export interface LanguageOption { value: string; displayCode: string; zhCN: string; }

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "zh-CN", displayCode: "zh-Hans", zhCN: "中文（简体）" },
  { value: "zh-TW", displayCode: "zh-Hant", zhCN: "中文（繁体）" },
  { value: "en", displayCode: "en", zhCN: "英语" },
  { value: "ja", displayCode: "ja", zhCN: "日语" },
  { value: "ko", displayCode: "ko", zhCN: "韩语" },
  { value: "fr", displayCode: "fr", zhCN: "法语" },
  { value: "de", displayCode: "de", zhCN: "德语" },
  { value: "es", displayCode: "es", zhCN: "西班牙语" },
  { value: "pt", displayCode: "pt", zhCN: "葡萄牙语" },
  { value: "ru", displayCode: "ru", zhCN: "俄语" },
  { value: "ar", displayCode: "ar", zhCN: "阿拉伯语" },
  { value: "it", displayCode: "it", zhCN: "意大利语" },
  { value: "th", displayCode: "th", zhCN: "泰语" },
  { value: "vi", displayCode: "vi", zhCN: "越南语" },
  { value: "id", displayCode: "id", zhCN: "印尼语" },
  { value: "hi", displayCode: "hi", zhCN: "印地语" },
  { value: "tr", displayCode: "tr", zhCN: "土耳其语" }
];

const legacyLanguageValues: Record<string, string> = {
  English: "en", Chinese: "zh-CN", "Simplified Chinese": "zh-CN", "Traditional Chinese": "zh-TW", Japanese: "ja", Korean: "ko",
  French: "fr", German: "de", Spanish: "es", Portuguese: "pt", Russian: "ru", Arabic: "ar", Italian: "it", Thai: "th", Vietnamese: "vi", Indonesian: "id", Hindi: "hi", Turkish: "tr"
};

export function normalizeLanguage(value: string, fallback: string): string {
  const normalized = legacyLanguageValues[value] ?? value;
  return normalized === "auto" || LANGUAGE_OPTIONS.some((option) => option.value === normalized) ? normalized : fallback;
}
