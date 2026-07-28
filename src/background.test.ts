import { beforeEach, describe, expect, it, vi } from "vitest";

const translateBatch = vi.fn();
const getActiveProfile = vi.fn();
vi.mock("./shared/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./shared/api")>()), translateBatch }));
vi.mock("./shared/storage", async (importOriginal) => ({ ...(await importOriginal<typeof import("./shared/storage")>()), getActiveProfile }));

describe("background task routing", () => {
  const runtimeListener = vi.fn();
  const installedListener = vi.fn();
  const contextClickListener = vi.fn();
  const createMenu = vi.fn();
  const sendMessage = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    getActiveProfile.mockResolvedValue({ id: "profile", name: "Test", baseUrl: "https://api.example/v1", apiKey: "key", model: "model", sourceLanguage: "auto", targetLanguage: "zh-CN", mode: "replace" });
    translateBatch.mockImplementation(async (_profile, nodes: Array<{ id: string }>) => new Map(nodes.map((node) => [node.id, "译文"])));
    globalThis.chrome = {
      runtime: { onInstalled: { addListener: installedListener }, onMessage: { addListener: runtimeListener }, openOptionsPage: vi.fn() },
      contextMenus: { create: createMenu, onClicked: { addListener: contextClickListener } },
      action: { onClicked: { addListener: vi.fn() }, setBadgeBackgroundColor: vi.fn(), setBadgeText: vi.fn(), setTitle: vi.fn() },
      tabs: { sendMessage, query: vi.fn(async () => []), onRemoved: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() } },
      i18n: { getMessage: vi.fn() }
    } as unknown as typeof chrome;
  });

  it("runs appendPage through the existing page task pipeline", async () => {
    await import("./background");
    const handler = runtimeListener.mock.calls[0][0] as (message: unknown, sender: unknown, respond: () => void) => boolean;
    const respond = vi.fn();
    expect(handler({ kind: "appendPage", nodes: [{ id: "node-dynamic", text: "Loaded later" }] }, { tab: { id: 7 } }, respond)).toBe(true);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "taskStarted", taskType: "append", total: 1 })));
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "nodeResult", nodeId: "node-dynamic", text: "译文" })));
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "taskFinished", summary: expect.objectContaining({ succeeded: 1, total: 1 }) })));
    expect(respond).toHaveBeenCalledOnce();
  });

  it("translates 400 page segments without exceeding 50 provider calls", async () => {
    await import("./background");
    const handler = runtimeListener.mock.calls[0][0] as (message: unknown, sender: unknown, respond: () => void) => boolean;
    const nodes = Array.from({ length: 400 }, (_, index) => ({ id: `node-${index}`, text: `Segment ${index}` }));

    expect(handler({ kind: "startPage", nodes }, { tab: { id: 7 } }, vi.fn())).toBe(true);

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, {
      kind: "taskFinished",
      summary: expect.objectContaining({ total: 400, succeeded: 400, failed: [] })
    }), { timeout: 2_000 });
    expect(translateBatch).toHaveBeenCalledTimes(40);
  });

  it("renders a completed batch without waiting for an earlier slow batch", async () => {
    let resolveFirst!: (value: Map<string, string>) => void;
    translateBatch
      .mockImplementationOnce(async () => new Promise<Map<string, string>>((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async (_profile, nodes: Array<{ id: string }>) => new Map(nodes.map((node) => [node.id, "fast"])));
    await import("./background");
    const handler = runtimeListener.mock.calls[0][0] as (message: unknown, sender: unknown, respond: () => void) => boolean;
    const nodes = Array.from({ length: 20 }, (_, index) => ({ id: `node-${index}`, text: `Segment ${index}` }));

    handler({ kind: "startPage", nodes }, { tab: { id: 7 } }, vi.fn());
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "nodeResult", nodeId: "node-10" })));
    expect(sendMessage).not.toHaveBeenCalledWith(7, expect.objectContaining({ kind: "nodeResult", nodeId: "node-0" }));

    resolveFirst(new Map(nodes.slice(0, 10).map((node) => [node.id, "slow"])));
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "taskFinished" })));
  });

  it("prepares page translation with the active bilingual mode", async () => {
    getActiveProfile.mockResolvedValue({ id: "profile", name: "Test", baseUrl: "https://api.example/v1", apiKey: "key", model: "model", sourceLanguage: "auto", targetLanguage: "zh-CN", mode: "preserve" });
    await import("./background");
    const onClicked = contextClickListener.mock.calls[0][0] as (info: unknown, tab: unknown) => void;
    onClicked({ menuItemId: "translate-page" }, { id: 7, url: "https://example.com" });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, { kind: "preparePage", mode: "preserve", maxRequests: 200 }));
  });

  it("registers and routes the selected-text context menu command", async () => {
    await import("./background");
    const onInstalled = installedListener.mock.calls[0][0] as () => void;
    onInstalled();
    expect(createMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "translate-selection", contexts: ["selection"] }));
    const onClicked = contextClickListener.mock.calls[0][0] as (info: unknown, tab: unknown) => void;
    onClicked({ menuItemId: "translate-selection", selectionText: "  Selected text  " }, { id: 7, url: "https://example.com" });
    expect(sendMessage).toHaveBeenCalledWith(7, { kind: "translateSelectionFromMenu", text: "Selected text" });
  });
});
