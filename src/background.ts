import { translateBatch, translate } from "./shared/api";
import { planTranslationBatches } from "./shared/batching";
import { MAX_REQUESTS_PER_PAGE_TASK } from "./shared/constants";
import { getActiveProfile } from "./shared/storage";
import { withRetries } from "./shared/retry";
import type { PageNode, PageTaskType, Profile, RuntimeMessage, TaskSummary } from "./shared/types";

const MAX_RETRIES = 3;
const CONCURRENCY = 5;
interface Task { controller: AbortController; tabId: number; cancelled: boolean; requestsStarted: number; profile: Profile; }
const tasks = new Map<string, Task>();
const selectionTasks = new Map<string, { controller: AbortController; tabId: number }>();
const send = (tabId: number, message: RuntimeMessage) => chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
const id = () => crypto.randomUUID();

async function activeProfileOrError(): Promise<NonNullable<Awaited<ReturnType<typeof getActiveProfile>>>> {
  const profile = await getActiveProfile();
  if (!profile) throw new Error("No active model profile. Open settings to create one.");
  return profile;
}

async function translateBatchWithRetry(nodes: PageNode[], task: Task) {
  return withRetries(async () => {
    if (task.requestsStarted >= MAX_REQUESTS_PER_PAGE_TASK) throw new Error(`This page task reached its ${MAX_REQUESTS_PER_PAGE_TASK}-request limit.`);
    task.requestsStarted += 1;
    return translateBatch(task.profile, nodes, task.controller.signal);
  }, MAX_RETRIES, () => task.cancelled || task.controller.signal.aborted);
}

async function runPageTask(tabId: number, nodes: PageNode[], taskType: PageTaskType) {
  for (const existing of tasks.values()) if (existing.tabId === tabId) { existing.cancelled = true; existing.controller.abort(); }
  const profile = await activeProfileOrError();
  const taskId = id();
  const task: Task = { tabId, controller: new AbortController(), cancelled: false, requestsStarted: 0, profile };
  tasks.set(taskId, task);
  const summary: TaskSummary = { taskId, total: nodes.length, succeeded: 0, failed: [], cancelled: false };
  await send(tabId, { kind: "taskStarted", taskId, total: nodes.length, mode: profile.mode, taskType });
  const { batches, accepted, overflow } = planTranslationBatches(nodes);
  if (overflow.length) summary.failed.push(...overflow);
  summary.total = accepted.length + overflow.length;
  for (const node of overflow) await send(tabId, { kind: "nodeFailed", taskId, node, error: `This page task reached its ${MAX_REQUESTS_PER_PAGE_TASK}-request limit.` });
  let index = 0;
  const worker = async () => {
    while (!task.cancelled && index < batches.length) {
      const batchIndex = index++;
      const batch = batches[batchIndex];
      try {
        const translations = await translateBatchWithRetry(batch, task);
        if (!task.cancelled) for (const node of batch) {
          summary.succeeded += 1;
          await send(tabId, { kind: "nodeResult", taskId, nodeId: node.id, text: translations.get(node.id)! });
        }
      } catch (error) {
        if (task.cancelled || task.controller.signal.aborted) break;
        for (const node of batch) {
          summary.failed.push(node);
          await send(tabId, { kind: "nodeFailed", taskId, node, error: error instanceof Error ? error.message : "Translation failed." });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  summary.cancelled = task.cancelled;
  tasks.delete(taskId);
  await send(tabId, { kind: "taskFinished", summary });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "translate-page", title: chrome.i18n.getMessage("contextTranslatePage") || "Translate this page", contexts: ["page"] });
  chrome.contextMenus.create({ id: "translate-selection", title: chrome.i18n.getMessage("contextTranslateSelection") || "Translate selected text", contexts: ["selection"] });
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (!tab.url || /^(?:chrome|edge|about|moz-extension):/i.test(tab.url) || tab.url.startsWith("https://chrome.google.com/webstore")) {
    void chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#b91c1c" });
    void chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    void chrome.action.setTitle({ tabId: tab.id, title: chrome.i18n.getMessage("unsupportedPage") || "This page cannot be translated by browser extensions." });
    return;
  }
  if (info.menuItemId === "translate-selection") {
    const text = info.selectionText?.trim();
    if (text) send(tab.id, { kind: "translateSelectionFromMenu", text });
    return;
  }
  if (info.menuItemId === "translate-page") {
    void activeProfileOrError()
      .then((profile) => send(tab.id!, { kind: "preparePage", mode: profile.mode, maxRequests: MAX_REQUESTS_PER_PAGE_TASK }))
      .catch((error) => send(tab.id!, { kind: "taskError", error: error instanceof Error ? error.message : "Unable to start translation." }));
  }
});
function cancelTabWork(tabId: number) {
  for (const task of tasks.values()) if (task.tabId === tabId) { task.cancelled = true; task.controller.abort(); }
  for (const selection of selectionTasks.values()) if (selection.tabId === tabId) selection.controller.abort();
}
chrome.tabs.onRemoved.addListener(cancelTabWork);
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.status === "loading") cancelTabWork(tabId); });

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, respond) => {
  if (message.kind === "profilesChanged") {
    for (const task of tasks.values()) { task.cancelled = true; task.controller.abort(); }
    void chrome.tabs.query({}).then((tabs) => Promise.all(tabs.flatMap((tab) => tab.id ? [send(tab.id, { kind: "restorePage" })] : [])));
    respond();
    return;
  }
  const tabId = sender.tab?.id;
  if (!tabId) return;
  if (message.kind === "translateSelection") {
    const controller = new AbortController();
    selectionTasks.set(message.requestId, { controller, tabId });
    void activeProfileOrError().then((profile) => translate(profile, message.text, controller.signal))
      .then((text) => { if (!controller.signal.aborted) return send(tabId, { kind: "selectionResult", requestId: message.requestId, text }); })
      .catch((error) => { if (!controller.signal.aborted) return send(tabId, { kind: "selectionError", requestId: message.requestId, error: error instanceof Error ? error.message : "Translation failed." }); })
      .finally(() => { selectionTasks.delete(message.requestId); respond(); });
    return true;
  }
  if (message.kind === "cancelSelection") { selectionTasks.get(message.requestId)?.controller.abort(); selectionTasks.delete(message.requestId); respond(); return; }
  if (message.kind === "startPage" || message.kind === "appendPage" || message.kind === "retryNodes") {
    const taskType: PageTaskType = message.kind === "startPage" ? "initial" : message.kind === "appendPage" ? "append" : "retry";
    void runPageTask(tabId, message.nodes, taskType)
      .catch((error) => send(tabId, { kind: "taskError", error: error instanceof Error ? error.message : "Unable to start translation." }))
      .finally(respond);
    return true;
  }
  if (message.kind === "cancelTask") { const task = tasks.get(message.taskId); if (task) { task.cancelled = true; task.controller.abort(); } respond(); return; }
  respond();
});
