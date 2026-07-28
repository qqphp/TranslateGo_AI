import { translate } from "./shared/api";
import { getSettings, saveSettings, validateBaseUrl } from "./shared/storage";
import { localeNames, setLocale, t } from "./shared/i18n";
import { LANGUAGE_OPTIONS, normalizeLanguage } from "./shared/languages";
import { addTranslationHistory, getTranslationHistory } from "./shared/translation-history";
import type { Profile, Settings, TranslationHistoryEntry, TranslationMode, UiLocale, UiLocalePreference } from "./shared/types";
import "./options.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
let settings: Settings;
let editing: Profile | null = null;
let activeTab: "translate" | "settings" | "about" = "settings";
let translationInput = "";
let translationResult = "";
let translationSource = "auto";
let translationTarget = "zh-CN";
let translationPending = false;
let translationError = "";
let translationRequestId = 0;

type IconName = "settings" | "info" | "profile" | "plus" | "save" | "test" | "trash" | "check" | "close" | "model" | "language" | "gift" | "sparkles" | "selection" | "bilingual" | "globe" | "shield" | "focus" | "accurate" | "flow" | "natural" | "translate" | "copy" | "refresh" | "clear" | "history";

const iconPaths: Record<IconName, string> = {
  settings: '<path d="M4 7h10M4 12h16M16 7h4M4 17h4M10 17h10"/><circle cx="12" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  profile: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9h8M8 13h6M8 17h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  save: '<path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6"/>',
  test: '<path d="m13 2-1 7h6l-9 13 2-9H5z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  model: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M19 9h3M2 15h3M19 15h3"/>',
  language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  gift: '<path d="M4 10h16v11H4zM3 7h18v4H3zM12 7v14M12 7H8.5A2.5 2.5 0 1 1 12 3.5V7Zm0 0h3.5A2.5 2.5 0 1 0 12 3.5V7Z"/>',
  sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14ZM18 13l.7 1.8 1.8.7-1.8.7L18 18l-.7-1.8-1.8-.7 1.8-.7L18 13Z"/>',
  selection: '<path d="M5 4h5M4 5v5M19 4h-5M20 5v5M5 20h5M4 19v-5M19 20h-5M20 19v-5M8 12h8"/>',
  bilingual: '<path d="M4 5h7v10H7l-3 3V5Zm9 4h7v10h-3l-3 3v-3h-1V9Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  focus: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/><circle cx="12" cy="12" r="3"/>',
  accurate: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flow: '<path d="M4 7h11M12 4l3 3-3 3M20 17H9M12 14l-3 3 3 3"/>',
  natural: '<path d="M19 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 9-6 9-15Z"/><path d="M5 20c2-5 5-8 10-11"/>',
  translate: '<path d="M4 5h10M9 3v2c0 5-2 8-6 10M6 9c1.5 2.5 3.5 4.5 6 6M14 11h4l3 10M19.5 17h-7"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  refresh: '<path d="M20 7V3m0 0h-4M20 3l-3 3a7 7 0 0 0-11 2M4 17v4m0 0h4m-4 0 3-3a7 7 0 0 0 11-2"/>',
  clear: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  history: '<path d="M4 12a8 8 0 1 0 2-5.3L4 9M4 4v5h5M12 8v5l3 2"/>'
};

const icon = (name: IconName, className = "icon") => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
const buttonContent = (name: IconName, label: string) => `${icon(name)}<span>${escape(label)}</span>`;
const newProfile = (): Profile => ({ id: crypto.randomUUID(), name: "", baseUrl: "", apiKey: "", model: "", sourceLanguage: "auto", targetLanguage: "zh-CN", mode: "replace" });
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const format = (value: string, variables: Record<string, string | number>) => value.replace(/\{([a-z]+)\}/g, (placeholder, key: string) => key in variables ? String(variables[key]) : placeholder);
const notifyProfileChange = () => chrome.runtime.sendMessage({ kind: "profilesChanged" }).catch(() => undefined);
const localizeUrlError = (error: string) => error.includes("valid absolute") ? t("invalidUrl") : error.includes("HTTPS") ? t("insecureUrl") : error.includes("credentials") ? t("credentialsUrl") : error.includes("query string") ? t("queryUrl") : error;

