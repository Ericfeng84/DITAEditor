# DITAEditor 文档导航

本目录存放 **DITAEditor** 的工程架构、专题设计、架构决策记录（ADR）、部署运维指南、DITA 1.3 编写参考与历史阶段规划归档。

> 面向终端用户的中英双语产品文档（简介、Docker 快速开始、本地开发、功能导览、AI 配置、架构概览）位于 [`apps/site/src/content/docs/`](../apps/site/src/content/docs/)。

---

## 一、现行架构与设计（活文档 · 唯一真相源）

| 文档 | 说明 |
| :--- | :--- |
| [architecture-and-plan.md](./architecture-and-plan.md) | **总架构基线与实施路线图**：系统总体架构、核心难点攻关、技术选型矩阵与 Phase 0–14 演进记录 |
| [design/versioning-model.md](./design/versioning-model.md) | **版本管理与并发协作模型（现状）**：Git 干净基线 + 个人草稿叠加层、独占锁、签入、合并、回滚与发布溯源 |
| [design/dita-authoring-compliance.md](./design/dita-authoring-compliance.md) | **DITA 1.3 结构化写作合规实现**：规则单一来源、引导式插入与三处同源结构诊断 |
| [design/content-reuse-workflow.md](./design/content-reuse-workflow.md) | **内容复用工作流设计**：Warehouse 复用仓库、新建/提取复用片段与全入口插入闭环 |
| [design/ai-contract.md](./design/ai-contract.md) | **AI 辅助跨包接口契约**：`@dita/core` / `@dita/api` / `@dita/web` 间的类型、SSE 协议与安全边界真相源 |

## 二、架构决策记录（ADR）

位于 [`adr/`](./adr/)，记录已采纳的关键架构权衡：

- [0001-manual-as-independent-workspace.md](./adr/0001-manual-as-independent-workspace.md) — 每本手册映射为独立工作区与独立 Git 仓库
- [0002-per-request-manual-isolation.md](./adr/0002-per-request-manual-isolation.md) — 请求级按 Manual ID 与 Branch 隔离工作区与语义索引
- [0003-soft-assignments-in-sqlite.md](./adr/0003-soft-assignments-in-sqlite.md) — Topic 任务委派以软引导形式存储于 SQLite，与 XML 和文件锁解耦
- [0004-baseline-and-draft-overlay.md](./adr/0004-baseline-and-draft-overlay.md) — 分支 worktree 保持干净基线（`HEAD`），未检入改动隔离至个人草稿叠加层

## 三、部署与运维指南

位于 [`deploy/`](./deploy/)：

- [deploy/gcp-cloudrun.md](./deploy/gcp-cloudrun.md) — GCP Cloud Run 低成本试用部署（子路径反代 + WIF 自动发布）
- [deploy/github-pages.md](./deploy/github-pages.md) — GitHub Pages 免费托管官网、沙箱与纯前端离线三栏工作台
- [deploy/huggingface-spaces.md](./deploy/huggingface-spaces.md) — Hugging Face Spaces 单容器完整版部署

## 四、DITA 1.3 编写参考与工程资产

- **DITA 1.3 主题编写规范（[`dita/`](./dita/)）**：
  - [dita_topic.md](./dita/dita_topic.md)（通用 Topic 与 Warehouse 复用仓库）
  - [dita_concept.md](./dita/dita_concept.md)（Concept 概念主题）
  - [dita_task.md](./dita/dita_task.md)（Task 任务主题）
  - [dita_reference.md](./dita/dita_reference.md)（Reference 参考主题）
- **AI Agent 协作约定（[`agents/`](./agents/)）**：[domain.md](./agents/domain.md)、[issue-tracker.md](./agents/issue-tracker.md)、[triage-labels.md](./agents/triage-labels.md)
- **工作台截图资产（[`pic/`](./pic/)）**：供根目录 [README.md](../README.md) 与 [README.en.md](../README.en.md) 使用的中英双语 UI 截图

## 五、历史阶段规划与专项方案归档（只读参考）

位于 [`plans/`](./plans/)，记录各阶段落地前的详细设计蓝图与专项修复方案。下列方案**均已实现**；若细节与现行代码存在演进差异，请以源码与上方「现行架构与设计」为准：

| 文档 | 覆盖范围 |
| :--- | :--- |
| [plans/phase06-ai-implementation.md](./plans/phase06-ai-implementation.md) | Phase 6：AI 辅助编写、标签优化与错误处理实施蓝图 |
| [plans/phase07-site.md](./plans/phase07-site.md) | Phase 7：官网、浏览器 DITA 沙箱与双语文档站蓝图 |
| [plans/phase08-i18n.md](./plans/phase08-i18n.md) | Phase 8：全栈中英双语国际化（i18n）蓝图 |
| [plans/phase10-workbench-assignments.md](./plans/phase10-workbench-assignments.md) | Phase 10：手册编辑工作台（Workbench Hub）与 Topic 任务委派蓝图 |
| [plans/phase12-html-themes.md](./plans/phase12-html-themes.md) | Phase 12：HTML5 发布样式主题与多套专业文档模板蓝图 |
| [plans/phase13-versioning-overlay.md](./plans/phase13-versioning-overlay.md) | Phase 13：Git 干净基线 + 个人草稿叠加层与合并闭环蓝图 |
| [plans/phase13-restore-revert-fix.md](./plans/phase13-restore-revert-fix.md) | Phase 13 补充修复：还原此版本（Restore）与撤销该提交（Revert）前端联动 |
| [plans/key-management-integration.md](./plans/key-management-integration.md) | v1.5.0：Key 管理整合至「Map 管理」与「属性」及新建 Key 工作流 |
| [plans/checkin-validation-ai-fix.md](./plans/checkin-validation-ai-fix.md) | v1.5.0：签入前置校验门禁与 AI 修复「检出—草稿—提交」闭环 |
| [plans/phase14-docling-agent.md](./plans/phase14-docling-agent.md) | Phase 14：文档智能导入与工具化 DITA-OT Repair Agent 闭环 |
