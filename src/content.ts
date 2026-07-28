import type { PageNode, PageTaskType, RuntimeMessage, TaskSummary, TranslationMode } from "./shared/types";
import { contentMessages } from "./generated/content-locales";

const ATTR = "data-llm-web-translator";
let currentMode: TranslationMode = "replace";
let activeTaskId: string | null = null;
type TranslationTarget = { kind: "text"; node: Text } | { kind: "paragraph"; element: HTMLElement };
const nodeMap = new Map<string, TranslationTarget>();
const originalText = new Map<Text, string>();
let preservedTranslations = new WeakMap<HTMLElement, HTMLElement>();
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
let nextNodeId = 0;
let trackedText = new WeakMap<Text, string>();
const pendingDynamicNodes = new Set<Text>();
let dynamicObserver: MutationObserver | null = null;
let dynamicTimer: number | null = null;
let watchingDynamicContent = false;
let taskInProgress = false;
let cumulativeTranslated = 0;
let selectionPopoverX = 16;
let selectionPopoverY = 16;

const language = (chrome.i18n?.getUILanguage?.() || navigator.language).toLowerCase();
type ContentLocale = keyof typeof contentMessages;
function resolveContentLocale(value: string): ContentLocale {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh-tw") || normalized.startsWith("zh-hk") || normalized.startsWith("zh-hant")) return "zh-TW";
  if (normalized.startsWith("zh")) return "zh-CN";
  const primary = normalized.split("-")[0];
  return Object.prototype.hasOwnProperty.call(contentMessages, primary) ? primary as ContentLocale : "en";
}
const browserLocale = resolveContentLocale(language);
let ui = contentMessages[browserLocale];
function applyLocalePreference(preference: unknown) {
  const locale = typeof preference === "string" && preference !== "auto" ? resolveContentLocale(preference) : browserLocale;
  ui = contentMessages[locale];
}
const storedSettings = chrome.storage?.local?.get("settings");
void storedSettings?.then((value) => applyLocalePreference((value.settings as { uiLocale?: unknown } | undefined)?.uiLocale));
chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings?.newValue) applyLocalePreference((changes.settings.newValue as { uiLocale?: unknown }).uiLocale);
});
const formatMessage = (template: string, values: Record<string, string | number>) => template.replace(/\{([a-z]+)\}/g, (placeholder, key: string) => key in values ? String(values[key]) : placeholder);

type IconName = "close" | "cancel" | "restore" | "settings" | "retry";
const iconPaths: Record<IconName, string> = {
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  cancel: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  restore: '<path d="M4 9V4m0 0h5M4 4l4 4a7 7 0 1 1-2 7"/>',
  settings: '<path d="M4 7h10M4 12h16M16 7h4M4 17h4M10 17h10"/><circle cx="12" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  retry: '<path d="M20 7V3m0 0h-4M20 3l-3 3a7 7 0 0 0-11 2M4 17v4m0 0h4m-4 0 3-3a7 7 0 0 0 11-2"/>'
};

function createIcon(name: IconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "llmwt-icon"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.9"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = iconPaths[name];
  return svg;
}

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `[${ATTR}]{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.4;box-sizing:border-box}.llmwt-icon{display:block;width:16px;height:16px;flex:none}.llmwt-float{position:fixed;z-index:2147483647;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:18px;background:#2563eb;color:#fff;padding:8px 12px;box-shadow:0 4px 14px #0004;font:650 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;transition:background-color .16s,transform .16s}.llmwt-float:hover{background:#1d4ed8;transform:translateY(-1px)}.llmwt-float:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}.llmwt-popover{position:fixed;z-index:2147483647;max-width:360px;background:#111827;color:#fff;border-radius:9px;padding:12px 38px 12px 13px;box-shadow:0 6px 20px #0005;white-space:pre-wrap}.llmwt-popover-close{position:absolute;right:8px;top:8px;width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:6px;background:#ffffff14;color:#fff;cursor:pointer}.llmwt-popover-close:hover{background:#ffffff28}.llmwt-popover-close .llmwt-icon{width:14px;height:14px}.llmwt-panel{position:fixed;right:20px;bottom:20px;z-index:2147483647;width:min(340px,calc(100vw - 40px));background:#fff;color:#111827;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 14px 38px #0f172a2e}.llmwt-panel-message{font-size:14px;color:#334155}.llmwt-panel-notice{margin-bottom:12px;padding:9px 10px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:650}.llmwt-panel-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.llmwt-action{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:8px;padding:8px 13px;font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;transition:background-color .16s,border-color .16s,box-shadow .16s,transform .16s}.llmwt-action:hover{transform:translateY(-1px)}.llmwt-action:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}.llmwt-secondary{background:#f1f5f9;color:#334155;border-color:#cbd5e1}.llmwt-secondary:hover{background:#e2e8f0;border-color:#94a3b8}.llmwt-danger{background:#dc2626;color:#fff;border-color:#dc2626}.llmwt-danger:hover{background:#b91c1c;border-color:#b91c1c;box-shadow:0 4px 10px #dc262633}.llmwt-primary{background:#2563eb;color:#fff;border-color:#2563eb}.llmwt-primary:hover{background:#1d4ed8;border-color:#1d4ed8}.llmwt-progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.llmwt-progress-label{min-width:0;font-size:14px;font-weight:600;color:#1e293b}.llmwt-progress-percent{flex:none;color:#2563eb;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}.llmwt-progress-track{height:9px;margin-top:11px;overflow:hidden;border-radius:999px;background:#e2e8f0}.llmwt-progress-bar{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#38bdf8);box-shadow:0 0 8px #38bdf866;transition:width .2s ease}.llmwt-translation{display:block;margin:0;margin-block-start:.35em;margin-inline-start:0;color:#1d4ed8;font-style:italic}`;
  document.documentElement.append(style);
}

