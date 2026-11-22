---
title: AI 接入与安全边界
description: 配置 OpenAI 兼容模型、理解 SSE 协议、角色与密钥边界，以及为什么 AI 永远不会直接改写 XML。
updated: '2026-11-22'
---

AI 辅助是 Phase 6 的能力，但它的定位很克制：**模型只提交候选 XML 片段，永远不直接修改文档**。文档能否改变，由服务端校验与人工 Diff 审阅共同决定。

## 配置模型

DITAEditor 使用 OpenAI 兼容的 Chat Completions 协议，可直接对接 DeepSeek 或私有化代理。

优先在界面中配置（Admin 角色）：

1. 以 Admin 身份打开 AI 设置；
2. 填写 `baseUrl`、`model`、`apiKey`、温度、超时与最大上下文字符数；
3. 先点「测试连接」，确认模型可返回；
4. 保存。数据库中的值优先于环境变量。

也可用环境变量兜底：

```bash
export DEEPSEEK_API_KEY="sk-..."
export DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
export DEEPSEEK_MODEL="deepseek-flash"
export AI_TIMEOUT_MS="60000"
export AI_MAX_CONTEXT_CHARS="48000"
```

## 接口与角色

| 接口 | 方法 | 角色 | 说明 |
| --- | --- | --- | --- |
| `/api/ai/config` | GET | 任意已识别身份 | 只返回 `maskedApiKey`，例如 `sk-****9a2f` |
| `/api/ai/config` | PUT | Admin | 写入配置，密钥加密/掩码处理，不回传明文 |
| `/api/ai/config/test` | POST | Admin | 用当前配置做一次最小请求 |
| `/api/ai/usage` | GET | Admin | 调用量、token 与耗时统计 |
| `/api/ai/stream` | POST | Writer / Admin | SSE 流式返回候选与验证结果 |

密钥只存在于服务端。前端从不接收明文，也不会把密钥写入 localStorage。

## 请求如何流动

```text
Web AI 面板
  ├─ POST /api/ai/stream  { mode, target?, instruction, documentXml }
  │     mode: full-document | line-window | element
  ├─ SSE: status → delta → candidate → verification → done | error
  ▼
@dita/core（服务端）
  normalizeCandidateXml(candidate)     清洗围栏、声明与杂散根
  spliceAndVerifyAiXml(document, ...)  无损拼接 + 结构校验
  ▼
Web：AiDiffDialog → resolveAiApplyMode → applyAiPatchedXml
  apply | checkout-and-apply | preview-only
```

### 三种目标范围

- **full-document（默认）**：整篇主题。补丁必须保持根元素、XML 声明与 DOCTYPE 不变；根标签变化会返回 `structure-invalid`。
- **line-window**：围绕指定行窗口替换；以拼接后的文档为权威。
- **element**：要求候选是单根片段，用于气泡工具栏、诊断与严格校验入口的精确修复。

片段请求如果无法解析出目标，会降级为整篇主题，而不是猜测。

## 为什么必须 Diff 审阅

即使模型返回了「看起来正确」的 XML，也可能：

- 丢掉注释、PI 或 `xml:lang`；
- 重排属性，导致无意义的 Git Diff；
- 引入非法 DTD 子元素；
- 悄悄改变 `keyref` 或 `conref` 语义。

因此写入路径被强制为：服务端拼接校验 → 客户端 Diff → 用户选择。可视化应用保持单个 ProseMirror transaction（`skipVisualReload: true`），源码应用是单次 CodeMirror 替换，保证 `Cmd/Ctrl+Z` 一步撤销整次 AI 编辑。

## SSE 与断连

- 服务端只在请求 `'aborted'` 或响应 `'close'` 且未 `writableEnded` 时取消上游请求。
- 不要监听 `req.raw` 的 `'close'`：它在请求体被消费后就会触发，会误杀正常流。
- 浏览器端使用 `fetch` + `ReadableStream` 解析 SSE，因为原生 `EventSource` 不能发送身份头。

相关回归测试：`apps/api/test/phase6-ai-sse-socket.test.ts`。

## 校验与重试

服务端在返回 `candidate` 后会运行结构校验；不通过时最多重试一次，并把失败原因回传给模型。仍不通过则以 `verification` 事件报告，不生成可应用补丁。

## 成本与隐私

- 每次调用写入 `ai_usage_logs`，包含 token 与耗时；只有 Admin 可读。
- 默认只发送目标片段与必要的主题上下文，`AI_MAX_CONTEXT_CHARS` 控制上限。
- 私有化部署时，把 `baseUrl` 指向你自己的兼容网关即可；不会有任何遥测发往 DITAEditor 项目。

## 验收脚本

真实端点的端到端验收位于 `apps/api/scripts/e2e-ai-live.mts`。它会读取当前配置，发起一次完整流式请求，并验证候选可以被无损拼接。运行前请确认密钥与配额。

## 下一步

- 了解完整写入路径：[功能导览](/docs/features)
- 部署与数据卷：[快速开始与 Docker 部署](/docs/getting-started)
