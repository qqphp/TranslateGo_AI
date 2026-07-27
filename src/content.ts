import type { PageNode, RuntimeMessage, TaskSummary, TranslationMode } from "./shared/types";

const ATTR = "data-llm-web-translator";
let currentMode: TranslationMode = "replace";
let activeTaskId: string | null = null;
const nodeMap = new Map<string, Text>();
const originalText = new Map<Text, string>();
let floatingButton: HTMLButtonElement | null = null;
let popover: HTMLDivElement | null = null;
let progressPanel: HTMLDivElement | null = null;
let progressLabel: HTMLDivElement | null = null;
let progressBar: HTMLDivElement | null = null;
let progressPercent: HTMLSpanElement | null = null;
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
  style.textContent = `[${ATTR}]{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.4;box-sizing:border-box}.llmwt-float{position:fixed;z-index:2147483647;border:0;border-radius:16px;background:#2563eb;color:#fff;padding:7px 11px;box-shadow:0 3px 12px #0004;cursor:pointer}.llmwt-popover{position:fixed;z-index:2147483647;max-width:360px;background:#111827;color:#fff;border-radius:8px;padding:12px;box-shadow:0 6px 20px #0005;white-space:pre-wrap}.llmwt-popover button{margin-left:8px}.llmwt-panel{position:fixed;right:20px;bottom:20px;z-index:2147483647;width:min(340px,calc(100vw - 40px));background:#fff;color:#111827;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 14px 38px #0f172a2e}.llmwt-panel-message{font-size:14px;color:#334155}.llmwt-panel-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.llmwt-action{appearance:none;border:1px solid transparent;border-radius:8px;padding:8px 13px;font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;transition:background-color .16s,border-color .16s,box-shadow .16s,transform .16s}.llmwt-action:hover{transform:translateY(-1px)}.llmwt-action:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}.llmwt-secondary{background:#f1f5f9;color:#334155;border-color:#cbd5e1}.llmwt-secondary:hover{background:#e2e8f0;border-color:#94a3b8}.llmwt-danger{background:#dc2626;color:#fff;border-color:#dc2626}.llmwt-danger:hover{background:#b91c1c;border-color:#b91c1c;box-shadow:0 4px 10px #dc262633}.llmwt-primary{background:#2563eb;color:#fff;border-color:#2563eb}.llmwt-primary:hover{background:#1d4ed8;border-color:#1d4ed8}.llmwt-progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.llmwt-progress-label{min-width:0;font-size:14px;font-weight:600;color:#1e293b}.llmwt-progress-percent{flex:none;color:#2563eb;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}.llmwt-progress-track{height:9px;margin-top:11px;overflow:hidden;border-radius:999px;background:#e2e8f0}.llmwt-progress-bar{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#38bdf8);box-shadow:0 0 8px #38bdf866;transition:width .2s ease}.llmwt-translation{display:inline;margin-left:.35em;color:#1d4ed8;font-style:italic}`;
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

type ButtonStyle = "primary" | "secondary" | "danger";
type PanelButton = [label: string, handler: () => void, style?: ButtonStyle];

function createActionButton(label: string, handler: () => void, style: ButtonStyle = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `llmwt-action llmwt-${style}`;
  button.textContent = label;
  button.onclick = handler;
  return button;
}

function showPanel(message: string, buttons: PanelButton[]) {
  document.querySelector(".llmwt-panel")?.remove();
  const panel = document.createElement("div"); panel.className = "llmwt-panel"; panel.setAttribute(ATTR, "");
  const text = document.createElement("div"); text.className = "llmwt-panel-message"; text.textContent = message; panel.append(text);
  if (buttons.length) {
    const actions = document.createElement("div"); actions.className = "llmwt-panel-actions";
    for (const [label, handler, style] of buttons) actions.append(createActionButton(label, () => { handler(); panel.remove(); }, style));
    panel.append(actions);
  }
  document.documentElement.append(panel);
  return panel;
}

function showProgressPanel(taskId: string, total: number) {
  document.querySelector(".llmwt-panel")?.remove();
  const panel = document.createElement("div"); panel.className = "llmwt-panel llmwt-progress-panel"; panel.setAttribute(ATTR, "");
  const head = document.createElement("div"); head.className = "llmwt-progress-head";
  progressLabel = document.createElement("div"); progressLabel.className = "llmwt-progress-label";
  progressPercent = document.createElement("span"); progressPercent.className = "llmwt-progress-percent";
  head.append(progressLabel, progressPercent);
  const track = document.createElement("div"); track.className = "llmwt-progress-track";
  progressBar = document.createElement("div"); progressBar.className = "llmwt-progress-bar"; progressBar.setAttribute("role", "progressbar"); progressBar.setAttribute("aria-valuemin", "0"); progressBar.setAttribute("aria-valuemax", "100");
  track.append(progressBar);
  const actions = document.createElement("div"); actions.className = "llmwt-panel-actions";
  actions.append(
    createActionButton(ui.restore, () => { restoreAndCancel(); panel.remove(); }, "secondary"),
    createActionButton(ui.cancel, () => { chrome.runtime.sendMessage({ kind: "cancelTask", taskId } satisfies RuntimeMessage); panel.remove(); }, "danger")
  );
  panel.append(head, track, actions);
  document.documentElement.append(panel);
  progressPanel = panel;
  updateProgress();
  return panel;
}

function updateProgress() {
  if (!progressPanel?.isConnected) return;
  const label = `${ui.running}: ${progressProcessed}/${progressTotal}${progressFailed ? ` (${ui.failed}: ${progressFailed})` : ""}`;
  const percentage = progressTotal > 0 ? Math.min(100, Math.round((progressProcessed / progressTotal) * 100)) : 100;
  if (progressLabel) progressLabel.textContent = label;
  if (progressPercent) progressPercent.textContent = `${percentage}%`;
  if (progressBar) { progressBar.style.width = `${percentage}%`; progressBar.setAttribute("aria-valuenow", String(percentage)); }
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
    showPanel(`${nodes.length} ${ui.nodes}, ${message.maxRequests} ${ui.requests}.${limitNote} ${ui.starting}`, [[ui.cancel, () => { cancelled = true; if (pageStartTimer !== null) window.clearTimeout(pageStartTimer); pageStartTimer = null; }, "danger"]]);
    pageStartTimer = window.setTimeout(() => { pageStartTimer = null; if (!cancelled) chrome.runtime.sendMessage({ kind: "startPage", nodes } satisfies RuntimeMessage); }, 350);
  }
  if (message.kind === "selectionResult" && message.requestId === selectionRequestId) { selectionRequestId = null; const rect = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0).getBoundingClientRect() : new DOMRect(16, 16); showPopover(message.text, rect.left, rect.bottom + 10); }
  if (message.kind === "selectionError" && message.requestId === selectionRequestId) { selectionRequestId = null; showPopover(message.error, 16, 16); }
  if (message.kind === "taskError") showPanel(message.error, [[ui.openSettings, () => chrome.runtime.openOptionsPage()]]);
  if (message.kind === "taskStarted") { currentMode = message.mode; activeTaskId = message.taskId; progressTotal = message.total; progressProcessed = 0; progressFailed = 0; showProgressPanel(message.taskId, message.total); }
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
