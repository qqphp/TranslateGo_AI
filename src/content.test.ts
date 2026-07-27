import { beforeEach, describe, expect, it, vi } from "vitest";

describe("page translation entry", () => {
  const sendMessage = vi.fn();
  const addListener = vi.fn();

  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    document.body.innerHTML = "<p>Visible page text</p>";
    Object.defineProperty(HTMLElement.prototype, "getClientRects", { configurable: true, value: () => [{ width: 100, height: 20 }] });
    globalThis.chrome = { runtime: { onMessage: { addListener }, sendMessage, openOptionsPage: vi.fn() } } as unknown as typeof chrome;
  });

  it("starts a page task after the right-click command while showing the request count", async () => {
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: { kind: string; maxNodes: number; maxRequests: number }) => void;
    handler({ kind: "preparePage", maxNodes: 600, maxRequests: 200 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "startPage", nodes: [expect.objectContaining({ text: "Visible page text" })] })));
  });

  it("updates progress after each translated or failed node", async () => {
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", maxNodes: 600, maxRequests: 200 });
    handler({ kind: "taskStarted", taskId: "task-1", total: 2, mode: "replace" });
    handler({ kind: "nodeResult", taskId: "task-1", nodeId: "node-0", text: "译文" });
    expect(document.querySelector(".llmwt-panel")?.textContent).toContain("1/2");
    handler({ kind: "nodeFailed", taskId: "task-1", node: { id: "node-1", text: "bad" }, error: "failed" });
    expect(document.querySelector(".llmwt-panel")?.textContent).toContain("2/2 (failed: 1)");
  });
});
