---
title: 什么是 DITAEditor
description: 一个把标准 DITA 1.3 XML 放回浏览器的开源写作工作台：手册与任务委派、无损往返、单一信息源、本地 Git 锁、DITA-OT 发布与中英双语界面。
updated: '2026-11-24'
---

DITAEditor 是一个团队级的轻量 Web DITA 1.3 结构化写作工作台。它不发明新的文档格式，也不把 XML 藏进数据库：**标准 DITA XML 是唯一真相源**，浏览器只是它的一等编辑界面。

如果你正在评估它，先记住三个可以当场验证的事实：

1. 可视化编辑与 XML 源码互为镜像，`XML → ProseMirror → XML` 逐字节一致；
2. 修改一个字符，Git Diff 只亮起那一行；
3. 它调用标准 DITA-OT 4.x 命令行发布 HTML5 与中文 PDF，没有任何自研 Java 服务代码。

从 Phase 10 起，入口变成**手册工作台**：手册是一份可挂载本地目录的文档产品，主题可以带负责人、截止日期与备注地委派给团队成员，「我收到的 / 我委派的」任务一目了然。任务只存在于 SQLite，不写回 XML；文档本身仍走标准 Git 流程。工作台、命令行输出与文档站均提供中英双语。

## 为谁而写

- **文档工程师**：需要 DITA 的结构约束、keyref/conref 复用与 DITAVAL 条件发布，但不想维护桌面 CCMS。
- **研发团队**：希望文档与代码同仓库、同分支、同 Code Review，而不是另一套云端系统。
- **文档负责人**：需要把 Topic 分派给作者、跟踪截止日期，同时不引入另一套云端协作系统。
- **平台/运维**：希望一个容器、一份数据卷、零 Redis / PostgreSQL / 消息队列即可交付。
- **AI 辅助写作的早期采用者**：希望模型只产出候选片段，任何写入都必须经过无损拼接、校验与 Diff 审阅。

## 设计原则

### 标准 XML 优先

所有编辑最终都序列化回 DITA 1.3 XML。XML 声明、DOCTYPE、注释、处理指令、CDATA、命名空间与属性顺序都必须原样保留。未知或特化元素不会被丢弃，而是以 `unknown_block` / `unknown_inline` 透传。

### 结构化，但不笨重

核心 DITA 元素被精细建模：`task`、`concept`、`reference`、`topic`、`section`、`note`、`step`、CALS 表格等都有对应的 ProseMirror 节点。行内元素使用 inline node 而不是 marks，因此 `<b><i>` 的嵌套顺序、空元素与逐元素属性都不会被合并。

### 单一信息源

Root Map 的 `keydef` 会被 BFS 解析成键空间；`conref` / `conkeyref` 在编辑器内只读展开；`.ditaval` 以三态投影（包含 / 排除 / 标记）作用于视图，底层 XML 纹丝不动。

### 双语是一等公民

`zh-CN` 与 `en` 两套字典结构完全一致，`en` 以 `zh` 的类型约束，缺键会让构建失败。语言切换即时生效并持久化，日期、时长、诊断与发布产物都跟随语言；官网与文档站也提供完全对称的 `/` 与 `/en`。

### 并发靠锁，不靠 CRDT

每个 `(project, branch, file_path)` 只允许一个 Check-out 独占锁。分支通过 `git worktree` 隔离，避免把「实时协同」的复杂度引入结构化 XML。

## 盒子里有什么

| 组成 | 作用 |
| --- | --- |
| `@dita/core` | 同构 XML / CALS / 键空间 / DITAVAL / ProseMirror 内核 |
| `@dita/web` | React 19 工作台：手册与任务、可视化编辑、源码、Map 树、锁、发布、AI |
| `@dita/api` | Fastify + SQLite + simple-git：身份、锁、语义索引、DITA-OT 调用 |
| `dita-ot-plugins` | 纯 XML 的 Noto CJK PDF font-mappings 插件 |
| 单容器镜像 | Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK |

## 明确的边界

- 不做实时多人协同编辑（没有 CRDT），并发由独占锁保证。
- 不内置 Git 托管平台集成；仓库是本地的，推送由你自己的 CI/流程负责。
- AI 不是自动写作代理：它返回候选 XML，必须经服务端校验、客户端 Diff 审阅后才写入。
- 未建模的 DITA 元素可以无损保存，但不一定有专门的所见即所得控件。

## 下一步

- 想在浏览器里直接体验多文件工作台：[打开离线版工作台](../../workbench/)。
- 想直接部署：[快速开始与 Docker 部署](/docs/getting-started)。
- 想读代码：[架构参考](/docs/architecture)。
