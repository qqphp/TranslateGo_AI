# ADR-0028：Base URL 仅允许 HTTPS，localhost 例外

- 状态：已接受
- 日期：2026-07-26

## 决策

配置档案的 Base URL 只接受 HTTPS 地址。`localhost` 可作为开发环境例外允许 HTTP；其他非 HTTPS 地址拒绝保存或测试。

设置页必须对地址协议校验给出明确错误，不能让用户误以为 HTTP API 与 HTTPS 具有相同安全性。
