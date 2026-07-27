import { translateBatch, translate } from "./shared/api";
import { MAX_REQUESTS_PER_PAGE_TASK, NODES_PER_REQUEST } from "./shared/constants";
import { getActiveProfile } from "./shared/storage";
import { withRetries } from "./shared/retry";
import type { PageNode, Profile, RuntimeMessage, TaskSummary } from "./shared/types";

const MAX_RETRIES = 3;
const CONCURRENCY = 5;
const BATCH_SIZE = NODES_PER_REQUEST;
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

async function runPageTask(tabId: number, nodes: PageNode[]) {
  for (const existing of tasks.values()) if (existing.tabId === tabId) { existing.cancelled = true; existing.controller.abort(); }
  const profile = await activeProfileOrError();
  const taskId = id();
  const task: Task = { tabId, controller: new AbortController(), cancelled: false, requestsStarted: 0, profile };
  tasks.set(taskId, task);
  const summary: TaskSummary = { taskId, total: nodes.length, succeeded: 0, failed: [], cancelled: false };
  await send(tabId, { kind: "taskStarted", taskId, total: nodes.length, mode: profile.mode });
  const batches: PageNode[][] = [];
  for (let index = 0; index < nodes.length; index += BATCH_SIZE) batches.push(nodes.slice(index, index + BATCH_SIZE));
  let index = 0;
  let nextToDisplay = 0;
  const completed = new Map<number, { nodes: PageNode[]; translations?: Map<string, string>; error?: string }>();
  let flushChain = Promise.resolve();
  const flushCompleted = () => {
    flushChain = flushChain.then(async () => {
      while (!task.cancelled && completed.has(nextToDisplay)) {
        const result = completed.get(nextToDisplay)!;
        completed.delete(nextToDisplay);
        nextToDisplay += 1;
        if (result.translations) {
          for (const node of result.nodes) {
            summary.succeeded += 1;
            await send(tabId, { kind: "nodeResult", taskId, nodeId: node.id, text: result.translations.get(node.id)! });
          }
        } else {
          for (const node of result.nodes) {
            summary.failed.push(node);
            await send(tabId, { kind: "nodeFailed", taskId, node, error: result.error ?? "Translation failed." });
          }
        }
      }
    });
    return flushChain;
  };
  const worker = async () => {
    while (!task.cancelled && index < batches.length) {
      const batchIndex = index++;
      const batch = batches[batchIndex];
      try {
        const translations = await translateBatchWithRetry(batch, task);
        if (!task.cancelled) { completed.set(batchIndex, { nodes: batch, translations }); await flushCompleted(); }
      } catch (error) {
        if (task.cancelled || task.controller.signal.aborted) break;
        completed.set(batchIndex, { nodes: batch, error: error instanceof Error ? error.message : "Translation failed." });
        await flushCompleted();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  await flushChain;
  summary.cancelled = task.cancelled;
  tasks.delete(taskId);
  await send(tabId, { kind: "taskFinished", summary });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "translate-page", title: chrome.i18n.getMessage("contextTranslatePage") || "Translate this page", contexts: ["page"] });
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.contextMenus.onClicked.addListener((_info, tab) => {
  if (!tab?.id) return;
  if (!tab.url || /^(?:chrome|edge|about|moz-extension):/i.test(tab.url) || tab.url.startsWith("https://chrome.google.com/webstore")) {
    void chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#b91c1c" });
    void chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    void chrome.action.setTitle({ tabId: tab.id, title: chrome.i18n.getMessage("unsupportedPage") || "This page cannot be translated by browser extensions." });
    return;
  }
  send(tab.id, { kind: "preparePage", maxNodes: MAX_REQUESTS_PER_PAGE_TASK * NODES_PER_REQUEST, maxRequests: MAX_REQUESTS_PER_PAGE_TASK });
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
  if (message.kind === "startPage" || message.kind === "retryNodes") {
    void runPageTask(tabId, message.nodes)
      .catch((error) => send(tabId, { kind: "taskError", error: error instanceof Error ? error.message : "Unable to start translation." }))
      .finally(respond);
    return true;
  }
  if (message.kind === "cancelTask") { const task = tasks.get(message.taskId); if (task) { task.cancelled = true; task.controller.abort(); } respond(); return; }
  respond();
});
