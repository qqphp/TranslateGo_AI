import { describe, expect, it } from "vitest";
import { getLocale, setLocale, t } from "./i18n";

describe("UI locale selection", () => {
  it("supports Simplified Chinese, Traditional Chinese, English, and Japanese", () => {
    expect(getLocale("zh-CN")).toBe("zh-CN");
    expect(getLocale("zh-HK")).toBe("zh-TW");
    expect(getLocale("en-US")).toBe("en");
    expect(getLocale("ja-JP")).toBe("ja");
  });

  it("falls back to English", () => expect(getLocale("fr-FR")).toBe("en"));
  it("supports an explicit settings-page override", () => {
    setLocale("ja"); expect(t("title")).toBe("AI大模型-沉浸式翻译-免费-极简");
    setLocale("zh-CN"); expect(t("uiLanguage")).toBe("界面语言");
    setLocale(null);
  });
});
