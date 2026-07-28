import { access, readFile, readdir } from "node:fs/promises";

const content = await readFile(new URL("../dist/content.js", import.meta.url), "utf8");
if (/^\s*import\b/m.test(content)) {
  throw new Error("dist/content.js contains an ES module import; MV3 content_scripts must be self-contained classic scripts.");
}

const manifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
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
  for (const key of ["extensionName", "extensionDescription", "actionTitle", "contextTranslatePage", "contextTranslateSelection", "unsupportedPage"]) {
    if (!messages[key]?.message) throw new Error(`Built locale ${locale} is missing ${key}.`);
  }
}));

console.log("Validated MV3 build entrypoints.");
