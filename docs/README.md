# DITAEditor 文档导航

本目录存放 **DITAEditor** 的工程架构、专题设计、架构决策记录（ADR）、部署运维指南、DITA 1.3 编写参考与历史阶段规划归档。

> 面向终端用户的中英双语产品文档（简介、Docker 快速开始、本地开发、功能导览、AI 配置、架构概览）位于 [`apps/site/src/content/docs/`](../apps/site/src/content/docs/)。

---

## 一、现行架构与设计（活文档 · 唯一真相源）

| 文档 | 说明 |
| :--- | :--- |
| [architecture-and-plan.md](./architecture-and-plan.md) | **总架构基线与实施路线图**：系统总体架构、核心难点攻关、技术选型矩阵与 Phase 0–16 演进记录 |
| [design/versioning-model.md](./design/versioning-model.md) | **版本管理与并发协作模型（现状）**：Git 干净基线 + 个人草稿叠加层、独占锁、签入、合并、回滚与发布溯源 |
| [design/dita-authoring-compliance.md](./design/dita-authoring-compliance.md) | **DITA 1.3 结构化写作合规实现**：规则单一来源、引导式插入与三处同源结构诊断 |
| [design/content-reuse-workflow.md](./design/content-reuse-workflow.md) | **内容复用工作流设计**：Warehouse 复用仓库、新建/提取复用片段与全入口插入闭环 |
| [design/ai-contract.md](./design/ai-contract.md) | **AI 辅助跨包接口契约**：`@dita/core` / `@dita/api` / `@dita/web` 间的类型、SSE 协议与安全边界真相源 |
| [design/help-center.md](./design/help-center.md) | **应用内帮助中心与 DITA 规范文档**：七章信息架构、派生式速查（`DITA_SEQUENCE_MODEL`）、外链/离线降级与文档站两页扩展 |
| [design/workbench-ux-architecture.md](./design/workbench-ux-architecture.md) | **工作台信息结构与交互设计规范**：壳层包含层级、左栏降噪、自适应标签显示模式（只读无标签/编辑仅标签）、单一信源与 AI/只读交互引导 |

## 二、架构决策记录（ADR）

位于 [`adr/`](./adr/)，记录已采纳的关键架构权衡：

- [0001-manual-as-independent-workspace.md](./adr/0001-manual-as-independent-workspace.md) — 每本手册映射为独立工作区与独立 Git 仓库
- [0002-per-request-manual-isolation.md](./adr/0002-per-request-manual-isolation.md) — 请求级按 Manual ID 与 Branch 隔离工作区与语义索引
- [0003-soft-assignments-in-sqlite.md](./adr/0003-soft-assignments-in-sqlite.md) — Topic 任务委派以软引导形式存储于 SQLite，与 XML 和文件锁解耦
- [0004-baseline-and-draft-overlay.md](./adr/0004-baseline-and-draft-overlay.md) — 分支 worktree 保持干净基线（`HEAD`），未检入改动隔离至个人草稿叠加层
- [0005-paired-manuals-translation-model.md](./adr/0005-paired-manuals-translation-model.md) — 多语言版本采用跨手册配对（语言家族）模型，SQLite 追踪路径映射与同步水位

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

## 五、阶段规划与专项方案归档

位于 [`plans/`](./plans/)，记录各阶段落地前的详细设计蓝图与专项方案。其中 Phase 6–16 **均已实现**（细节演进以源码与上方「现行架构与设计」为准）：

| 文档 | 状态 | 覆盖范围 |
| :--- | :--- | :--- |
| [plans/phase06-ai-implementation.md](./plans/phase06-ai-implementation.md) | ✅ 已实现 | Phase 6：AI 辅助编写、标签优化与错误处理实施蓝图 |
| [plans/phase07-site.md](./plans/phase07-site.md) | ✅ 已实现 | Phase 7：官网、浏览器 DITA 沙箱与双语文档站蓝图 |
| [plans/phase08-i18n.md](./plans/phase08-i18n.md) | ✅ 已实现 | Phase 8：全栈中英双语国际化（i18n）蓝图 |
| [plans/phase10-workbench-assignments.md](./plans/phase10-workbench-assignments.md) | ✅ 已实现 | Phase 10：手册编辑工作台（Workbench Hub）与 Topic 任务委派蓝图 |
| [plans/phase12-html-themes.md](./plans/phase12-html-themes.md) | ✅ 已实现 | Phase 12：HTML5 发布样式主题与多套专业文档模板蓝图 |
| [plans/phase13-versioning-overlay.md](./plans/phase13-versioning-overlay.md) | ✅ 已实现 | Phase 13：Git 干净基线 + 个人草稿叠加层与合并闭环蓝图 |
| [plans/phase13-restore-revert-fix.md](./plans/phase13-restore-revert-fix.md) | ✅ 已实现 | Phase 13 补充修复：还原此版本（Restore）与撤销该提交（Revert）前端联动 |
| [plans/key-management-integration.md](./plans/key-management-integration.md) | ✅ 已实现 | v1.5.0：Key 管理整合至「Map 管理」与「属性」及新建 Key 工作流 |
| [plans/checkin-validation-ai-fix.md](./plans/checkin-validation-ai-fix.md) | ✅ 已实现 | v1.5.0：签入前置校验门禁与 AI 修复「检出—草稿—提交」闭环 |
| [plans/phase14-docling-agent.md](./plans/phase14-docling-agent.md) | ✅ 已实现 | Phase 14：文档智能导入与工具化 DITA-OT Repair Agent 闭环 |
| [plans/phase15-pdf-themes.md](./plans/phase15-pdf-themes.md) | ✅ 已实现 | Phase 15：PDF 发布样式主题与多套专业印刷排版模板 |
| [plans/phase16-translation.md](./plans/phase16-translation.md) | ✅ 已实现 | Phase 16：多语言翻译、增量同步、翻译队列、术语库与 AI 协同工作台 |
| [plans/phase16-bilingual-review-ux.md](./plans/phase16-bilingual-review-ux.md) | ✅ 已实现 | Phase 16 补充方案：双语审校多视图对照、无损行内富文本编辑与连续审校重构 |
| [plans/phase16-translation-center-ux.md](./plans/phase16-translation-center-ux.md) | ✅ 已实现 | Phase 16 补充方案：翻译中心场景化工作流重构、图资/结构变动闭环与编辑器 UI 风格统一 |
| [plans/phase16-translation-dual-ai-qa-strict.md](./plans/phase16-translation-dual-ai-qa-strict.md) | ✅ 已实现 | Phase 16 补充方案：翻译双 AI 独立审查、QA 自动修复、审查模型配置与整批 DITA-OT 严格校验闭环 |
| [plans/phase16-translation-lineage.md](./plans/phase16-translation-lineage.md) | ✅ 已实现 | Phase 16 补充方案：多级翻译血缘（树形/分支本地化链路）、全家族查询、下游签入重扫与左侧血缘树 UI |
