import { access, readFile, readdir } from "node:fs/promises";

const content = await readFile(new URL("../dist/content.js", import.meta.url), "utf8");
if (/^\s*import\b/m.test(content)) {
  throw new Error("dist/content.js contains an ES module import; MV3 content_scripts must be self-contained classic scripts.");
}

const manifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("dist/manifest.json must use Manifest V3.");
if (manifest.version !== packageJson.version) throw new Error("package.json and dist/manifest.json versions must match.");
if (manifest.short_name !== "__MSG_extensionShortName__") throw new Error("dist/manifest.json must use the localized short name.");
if (manifest.minimum_chrome_version !== "99") throw new Error("dist/manifest.json must declare Chrome 99 as the minimum supported version.");
if (!String(manifest.homepage_url).startsWith("https://")) throw new Error("dist/manifest.json must declare an HTTPS homepage.");
if (manifest.permissions?.includes("tabs")) throw new Error("The unnecessary tabs permission must not be requested.");
for (const permission of ["storage", "contextMenus"]) if (!manifest.permissions?.includes(permission)) throw new Error(`dist/manifest.json is missing the ${permission} permission.`);
if (!manifest.content_scripts?.some((entry) => entry.js?.includes("content.js"))) {
  throw new Error("dist/manifest.json does not declare content.js.");
}
if (manifest.icons?.["16"] !== manifest.action?.default_icon?.["16"]) {
  throw new Error("The context-menu extension icon and toolbar icon must use the same 16px asset.");
}

await Promise.all([16, 32, 48, 128].map((size) => access(new URL(`../dist/icons/icon-${size}.png`, import.meta.url))));

const expectedLocales = ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "pt_BR", "ru", "th", "tr", "vi", "zh_CN", "zh_TW"];
const builtLocales = (await readdir(new URL("../dist/_locales/", import.meta.url))).sort();
if (JSON.stringify(builtLocales) !== JSON.stringify(expectedLocales)) {
  throw new Error(`Built browser locales differ from the supported UI locales: ${builtLocales.join(", ")}`);
}
await Promise.all(builtLocales.map(async (locale) => {
  const messages = JSON.parse(await readFile(new URL(`../dist/_locales/${locale}/messages.json`, import.meta.url), "utf8"));
  for (const key of ["extensionName", "extensionShortName", "extensionDescription", "actionTitle", "contextTranslatePage", "contextTranslateSelection", "unsupportedPage"]) {
    if (!messages[key]?.message) throw new Error(`Built locale ${locale} is missing ${key}.`);
  }
  if ([...messages.extensionShortName.message].length > 12) throw new Error(`Built locale ${locale} has a short name longer than 12 characters.`);
}));

console.log("Validated MV3 build entrypoints.");
