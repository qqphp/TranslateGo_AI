import { translate } from "./shared/api";
import { getSettings, saveSettings, validateBaseUrl } from "./shared/storage";
import { setLocale, t } from "./shared/i18n";
import { LANGUAGE_OPTIONS, normalizeLanguage } from "./shared/languages";
import type { Profile, Settings, TranslationMode, UiLocalePreference } from "./shared/types";
import "./options.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
let settings: Settings;
let editing: Profile | null = null;
let activeTab: "settings" | "about" = "settings";

type IconName = "settings" | "info" | "profile" | "plus" | "save" | "test" | "trash" | "check" | "close" | "model" | "language" | "gift" | "sparkles" | "selection" | "bilingual" | "globe" | "shield" | "focus" | "accurate" | "flow" | "natural";

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
  natural: '<path d="M19 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 9-6 9-15Z"/><path d="M5 20c2-5 5-8 10-11"/>'
};

const icon = (name: IconName, className = "icon") => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
const buttonContent = (name: IconName, label: string) => `${icon(name)}<span>${escape(label)}</span>`;
const newProfile = (): Profile => ({ id: crypto.randomUUID(), name: "", baseUrl: "", apiKey: "", model: "", sourceLanguage: "auto", targetLanguage: "zh-CN", mode: "replace" });
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
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
    <button type="button" id="settings-tab" class="tab ${activeTab === "settings" ? "active" : ""}" role="tab" aria-selected="${activeTab === "settings"}">${buttonContent("settings", t("settingsTab"))}</button>
    <button type="button" id="about-tab" class="tab ${activeTab === "about" ? "active" : ""}" role="tab" aria-selected="${activeTab === "about"}">${buttonContent("info", t("aboutTab"))}</button>
  </nav>`;
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

function bindTabs() {
  document.querySelector<HTMLButtonElement>("#settings-tab")!.onclick = () => { activeTab = "settings"; render(); };
  document.querySelector<HTMLButtonElement>("#about-tab")!.onclick = () => { activeTab = "about"; render(); };
}

function render() {
  const baseProfile = editing ?? newProfile();
  const profile = { ...baseProfile, sourceLanguage: normalizeLanguage(baseProfile.sourceLanguage, "auto"), targetLanguage: normalizeLanguage(baseProfile.targetLanguage, "zh-CN") };
  document.documentElement.lang = settings.uiLocale && settings.uiLocale !== "auto" ? settings.uiLocale : navigator.language;
  document.title = t("title");
  app.innerHTML = `
    <header>
      <div class="header-row"><div class="brand"><span class="brand-icon">${icon("language")}</span><div><h1>${t("title")}</h1><p>${t("brandTagline")}</p></div></div><label class="locale">${t("uiLanguage")}<select id="ui-locale"><option value="auto" ${!settings.uiLocale || settings.uiLocale === "auto" ? "selected" : ""}>${t("followBrowser")}</option><option value="zh-CN" ${settings.uiLocale === "zh-CN" ? "selected" : ""}>简体中文</option><option value="zh-TW" ${settings.uiLocale === "zh-TW" ? "selected" : ""}>繁體中文</option><option value="en" ${settings.uiLocale === "en" ? "selected" : ""}>English</option><option value="ja" ${settings.uiLocale === "ja" ? "selected" : ""}>日本語</option></select></label></div>
    </header>
    ${renderTabs()}
    ${activeTab === "about" ? renderAbout() : renderSettings(profile)}`;

  bindTabs();
  document.querySelector<HTMLSelectElement>("#ui-locale")!.onchange = async (event) => { const preference = (event.currentTarget as HTMLSelectElement).value as UiLocalePreference; settings.uiLocale = preference; setLocale(preference === "auto" ? null : preference); await saveSettings(settings); render(); };
  if (activeTab === "about") return;
  document.querySelectorAll<HTMLButtonElement>(".profile").forEach((button) => button.onclick = async () => { editing = settings.profiles.find((item) => item.id === button.dataset.id) ?? null; if (editing) { settings.activeProfileId = editing.id; await saveSettings(settings); await notifyProfileChange(); } render(); });
  document.querySelector("#add")!.addEventListener("click", () => { editing = null; render(); });
  document.querySelector<HTMLFormElement>("#profile-form")!.onsubmit = async (event) => {
    event.preventDefault(); const next = profileFromForm(event.currentTarget as HTMLFormElement, { ...profile, id: editing?.id ?? profile.id });
    const error = validateBaseUrl(next.baseUrl); if (error) { await showDialog(localizeUrlError(error)); return; }
    settings.profiles = [...settings.profiles.filter((item) => item.id !== next.id), next]; settings.activeProfileId = next.id;
    await saveSettings(settings); await notifyProfileChange(); editing = next; render(); await showDialog(t("saved"));
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
      await saveSettings(settings); await notifyProfileChange(); editing = draft; render(); await showDialog(t("connected"));
    } catch (caught) { await showDialog(caught instanceof Error ? caught.message : t("connectionFailed")); }
  });
}

getSettings().then((loaded) => { settings = loaded; setLocale(loaded.uiLocale && loaded.uiLocale !== "auto" ? loaded.uiLocale : null); render(); });
