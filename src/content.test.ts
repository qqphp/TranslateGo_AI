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
    const handler = addListener.mock.calls[0][0] as (message: { kind: string; mode: string; maxRequests: number }) => void;
    handler({ kind: "preparePage", mode: "replace", maxRequests: 200 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "startPage", nodes: [expect.objectContaining({ text: "Visible page text" })] })));
  });

  it("updates progress after each translated or failed node", async () => {
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", mode: "replace", maxRequests: 200 });
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
    const paragraph = document.querySelector("p")!;
    paragraph.style.color = "rgb(12, 34, 56)"; paragraph.style.fontFamily = "Georgia"; paragraph.style.fontSize = "19px"; paragraph.style.fontStyle = "normal"; paragraph.style.fontWeight = "700"; paragraph.style.lineHeight = "28px";
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", mode: "preserve", maxRequests: 200 });
    handler({ kind: "taskStarted", taskId: "task-2", total: 1, mode: "preserve" });
    handler({ kind: "nodeResult", taskId: "task-2", nodeId: "node-0", text: "保留译文" });
    handler({ kind: "nodeResult", taskId: "task-2", nodeId: "node-0", text: "更新译文" });
    expect(document.querySelectorAll('[data-llm-web-translator="translation"]')).toHaveLength(1);
    const translation = document.querySelector<HTMLElement>('[data-llm-web-translator="translation"]')!;
    expect(translation.textContent).toBe("更新译文");
    expect(translation.parentElement?.tagName).toBe("P");
    expect(translation.style.color).toBe("rgb(12, 34, 56)");
    expect(translation.style.fontFamily).toBe("Georgia");
    expect(translation.style.fontSize).toBe("19px");
    expect(translation.style.fontStyle).toBe("normal");
    expect(translation.style.fontWeight).toBe("700");
    expect(translation.style.lineHeight).toBe("28px");
    handler({ kind: "restorePage" });
    expect(document.querySelector('[data-llm-web-translator="translation"]')).toBeNull();
    expect(document.querySelector("p")?.textContent).toBe("Visible page text");
  });

  it("treats a styled paragraph as one bilingual segment and places its translation below the original", async () => {
    document.body.innerHTML = "<p>Hello <strong>important</strong> world.</p>";
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;

    handler({ kind: "preparePage", mode: "preserve", maxRequests: 200 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      kind: "startPage",
      nodes: [{ id: "node-0", text: "Hello important world." }]
    })));

    handler({ kind: "taskStarted", taskId: "task-bilingual", total: 1, mode: "preserve", taskType: "initial" });
    handler({ kind: "nodeResult", taskId: "task-bilingual", nodeId: "node-0", text: "你好，重要的世界。" });
    const translation = document.querySelector<HTMLElement>('p > [data-llm-web-translator="translation"]:last-child');
    expect(translation?.textContent).toBe("你好，重要的世界。");
    expect(translation?.style.display).toBe("block");
    expect(document.querySelector("p")?.textContent).toBe("Hello important world.你好，重要的世界。");
  });

  it("sends all 400 paragraph segments instead of truncating the page at 200", async () => {
    document.body.innerHTML = Array.from({ length: 400 }, (_, index) => `<p>Paragraph ${index}</p>`).join("");
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;

    handler({ kind: "preparePage", mode: "preserve", maxRequests: 200 });
    await vi.waitFor(() => {
      const start = sendMessage.mock.calls.find(([message]) => message.kind === "startPage" && message.nodes?.length === 400)?.[0];
      expect(start?.nodes).toHaveLength(400);
    }, { timeout: 2_000 });
  });

  it("skips code, form controls, buttons, and hidden text", async () => {
    document.body.innerHTML = '<article><p>Reader text</p><pre>const x = 1</pre><input value="Form text"><button>Button text</button><p style="display:none">Hidden text</p></article>';
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", mode: "replace", maxRequests: 200 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "startPage", nodes: [expect.objectContaining({ text: "Reader text" })] })));
    const start = sendMessage.mock.calls.find(([message]) => message.kind === "startPage" && message.nodes?.[0]?.text === "Reader text")?.[0];
    expect(start.nodes.map((node: { text: string }) => node.text.trim())).toEqual(["Reader text"]);
  });

  it("watches for dynamically loaded text and appends its translation", async () => {
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", mode: "replace", maxRequests: 200 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "startPage" })));
    handler({ kind: "taskStarted", taskId: "task-initial", total: 1, mode: "replace", taskType: "initial" });
    handler({ kind: "nodeResult", taskId: "task-initial", nodeId: "node-0", text: "Initial translation" });
    handler({ kind: "taskFinished", summary: { taskId: "task-initial", total: 1, succeeded: 1, failed: [], cancelled: false } });
    expect(document.querySelector(".llmwt-panel-message")?.textContent).toBe("Translation complete! 1 text segments translated (continuing to watch for new content)");

    const loaded = document.createElement("p"); loaded.textContent = "Dynamically loaded text"; document.body.append(loaded);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "appendPage", nodes: [expect.objectContaining({ text: "Dynamically loaded text" })] })), { timeout: 2000 });
    expect(document.querySelector(".llmwt-panel-message")?.textContent).toBe("New content found. Adding translation…");
    const append = sendMessage.mock.calls.find(([message]) => message.kind === "appendPage")?.[0];
    handler({ kind: "taskStarted", taskId: "task-append", total: 1, mode: "replace", taskType: "append" });
    expect(document.querySelector(".llmwt-panel-notice")?.textContent).toBe("New content found. Adding translation…");
    handler({ kind: "nodeResult", taskId: "task-append", nodeId: append.nodes[0].id, text: "Dynamic translation" });
    handler({ kind: "taskFinished", summary: { taskId: "task-append", total: 1, succeeded: 1, failed: [], cancelled: false } });
    expect(document.querySelector(".llmwt-panel-message")?.textContent).toBe("Translation complete! 2 text segments translated (continuing to watch for new content)");
    handler({ kind: "restorePage" });
  });

  it("shows the required cumulative completion message in Simplified Chinese", async () => {
    globalThis.chrome = { runtime: { onMessage: { addListener }, sendMessage, openOptionsPage: vi.fn() }, i18n: { getUILanguage: () => "zh-CN" } } as unknown as typeof chrome;
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    handler({ kind: "preparePage", mode: "replace", maxRequests: 200 });
    handler({ kind: "taskStarted", taskId: "task-zh", total: 62, mode: "replace", taskType: "initial" });
    handler({ kind: "taskFinished", summary: { taskId: "task-zh", total: 62, succeeded: 62, failed: [], cancelled: false } });
    expect(document.querySelector(".llmwt-panel-message")?.textContent).toBe("翻译完成！共翻译 62 段文本（将持续监听新内容）");
    handler({ kind: "restorePage" });
  });

  it("does not show a floating button and translates selection only from the context menu", async () => {
    Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 40, 20);
    await import("./content");
    const handler = addListener.mock.calls[0][0] as (message: unknown) => void;
    const range = document.createRange(); range.selectNodeContents(document.querySelector("p")!);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await Promise.resolve();
    expect(document.querySelector(".llmwt-float")).toBeNull();
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "translateSelection" }));
    handler({ kind: "translateSelectionFromMenu", text: "Visible page text" });
    const start = sendMessage.mock.calls.find(([message]) => message.kind === "translateSelection")?.[0];
    expect(start).toMatchObject({ kind: "translateSelection", text: "Visible page text", requestId: expect.any(String) });
    (document.querySelector(".llmwt-popover button") as HTMLButtonElement).click();
    expect(sendMessage).toHaveBeenCalledWith({ kind: "cancelSelection", requestId: start.requestId });
  });
});
