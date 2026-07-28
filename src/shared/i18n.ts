import type { UiLocale } from "./types";
import { createAdditionalLocaleMessages } from "./i18n-locales";

type Messages = Record<string, string>;
let selectedLocale: UiLocale | null = null;

const PRODUCT_NAME = "AI大模型-沉浸式翻译-免费-极简";

const commonEnglish: Messages = {
  title: PRODUCT_NAME,
  brandTagline: "A focused AI translation tool for every webpage",
  uiLanguage: "Interface language", followBrowser: "Follow browser", autoDetect: "Auto detect",
  settingsTab: "Settings", aboutTab: "About", pageNavigation: "Settings page navigation",
  save: "Save profile", add: "Add profile", remove: "Delete", test: "Test connection", active: "Active", profiles: "Profiles",
  profilesEyebrow: "Saved", editingEyebrow: "Update", createEyebrow: "Configure",
  newProfile: "New profile", editProfile: "Edit profile", noProfiles: "No profiles yet.", name: "Name", baseUrl: "Base URL", apiKey: "API key", model: "Model", language: "Languages",
  source: "Source language", target: "Target language", mode: "Translation mode", replace: "Replace original", preserve: "Bilingual comparison",
  connected: "Connection succeeded. This profile is now active.", connectionFailed: "Connection failed.", invalidUrl: "Base URL must be a valid absolute URL.",
  insecureUrl: "Base URL must use HTTPS (HTTP is only allowed for localhost).", credentialsUrl: "Base URL must not contain embedded credentials.", queryUrl: "Base URL must not contain a query string or fragment.",
  privacy: "Page text is read only after you explicitly translate it and is sent only to your configured API. It is never saved or used for telemetry.", unsupported: "This page cannot be translated by browser extensions.",
  ok: "OK", confirm: "Delete", cancel: "Cancel", saved: "Profile saved successfully.", confirmDelete: "Delete this profile? This action cannot be undone.", deleted: "Profile deleted.",
  aboutEyebrow: "Designed for reading", aboutTitle: "Translation without distractions", aboutIntro: "A lightweight browser extension powered by your chosen AI model. Translate selected text or an entire webpage while staying focused on what you are reading.",
  featureFree: "Free", featureFreeDesc: "The extension has no subscription fee and works with your configured API.",
  featureAllInOne: "All-in-one AI translation", featureAllInOneDesc: "Manage models, languages, selected text, and full-page translation in one place.",
  featureSelection: "Selection translation", featureSelectionDesc: "Select any passage and get its translation without leaving the page.",
  featureBilingual: "Bilingual comparison", featureBilingualDesc: "Keep the original beside the translation for easy comparison and study.",
  featureLanguages: "Multiple languages", featureLanguagesDesc: "Translate between a broad selection of commonly used languages.",
  featureNoAds: "Ad-free", featureNoAdsDesc: "No advertising, promotional popups, or attention-grabbing clutter.",
  featurePure: "Pure", featurePureDesc: "Local profiles, no telemetry, and a product experience focused on translation.",
  featureAccurate: "Accurate", featureAccurateDesc: "Use capable large language models for context-aware translations.",
  featureFluent: "Fluent", featureFluentDesc: "Readable phrasing helps ideas flow naturally across languages.",
  featureNatural: "Natural", featureNaturalDesc: "Translations favor authentic expression over rigid word-for-word output.",
  aboutClosingTitle: "Built only for translation", aboutClosing: "Break language barriers with ease and understand any content you encounter on the web."
};