function displayLanguage(value: string, includeAuto = false): string {
  const normalized = normalizeLanguage(value, includeAuto ? "auto" : "zh-CN");
  if (normalized === "auto") return t("autoDetect");
  const option = LANGUAGE_OPTIONS.find((item) => item.value === normalized);
  if (!option) return value;
  const locale = document.documentElement.lang || navigator.language;
  if (locale.toLowerCase().startsWith("zh-cn")) return option.zhCN;
  return typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "language" }).of(option.displayCode) ?? option.zhCN : option.zhCN;
}

function languageOptions(selected: string, includeAuto: boolean): string {
  const auto = includeAuto ? `<option value="auto" ${selected === "auto" ? "selected" : ""}>${t("autoDetect")}</option>` : "";
  return auto + LANGUAGE_OPTIONS.map((option) => `<option value="${option.value}" ${selected === option.value ? "selected" : ""}>${escape(displayLanguage(option.value))}</option>`).join("");
}

function uiLanguageOptions(selected: UiLocalePreference | undefined): string {
  return `<option value="auto" ${!selected || selected === "auto" ? "selected" : ""}>${t("followBrowser")}</option>` + LANGUAGE_OPTIONS.map((option) => `<option value="${option.value}" ${selected === option.value ? "selected" : ""}>${localeNames[option.value as UiLocale]}</option>`).join("");
}

function showDialog(message: string, confirm = false): Promise<boolean> {
  document.querySelector(".settings-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.className = "settings-dialog";
  dialog.innerHTML = `<form method="dialog"><p>${escape(message)}</p><div class="dialog-actions">${confirm ? `<button type="button" class="button secondary dialog-cancel">${buttonContent("close", t("cancel"))}</button>` : ""}<button type="button" class="button ${confirm ? "danger" : "primary"} dialog-confirm">${buttonContent(confirm ? "trash" : "check", confirm ? t("confirm") : t("ok"))}</button></div></form>`;
  document.body.append(dialog);
  return new Promise((resolve) => {
    const finish = (result: boolean) => { if (typeof dialog.close === "function") dialog.close(); dialog.remove(); resolve(result); };
    dialog.querySelector<HTMLButtonElement>(".dialog-confirm")!.onclick = () => finish(true);
    dialog.querySelector<HTMLButtonElement>(".dialog-cancel")?.addEventListener("click", () => finish(false));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); }, { once: true });
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  });
}

function profileFromForm(form: HTMLFormElement, base: Profile): Profile {
  const data = new FormData(form);
  return {
    id: base.id, name: String(data.get("name")).trim(), baseUrl: String(data.get("baseUrl")).trim(), apiKey: String(data.get("apiKey")).trim(),
    model: String(data.get("model")).trim(), sourceLanguage: String(data.get("sourceLanguage")).trim(), targetLanguage: String(data.get("targetLanguage")).trim(), mode: data.get("mode") as TranslationMode
  };
}

function renderProfile(item: Profile): string {
  const active = item.id === settings.activeProfileId;
  const source = displayLanguage(item.sourceLanguage, true);
  const target = displayLanguage(item.targetLanguage);
  return `<button type="button" class="profile ${active ? "active" : ""}" aria-pressed="${active}" data-id="${item.id}">
    <span class="profile-leading">${icon("profile")}</span>
    <span class="profile-content">
      <span class="profile-name-row"><strong>${escape(item.name)}</strong>${active ? `<small>${icon("check", "status-icon")}${t("active")}</small>` : ""}</span>
      <span class="profile-detail">${icon("model", "meta-icon")}<span class="profile-detail-text"><span>${t("model")}</span><b>${escape(item.model)}</b></span></span>
      <span class="profile-detail">${icon("language", "meta-icon")}<span class="profile-detail-text"><span>${t("language")}</span><b>${escape(source)} → ${escape(target)}</b></span></span>
    </span>
  </button>`;
}

