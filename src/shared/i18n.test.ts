import { describe, expect, it } from "vitest";
import { getLocale, setLocale, t } from "./i18n";
import { LANGUAGE_OPTIONS } from "./languages";

describe("UI locale selection", () => {
  it("supports every target language as an interface language", () => {
    expect(getLocale("zh-CN")).toBe("zh-CN");
    expect(getLocale("zh-HK")).toBe("zh-TW");
    expect(getLocale("en-US")).toBe("en");
    expect(getLocale("ja-JP")).toBe("ja");
    for (const language of LANGUAGE_OPTIONS) expect(getLocale(`${language.value}-test`)).toBe(language.value);
  });

  it("falls back to English", () => expect(getLocale("nl-NL")).toBe("en"));
  it("supports an explicit settings-page override", () => {
    setLocale("ja"); expect(t("title")).toBe("AI大模型-沉浸式翻译-免费-极简");
    setLocale("zh-CN"); expect(t("uiLanguage")).toBe("界面语言");
    setLocale("fr"); expect(t("uiLanguage")).toBe("Langue de l’interface");
    setLocale(null);
  });
});
