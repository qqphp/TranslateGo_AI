# ADR-0011：配置仅保存在 chrome.storage.local

- 状态：已接受
- 日期：2026-07-26

## 决策

所有模型和翻译配置（包括 API Key）只保存在 `chrome.storage.local`，不使用 `chrome.storage.sync`。用户换设备或重新安装后需要重新填写配置。

## 影响

- 降低密钥跨设备同步和云端暴露风险。
- 设置页必须说明本地保存边界和配置丢失场景。
- 不得在日志、错误消息或页面 DOM 中暴露完整 API Key。
