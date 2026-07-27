import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS, normalizeLanguage } from "./languages";

describe("language options", () => {
  it("contains the 17 requested target languages and excludes auto", () => {
    expect(LANGUAGE_OPTIONS).toHaveLength(17);
    expect(LANGUAGE_OPTIONS.some((option) => option.value === "auto")).toBe(false);
  });
  it("migrates legacy saved language names", () => {
    expect(normalizeLanguage("English", "auto")).toBe("en");
    expect(normalizeLanguage("Chinese", "zh-CN")).toBe("zh-CN");
  });
});
