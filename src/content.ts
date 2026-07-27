import type { PageNode, RuntimeMessage, TaskSummary, TranslationMode } from "./shared/types";

const ATTR = "data-llm-web-translator";
let currentMode: TranslationMode = "replace";
let activeTaskId: string | null = null;
const nodeMap = new Map<string, Text>();
const originalText = new Map<Text, string>();
let floatingButton: HTMLButtonElement | null = null;
let popover: HTMLDivElement | null = null;
let progressPanel: HTMLDivElement | null = null;
let progressTotal = 0;
let progressProcessed = 0;
let progressFailed = 0;
let selectionRequestId: string | null = null;
let pageStartTimer: number | null = null;

const language = (chrome.i18n?.getUILanguage?.() || navigator.language).toLowerCase();
const locale = language.startsWith("zh-tw") || language.startsWith("zh-hk") ? "zh-TW" : language.startsWith("zh") ? "zh-CN" : language.startsWith("ja") ? "ja" : "en";
const pageMessages = {
  en: { translate: "Translate", translating: "Translating…", cancel: "Cancel", restore: "Restore original", openSettings: "Open settings", running: "Translation running", failed: "failed", complete: "completed", partial: "finished with failures", cancelled: "cancelled", retry: "Retry failed", nodes: "text nodes will be sent", requests: "requests", remaining: "nodes will not be sent", starting: "Starting translation…" },
  "zh-CN": { translate: "翻译", translating: "正在翻译…", cancel: "取消", restore: "恢复原文", openSettings: "打开设置", running: "正在翻译", failed: "失败", complete: "已完成", partial: "部分失败", cancelled: "已取消", retry: "重试失败项", nodes: "个文本节点将被发送", requests: "次请求", remaining: "个节点不会发送", starting: "正在开始翻译…" },
  "zh-TW": { translate: "翻譯", translating: "正在翻譯…", cancel: "取消", restore: "恢復原文", openSettings: "開啟設定", running: "正在翻譯", failed: "失敗", complete: "已完成", partial: "部分失敗", cancelled: "已取消", retry: "重試失敗項", nodes: "個文字節點將被傳送", requests: "次請求", remaining: "個節點不會傳送", starting: "正在開始翻譯…" },
  ja: { translate: "翻訳", translating: "翻訳中…", cancel: "キャンセル", restore: "原文を復元", openSettings: "設定を開く", running: "翻訳中", failed: "失敗", complete: "完了", partial: "一部失敗", cancelled: "キャンセル済み", retry: "失敗項目を再試行", nodes: "個のテキストノードを送信", requests: "リクエスト", remaining: "個のノードは送信されません", starting: "翻訳を開始しています…" }
} as const;
const ui = pageMessages[locale];

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `[${ATTR}]{font-family:system-ui,sans-serif;line-height:1.4} .llmwt-float{position:fixed;z-index:2147483647;border:0;border-radius:16px;background:#2563eb;color:#fff;padding:7px 11px;box-shadow:0 3px 12px #0004;cursor:pointer}.llmwt-popover{position:fixed;z-index:2147483647;max-width:360px;background:#111827;color:#fff;border-radius:8px;padding:12px;box-shadow:0 6px 20px #0005;white-space:pre-wrap}.llmwt-popover button,.llmwt-panel button{margin-left:8px}.llmwt-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;color:#111827;border:1px solid #d1d5db;border-radius:8px;padding:12px;box-shadow:0 4px 16px #0003}.llmwt-translation{display:inline;margin-left:.35em;color:#1d4ed8;font-style:italic}`;
  document.documentElement.append(style);
}

function isVisible(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent || parent.closest(`[${ATTR}]`) || parent.closest("script,style,noscript,template,pre,code,kbd,samp,textarea,input,select,option,button")) return false;
  const style = getComputedStyle(parent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && parent.getClientRects().length > 0;
}

function collectNodes(): PageNode[] {
  nodeMap.clear();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: PageNode[] = [];
  let text: Text | null;
  let i = 0;
  while ((text = walker.nextNode() as Text | null)) {
    if (!text.data.trim() || !isVisible(text)) continue;
    const id = `node-${i++}`;
    nodeMap.set(id, text);
    nodes.push({ id, text: text.data });
  }
  return nodes;
}

function removePopover() { popover?.remove(); popover = null; }
function showPopover(message: string, x: number, y: number, closable = true, onClose?: () => void) {
  removePopover();
  popover = document.createElement("div");
  popover.className = "llmwt-popover";
  popover.setAttribute(ATTR, "");
  popover.style.left = `${Math.max(8, x)}px`; popover.style.top = `${Math.max(8, y)}px`;
  popover.textContent = message;
  if (closable) { const close = document.createElement("button"); close.textContent = "×"; close.onclick = () => { onClose?.(); removePopover(); }; popover.append(close); }
  document.documentElement.append(popover);
}

function showPanel(message: string, buttons: Array<[string, () => void]>) {
  document.querySelector(".llmwt-panel")?.remove();
  const panel = document.createElement("div"); panel.className = "llmwt-panel"; panel.setAttribute(ATTR, ""); panel.textContent = message;
  for (const [label, handler] of buttons) { const button = document.createElement("button"); button.textContent = label; button.onclick = () => { handler(); panel.remove(); }; panel.append(button); }
  document.documentElement.append(panel);
  return panel;
}

function updateProgress() {
  if (!progressPanel?.isConnected) return;
  const label = `${ui.running}: ${progressProcessed}/${progressTotal}${progressFailed ? ` (${ui.failed}: ${progressFailed})` : ""}`;
  if (progressPanel.firstChild?.nodeType === Node.TEXT_NODE) progressPanel.firstChild.nodeValue = label;
}

