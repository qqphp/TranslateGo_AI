export type TranslationMode = "replace" | "preserve";
export type UiLocale = "zh-CN" | "zh-TW" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru" | "ar" | "it" | "th" | "vi" | "id" | "hi" | "tr";
export type UiLocalePreference = "auto" | UiLocale;

export interface Profile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  mode: TranslationMode;
}

export interface Settings { profiles: Profile[]; activeProfileId: string | null; uiLocale?: UiLocalePreference; }
export interface PageNode { id: string; text: string; }
export interface TaskSummary { taskId: string; total: number; succeeded: number; failed: PageNode[]; cancelled: boolean; }
export type PageTaskType = "initial" | "append" | "retry";

export type RuntimeMessage =
  | { kind: "translateSelection"; requestId: string; text: string }
  | { kind: "translateSelectionFromMenu"; text: string }
  | { kind: "cancelSelection"; requestId: string }
  | { kind: "profilesChanged" }
  | { kind: "startPage"; nodes: PageNode[] }
  | { kind: "appendPage"; nodes: PageNode[] }
  | { kind: "cancelTask"; taskId: string }
  | { kind: "retryNodes"; nodes: PageNode[] }
  | { kind: "restorePage" }
  | { kind: "preparePage"; maxNodes: number; maxRequests: number }
  | { kind: "pagePrepared"; count: number }
  | { kind: "selectionResult"; requestId: string; text: string }
  | { kind: "selectionError"; requestId: string; error: string }
  | { kind: "taskStarted"; taskId: string; total: number; mode: TranslationMode; taskType: PageTaskType }
  | { kind: "nodeResult"; taskId: string; nodeId: string; text: string }
  | { kind: "nodeFailed"; taskId: string; node: PageNode; error: string }
  | { kind: "taskFinished"; summary: TaskSummary }
  | { kind: "taskError"; error: string }
  | { kind: "notice"; message: string };
