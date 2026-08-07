import { TranslationError, translate, translateBatch, translateStreaming } from "./shared/api";
import { planTranslationBatches } from "./shared/batching";
import { MAX_REQUESTS_PER_PAGE_TASK } from "./shared/constants";
import { getActiveProfile } from "./shared/storage";
import { withRetries } from "./shared/retry";
import { TranslationCache, translationCacheKey } from "./shared/translation-cache";
import type { PageNode, PageTaskType, Profile, RuntimeMessage, TaskSummary, TranslationPerformance, TranslationResult } from "./shared/types";

const MAX_RETRIES = 3;
const INITIAL_CONCURRENCY = 5;
const MAX_CONCURRENCY = 8;
interface Task {
  controller: AbortController;
  tabId: number;
  cancelled: boolean;
  requestsStarted: number;
  profile: Profile;
  concurrencyLimit: number;
  successStreak: number;
  performance: TranslationPerformance;
}
const tasks = new Map<string, Task>();
const translationCache = new TranslationCache();
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
    if (task.requestsStarted >= MAX_REQUESTS_PER_PAGE_TASK) throw new TranslationError(`This page task reached its ${MAX_REQUESTS_PER_PAGE_TASK}-request limit.`, 400);
    task.requestsStarted += 1;
    const startedAt = performance.now();
    try {
      const result = await translateBatch(task.profile, nodes, task.controller.signal);
      task.successStreak += 1;
      if (task.successStreak >= 4 && task.concurrencyLimit < MAX_CONCURRENCY) {
        task.concurrencyLimit += 1;
        task.performance.peakConcurrency = Math.max(task.performance.peakConcurrency, task.concurrencyLimit);
        task.successStreak = 0;
      }
      return result;
    }
    finally { task.performance.providerMs += performance.now() - startedAt; }
  }, MAX_RETRIES, () => task.cancelled || task.controller.signal.aborted, {
    shouldRetry: (error) => !(error instanceof TranslationError) || error.status === undefined || error.status === 408 || error.status === 409 || error.status === 425 || error.status === 429 || error.status >= 500,
    delayMs: (error, attempt) => error instanceof TranslationError && error.retryAfterMs !== undefined
      ? Math.min(error.retryAfterMs, 10_000)
      : Math.min(4_000, 250 * (2 ** attempt)) + Math.floor(Math.random() * 150),
    onRetry: (error) => {
      task.performance.retries += 1;
      task.successStreak = 0;
      if (error instanceof TranslationError && (error.status === 429 || error.status === 503)) {
        task.concurrencyLimit = Math.max(2, task.concurrencyLimit - 1);
      }
    }
  });
}

