import { describe, expect, it } from "vitest";
import { getLocale } from "./i18n";

describe("UI locale selection", () => {
  it("supports Simplified Chinese, Traditional Chinese, English, and Japanese", () => {
    expect(getLocale("zh-CN")).toBe("zh-CN");
    expect(getLocale("zh-HK")).toBe("zh-TW");
    expect(getLocale("en-US")).toBe("en");
    expect(getLocale("ja-JP")).toBe("ja");
  });

  it("falls back to English", () => expect(getLocale("fr-FR")).toBe("en"));
});
