import { beforeEach, describe, expect, it, vi } from "vitest";

describe("page translation entry", () => {
  const sendMessage = vi.fn();
  const addListener = vi.fn();

  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    document.body.innerHTML = "<p>Visible page text</p>";
    Object.defineProperty(HTMLElement.prototype, "getClientRects", { configurable: true, value: () => [{ width: 100, height: 20 }] });
    globalThis.chrome = { runtime: { onMessage: { addListener }, sendMessage, openOptionsPage: vi.fn() }, i18n: { getUILanguage: () => "en" } } as unknown as typeof chrome;
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
    expect(document.querySelector(".llmwt-progress-percent")?.textContent).toBe("0%");
    expect(document.querySelectorAll(".llmwt-panel-actions .llmwt-action")).toHaveLength(2);
    expect(document.querySelector(".llmwt-danger")?.textContent).toBe("Cancel");
    expect(Array.from(document.querySelectorAll(".llmwt-panel-actions button")).every((button) => button.querySelector("svg"))).toBe(true);
    handler({ kind: "nodeResult", taskId: "task-1", nodeId: "node-0", text: "译文" });
    expect(document.querySelector(".llmwt-panel")?.textContent).toContain("1/2");
    expect(document.querySelector(".llmwt-progress-percent")?.textContent).toBe("50%");
    expect((document.querySelector(".llmwt-progress-bar") as HTMLElement).style.width).toBe("50%");
    expect(document.querySelector(".llmwt-progress-bar")?.getAttribute("aria-valuenow")).toBe("50");
    handler({ kind: "nodeFailed", taskId: "task-1", node: { id: "node-1", text: "bad" }, error: "failed" });
    expect(document.querySelector(".llmwt-panel")?.textContent).toContain("2/2 (failed: 1)");
    expect(document.querySelector(".llmwt-progress-percent")?.textContent).toBe("100%");
  });

  it("inserts preserved translations and restores the original page", async () => {
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", maxNodes: 200, maxRequests: 200 });
    handler({ kind: "taskStarted", taskId: "task-2", total: 1, mode: "preserve" });
    handler({ kind: "nodeResult", taskId: "task-2", nodeId: "node-0", text: "保留译文" });
    handler({ kind: "nodeResult", taskId: "task-2", nodeId: "node-0", text: "更新译文" });
    expect(document.querySelectorAll('[data-llm-web-translator="translation"]')).toHaveLength(1);
    expect(document.querySelector('[data-llm-web-translator="translation"]')?.textContent).toBe("更新译文");
    handler({ kind: "restorePage" });
    expect(document.querySelector('[data-llm-web-translator="translation"]')).toBeNull();
    expect(document.querySelector("p")?.textContent).toBe("Visible page text");
  });

  it("skips code, form controls, buttons, and hidden text", async () => {
    document.body.innerHTML = '<article><p>Reader text</p><pre>const x = 1</pre><input value="Form text"><button>Button text</button><p style="display:none">Hidden text</p></article>';
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", maxNodes: 200, maxRequests: 200 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "startPage", nodes: [expect.objectContaining({ text: "Reader text" })] })));
    const start = sendMessage.mock.calls.find(([message]) => message.kind === "startPage" && message.nodes?.[0]?.text === "Reader text")?.[0];
    expect(start.nodes.map((node: { text: string }) => node.text.trim())).toEqual(["Reader text"]);
  });

  it("cancels a selection request when its bubble closes", async () => {
    Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 40, 20);
    await import("./content");
    const range = document.createRange(); range.selectNodeContents(document.querySelector("p")!);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector(".llmwt-float")).not.toBeNull());
    expect(document.querySelector(".llmwt-float svg")).not.toBeNull();
    (document.querySelector(".llmwt-float") as HTMLButtonElement).click();
    const start = sendMessage.mock.calls.find(([message]) => message.kind === "translateSelection")?.[0];
    expect(start).toMatchObject({ kind: "translateSelection", text: "Visible page text", requestId: expect.any(String) });
    (document.querySelector(".llmwt-popover button") as HTMLButtonElement).click();
    expect(sendMessage).toHaveBeenCalledWith({ kind: "cancelSelection", requestId: start.requestId });
  });
});
