# ADR-0019：由 service worker 统一发起模型请求

- 状态：已接受
- 日期：2026-07-26

## 决策

Manifest V3 扩展 service worker 统一负责读取本地模型配置、发起 API 请求、解析普通 JSON 响应、管理重试和右键菜单命令。content script 负责网页 DOM 提取、DOM 回写与选中文本翻译气泡。

两者通过扩展消息传输任务、批次、节点和增量结果。API Key 不下发到网页 content script。

## 影响

必须处理 service worker 的短生命周期、任务取消、标签页关闭、消息丢失和长任务进度反馈。
