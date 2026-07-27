import { beforeEach, describe, expect, it, vi } from "vitest";

const translate = vi.fn();
vi.mock("./shared/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./shared/api")>()), translate }));

describe("profile connection test", () => {
  const stored: Record<string, unknown> = {};
  const set = vi.fn(async (value: Record<string, unknown>) => Object.assign(stored, value));
  const sendMessage = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    Object.keys(stored).forEach((key) => delete stored[key]);
    document.body.innerHTML = '<main id="app"></main>';
    globalThis.chrome = { storage: { local: { get: vi.fn(async () => stored), set } }, runtime: { sendMessage } } as unknown as typeof chrome;
    translate.mockResolvedValue("Hello");
  });

  it("persists and activates a profile after a successful connection test", async () => {
    await import("./options");
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
    await vi.waitFor(() => expect(document.querySelectorAll(".profile")).toHaveLength(2));
    (document.querySelectorAll<HTMLButtonElement>(".profile")[1]).click();
    await vi.waitFor(() => {
      expect((stored.settings as { activeProfileId: string }).activeProfileId).toBe("two");
      expect(sendMessage).toHaveBeenCalledWith({ kind: "profilesChanged" });
    });
  });

  it("persists an explicit settings-page language and rerenders immediately", async () => {
    await import("./options");
    await vi.waitFor(() => expect(document.querySelector("#ui-locale")).not.toBeNull());
    const selector = document.querySelector<HTMLSelectElement>("#ui-locale")!;
    selector.value = "zh-CN"; selector.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect((stored.settings as { uiLocale: string }).uiLocale).toBe("zh-CN");
      expect(document.title).toBe("大模型网页翻译");
    });
    expect(document.querySelector(".locale")?.textContent).toContain("界面语言");
  });

  it("keeps three profile actions on one row and confirms before deleting", async () => {
    stored.settings = { activeProfileId: "one", profiles: [
      { id: "one", name: "One", baseUrl: "https://one.example/v1", apiKey: "1", model: "m1", sourceLanguage: "English", targetLanguage: "Chinese", mode: "replace" }
    ] };
    await import("./options");
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
