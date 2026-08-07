import { describe, expect, it } from "vitest";
import { TranslationCache, translationCacheKey } from "./translation-cache";
import type { Profile } from "./types";

const profile: Profile = { id: "p", name: "Test", baseUrl: "https://api.example/v1", apiKey: "secret", model: "fast", sourceLanguage: "en", targetLanguage: "zh-CN", mode: "replace" };

describe("translation cache", () => {
  it("does not include the API key and varies by translation semantics", () => {
    const key = translationCacheKey(profile, "Hello");
    expect(key).not.toContain("secret");
    expect(translationCacheKey({ ...profile, targetLanguage: "ja" }, "Hello")).not.toBe(key);
  });

  it("evicts the least recently used entry", () => {
    const cache = new TranslationCache(2);
    cache.set("a", "A"); cache.set("b", "B");
    expect(cache.get("a")).toBe("A");
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
  });
});
