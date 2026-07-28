# AI大模型-沉浸式翻译-免费-极简

A Manifest V3 extension for Chrome and Microsoft Edge that translates selected text or visible webpage text through the user's own OpenAI-compatible API.

## Build and load

```powershell
npm install
npm run build
```

Open `chrome://extensions` or `edge://extensions`, enable developer mode, choose **Load unpacked**, and select the generated `dist` directory. Reload the extension and refresh existing webpages after every new build.

## Use

1. Click the toolbar icon and create a profile with an HTTPS Base URL, API key, model, source language, target language, and translation mode.
2. Test or save the profile. Clicking a profile makes it active and restores translated pages before the new profile is used.
3. Select webpage text and choose **Translate selected text** from the context menu, or use the page context menu for full-page translation.
4. Use the page panel to monitor progress, cancel, retry failures, or restore the original page.

Profiles, API keys, and the 30 most recent successful translations entered on the Translate page are stored only in `chrome.storage.local`. Translated webpage content is not persisted.

## Localization

Maintain translations only in `src/shared/i18n.ts` (base locales) and `src/shared/i18n-locales.ts` (additional locales). Run `npm run generate:i18n` to validate the catalog and regenerate the in-page message module plus Chrome/Edge `_locales` bundles. The test and build commands run this generator automatically; do not edit generated files directly.
