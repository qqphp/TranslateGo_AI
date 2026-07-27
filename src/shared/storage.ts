import type { Profile, Settings } from "./types";

const KEY = "settings";
export const emptySettings: Settings = { profiles: [], activeProfileId: null };

export async function getSettings(): Promise<Settings> {
  const value = await chrome.storage.local.get(KEY);
  const settings = value[KEY] as Settings | undefined;
  return settings && Array.isArray(settings.profiles) ? settings : emptySettings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export async function getActiveProfile(): Promise<Profile | null> {
  const settings = await getSettings();
  return settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? null;
}

export function validateBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return "Base URL must not contain embedded credentials.";
    if (url.search || url.hash) return "Base URL must not contain a query string or fragment.";
    if (url.protocol === "https:") return null;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")) return null;
    return "Base URL must use HTTPS (HTTP is only allowed for localhost).";
  } catch { return "Base URL must be a valid absolute URL."; }
}

export function profileLabel(profile: Profile): string {
  return `${profile.name} · ${profile.model} · ${profile.sourceLanguage} → ${profile.targetLanguage}`;
}