const simplifiedChinese: Messages = {
  ...commonEnglish,
  brandTagline: "专注、纯粹的网页 AI 翻译工具",
  uiLanguage: "界面语言", followBrowser: "跟随浏览器", autoDetect: "自动检测",
  settingsTab: "配置", aboutTab: "说明", pageNavigation: "配置页面导航",
  save: "保存档案", add: "新增档案", remove: "删除", test: "测试连接", active: "当前", profiles: "配置档案",
  profilesEyebrow: "已保存", editingEyebrow: "更新配置", createEyebrow: "连接模型",
  newProfile: "新建档案", editProfile: "编辑档案", noProfiles: "尚无配置档案。", name: "名称", apiKey: "API 密钥", model: "模型", language: "语言",
  source: "源语言", target: "目标语言", mode: "翻译模式", replace: "替换原文", preserve: "双语对照",
  connected: "连接成功，此档案已设为当前档案。", connectionFailed: "连接失败。", invalidUrl: "Base URL 必须是有效的绝对地址。", insecureUrl: "Base URL 必须使用 HTTPS（仅 localhost 可使用 HTTP）。", credentialsUrl: "Base URL 不能包含用户名或密码。", queryUrl: "Base URL 不能包含查询参数或片段。",
  privacy: "仅在您主动翻译后读取网页文本，并且只发送到您配置的 API；不会保存或用于遥测。", unsupported: "浏览器扩展无法翻译此页面。",
  ok: "确定", confirm: "删除", cancel: "取消", saved: "档案保存成功。", confirmDelete: "确定删除此档案吗？此操作无法撤销。", deleted: "档案已删除。",
  aboutEyebrow: "为阅读而生", aboutTitle: "纯粹、轻松的沉浸式翻译", aboutIntro: "这是一款由你选择的 AI 大模型驱动的轻量浏览器插件。无需离开当前网页，即可翻译选中文本或整页内容，让阅读始终连贯专注。",
  featureFree: "免费", featureFreeDesc: "插件本身不收取订阅费用，连接你配置的 API 即可使用。",
  featureAllInOne: "一站式 AI 翻译", featureAllInOneDesc: "模型、语言、划词与整页翻译集中管理，一处配置即可使用。",
  featureSelection: "划词翻译", featureSelectionDesc: "选中网页上的任意文字，原地获取译文，无需复制或跳转。",
  featureBilingual: "双语对照翻译", featureBilingualDesc: "保留原文并紧随显示译文，对照阅读与语言学习都更轻松。",
  featureLanguages: "支持多种语言", featureLanguagesDesc: "覆盖多种常用语言，轻松切换源语言与目标语言。",
  featureNoAds: "无广告", featureNoAdsDesc: "没有广告、推广弹窗或打断阅读的多余内容。",
  featurePure: "纯洁", featurePureDesc: "档案保存在本地，不做遥测，产品体验只专注于翻译。",
  featureAccurate: "准确", featureAccurateDesc: "借助大模型理解上下文，让译文准确传达原意。",
  featureFluent: "流畅", featureFluentDesc: "顺畅易读的表达，让跨语言阅读不再磕绊。",
  featureNatural: "自然", featureNaturalDesc: "告别生硬的逐字替换，呈现更贴近真实语言的译文。",
  aboutClosingTitle: "只为翻译而打造", aboutClosing: "助你轻松打破语言障碍，读懂网页上的任何内容。"
};

const traditionalChinese: Messages = {
  ...simplifiedChinese,
  brandTagline: "專注、純粹的網頁 AI 翻譯工具", uiLanguage: "介面語言", followBrowser: "跟隨瀏覽器", autoDetect: "自動偵測",
  settingsTab: "設定", aboutTab: "說明", pageNavigation: "設定頁面導覽", save: "儲存設定檔", add: "新增設定檔", remove: "刪除", test: "測試連線", active: "目前", profiles: "設定檔",
  profilesEyebrow: "已儲存", editingEyebrow: "更新設定", createEyebrow: "連接模型", newProfile: "新增設定檔", editProfile: "編輯設定檔", noProfiles: "尚無設定檔。", name: "名稱", apiKey: "API 金鑰", model: "模型", language: "語言",
  source: "來源語言", target: "目標語言", mode: "翻譯模式", replace: "取代原文", preserve: "雙語對照", connected: "連線成功，此設定檔已設為目前設定檔。", connectionFailed: "連線失敗。", invalidUrl: "Base URL 必須是有效的絕對網址。", insecureUrl: "Base URL 必須使用 HTTPS（僅 localhost 可使用 HTTP）。", credentialsUrl: "Base URL 不得包含使用者名稱或密碼。", queryUrl: "Base URL 不得包含查詢參數或片段。",
  privacy: "僅在您主動翻譯後讀取網頁文字，並且只傳送到您設定的 API；不會儲存或用於遙測。", unsupported: "瀏覽器擴充功能無法翻譯此頁面。", ok: "確定", confirm: "刪除", cancel: "取消", saved: "設定檔儲存成功。", confirmDelete: "確定刪除此設定檔嗎？此操作無法復原。", deleted: "設定檔已刪除。",
  aboutEyebrow: "為閱讀而生", aboutTitle: "純粹、輕鬆的沉浸式翻譯", aboutIntro: "這是一款由你選擇的 AI 大模型驅動的輕量瀏覽器擴充功能。無需離開目前網頁，即可翻譯選取文字或整頁內容。",
  featureFree: "免費", featureFreeDesc: "擴充功能本身不收取訂閱費用，連接你設定的 API 即可使用。", featureAllInOne: "一站式 AI 翻譯", featureAllInOneDesc: "模型、語言、選取與整頁翻譯集中管理。", featureSelection: "劃詞翻譯", featureSelectionDesc: "選取網頁上的任意文字，原地取得譯文。", featureBilingual: "雙語對照翻譯", featureBilingualDesc: "保留原文並緊隨顯示譯文，方便對照閱讀。", featureLanguages: "支援多種語言", featureLanguagesDesc: "涵蓋多種常用語言，輕鬆切換來源與目標語言。", featureNoAds: "無廣告", featureNoAdsDesc: "沒有廣告、推廣彈窗或打斷閱讀的內容。", featurePure: "純潔", featurePureDesc: "設定檔儲存在本機，不做遙測，只專注翻譯。", featureAccurate: "準確", featureAccurateDesc: "借助大模型理解上下文，準確傳達原意。", featureFluent: "流暢", featureFluentDesc: "順暢易讀的表達，讓跨語言閱讀更輕鬆。", featureNatural: "自然", featureNaturalDesc: "呈現更貼近真實語言的自然譯文。", aboutClosingTitle: "只為翻譯而打造", aboutClosing: "助你輕鬆打破語言障礙，讀懂網頁上的任何內容。"
};

