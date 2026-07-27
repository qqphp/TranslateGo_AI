# ADR-0026：采用 TypeScript、Vite 和原生扩展 API

- 状态：已接受
- 日期：2026-07-26

## 决策

第一版使用 TypeScript + Vite 构建 Manifest V3 扩展，页面 UI 使用原生 DOM，扩展能力使用 Chrome/Chromium Extension API。

不引入 React 等 UI 框架。这样可以减少构建依赖，明确区分 options 页面、service worker 和 content script，并便于控制页面注入内容。
