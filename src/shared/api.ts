import type { PageNode, Profile } from "./types";

export const SYSTEM_PROMPT = "Translate the text. Return only the translation, without quotes, labels, notes, or Markdown.";

export class TranslationError extends Error {
  constructor(message: string, readonly status?: number, readonly retryAfterMs?: number) { super(message); }
}
const REQUEST_TIMEOUT_MS = 60_000;
type ChatMessage = { role: "system" | "user"; content: string };

const translationMessages = (profile: Profile, text: string): ChatMessage[] => [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: `Source: ${profile.sourceLanguage === "auto" ? "auto-detect" : profile.sourceLanguage}\nTarget: ${profile.targetLanguage}\n\n${text}` }
];

function chatRequestBody(profile: Profile, messages: ChatMessage[], stream: boolean): Record<string, unknown> {
  return { model: profile.model, stream, thinking: { type: "disabled" }, messages };
}

export function cleanTranslation(value: string): string {
  return value.trim()
    .replace(/^```(?:text|markdown)?\s*/i, "").replace(/```$/i, "").trim()
    .replace(/^["“”']|["“”']$/g, "").trim()
    .replace(/^(?:translation|译文)\s*[:：]\s*/i, "").trim();
}

async function chat(profile: Profile, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const base = profile.baseUrl.endsWith("/") ? profile.baseUrl : `${profile.baseUrl}/`;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("chat/completions", base), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.apiKey}` },
      body: JSON.stringify(chatRequestBody(profile, messages, false))
    });
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterMs = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1_000 : undefined;
      throw new TranslationError(`API request failed (${response.status}). Check your profile and API service.`, response.status, retryAfterMs);
    }
    let body: unknown;
    try { body = await response.json(); } catch { throw new TranslationError("API returned an invalid JSON response."); }
    const content = (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new TranslationError("API returned an empty translation.");
    return content;
  } catch (error) {
    if (timedOut) throw new TranslationError("API request timed out after 60 seconds.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function translate(profile: Profile, text: string, signal?: AbortSignal): Promise<string> {
  return cleanTranslation(await chat(profile, translationMessages(profile, text), signal));
}

export async function translateStreaming(profile: Profile, text: string, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const base = profile.baseUrl.endsWith("/") ? profile.baseUrl : `${profile.baseUrl}/`;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("chat/completions", base), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.apiKey}` },
      body: JSON.stringify(chatRequestBody(profile, translationMessages(profile, text), true))
    });
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterMs = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1_000 : undefined;
      throw new TranslationError(`API request failed (${response.status}). Check your profile and API service.`, response.status, retryAfterMs);
    }
    if (response.headers.get("Content-Type")?.includes("application/json")) {
      const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !cleanTranslation(content)) throw new TranslationError("API returned an empty translation.");
      const cleaned = cleanTranslation(content);
      onText(cleaned);
      return cleaned;
    }
    if (!response.body) throw new TranslationError("API returned an empty streaming response.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";
    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") return;
      let event: unknown;
      try { event = JSON.parse(data); } catch { throw new TranslationError("API returned an invalid streaming response."); }
      const delta = (event as { choices?: Array<{ delta?: { content?: unknown } }> }).choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        output += delta;
        onText(output.trimStart());
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    if (buffer) consumeLine(buffer);
    const cleaned = cleanTranslation(output);
    if (!cleaned) throw new TranslationError("API returned an empty translation.");
    return cleaned;
  } catch (error) {
    if (timedOut) throw new TranslationError("API request timed out after 60 seconds.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function parseBatchOutput(output: string, expected: PageNode[]): Map<string, string> {
  const candidate = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let rows: unknown;
  try { rows = JSON.parse(candidate); } catch { throw new TranslationError("API returned an invalid batch translation response."); }
  if (!Array.isArray(rows)) throw new TranslationError("API returned an invalid batch translation response.");
  const expectedIds = new Set(expected.map((node) => node.id));
  const result = new Map<string, string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = (row as { id?: unknown }).id;
    const text = (row as { translation?: unknown }).translation;
    if (typeof id === "string" && expectedIds.has(id) && typeof text === "string" && cleanTranslation(text)) result.set(id, cleanTranslation(text));
  }
  if (result.size !== expected.length) throw new TranslationError("API returned incomplete batch translations.");
  return result;
}

export async function translateBatch(profile: Profile, nodes: PageNode[], signal?: AbortSignal): Promise<Map<string, string>> {
  if (nodes.length === 0) return new Map();
  if (nodes.length === 1) {
    const node = nodes[0];
    return new Map([[node.id, await translate(profile, node.text, signal)]]);
  }
  const output = await chat(profile, [
    { role: "system", content: "You are a translation engine. Translate every item from the requested source language to the requested target language. Return only a valid JSON array. Each item must be exactly {\"id\": string, \"translation\": string}; preserve every supplied id exactly; provide plain translations only, with no explanations or Markdown." },
    { role: "user", content: `${profile.sourceLanguage === "auto" ? "Detect the source language of each item automatically." : `Source language: ${profile.sourceLanguage}`}\nTarget language: ${profile.targetLanguage}\nItems:\n${JSON.stringify(nodes)}` }
  ], signal);
  return parseBatchOutput(output, nodes);
}