async function runPageTask(tabId: number, nodes: PageNode[], taskType: PageTaskType, scanMs = 0) {
  for (const existing of tasks.values()) if (existing.tabId === tabId) { existing.cancelled = true; existing.controller.abort(); }
  const profile = await activeProfileOrError();
  const taskId = id();
  const startedAt = performance.now();
  const task: Task = {
    tabId,
    controller: new AbortController(),
    cancelled: false,
    requestsStarted: 0,
    profile,
    concurrencyLimit: INITIAL_CONCURRENCY,
    successStreak: 0,
    performance: { scanMs, firstResultMs: null, totalMs: 0, providerMs: 0, requests: 0, retries: 0, peakConcurrency: INITIAL_CONCURRENCY, cacheHits: 0, deduplicated: 0 }
  };
  tasks.set(taskId, task);
  const summary: TaskSummary = { taskId, total: nodes.length, succeeded: 0, failed: [], cancelled: false };
  await send(tabId, { kind: "taskStarted", taskId, total: nodes.length, mode: profile.mode, taskType });

  const groups = new Map<string, PageNode[]>();
  for (const node of nodes) {
    const group = groups.get(node.text);
    if (group) group.push(node); else groups.set(node.text, [node]);
  }
  task.performance.deduplicated = nodes.length - groups.size;
  const representatives: PageNode[] = [];
  const groupsById = new Map<string, PageNode[]>();
  const cachedResults: TranslationResult[] = [];
  for (const group of groups.values()) {
    const representative = group[0];
    groupsById.set(representative.id, group);
    const cached = translationCache.get(translationCacheKey(profile, representative.text));
    if (cached === undefined) representatives.push(representative);
    else {
      task.performance.cacheHits += group.length;
      cachedResults.push(...group.map((node) => ({ nodeId: node.id, text: cached })));
    }
  }
  if (cachedResults.length) {
    summary.succeeded += cachedResults.length;
    task.performance.firstResultMs = performance.now() - startedAt;
    await send(tabId, { kind: "batchResult", taskId, results: cachedResults });
  }

  const { batches, overflow } = planTranslationBatches(representatives);
  for (const representative of overflow) {
    const group = groupsById.get(representative.id) ?? [representative];
    summary.failed.push(...group);
    for (const node of group) await send(tabId, { kind: "nodeFailed", taskId, node, error: `This page task reached its ${MAX_REQUESTS_PER_PAGE_TASK}-request limit.` });
  }
  let index = 0;
  const worker = async (workerId: number) => {
    while (!task.cancelled && index < batches.length) {
      if (workerId >= task.concurrencyLimit) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        continue;
      }
      const batchIndex = index++;
      const batch = batches[batchIndex];
      try {
        const translations = await translateBatchWithRetry(batch, task);
        if (!task.cancelled) {
          const results: TranslationResult[] = [];
          for (const representative of batch) {
            const text = translations.get(representative.id)!;
            translationCache.set(translationCacheKey(profile, representative.text), text);
            const group = groupsById.get(representative.id) ?? [representative];
            results.push(...group.map((node) => ({ nodeId: node.id, text })));
          }
          summary.succeeded += results.length;
          if (task.performance.firstResultMs === null) task.performance.firstResultMs = performance.now() - startedAt;
          await send(tabId, { kind: "batchResult", taskId, results });
        }
      } catch (error) {
        if (task.cancelled || task.controller.signal.aborted) break;
        for (const representative of batch) {
          const group = groupsById.get(representative.id) ?? [representative];
          summary.failed.push(...group);
          for (const node of group) await send(tabId, { kind: "nodeFailed", taskId, node, error: error instanceof Error ? error.message : "Translation failed." });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, batches.length) }, (_, workerId) => worker(workerId)));
  summary.cancelled = task.cancelled;
  task.performance.requests = task.requestsStarted;
  task.performance.totalMs = performance.now() - startedAt;
  summary.performance = task.performance;
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
    void activeProfileOrError().then(async (profile) => {
      try {
        return await translateStreaming(profile, message.text, (text) => {
          if (!controller.signal.aborted) void send(tabId, { kind: "selectionChunk", requestId: message.requestId, text });
        }, controller.signal);
      } catch (error) {
        if (error instanceof TranslationError && (error.status === 400 || error.status === 422)) return translate(profile, message.text, controller.signal);
        throw error;
      }
    })
      .then((text) => { if (!controller.signal.aborted) return send(tabId, { kind: "selectionResult", requestId: message.requestId, text }); })
      .catch((error) => { if (!controller.signal.aborted) return send(tabId, { kind: "selectionError", requestId: message.requestId, error: error instanceof Error ? error.message : "Translation failed." }); })
      .finally(() => { selectionTasks.delete(message.requestId); respond(); });
    return true;
  }
  if (message.kind === "cancelSelection") { selectionTasks.get(message.requestId)?.controller.abort(); selectionTasks.delete(message.requestId); respond(); return; }
  if (message.kind === "startPage" || message.kind === "appendPage" || message.kind === "retryNodes") {
    const taskType: PageTaskType = message.kind === "startPage" ? "initial" : message.kind === "appendPage" ? "append" : "retry";
    void runPageTask(tabId, message.nodes, taskType, message.kind === "startPage" ? message.scanMs ?? 0 : 0)
      .catch((error) => send(tabId, { kind: "taskError", error: error instanceof Error ? error.message : "Unable to start translation." }))
      .finally(respond);
    return true;
  }
  if (message.kind === "cancelTask") { const task = tasks.get(message.taskId); if (task) { task.cancelled = true; task.controller.abort(); } respond(); return; }
  respond();
});
