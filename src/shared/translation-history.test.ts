import { describe, expect, it } from "vitest";
import { addTranslationHistory, getTranslationHistory, TRANSLATION_HISTORY_LIMIT } from "./translation-history";
import type { Settings, TranslationHistoryEntry } from "./types";

const settings: Settings = { profiles: [], activeProfileId: null };
const entry = (index: number): TranslationHistoryEntry => ({
  id: `entry-${index}`, sourceText: `source ${index}`, translatedText: `translation ${index}`,
  sourceLanguage: "en", targetLanguage: "zh-CN", createdAt: index
});

describe("translation history", () => {
  it("keeps the newest 30 successful translations", () => {
    let current = settings;
    for (let index = 0; index < 35; index += 1) current = addTranslationHistory(current, entry(index));
    const history = getTranslationHistory(current);
    expect(history).toHaveLength(TRANSLATION_HISTORY_LIMIT);
    expect(history[0].id).toBe("entry-34");
    expect(history.at(-1)?.id).toBe("entry-5");
  });

  it("ignores malformed persisted entries and de-duplicates IDs", () => {
    const first = addTranslationHistory({ ...settings, translationHistory: [entry(1), null as unknown as TranslationHistoryEntry] }, entry(2));
    const second = addTranslationHistory(first, { ...entry(2), translatedText: "updated" });
    expect(getTranslationHistory(second).map((item) => [item.id, item.translatedText])).toEqual([["entry-2", "updated"], ["entry-1", "translation 1"]]);
  });
});