function isVisible(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent || parent.closest(`[${ATTR}]`) || parent.closest("script,style,noscript,template,pre,code,kbd,samp,textarea,input,select,option,button")) return false;
  const style = getComputedStyle(parent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && parent.getClientRects().length > 0;
}

const paragraphTags = new Set(["P", "LI", "BLOCKQUOTE", "FIGCAPTION", "DT", "DD", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "TH", "CAPTION", "DIV"]);

function paragraphFor(text: Text): HTMLElement | null {
  let element = text.parentElement;
  const fallback = element;
  while (element && element !== document.body) {
    if (paragraphTags.has(element.tagName)) return element;
    element = element.parentElement;
  }
  return fallback;
}

function createPageNodes(textNodes: Text[], mode: TranslationMode): PageNode[] {
  if (mode === "replace") return textNodes.map((text) => {
    const id = `node-${nextNodeId++}`;
    nodeMap.set(id, { kind: "text", node: text });
    return { id, text: text.data };
  });

  const paragraphs = new Map<HTMLElement, Text[]>();
  for (const text of textNodes) {
    const paragraph = paragraphFor(text);
    if (!paragraph) continue;
    const group = paragraphs.get(paragraph);
    if (group) group.push(text); else paragraphs.set(paragraph, [text]);
  }
  return Array.from(paragraphs, ([element, texts]) => {
    const id = `node-${nextNodeId++}`;
    nodeMap.set(id, { kind: "paragraph", element });
    return { id, text: texts.map((text) => text.data).join("").trim() };
  }).filter((node) => node.text.length > 0);
}

function collectNodes(mode: TranslationMode): PageNode[] {
  nodeMap.clear();
  trackedText = new WeakMap<Text, string>();
  nextNodeId = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let text: Text | null;
  while ((text = walker.nextNode() as Text | null)) {
    if (!text.data.trim() || !isVisible(text)) continue;
    trackedText.set(text, text.data);
    textNodes.push(text);
  }
  return createPageNodes(textNodes, mode);
}

function stopDynamicMonitoring() {
  dynamicObserver?.disconnect(); dynamicObserver = null;
  if (dynamicTimer !== null) { window.clearTimeout(dynamicTimer); dynamicTimer = null; }
  pendingDynamicNodes.clear();
  watchingDynamicContent = false;
}

function scheduleDynamicTranslation() {
  if (!watchingDynamicContent) return;
  if (dynamicTimer !== null) window.clearTimeout(dynamicTimer);
  dynamicTimer = window.setTimeout(flushDynamicNodes, 400);
}

function queueDynamicText(text: Text) {
  if (!watchingDynamicContent || !text.isConnected || !text.data.trim() || !isVisible(text)) return;
  if (trackedText.get(text) === text.data) return;
  if (currentMode === "replace" && originalText.has(text)) originalText.set(text, text.data);
  trackedText.set(text, text.data);
  pendingDynamicNodes.add(text);
  scheduleDynamicTranslation();
}

function scanDynamicContent(root: Node) {
  if (root instanceof Text) { queueDynamicText(root); return; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text: Text | null;
  while ((text = walker.nextNode() as Text | null)) queueDynamicText(text);
}

function flushDynamicNodes() {
  dynamicTimer = null;
  if (!watchingDynamicContent || taskInProgress) return;
  for (const text of pendingDynamicNodes) if (!text.isConnected || !text.data.trim() || !isVisible(text)) pendingDynamicNodes.delete(text);
  const texts = Array.from(pendingDynamicNodes);
  if (!texts.length) return;
  const nodes = createPageNodes(texts, currentMode);
  if (!nodes.length) return;
  pendingDynamicNodes.clear();
  taskInProgress = true;
  showPanel(ui.newContent, []);
  chrome.runtime.sendMessage({ kind: "appendPage", nodes } satisfies RuntimeMessage);
}

function startDynamicMonitoring() {
  stopDynamicMonitoring();
  watchingDynamicContent = true;
  dynamicObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") for (const node of record.addedNodes) scanDynamicContent(node);
      else if (record.type === "characterData") queueDynamicText(record.target as Text);
      else if (record.type === "attributes") scanDynamicContent(record.target);
    }
  });
  dynamicObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
}

