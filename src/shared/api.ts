import type { PageNode, Profile } from "./types";

export const SYSTEM_PROMPT = "You are a translation engine. Translate from the requested source language to the requested target language. Return only the plain translation: no explanation, quotation marks, Markdown, labels, or notes.";

export class TranslationError extends Error {}
const REQUEST_TIMEOUT_MS = 60_000;

export function cleanTranslation(value: string): string {
  return value.trim()
    .replace(/^```(?:text|markdown)?\s*/i, "").replace(/```$/i, "").trim()
    .replace(/^["“”']|["“”']$/g, "").trim()
    .replace(/^(?:translation|译文)\s*[:：]\s*/i, "").trim();
}

async function chat(profile: Profile, messages: Array<{ role: "system" | "user"; content: string }>, signal?: AbortSignal): Promise<string> {
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
      body: JSON.stringify({ model: profile.model, stream: false, messages })
    });
    if (!response.ok) throw new TranslationError(`API request failed (${response.status}). Check your profile and API service.`);
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
  return cleanTranslation(await chat(profile, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${profile.sourceLanguage === "auto" ? "Detect the source language automatically." : `Source language: ${profile.sourceLanguage}`}\nTarget language: ${profile.targetLanguage}\nText:\n${text}` }
  ], signal));
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
  const output = await chat(profile, [
    { role: "system", content: "You are a translation engine. Translate every item from the requested source language to the requested target language. Return only a valid JSON array. Each item must be exactly {\"id\": string, \"translation\": string}; preserve every supplied id exactly; provide plain translations only, with no explanations or Markdown." },
    { role: "user", content: `${profile.sourceLanguage === "auto" ? "Detect the source language of each item automatically." : `Source language: ${profile.sourceLanguage}`}\nTarget language: ${profile.targetLanguage}\nItems:\n${JSON.stringify(nodes)}` }
  ], signal);
  return parseBatchOutput(output, nodes);
}
