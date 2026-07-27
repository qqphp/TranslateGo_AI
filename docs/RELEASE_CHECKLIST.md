# Chrome / Edge release checklist

## Automated gate

- [ ] `npm run build` passes TypeScript, generates PNG icons, builds the extension, and verifies MV3 entrypoints.
- [ ] `npm test` passes API, URL validation, retry, profile, i18n, node-filtering, translation-mode, restoration, cancellation, and progress tests.

## Manual browser acceptance

- [ ] Load the same `dist` directory in current Chrome and Edge desktop.
- [ ] Create, edit, delete, test, and switch between at least two profiles.
- [ ] Verify API keys remain masked and no webpage content appears in extension storage.
- [ ] Verify selection translation loading, success, failure, close, and cancellation.
- [ ] Verify page translation on a news page, technical documentation, forum, SPA, and form-heavy page.
- [ ] Verify code, forms, scripts, styles, iframe content, and Shadow DOM are untouched.
- [ ] Verify replace mode, preserve-original mode, restore, repeat translation, cancellation, partial failure, and retry.
- [ ] Verify links, buttons, and forms still work after translation.
- [ ] Verify restricted-page feedback on `chrome://`, `edge://`, extension stores, and extension pages.
- [ ] Verify Simplified Chinese, Traditional Chinese, English, Japanese, and unsupported-language fallback.

## Store material

- [x] Privacy policy
- [x] Permission and data-flow disclosure
- [x] 16/32/48/128 px PNG icons
- [ ] Chrome screenshots
- [ ] Edge screenshots
- [ ] Final store descriptions reviewed in both stores
