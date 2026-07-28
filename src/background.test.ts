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
