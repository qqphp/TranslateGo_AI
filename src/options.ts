import { translate } from "./shared/api";
import { getSettings, profileLabel, saveSettings, validateBaseUrl } from "./shared/storage";
import { setLocale, t } from "./shared/i18n";
import type { Profile, Settings, TranslationMode, UiLocalePreference } from "./shared/types";
import "./options.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
let settings: Settings;
let editing: Profile | null = null;

const newProfile = (): Profile => ({ id: crypto.randomUUID(), name: "", baseUrl: "", apiKey: "", model: "", sourceLanguage: "English", targetLanguage: "Chinese", mode: "replace" });
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const notifyProfileChange = () => chrome.runtime.sendMessage({ kind: "profilesChanged" }).catch(() => undefined);
const localizeUrlError = (error: string) => error.includes("valid absolute") ? t("invalidUrl") : error.includes("HTTPS") ? t("insecureUrl") : error.includes("credentials") ? t("credentialsUrl") : error.includes("query string") ? t("queryUrl") : error;

function showDialog(message: string, confirm = false): Promise<boolean> {
  document.querySelector(".settings-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.className = "settings-dialog";
  dialog.innerHTML = `<form method="dialog"><p>${escape(message)}</p><div class="dialog-actions">${confirm ? `<button type="button" class="button secondary dialog-cancel">${t("cancel")}</button>` : ""}<button type="button" class="button ${confirm ? "danger" : "primary"} dialog-confirm">${confirm ? t("confirm") : t("ok")}</button></div></form>`;
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

function render() {
  const profile = editing ?? newProfile();
  document.documentElement.lang = settings.uiLocale && settings.uiLocale !== "auto" ? settings.uiLocale : navigator.language;
  document.title = t("title");
  app.innerHTML = `
    <header>
      <div class="header-row"><h1>${t("title")}</h1><label class="locale">${t("uiLanguage")}<select id="ui-locale"><option value="auto" ${!settings.uiLocale || settings.uiLocale === "auto" ? "selected" : ""}>${t("followBrowser")}</option><option value="zh-CN" ${settings.uiLocale === "zh-CN" ? "selected" : ""}>简体中文</option><option value="zh-TW" ${settings.uiLocale === "zh-TW" ? "selected" : ""}>繁體中文</option><option value="en" ${settings.uiLocale === "en" ? "selected" : ""}>English</option><option value="ja" ${settings.uiLocale === "ja" ? "selected" : ""}>日本語</option></select></label></div>
      <p>${t("privacy")}</p>
    </header>
    <section class="profiles"><h2>${t("profiles")}</h2>${settings.profiles.length ? settings.profiles.map((item) => `<button class="profile ${item.id === settings.activeProfileId ? "active" : ""}" aria-pressed="${item.id === settings.activeProfileId}" data-id="${item.id}">${escape(profileLabel(item))}${item.id === settings.activeProfileId ? `<small>${t("active")}</small>` : ""}</button>`).join("") : `<p>${t("noProfiles")}</p>`}<button class="button secondary" id="add">${t("add")}</button></section>
    <section><h2>${editing ? t("editProfile") : t("newProfile")}</h2><form id="profile-form">
      <label>${t("name")}<input name="name" required value="${escape(profile.name)}" /></label>
      <label>${t("baseUrl")}<input name="baseUrl" required placeholder="https://api.example.com/v1" value="${escape(profile.baseUrl)}" /></label>
      <label>${t("apiKey")}<input name="apiKey" type="password" required autocomplete="off" value="${escape(profile.apiKey)}" /></label>
      <label>${t("model")}<input name="model" required value="${escape(profile.model)}" /></label>
      <label>${t("source")}<input name="sourceLanguage" required value="${escape(profile.sourceLanguage)}" /></label>
      <label>${t("target")}<input name="targetLanguage" required value="${escape(profile.targetLanguage)}" /></label>
      <label>${t("mode")}<select name="mode"><option value="replace" ${profile.mode === "replace" ? "selected" : ""}>${t("replace")}</option><option value="preserve" ${profile.mode === "preserve" ? "selected" : ""}>${t("preserve")}</option></select></label>
      <div class="form-actions"><button class="button primary" type="submit">${t("save")}</button><button class="button secondary" type="button" id="test">${t("test")}</button>${editing ? `<button class="button danger" type="button" id="delete">${t("remove")}</button>` : ""}</div>
    </form></section>`;

  document.querySelector<HTMLSelectElement>("#ui-locale")!.onchange = async (event) => { const preference = (event.currentTarget as HTMLSelectElement).value as UiLocalePreference; settings.uiLocale = preference; setLocale(preference === "auto" ? null : preference); await saveSettings(settings); render(); };
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
