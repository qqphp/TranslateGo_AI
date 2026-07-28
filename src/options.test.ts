import { beforeEach, describe, expect, it, vi } from "vitest";

const translate = vi.fn();
vi.mock("./shared/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./shared/api")>()), translate }));

describe("profile connection test", () => {
  const stored: Record<string, unknown> = {};
  const set = vi.fn(async (value: Record<string, unknown>) => Object.assign(stored, value));
  const sendMessage = vi.fn(async () => undefined);
  const writeText = vi.fn(async () => undefined);

  async function openSettings() {
    await vi.waitFor(() => expect(document.querySelector("#settings-tab")).not.toBeNull());
    (document.querySelector("#settings-tab") as HTMLButtonElement).click();
  }

  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    Object.keys(stored).forEach((key) => delete stored[key]);
    document.body.innerHTML = '<main id="app"></main>';
    globalThis.chrome = { storage: { local: { get: vi.fn(async () => stored), set } }, runtime: { sendMessage } } as unknown as typeof chrome;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    translate.mockResolvedValue("Hello");
  });

  it("adds Translation before Settings and disables translation until a model is configured", async () => {
    await import("./options");
    await vi.waitFor(() => expect(document.querySelector("#translate-tab")).not.toBeNull());
    expect(Array.from(document.querySelectorAll(".tab"), (tab) => tab.id)).toEqual(["translate-tab", "settings-tab", "about-tab"]);
    expect((document.querySelector("#translate-tab") as HTMLButtonElement).getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector(".translator-page")).not.toBeNull();
    expect((document.querySelector("#translation-input") as HTMLTextAreaElement).placeholder).toBe("Enter text to translate");
    expect((document.querySelector("#translate-text") as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector(".model-required")?.textContent).toContain("Configure and activate a model");
  });

  it("translates text, shows character count, saves history, copies, and retranslates", async () => {
    stored.settings = { activeProfileId: "one", profiles: [
      { id: "one", name: "One", baseUrl: "https://one.example/v1", apiKey: "1", model: "m1", sourceLanguage: "en", targetLanguage: "zh-CN", mode: "replace" }
    ] };
    translate.mockResolvedValue("你好");
    await import("./options");
    await vi.waitFor(() => expect(document.querySelector("#translate-tab")).not.toBeNull());
    (document.querySelector("#translate-tab") as HTMLButtonElement).click();
    const input = document.querySelector<HTMLTextAreaElement>("#translation-input")!;
    input.value = "Hello"; input.dispatchEvent(new Event("input"));
    expect(document.querySelector(".character-count")?.textContent).toContain("5");
    (document.querySelector("#translate-text") as HTMLButtonElement).click();

    await vi.waitFor(() => expect(document.querySelector(".translation-output")?.textContent).toContain("你好"));
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: "en", targetLanguage: "zh-CN" }), "Hello");
    expect((stored.settings as { translationHistory: unknown[] }).translationHistory).toHaveLength(1);
    expect(document.querySelectorAll(".history-card")).toHaveLength(1);

    (document.querySelector("#copy-result") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("你好"));
    (document.querySelector("#retranslate-result") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(document.querySelectorAll(".history-card")).toHaveLength(2));
    (document.querySelector('[data-history-action="copy"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    (document.querySelector('[data-history-action="retranslate"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(3));
    (document.querySelector("#clear-translation") as HTMLButtonElement).click();
    expect((document.querySelector("#translation-input") as HTMLTextAreaElement).value).toBe("");
    expect(document.querySelector(".character-count")?.textContent).toContain("0");
  });

  it("persists and activates a profile after a successful connection test", async () => {
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector("#test")).not.toBeNull());
    const form = document.querySelector<HTMLFormElement>("#profile-form")!;
    (form.elements.namedItem("name") as HTMLInputElement).value = "My API";
    (form.elements.namedItem("baseUrl") as HTMLInputElement).value = "https://api.example.com/v1";
    (form.elements.namedItem("apiKey") as HTMLInputElement).value = "secret";
    (form.elements.namedItem("model") as HTMLInputElement).value = "demo";
    (document.querySelector("#test") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(set).toHaveBeenCalledOnce());
    expect(stored.settings).toMatchObject({ activeProfileId: expect.any(String), profiles: [expect.objectContaining({ name: "My API" })] });
    expect(sendMessage).toHaveBeenCalledWith({ kind: "profilesChanged" });
  });

  it("switches the active profile with one click", async () => {
    stored.settings = { activeProfileId: "one", profiles: [
      { id: "one", name: "One", baseUrl: "https://one.example/v1", apiKey: "1", model: "m1", sourceLanguage: "English", targetLanguage: "Chinese", mode: "replace" },
      { id: "two", name: "Two", baseUrl: "https://two.example/v1", apiKey: "2", model: "m2", sourceLanguage: "English", targetLanguage: "Japanese", mode: "preserve" }
    ] };
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelectorAll(".profile")).toHaveLength(2));
    (document.querySelectorAll<HTMLButtonElement>(".profile")[1]).click();
    await vi.waitFor(() => {
      expect((stored.settings as { activeProfileId: string }).activeProfileId).toBe("two");
      expect(sendMessage).toHaveBeenCalledWith({ kind: "profilesChanged" });
    });
  });

  it("persists an explicit settings-page language and rerenders immediately", async () => {
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector("#ui-locale")).not.toBeNull());
    const selector = document.querySelector<HTMLSelectElement>("#ui-locale")!;
    selector.value = "zh-CN"; selector.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect((stored.settings as { uiLocale: string }).uiLocale).toBe("zh-CN");
      expect(document.title).toBe("AI大模型-沉浸式翻译-免费-极简");
      expect(document.querySelector(".locale")?.textContent).toContain("界面语言");
    });
  });

  it("offers auto detection only for the source language", async () => {
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector("#sourceLang")).not.toBeNull());
    const sourceValues = Array.from(document.querySelectorAll<HTMLOptionElement>("#sourceLang option"), (option) => option.value);
    const targetValues = Array.from(document.querySelectorAll<HTMLOptionElement>("#targetLang option"), (option) => option.value);
    expect(sourceValues).toHaveLength(18); expect(sourceValues[0]).toBe("auto");
    expect(targetValues).toHaveLength(17); expect(targetValues).not.toContain("auto");
  });

  it("offers every target language for the interface and keeps the fixed language subtitle", async () => {
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector("#ui-locale")).not.toBeNull());
    const values = Array.from(document.querySelectorAll<HTMLOptionElement>("#ui-locale option"), (option) => option.value);
    expect(values).toHaveLength(18);
    expect(values.slice(1)).toEqual(["zh-CN", "zh-TW", "en", "ja", "ko", "fr", "de", "es", "pt", "ru", "ar", "it", "th", "vi", "id", "hi", "tr"]);
    expect(document.querySelector(".locale-copy strong")?.textContent).toBe("Interface language");
    expect(document.querySelector(".locale-copy small")?.textContent).toBe("language");
    const selector = document.querySelector<HTMLSelectElement>("#ui-locale")!;
    selector.value = "ar"; selector.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(document.querySelector(".locale-copy strong")?.textContent).toBe("لغة الواجهة");
    expect(document.querySelector(".locale-copy small")?.textContent).toBe("language");
  });

  it("shows an icon on every settings-page button and provides the about tab", async () => {
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector("#about-tab")).not.toBeNull());
    expect(Array.from(document.querySelectorAll("button")).every((button) => button.querySelector("svg"))).toBe(true);
    (document.querySelector("#about-tab") as HTMLButtonElement).click();
    expect(document.querySelector(".about")?.textContent).toContain("All-in-one AI translation");
    expect(document.querySelector(".about")?.textContent).toContain("Built only for translation");
    expect(Array.from(document.querySelectorAll("button")).every((button) => button.querySelector("svg"))).toBe(true);
  });

  it("renders profile name, model, and language on separate rows", async () => {
    stored.settings = { activeProfileId: "one", profiles: [
      { id: "one", name: "One", baseUrl: "https://one.example/v1", apiKey: "1", model: "m1", sourceLanguage: "en", targetLanguage: "zh-CN", mode: "replace" }
    ] };
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector(".profile")).not.toBeNull());
    expect(document.querySelectorAll(".profile-name-row")).toHaveLength(1);
    expect(document.querySelectorAll(".profile-detail")).toHaveLength(2);
    expect(document.querySelector(".profile")?.textContent).toContain("m1");
    expect(document.querySelector(".profile")?.textContent).toContain("English → Simplified Chinese");
  });

  it("keeps three profile actions on one row and confirms before deleting", async () => {
    stored.settings = { activeProfileId: "one", profiles: [
      { id: "one", name: "One", baseUrl: "https://one.example/v1", apiKey: "1", model: "m1", sourceLanguage: "English", targetLanguage: "Chinese", mode: "replace" }
    ] };
    await import("./options");
    await openSettings();
    await vi.waitFor(() => expect(document.querySelector(".profile")).not.toBeNull());
    (document.querySelector(".profile") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll(".form-actions .button")).toHaveLength(3));
    (document.querySelector("#delete") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector(".settings-dialog")).not.toBeNull());
    expect((stored.settings as { profiles: unknown[] }).profiles).toHaveLength(1);
    (document.querySelector(".dialog-confirm") as HTMLButtonElement).click();
    await vi.waitFor(() => expect((stored.settings as { profiles: unknown[] }).profiles).toHaveLength(0));
    expect(document.querySelector(".settings-dialog")?.textContent).toContain("Profile deleted");
  });
});