const japanese: Messages = {
  ...commonEnglish,
  brandTagline: "ウェブ閲覧に集中できる、純粋な AI 翻訳ツール", uiLanguage: "表示言語", followBrowser: "ブラウザーに合わせる", autoDetect: "自動検出",
  settingsTab: "設定", aboutTab: "概要", pageNavigation: "設定ページのナビゲーション", save: "プロファイルを保存", add: "プロファイルを追加", remove: "削除", test: "接続をテスト", active: "使用中", profiles: "プロファイル",
  profilesEyebrow: "保存済み", editingEyebrow: "設定を更新", createEyebrow: "モデルに接続", newProfile: "新しいプロファイル", editProfile: "プロファイルを編集", noProfiles: "プロファイルがありません。", name: "名前", apiKey: "API キー", model: "モデル", language: "言語",
  source: "翻訳元の言語", target: "翻訳先の言語", mode: "翻訳モード", replace: "原文を置換", preserve: "バイリンガル表示", connected: "接続に成功し、このプロファイルを有効にしました。", connectionFailed: "接続に失敗しました。", invalidUrl: "Base URL は有効な絶対 URL である必要があります。", insecureUrl: "Base URL は HTTPS が必要です（localhost のみ HTTP 可）。", credentialsUrl: "Base URL に認証情報を含めることはできません。", queryUrl: "Base URL にクエリやフラグメントを含めることはできません。",
  privacy: "ページ本文は明示的に翻訳した場合のみ読み取り、設定した API にのみ送信します。保存・利用状況の計測はしません。", unsupported: "このページはブラウザー拡張機能では翻訳できません。", ok: "OK", confirm: "削除", cancel: "キャンセル", saved: "プロファイルを保存しました。", confirmDelete: "このプロファイルを削除しますか？この操作は元に戻せません。", deleted: "プロファイルを削除しました。",
  aboutEyebrow: "読むためのデザイン", aboutTitle: "邪魔のない没入型翻訳", aboutIntro: "選択した AI モデルで動作する軽量なブラウザー拡張機能です。ページを離れずに、選択した文章やページ全体を翻訳できます。",
  featureFree: "無料", featureFreeDesc: "拡張機能の利用料はなく、設定した API で使用できます。", featureAllInOne: "AI 翻訳を一か所に", featureAllInOneDesc: "モデル、言語、選択範囲、ページ翻訳をまとめて管理できます。", featureSelection: "選択範囲を翻訳", featureSelectionDesc: "文章を選ぶだけで、その場に翻訳を表示します。", featureBilingual: "原文と訳文を対照表示", featureBilingualDesc: "原文を残して訳文を並べ、読み比べられます。", featureLanguages: "多言語対応", featureLanguagesDesc: "多くの一般的な言語を切り替えて翻訳できます。", featureNoAds: "広告なし", featureNoAdsDesc: "広告や宣伝ポップアップで読書を妨げません。", featurePure: "純粋", featurePureDesc: "ローカル保存、テレメトリなし。翻訳だけに集中します。", featureAccurate: "正確", featureAccurateDesc: "大規模言語モデルが文脈を理解して原意を伝えます。", featureFluent: "流暢", featureFluentDesc: "読みやすい表現で言語の壁を滑らかに越えます。", featureNatural: "自然", featureNaturalDesc: "逐語訳ではなく、自然な言い回しを重視します。", aboutClosingTitle: "翻訳のためだけに設計", aboutClosing: "言葉の壁を気軽に越え、ウェブ上のあらゆる内容を理解できます。"
};

const messages: Record<UiLocale, Messages> = { en: commonEnglish, "zh-CN": simplifiedChinese, "zh-TW": traditionalChinese, ja: japanese, ...createAdditionalLocaleMessages(commonEnglish) };

export function getLocale(language = navigator.language): UiLocale {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("zh-tw") || normalized.startsWith("zh-hk") || normalized.startsWith("zh-hant")) return "zh-TW";
  if (normalized.startsWith("zh")) return "zh-CN";
  const primary = normalized.split("-")[0] as UiLocale;
  return Object.prototype.hasOwnProperty.call(messages, primary) ? primary : "en";
}

export function setLocale(locale: UiLocale | null): void { selectedLocale = locale; }
export function t(key: string): string { return messages[selectedLocale ?? getLocale()][key] ?? messages.en[key] ?? key; }
