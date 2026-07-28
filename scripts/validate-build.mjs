import { access, readFile } from "node:fs/promises";

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

console.log("Validated MV3 build entrypoints.");
