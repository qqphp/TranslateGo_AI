import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanTranslation, parseBatchOutput, translate, translateBatch } from "./api";
import type { Profile } from "./types";

const profile: Profile = { id: "p", name: "Test", baseUrl: "https://api.example.com/v1", apiKey: "secret", model: "demo", sourceLanguage: "English", targetLanguage: "Chinese", mode: "replace" };
afterEach(() => vi.unstubAllGlobals());

describe("cleanTranslation", () => {
  it("removes common wrappers without changing translated prose", () => {
    expect(cleanTranslation('"Translation: Hello world"')).toBe("Hello world");
    expect(cleanTranslation("```text\n你好\n``` ")).toBe("你好");
  });
});

describe("parseBatchOutput", () => {
  it("keeps translations aligned to their source node IDs", () => {
    const result = parseBatchOutput('[{"id":"a","translation":"你好"},{"id":"b","translation":"世界"}]', [{ id: "a", text: "Hello" }, { id: "b", text: "World" }]);
    expect(result.get("a")).toBe("你好");
    expect(result.get("b")).toBe("世界");
  });
  it("rejects malformed or incomplete model output", () => {
    expect(() => parseBatchOutput("not json", [{ id: "a", text: "Hello" }])).toThrow(/invalid batch/);
    expect(() => parseBatchOutput('[]', [{ id: "a", text: "Hello" }])).toThrow(/incomplete/);
  });
});

describe("Chat Completions client", () => {
  it("uses the compact plain-text protocol for a single page node", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await translateBatch(profile, [{ id: "node-0", text: "Hello" }]);
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(result.get("node-0")).toBe("你好");
    expect(request.messages).toHaveLength(2);
    expect(request.messages.map((message: { content: string }) => message.content).join("\n")).not.toContain("JSON");
    expect(JSON.stringify(request).length).toBeLessThan(400);
  });

  it("uses a non-streaming request and parses the assistant message", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(translate(profile, "Hello")).resolves.toBe("你好");
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(request).toMatchObject({ model: "demo", stream: false });
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer secret" });
  });

  it("asks the model to detect an automatic source language", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: "Hello" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await translate({ ...profile, sourceLanguage: "auto" }, "Bonjour");
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(request.messages[1].content).toContain("Source: auto-detect");
  });

  it("returns safe errors without exposing the API key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied secret", { status: 401 })));
    await expect(translate(profile, "Hello")).rejects.toThrow("API request failed (401)");
    await expect(translate(profile, "Hello")).rejects.not.toThrow("secret");
  });
});
