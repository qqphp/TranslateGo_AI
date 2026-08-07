import type { Profile } from "./types";

const CACHE_PROTOCOL_VERSION = 1;

export function translationCacheKey(profile: Profile, text: string): string {
  return JSON.stringify([
    CACHE_PROTOCOL_VERSION,
    profile.baseUrl.replace(/\/$/, ""),
    profile.model,
    profile.sourceLanguage,
    profile.targetLanguage,
    text
  ]);
}

export class TranslationCache {
  private readonly entries = new Map<string, string>();

  constructor(private readonly maxEntries = 1_000) {}

  get(key: string): string | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