function removePopover() { popover?.remove(); popover = null; }
function showPopover(message: string, x: number, y: number, closable = true, onClose?: () => void) {
  removePopover();
  popover = document.createElement("div");
  popover.className = "llmwt-popover";
  popover.setAttribute(ATTR, "");
  popover.style.left = `${Math.max(8, x)}px`; popover.style.top = `${Math.max(8, y)}px`;
  popover.textContent = message;
  if (closable) { const close = document.createElement("button"); close.type = "button"; close.className = "llmwt-popover-close"; close.setAttribute("aria-label", ui.close); close.append(createIcon("close")); close.onclick = () => { onClose?.(); removePopover(); }; popover.append(close); }
  document.documentElement.append(popover);
}

type ButtonStyle = "primary" | "secondary" | "danger";
type PanelButton = [label: string, handler: () => void, style: ButtonStyle | undefined, icon: IconName];

function createActionButton(label: string, handler: () => void, style: ButtonStyle | undefined, icon: IconName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `llmwt-action llmwt-${style ?? "secondary"}`;
  button.append(createIcon(icon), document.createTextNode(label));
  button.onclick = handler;
  return button;
}

function showPanel(message: string, buttons: PanelButton[]) {
  document.querySelector(".llmwt-panel")?.remove();
  const panel = document.createElement("div"); panel.className = "llmwt-panel"; panel.setAttribute(ATTR, "");
  const text = document.createElement("div"); text.className = "llmwt-panel-message"; text.textContent = message; panel.append(text);
  if (buttons.length) {
    const actions = document.createElement("div"); actions.className = "llmwt-panel-actions";
    for (const [label, handler, style, icon] of buttons) actions.append(createActionButton(label, () => { handler(); panel.remove(); }, style, icon));
    panel.append(actions);
  }
  document.documentElement.append(panel);
  return panel;
}

function showProgressPanel(taskId: string, total: number, taskType: PageTaskType) {
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
    createActionButton(ui.restore, () => { restoreAndCancel(); panel.remove(); }, "secondary", "restore"),
    createActionButton(ui.cancel, () => { stopDynamicMonitoring(); chrome.runtime.sendMessage({ kind: "cancelTask", taskId } satisfies RuntimeMessage); panel.remove(); }, "danger", "cancel")
  );
  if (taskType === "append") { const notice = document.createElement("div"); notice.className = "llmwt-panel-notice"; notice.textContent = ui.newContent; panel.append(notice); }
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

const inheritedTranslationProperties = [
  "color", "direction", "font-family", "font-size", "font-stretch", "font-style", "font-variant", "font-weight", "letter-spacing", "line-height",
  "text-align", "text-decoration", "text-shadow", "text-transform", "white-space", "word-break", "word-spacing", "writing-mode"
] as const;

function matchSourceStyle(result: HTMLElement, source: HTMLElement) {
  const computed = getComputedStyle(source);
  for (const property of inheritedTranslationProperties) {
    const value = computed.getPropertyValue(property);
    if (value) result.style.setProperty(property, value);
  }
  result.style.setProperty("display", "block");
  result.style.setProperty("margin", "0");
  result.style.setProperty("margin-block-start", ".35em");
  result.style.setProperty("margin-inline-start", "0");
}

function applyTranslation(nodeId: string, translation: string) {
  const target = nodeMap.get(nodeId); if (!target) return;
  if (target.kind === "text") {
    const node = target.node;
    if (!node.parentNode) return;
    if (!originalText.has(node)) originalText.set(node, node.data);
    trackedText.set(node, translation);
    node.data = translation;
    return;
  }
  const source = target.element;
  if (!source.isConnected) return;
  let result = preservedTranslations.get(source);
  if (!result?.isConnected) {
    result = document.createElement("span");
    result.setAttribute(ATTR, "translation");
    result.className = "llmwt-translation";
    source.append(result);
    preservedTranslations.set(source, result);
  }
  matchSourceStyle(result, source);
  result.textContent = translation;
}