function renderTabs(): string {
  return `<nav class="tabs" role="tablist" aria-label="${escape(t("pageNavigation"))}">
    <button type="button" id="translate-tab" class="tab ${activeTab === "translate" ? "active" : ""}" role="tab" aria-selected="${activeTab === "translate"}">${buttonContent("translate", t("translateTab"))}</button>
    <button type="button" id="settings-tab" class="tab ${activeTab === "settings" ? "active" : ""}" role="tab" aria-selected="${activeTab === "settings"}">${buttonContent("settings", t("settingsTab"))}</button>
    <button type="button" id="about-tab" class="tab ${activeTab === "about" ? "active" : ""}" role="tab" aria-selected="${activeTab === "about"}">${buttonContent("info", t("aboutTab"))}</button>
  </nav>`;
}

function activeProfile(): Profile | null {
  return settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? null;
}

function configuredProfile(): Profile | null {
  const profile = activeProfile();
  return profile && profile.baseUrl.trim() && profile.apiKey.trim() && profile.model.trim() ? profile : null;
}

function useProfileLanguages(profile: Profile | null) {
  translationSource = normalizeLanguage(profile?.sourceLanguage ?? "auto", "auto");
  translationTarget = normalizeLanguage(profile?.targetLanguage ?? "zh-CN", "zh-CN");
}

function renderHistoryCard(entry: TranslationHistoryEntry): string {
  return `<article class="history-card" data-history-id="${escape(entry.id)}">
    <div class="history-languages">${icon("language", "meta-icon")}<span>${escape(displayLanguage(entry.sourceLanguage, true))} → ${escape(displayLanguage(entry.targetLanguage))}</span></div>
    <p class="history-source" title="${escape(entry.sourceText)}">${escape(entry.sourceText)}</p>
    <p class="history-translation" title="${escape(entry.translatedText)}">${escape(entry.translatedText)}</p>
    <div class="history-actions"><button type="button" class="compact-button" data-history-action="copy" data-history-id="${escape(entry.id)}">${buttonContent("copy", t("copy"))}</button><button type="button" class="compact-button" data-history-action="retranslate" data-history-id="${escape(entry.id)}">${buttonContent("refresh", t("retranslate"))}</button></div>
  </article>`;
}

function renderTranslator(): string {
  const profile = configuredProfile();
  const history = getTranslationHistory(settings);
  const inputCount = Array.from(translationInput).length;
  return `<section class="translator-page" role="tabpanel" aria-labelledby="translate-tab">
    <div class="translator-main">
      <div class="section-heading"><div><span class="eyebrow">${t("translatorEyebrow")}</span><h2>${t("translatorTitle")}</h2></div>${icon("translate", "heading-icon")}</div>
      <div class="translation-languages"><label>${t("source")}<select id="translation-source">${languageOptions(translationSource, true)}</select></label><label>${t("target")}<select id="translation-target">${languageOptions(translationTarget, false)}</select></label></div>
      <label class="translation-input-label" for="translation-input">${t("translationInput")}</label>
      <textarea id="translation-input" rows="9" placeholder="${escape(t("inputPlaceholder"))}">${escape(translationInput)}</textarea>
      <div class="translation-toolbar"><span class="character-count">${format(t("characterCount"), { count: inputCount })}</span><div class="translation-actions"><button type="button" id="clear-translation" class="button secondary" ${translationInput || translationResult ? "" : "disabled"}>${buttonContent("clear", t("clear"))}</button><button type="button" id="translate-text" class="button primary" ${profile && translationInput.trim() && !translationPending ? "" : "disabled"}>${buttonContent("translate", translationPending ? t("translationInProgress") : t("translateAction"))}</button></div></div>
      ${profile ? "" : `<div class="model-required">${icon("model")}<span>${t("modelRequired")}</span><button type="button" id="configure-model" class="text-button">${t("settingsTab")}</button></div>`}
      ${translationError ? `<div class="translation-error" role="alert">${escape(translationError)}</div>` : ""}
      <div class="translation-result-card"><div class="result-heading"><div><span class="eyebrow">${t("translationResultEyebrow")}</span><h3>${t("translationResult")}</h3></div>${translationResult ? `<div class="result-actions"><button type="button" id="copy-result" class="compact-button">${buttonContent("copy", t("copy"))}</button><button type="button" id="retranslate-result" class="compact-button">${buttonContent("refresh", t("retranslate"))}</button></div>` : ""}</div><div class="translation-output ${translationResult ? "" : "empty"}" aria-live="polite">${translationResult ? escape(translationResult) : escape(t("resultPlaceholder"))}</div></div>
    </div>
    <aside class="translation-history"><div class="section-heading"><div><span class="eyebrow">${t("historyEyebrow")}</span><h2>${t("historyTitle")}</h2></div><span class="profile-count">${history.length}</span></div><div class="history-list">${history.length ? history.map(renderHistoryCard).join("") : `<div class="history-empty">${icon("history", "history-empty-icon")}<p>${t("noHistory")}</p></div>`}</div></aside>
  </section>`;
}