function applyTranslation(nodeId: string, translation: string) {
  const node = nodeMap.get(nodeId); if (!node?.parentNode) return;
  if (currentMode === "replace") { if (!originalText.has(node)) originalText.set(node, node.data); node.data = translation; }
  else {
    const next = node.nextSibling;
    if (next instanceof HTMLElement && next.hasAttribute(ATTR)) next.textContent = translation;
    else { const result = document.createElement("span"); result.setAttribute(ATTR, "translation"); result.className = "llmwt-translation"; result.textContent = translation; node.parentNode.insertBefore(result, node.nextSibling); }
  }
}

function restorePage() {
  if (pageStartTimer !== null) { window.clearTimeout(pageStartTimer); pageStartTimer = null; }
  originalText.forEach((original, node) => { node.data = original; });
  originalText.clear();
  document.querySelectorAll(`[${ATTR}="translation"]`).forEach((element) => element.remove());
  nodeMap.clear(); activeTaskId = null;
}

function restoreAndCancel() {
  if (activeTaskId) chrome.runtime.sendMessage({ kind: "cancelTask", taskId: activeTaskId } satisfies RuntimeMessage);
  restorePage();
}

function selectedText() {
  const selection = window.getSelection(); const text = selection?.toString().trim(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!text || !range) return;
  const rect = range.getBoundingClientRect();
  floatingButton?.remove();
  floatingButton = document.createElement("button"); floatingButton.className = "llmwt-float"; floatingButton.setAttribute(ATTR, ""); floatingButton.textContent = ui.translate;
  floatingButton.style.left = `${Math.max(8, rect.left)}px`; floatingButton.style.top = `${Math.max(8, rect.bottom + 6)}px`;
  floatingButton.onclick = () => {
    if (selectionRequestId) chrome.runtime.sendMessage({ kind: "cancelSelection", requestId: selectionRequestId } satisfies RuntimeMessage);
    const requestId = crypto.randomUUID(); selectionRequestId = requestId;
    showPopover(ui.translating, rect.left, rect.bottom + 42, true, () => { chrome.runtime.sendMessage({ kind: "cancelSelection", requestId } satisfies RuntimeMessage); if (selectionRequestId === requestId) selectionRequestId = null; });
    chrome.runtime.sendMessage({ kind: "translateSelection", requestId, text } satisfies RuntimeMessage); floatingButton?.remove(); floatingButton = null;
  };
  document.documentElement.append(floatingButton);
}

document.addEventListener("mouseup", () => setTimeout(selectedText, 0));
document.addEventListener("mousedown", (event) => { if (!(event.target as Element).closest(`[${ATTR}]`)) floatingButton?.remove(); });
addStyles();

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.kind === "preparePage") {
    restorePage(); const allNodes = collectNodes(); const nodes = allNodes.slice(0, message.maxNodes);
    let cancelled = false;
    const limitNote = allNodes.length > nodes.length ? ` ${allNodes.length - nodes.length} ${ui.remaining}.` : "";
    showPanel(`${nodes.length} ${ui.nodes}, ${message.maxRequests} ${ui.requests}.${limitNote} ${ui.starting}`, [[ui.cancel, () => { cancelled = true; if (pageStartTimer !== null) window.clearTimeout(pageStartTimer); pageStartTimer = null; }]]);
    pageStartTimer = window.setTimeout(() => { pageStartTimer = null; if (!cancelled) chrome.runtime.sendMessage({ kind: "startPage", nodes } satisfies RuntimeMessage); }, 350);
  }
  if (message.kind === "selectionResult" && message.requestId === selectionRequestId) { selectionRequestId = null; const rect = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0).getBoundingClientRect() : new DOMRect(16, 16); showPopover(message.text, rect.left, rect.bottom + 10); }
  if (message.kind === "selectionError" && message.requestId === selectionRequestId) { selectionRequestId = null; showPopover(message.error, 16, 16); }
  if (message.kind === "taskError") showPanel(message.error, [[ui.openSettings, () => chrome.runtime.openOptionsPage()]]);
  if (message.kind === "taskStarted") { currentMode = message.mode; activeTaskId = message.taskId; progressTotal = message.total; progressProcessed = 0; progressFailed = 0; progressPanel = showPanel(`${ui.running}: 0/${message.total}`, [[ui.cancel, () => chrome.runtime.sendMessage({ kind: "cancelTask", taskId: message.taskId } satisfies RuntimeMessage)], [ui.restore, restoreAndCancel]]); }
  if (message.kind === "nodeResult" && message.taskId === activeTaskId) { applyTranslation(message.nodeId, message.text); progressProcessed += 1; updateProgress(); }
  if (message.kind === "nodeFailed" && message.taskId === activeTaskId) { progressProcessed += 1; progressFailed += 1; updateProgress(); }
  if (message.kind === "taskFinished") showTaskSummary(message.summary);
  if (message.kind === "restorePage") restorePage();
});

function showTaskSummary(summary: TaskSummary) {
  if (summary.taskId !== activeTaskId) return;
  const state = summary.cancelled ? ui.cancelled : summary.failed.length ? ui.partial : ui.complete;
  const failedPreview = summary.failed.slice(0, 3).map((node) => node.text.trim().slice(0, 40)).filter(Boolean).join(" · ");
  showPanel(`${state}: ${summary.succeeded}/${summary.total}.${failedPreview ? ` ${ui.failed}: ${failedPreview}` : ""}`, [[ui.restore, restorePage], ...(summary.failed.length ? [[ui.retry, () => chrome.runtime.sendMessage({ kind: "retryNodes", nodes: summary.failed } satisfies RuntimeMessage)] as [string, () => void]] : [])]);
}
