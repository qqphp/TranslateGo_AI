import type { UiLocale } from "./types";

type Messages = Record<string, string>;
let selectedLocale: UiLocale | null = null;

const commonEnglish: Messages = {
  title: "LLM Web Translator", uiLanguage: "Interface language", followBrowser: "Follow browser", autoDetect: "Auto detect",
  save: "Save profile", add: "Add profile", remove: "Delete", test: "Test connection", active: "Active profile", profiles: "Profiles",
  newProfile: "New profile", editProfile: "Edit profile", noProfiles: "No profiles yet.", name: "Name", baseUrl: "Base URL", apiKey: "API key", model: "Model",
  source: "Source language", target: "Target language", mode: "Translation mode", replace: "Replace original", preserve: "Preserve original",
  connected: "Connection succeeded. This profile is now active.", connectionFailed: "Connection failed.", invalidUrl: "Base URL must be a valid absolute URL.",
  insecureUrl: "Base URL must use HTTPS (HTTP is only allowed for localhost).", credentialsUrl: "Base URL must not contain embedded credentials.", queryUrl: "Base URL must not contain a query string or fragment.",
  privacy: "Page text is read only after you explicitly translate it and is sent only to your configured API. It is never saved or used for telemetry.", unsupported: "This page cannot be translated by browser extensions."
};

const messages: Record<UiLocale, Messages> = {
  en: commonEnglish,
  "zh-CN": { ...commonEnglish, title: "大模型网页翻译", uiLanguage: "界面语言", followBrowser: "跟随浏览器", save: "保存档案", add: "新增档案", remove: "删除", test: "测试连接", active: "当前档案", profiles: "配置档案", newProfile: "新建档案", editProfile: "编辑档案", noProfiles: "尚无配置档案。", name: "名称", apiKey: "API 密钥", model: "模型", source: "源语言", target: "目标语言", mode: "翻译模式", replace: "替换原文", preserve: "保留原文", connected: "连接成功，此档案已设为当前档案。", connectionFailed: "连接失败。", invalidUrl: "Base URL 必须是有效的绝对地址。", insecureUrl: "Base URL 必须使用 HTTPS（仅 localhost 可使用 HTTP）。", credentialsUrl: "Base URL 不能包含用户名或密码。", queryUrl: "Base URL 不能包含查询参数或片段。", privacy: "仅在您主动翻译后读取网页文本，并且只发送到您配置的 API；不会保存或用于遥测。", unsupported: "浏览器扩展无法翻译此页面。" },
  "zh-TW": { ...commonEnglish, title: "大模型網頁翻譯", uiLanguage: "介面語言", followBrowser: "跟隨瀏覽器", save: "儲存設定檔", add: "新增設定檔", remove: "刪除", test: "測試連線", active: "目前設定檔", profiles: "設定檔", newProfile: "新增設定檔", editProfile: "編輯設定檔", noProfiles: "尚無設定檔。", name: "名稱", apiKey: "API 金鑰", model: "模型", source: "來源語言", target: "目標語言", mode: "翻譯模式", replace: "取代原文", preserve: "保留原文", connected: "連線成功，此設定檔已設為目前設定檔。", connectionFailed: "連線失敗。", invalidUrl: "Base URL 必須是有效的絕對網址。", insecureUrl: "Base URL 必須使用 HTTPS（僅 localhost 可使用 HTTP）。", credentialsUrl: "Base URL 不得包含使用者名稱或密碼。", queryUrl: "Base URL 不得包含查詢參數或片段。", privacy: "僅在您主動翻譯後讀取網頁文字，並且只傳送到您設定的 API；不會儲存或用於遙測。", unsupported: "瀏覽器擴充功能無法翻譯此頁面。" },
  ja: { ...commonEnglish, title: "LLM Web 翻訳", uiLanguage: "表示言語", followBrowser: "ブラウザーに合わせる", save: "プロファイルを保存", add: "プロファイルを追加", remove: "削除", test: "接続をテスト", active: "現在のプロファイル", profiles: "プロファイル", newProfile: "新しいプロファイル", editProfile: "プロファイルを編集", noProfiles: "プロファイルがありません。", name: "名前", apiKey: "API キー", model: "モデル", source: "翻訳元の言語", target: "翻訳先の言語", mode: "翻訳モード", replace: "原文を置換", preserve: "原文を保持", connected: "接続に成功し、このプロファイルを有効にしました。", connectionFailed: "接続に失敗しました。", invalidUrl: "Base URL は有効な絶対 URL である必要があります。", insecureUrl: "Base URL は HTTPS が必要です（localhost のみ HTTP 可）。", credentialsUrl: "Base URL に認証情報を含めることはできません。", queryUrl: "Base URL にクエリやフラグメントを含めることはできません。", privacy: "ページ本文は明示的に翻訳した場合のみ読み取り、設定した API にのみ送信します。保存・利用状況の計測はしません。", unsupported: "このページはブラウザー拡張機能では翻訳できません。" }
};

Object.assign(messages.en, { ok: "OK", confirm: "Delete", cancel: "Cancel", saved: "Profile saved successfully.", confirmDelete: "Delete this profile? This action cannot be undone.", deleted: "Profile deleted." });
Object.assign(messages["zh-CN"], { autoDetect: "自动检测", ok: "确定", confirm: "删除", cancel: "取消", saved: "档案保存成功。", confirmDelete: "确定删除此档案吗？此操作无法撤销。", deleted: "档案已删除。" });
Object.assign(messages["zh-TW"], { autoDetect: "自動偵測", ok: "確定", confirm: "刪除", cancel: "取消", saved: "設定檔儲存成功。", confirmDelete: "確定刪除此設定檔嗎？此操作無法復原。", deleted: "設定檔已刪除。" });
Object.assign(messages.ja, { autoDetect: "自動検出", ok: "OK", confirm: "削除", cancel: "キャンセル", saved: "プロファイルを保存しました。", confirmDelete: "このプロファイルを削除しますか？この操作は元に戻せません。", deleted: "プロファイルを削除しました。" });

export function getLocale(language = navigator.language): UiLocale {
  const normalized = language.toLowerCase();
  return normalized.startsWith("zh-tw") || normalized.startsWith("zh-hk") ? "zh-TW" : normalized.startsWith("zh") ? "zh-CN" : normalized.startsWith("ja") ? "ja" : "en";
}

export function setLocale(locale: UiLocale | null): void { selectedLocale = locale; }
export function t(key: string): string { return messages[selectedLocale ?? getLocale()][key] ?? messages.en[key] ?? key; }