const features: Array<[IconName, string, string]> = [
  ["gift", "featureFree", "featureFreeDesc"], ["sparkles", "featureAllInOne", "featureAllInOneDesc"],
  ["selection", "featureSelection", "featureSelectionDesc"], ["bilingual", "featureBilingual", "featureBilingualDesc"],
  ["globe", "featureLanguages", "featureLanguagesDesc"], ["shield", "featureNoAds", "featureNoAdsDesc"],
  ["focus", "featurePure", "featurePureDesc"], ["accurate", "featureAccurate", "featureAccurateDesc"],
  ["flow", "featureFluent", "featureFluentDesc"], ["natural", "featureNatural", "featureNaturalDesc"]
];

function renderAbout(): string {
  return `<section class="about" role="tabpanel" aria-labelledby="about-tab">
    <div class="about-hero">
      <div class="about-mark">${icon("sparkles", "about-mark-icon")}</div>
      <div><span class="eyebrow">${t("aboutEyebrow")}</span><h2>${t("aboutTitle")}</h2><p>${t("aboutIntro")}</p></div>
    </div>
    <div class="feature-grid">${features.map(([name, title, description]) => `<article class="feature-card"><span class="feature-icon">${icon(name)}</span><div><h3>${t(title)}</h3><p>${t(description)}</p></div></article>`).join("")}</div>
    <div class="about-closing">${icon("language", "closing-icon")}<div><strong>${t("aboutClosingTitle")}</strong><p>${t("aboutClosing")}</p></div></div>
  </section>`;
}