function restorePage() {
  if (pageStartTimer !== null) { window.clearTimeout(pageStartTimer); pageStartTimer = null; }
  stopDynamicMonitoring();
  originalText.forEach((original, node) => { node.data = original; });
  originalText.clear();
  document.querySelectorAll(`[${ATTR}="translation"]`).forEach((element) => element.remove());
  document.querySelector(".llmwt-panel")?.remove();
  nodeMap.clear(); trackedText = new WeakMap<Text, string>(); preservedTranslations = new WeakMap<HTMLElement, HTMLElement>(); activeTaskId = null; taskInProgress = false; cumulativeTranslated = 0;
}

function restoreAndCancel() {
  if (activeTaskId) chrome.runtime.sendMessage({ kind: "cancelTask", taskId: activeTaskId } satisfies RuntimeMessage);
  restorePage();
}

function translateSelectionFromMenu(text: string) {
  const selection = window.getSelection();
  const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : new DOMRect(16, 16);
  selectionPopoverX = rect.left; selectionPopoverY = rect.bottom + 10;
  if (selectionRequestId) chrome.runtime.sendMessage({ kind: "cancelSelection", requestId: selectionRequestId } satisfies RuntimeMessage);
  const requestId = crypto.randomUUID(); selectionRequestId = requestId;
  showPopover(ui.translating, selectionPopoverX, selectionPopoverY, true, () => { chrome.runtime.sendMessage({ kind: "cancelSelection", requestId } satisfies RuntimeMessage); if (selectionRequestId === requestId) selectionRequestId = null; });
  chrome.runtime.sendMessage({ kind: "translateSelection", requestId, text } satisfies RuntimeMessage);
}

addStyles();

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.kind === "preparePage") {
    restorePage(); currentMode = message.mode;
    const nodes = collectNodes(message.mode);
    startDynamicMonitoring();
    let cancelled = false;
    showPanel(`${nodes.length} ${ui.nodes}; ${formatMessage(ui.requestLimit, { count: message.maxRequests })}. ${ui.starting}`, [[ui.cancel, () => { cancelled = true; stopDynamicMonitoring(); if (pageStartTimer !== null) window.clearTimeout(pageStartTimer); pageStartTimer = null; }, "danger", "cancel"]]);
    pageStartTimer = window.setTimeout(() => { pageStartTimer = null; if (!cancelled) { taskInProgress = true; chrome.runtime.sendMessage({ kind: "startPage", nodes } satisfies RuntimeMessage); } }, 350);
  }
  if (message.kind === "translateSelectionFromMenu") translateSelectionFromMenu(message.text);
  if (message.kind === "selectionResult" && message.requestId === selectionRequestId) { selectionRequestId = null; showPopover(message.text, selectionPopoverX, selectionPopoverY); }
  if (message.kind === "selectionError" && message.requestId === selectionRequestId) { selectionRequestId = null; showPopover(message.error, selectionPopoverX, selectionPopoverY); }
  if (message.kind === "taskError") { taskInProgress = false; stopDynamicMonitoring(); showPanel(message.error, [[ui.openSettings, () => chrome.runtime.openOptionsPage(), "secondary", "settings"]]); }
  if (message.kind === "taskStarted") { currentMode = message.mode; activeTaskId = message.taskId; taskInProgress = true; progressTotal = message.total; progressProcessed = 0; progressFailed = 0; showProgressPanel(message.taskId, message.total, message.taskType); }
  if (message.kind === "nodeResult" && message.taskId === activeTaskId) { applyTranslation(message.nodeId, message.text); progressProcessed += 1; updateProgress(); }
  if (message.kind === "nodeFailed" && message.taskId === activeTaskId) { progressProcessed += 1; progressFailed += 1; updateProgress(); }
  if (message.kind === "taskFinished" && message.summary.taskId === activeTaskId) { taskInProgress = false; showTaskSummary(message.summary); if (watchingDynamicContent && pendingDynamicNodes.size) scheduleDynamicTranslation(); }
  if (message.kind === "restorePage") restorePage();
});

function showTaskSummary(summary: TaskSummary) {
  if (summary.taskId !== activeTaskId) return;
  cumulativeTranslated += summary.succeeded;
  const failedPreview = summary.failed.slice(0, 3).map((node) => node.text.trim().slice(0, 40)).filter(Boolean).join(" · ");
  const message = summary.cancelled ? `${ui.cancelled}: ${summary.succeeded}/${summary.total}.` : summary.failed.length ? formatMessage(ui.partialCompletion, { count: cumulativeTranslated, failed: summary.failed.length }) : formatMessage(ui.completion, { count: cumulativeTranslated });
  showPanel(`${message}${failedPreview ? ` ${ui.failed}: ${failedPreview}` : ""}`, [[ui.restore, restorePage, "secondary", "restore"], ...(summary.failed.length ? [[ui.retry, () => { taskInProgress = true; chrome.runtime.sendMessage({ kind: "retryNodes", nodes: summary.failed } satisfies RuntimeMessage); }, "secondary", "retry"] as PanelButton] : [])]);
}
