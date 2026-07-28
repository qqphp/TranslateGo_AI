import type { Settings, TranslationHistoryEntry } from "./types";

export const TRANSLATION_HISTORY_LIMIT = 30;

function isHistoryEntry(value: unknown): value is TranslationHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<TranslationHistoryEntry>;
  return typeof entry.id === "string" && typeof entry.sourceText === "string" && typeof entry.translatedText === "string"
    && typeof entry.sourceLanguage === "string" && typeof entry.targetLanguage === "string" && typeof entry.createdAt === "number";
}

export function getTranslationHistory(settings: Settings): TranslationHistoryEntry[] {
  if (!Array.isArray(settings.translationHistory)) return [];
  return settings.translationHistory.filter(isHistoryEntry).slice(0, TRANSLATION_HISTORY_LIMIT);
}

export function addTranslationHistory(settings: Settings, entry: TranslationHistoryEntry): Settings {
  const history = getTranslationHistory(settings).filter((item) => item.id !== entry.id);
  return { ...settings, translationHistory: [entry, ...history].slice(0, TRANSLATION_HISTORY_LIMIT) };
}