function renderSettings(profile: Profile): string {
  return `<section class="profiles" role="tabpanel" aria-labelledby="settings-tab"><div class="section-heading"><div><span class="eyebrow">${t("profilesEyebrow")}</span><h2>${t("profiles")}</h2></div><span class="profile-count">${settings.profiles.length}</span></div><div class="profile-list">${settings.profiles.length ? settings.profiles.map(renderProfile).join("") : `<p class="empty-state">${t("noProfiles")}</p>`}</div><button class="button secondary full-width" id="add" type="button">${buttonContent("plus", t("add"))}</button></section>
    <section class="profile-editor"><div class="section-heading"><div><span class="eyebrow">${editing ? t("editingEyebrow") : t("createEyebrow")}</span><h2>${editing ? t("editProfile") : t("newProfile")}</h2></div>${icon(editing ? "profile" : "plus", "heading-icon")}</div><form id="profile-form">
      <label>${t("name")}<input name="name" required value="${escape(profile.name)}" /></label>
      <label>${t("baseUrl")}<input name="baseUrl" required placeholder="https://api.example.com/v1" value="${escape(profile.baseUrl)}" /></label>
      <label>${t("apiKey")}<input name="apiKey" type="password" required autocomplete="off" value="${escape(profile.apiKey)}" /></label>
      <label>${t("model")}<input name="model" required value="${escape(profile.model)}" /></label>
      <div class="form-row"><label>${t("source")}<select id="sourceLang" class="form-select" name="sourceLanguage">${languageOptions(profile.sourceLanguage, true)}</select></label>
      <label>${t("target")}<select id="targetLang" class="form-select" name="targetLanguage">${languageOptions(profile.targetLanguage, false)}</select></label></div>
      <label>${t("mode")}<select name="mode"><option value="replace" ${profile.mode === "replace" ? "selected" : ""}>${t("replace")}</option><option value="preserve" ${profile.mode === "preserve" ? "selected" : ""}>${t("preserve")}</option></select></label>
      <div class="form-actions"><button class="button primary" type="submit">${buttonContent("save", t("save"))}</button><button class="button secondary" type="button" id="test">${buttonContent("test", t("test"))}</button>${editing ? `<button class="button danger" type="button" id="delete">${buttonContent("trash", t("remove"))}</button>` : ""}</div>
    </form></section>`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

async function runTextTranslation() {
  const profile = configuredProfile();
  const sourceText = translationInput;
  if (!profile || !sourceText.trim() || translationPending) return;
  const requestId = ++translationRequestId;
  translationPending = true; translationError = ""; render();
  try {
    const translatedText = await translate({ ...profile, sourceLanguage: translationSource, targetLanguage: translationTarget }, sourceText);
    if (requestId !== translationRequestId) return;
    translationResult = translatedText;
    const entry: TranslationHistoryEntry = { id: crypto.randomUUID(), sourceText, translatedText, sourceLanguage: translationSource, targetLanguage: translationTarget, createdAt: Date.now() };
    settings = addTranslationHistory(settings, entry);
    await saveSettings(settings);
  } catch (caught) {
    if (requestId === translationRequestId) translationError = caught instanceof Error ? caught.message : t("translationFailed");
  } finally {
    if (requestId === translationRequestId) { translationPending = false; render(); }
  }
}

function bindTranslator() {
  const input = document.querySelector<HTMLTextAreaElement>("#translation-input")!;
  input.oninput = () => {
    translationInput = input.value; translationError = "";
    document.querySelector(".character-count")!.textContent = format(t("characterCount"), { count: Array.from(translationInput).length });
    document.querySelector<HTMLButtonElement>("#clear-translation")!.disabled = !translationInput && !translationResult;
    document.querySelector<HTMLButtonElement>("#translate-text")!.disabled = !configuredProfile() || !translationInput.trim() || translationPending;
    document.querySelector(".translation-error")?.remove();
  };
  document.querySelector<HTMLSelectElement>("#translation-source")!.onchange = (event) => { translationSource = (event.currentTarget as HTMLSelectElement).value; };
  document.querySelector<HTMLSelectElement>("#translation-target")!.onchange = (event) => { translationTarget = (event.currentTarget as HTMLSelectElement).value; };
  document.querySelector<HTMLButtonElement>("#clear-translation")!.onclick = () => { translationRequestId += 1; translationPending = false; translationInput = ""; translationResult = ""; translationError = ""; render(); };
  document.querySelector<HTMLButtonElement>("#translate-text")!.onclick = () => { void runTextTranslation(); };
  document.querySelector<HTMLButtonElement>("#configure-model")?.addEventListener("click", () => { activeTab = "settings"; render(); });
  document.querySelector<HTMLButtonElement>("#copy-result")?.addEventListener("click", () => { void copyText(translationResult); });
  document.querySelector<HTMLButtonElement>("#retranslate-result")?.addEventListener("click", () => { void runTextTranslation(); });
  const history = getTranslationHistory(settings);
  document.querySelectorAll<HTMLButtonElement>("[data-history-action]").forEach((button) => button.onclick = () => {
    const entry = history.find((item) => item.id === button.dataset.historyId);
    if (!entry) return;
    if (button.dataset.historyAction === "copy") { void copyText(entry.translatedText); return; }
    translationInput = entry.sourceText; translationResult = entry.translatedText; translationSource = entry.sourceLanguage; translationTarget = entry.targetLanguage;
    render(); void runTextTranslation();
  });
}

function bindTabs() {
  document.querySelector<HTMLButtonElement>("#translate-tab")!.onclick = () => { activeTab = "translate"; render(); };
  document.querySelector<HTMLButtonElement>("#settings-tab")!.onclick = () => { activeTab = "settings"; render(); };
  document.querySelector<HTMLButtonElement>("#about-tab")!.onclick = () => { activeTab = "about"; render(); };
}

function render() {
  const baseProfile = editing ?? newProfile();
  const profile = { ...baseProfile, sourceLanguage: normalizeLanguage(baseProfile.sourceLanguage, "auto"), targetLanguage: normalizeLanguage(baseProfile.targetLanguage, "zh-CN") };
  document.documentElement.lang = settings.uiLocale && settings.uiLocale !== "auto" ? settings.uiLocale : navigator.language;
  document.documentElement.dir = document.documentElement.lang.toLowerCase().startsWith("ar") ? "rtl" : "ltr";
  document.title = t("title");
  app.innerHTML = `
    <header>
      <div class="header-row"><div class="brand"><span class="brand-icon">${icon("language")}</span><div><h1>${t("title")}</h1><p>${t("brandTagline")}</p></div></div><div class="locale-card"><span class="locale-card-icon">${icon("globe")}</span><label class="locale" for="ui-locale"><span class="locale-copy"><strong>${t("uiLanguage")}</strong><small>language</small></span><select id="ui-locale">${uiLanguageOptions(settings.uiLocale)}</select></label></div></div>
    </header>
    ${renderTabs()}
    ${activeTab === "about" ? renderAbout() : activeTab === "translate" ? renderTranslator() : renderSettings(profile)}`;

  bindTabs();
  document.querySelector<HTMLSelectElement>("#ui-locale")!.onchange = async (event) => { const preference = (event.currentTarget as HTMLSelectElement).value as UiLocalePreference; settings.uiLocale = preference; setLocale(preference === "auto" ? null : preference); await saveSettings(settings); render(); };
  if (activeTab === "about") return;
  if (activeTab === "translate") { bindTranslator(); return; }
  document.querySelectorAll<HTMLButtonElement>(".profile").forEach((button) => button.onclick = async () => { editing = settings.profiles.find((item) => item.id === button.dataset.id) ?? null; if (editing) { settings.activeProfileId = editing.id; useProfileLanguages(editing); await saveSettings(settings); await notifyProfileChange(); } render(); });
  document.querySelector("#add")!.addEventListener("click", () => { editing = null; render(); });
  document.querySelector<HTMLFormElement>("#profile-form")!.onsubmit = async (event) => {
    event.preventDefault(); const next = profileFromForm(event.currentTarget as HTMLFormElement, { ...profile, id: editing?.id ?? profile.id });
    const error = validateBaseUrl(next.baseUrl); if (error) { await showDialog(localizeUrlError(error)); return; }
    settings.profiles = [...settings.profiles.filter((item) => item.id !== next.id), next]; settings.activeProfileId = next.id;
    await saveSettings(settings); await notifyProfileChange(); editing = next; useProfileLanguages(next); render(); await showDialog(t("saved"));
  };
  document.querySelector("#delete")?.addEventListener("click", async () => {
    if (!editing || !await showDialog(t("confirmDelete"), true)) return;
    settings.profiles = settings.profiles.filter((item) => item.id !== editing!.id);
    if (settings.activeProfileId === editing.id) settings.activeProfileId = settings.profiles[0]?.id ?? null;
    await saveSettings(settings); await notifyProfileChange(); editing = null; render(); await showDialog(t("deleted"));
  });
  document.querySelector("#test")!.addEventListener("click", async () => {
    const draft = profileFromForm(document.querySelector<HTMLFormElement>("#profile-form")!, profile);
    const error = validateBaseUrl(draft.baseUrl); if (error) { await showDialog(localizeUrlError(error)); return; }
    try {
      await translate(draft, "Hello"); settings.profiles = [...settings.profiles.filter((item) => item.id !== draft.id), draft]; settings.activeProfileId = draft.id;
      await saveSettings(settings); await notifyProfileChange(); editing = draft; useProfileLanguages(draft); render(); await showDialog(t("connected"));
    } catch (caught) { await showDialog(caught instanceof Error ? caught.message : t("connectionFailed")); }
  });
}

getSettings().then((loaded) => { settings = loaded; setLocale(loaded.uiLocale && loaded.uiLocale !== "auto" ? loaded.uiLocale : null); useProfileLanguages(loaded.profiles.find((profile) => profile.id === loaded.activeProfileId) ?? null); render(); });
