export type TranslationMode = "replace" | "preserve";

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

export interface Settings { profiles: Profile[]; activeProfileId: string | null; }
export interface PageNode { id: string; text: string; }
export interface TaskSummary { taskId: string; total: number; succeeded: number; failed: PageNode[]; cancelled: boolean; }

export type RuntimeMessage =
  | { kind: "translateSelection"; requestId: string; text: string }
  | { kind: "cancelSelection"; requestId: string }
  | { kind: "profilesChanged" }
  | { kind: "startPage"; nodes: PageNode[] }
  | { kind: "cancelTask"; taskId: string }
  | { kind: "retryNodes"; nodes: PageNode[] }
  | { kind: "restorePage" }
  | { kind: "preparePage"; maxNodes: number; maxRequests: number }
  | { kind: "pagePrepared"; count: number }
  | { kind: "selectionResult"; requestId: string; text: string }
  | { kind: "selectionError"; requestId: string; error: string }
  | { kind: "taskStarted"; taskId: string; total: number; mode: TranslationMode }
  | { kind: "nodeResult"; taskId: string; nodeId: string; text: string }
  | { kind: "nodeFailed"; taskId: string; node: PageNode; error: string }
  | { kind: "taskFinished"; summary: TaskSummary }
  | { kind: "taskError"; error: string }
  | { kind: "notice"; message: string };
