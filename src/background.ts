import { translateBatch, translate } from "./shared/api";
import { MAX_REQUESTS_PER_PAGE_TASK, NODES_PER_REQUEST } from "./shared/constants";
import { getActiveProfile } from "./shared/storage";
import type { PageNode, RuntimeMessage, TaskSummary } from "./shared/types";

const MAX_RETRIES = 3;
const CONCURRENCY = 100;
const BATCH_SIZE = NODES_PER_REQUEST;
interface Task { controller: AbortController; tabId: number; cancelled: boolean; requestsStarted: number; }
const tasks = new Map<string, Task>();
const send = (tabId: number, message: RuntimeMessage) => chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
const id = () => crypto.randomUUID();

async function activeProfileOrError(): Promise<NonNullable<Awaited<ReturnType<typeof getActiveProfile>>>> {
  const profile = await getActiveProfile();
  if (!profile) throw new Error("No active model profile. Open settings to create one.");
  return profile;
}

async function translateBatchWithRetry(nodes: PageNode[], task: Task) {
  const profile = await activeProfileOrError();
  let error: unknown;
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    if (task.cancelled) throw new DOMException("Cancelled", "AbortError");
    if (task.requestsStarted >= MAX_REQUESTS_PER_PAGE_TASK) throw new Error(`This page task reached its ${MAX_REQUESTS_PER_PAGE_TASK}-request limit.`);
    task.requestsStarted += 1;
    try { return await translateBatch(profile, nodes, task.controller.signal); }
    catch (caught) { error = caught; if (task.controller.signal.aborted) throw caught; }
  }
  throw error;
}

async function runPageTask(tabId: number, nodes: PageNode[]) {
  const taskId = id();
  const task: Task = { tabId, controller: new AbortController(), cancelled: false, requestsStarted: 0 };
  tasks.set(taskId, task);
  const summary: TaskSummary = { taskId, total: nodes.length, succeeded: 0, failed: [], cancelled: false };
  const profile = await activeProfileOrError();
  await send(tabId, { kind: "taskStarted", taskId, total: nodes.length, mode: "replace" });
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
  chrome.contextMenus.create({ id: "translate-page", title: "Translate this page", contexts: ["page"] });
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.contextMenus.onClicked.addListener((_info, tab) => {
  if (!tab?.id) return;
  if (!tab.url || /^(?:chrome|edge|about|moz-extension):/i.test(tab.url) || tab.url.startsWith("https://chrome.google.com/webstore")) {
    void chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#b91c1c" });
    void chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    void chrome.action.setTitle({ tabId: tab.id, title: "This page cannot be translated by browser extensions." });
    return;
  }
  send(tab.id, { kind: "preparePage", maxNodes: MAX_REQUESTS_PER_PAGE_TASK * NODES_PER_REQUEST, maxRequests: MAX_REQUESTS_PER_PAGE_TASK });
});
chrome.tabs.onRemoved.addListener((tabId) => { for (const task of tasks.values()) if (task.tabId === tabId) { task.cancelled = true; task.controller.abort(); } });
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.status === "loading") for (const task of tasks.values()) if (task.tabId === tabId) { task.cancelled = true; task.controller.abort(); } });

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, respond) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;
  if (message.kind === "translateSelection") {
    void activeProfileOrError().then((profile) => translate(profile, message.text))
      .then((text) => send(tabId, { kind: "selectionResult", text }))
      .catch((error) => send(tabId, { kind: "selectionError", error: error instanceof Error ? error.message : "Translation failed." }));
  }
  if (message.kind === "startPage" || message.kind === "retryNodes") void runPageTask(tabId, message.nodes).catch((error) => send(tabId, { kind: "taskError", error: error instanceof Error ? error.message : "Unable to start translation." }));
  if (message.kind === "cancelTask") { const task = tasks.get(message.taskId); if (task) { task.cancelled = true; task.controller.abort(); } }
  respond();
});
