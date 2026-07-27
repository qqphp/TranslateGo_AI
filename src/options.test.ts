import { beforeEach, describe, expect, it, vi } from "vitest";

const translate = vi.fn();
vi.mock("./shared/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./shared/api")>()), translate }));

describe("profile connection test", () => {
  const stored: Record<string, unknown> = {};
  const set = vi.fn(async (value: Record<string, unknown>) => Object.assign(stored, value));

  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    Object.keys(stored).forEach((key) => delete stored[key]);
    document.body.innerHTML = '<main id="app"></main>';
    globalThis.chrome = { storage: { local: { get: vi.fn(async () => stored), set } } } as unknown as typeof chrome;
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
  });
});
