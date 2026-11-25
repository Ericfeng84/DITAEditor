---
title: 架构参考
description: 包边界、同构内核、无损往返流水线、锁与 worktree 并发模型、DITA-OT 调用链与部署视图。
updated: '2026-11-25'
---

DITAEditor 的架构目标只有一个：让标准 DITA XML 在浏览器、服务端与发布工具之间**无损流动**。所有模块划分都服务于此。

## 全局视图

```text
Browser
  @dita/web (React 19)
    ProseMirror visual editor ─┐
    CodeMirror 6 source        ├─ @dita/core (isomorphic)
    Map tree / Keys / Publish  ┘
              │ fetch /api
              ▼
Node
  @dita/api (Fastify)
    identity · locks · files · indexer · validate · publish · ai · static
    SQLite (Drizzle) · simple-git worktree · DITA-OT CLI
              │
              ▼
  DITA-OT 4.2.1 (JRE 21) + Noto CJK plugin
```

前端与后端引用同一个 `@dita/core` 包，因此「什么是良构」「键如何解析」「CALS 如何展开」只有一份实现。

## 包边界

### `@dita/core`

- `xml/`：`slimdom-sax-parser` 位置跟踪、确定性序列化、fontoxpath、DOM diff。
- `model/`：DITA 1.3 元素注册表（block / inline / structural / whitespace-preserve）。
- `cals/`：CALS 与 `colspan`/`rowspan` 网格互转。
- `ai/`：目标定位、候选清洗、无损拼接与校验。
- `prosemirror/`：原生 Schema 与 slimdom ↔ PM Doc 转换。

约束：`src/` 内不得引用 Node 内置模块，保证浏览器可用。不要用 `instanceof slimdom.*` 判断节点；不同版本可能同时存在，使用 `nodeType` 常量。

### `@dita/web`

手册工作台与任务面板、Topic 编辑器、NodeViews、DITA 感知命令、Map/Bookmap 树、Keys 面板、发布面板、AI 面板与 Diff。以及覆盖全部界面的 `zh-CN` / `en` 字典。所有写操作最终都落到同一份 XML 字符串。

### `@dita/api`

- `identity`：SQLite 中的本地用户与角色。
- `manuals` / `assignments`：手册元数据与「待开始 / 进行中 / 已完成」任务状态机。
- `locks`：Check-out 独占锁与 Admin 强制解锁。
- `files`：工作区 CRUD 与 multipart 资源。
- `indexer`：增量语义索引（键空间、conref）。
- `validate` / `publish` / `dita-ot`：严格校验、异步发布队列与 CLI 调用。
- `ai`：LangChain `ChatOpenAI` 工厂、SSE、配置与用量。
- `static`：生产环境托管构建后的 Web 资源。

### `@dita/site`

本官网与 `/playground`。沙箱在浏览器内直接使用 `@dita/core`，没有后端；这也是一条持续验证「同构」的活体测试。

## 无损往返流水线

```text
parseXml(xml)
  → slimdom Document（保留声明/DOCTYPE/注释/PI/CDATA/属性顺序）
  → pmDocFromXml(document)
  → ProseMirror Doc
  → xmlFromPmDoc(doc)
  → serializeXml(document)
```

保证：

1. 元数据不丢；
2. 属性顺序按 `rawAttrs` 原样写回；
3. 序列化幂等；
4. 单点编辑只产生单行 Diff；
5. 未建模元素进入 `unknown_*` 节点，仍可写回。

## 编辑器数据流

```text
CodeMirror change ─┐
                   ├─ well-formed guard ─→ PM Doc ─→ transactions ─→ XML
ProseMirror tx   ──┘
```

- 源码 → 可视化：先 `checkXmlWellFormed()`，失败则阻断并定位。
- 可视化 → 源码：序列化后与源码对比，必要时以最小变更替换。
- AI 应用：`applyAiPatchedXml` 接受已校验的完整 XML，按模式只做一次替换。

## 并发模型

- 锁键：`(project, branch, file_path)`。
- 干净基线：每个分支一个 `git worktree`，其 `workDir` 永远等于 Git `HEAD`，避免 checkout 抖动。
- 个人草稿层：未检入的编辑 / 新建 / 删除 / 重命名与草稿图片隔离在 SQLite `working_drafts`，仅持锁人可见；诊断、严格校验、AI 上下文与 `my_drafts` 预览读「基线 + 本人草稿」。
- 锁过期：`DITA_LOCK_TTL_HOURS`，按 `updatedAt` 续期与判定；过期后可被重新获取。
- 强制解锁：先备份草稿与文件为补丁，再删除锁记录。
- 合并在隔离的合成提交中完成：`git merge-tree` 预检，冲突逐文件求解，共享 `workDir` 永不残留 `MERGING` 态。
- 不做 CRDT；冲突在锁层解决，而不是在字符层合并。

## 发布链路

```text
POST /api/publish
  → 队列（SQLite + 并发限制）
  → dita --validate=yes --processing-mode=strict
  → dita -f html5 | pdf --customization.dir=<Noto CJK plugin>
  → 产物目录 + SSE 日志 + 可取消
```

PDF 插件是纯 XML 的 font-mappings，不含自定义 Java 代码；字体来自容器内的 Noto CJK。

## 存储

| 数据 | 位置 |
| --- | --- |
| 工作区文件 | `DITA_WORKSPACE_DIR` |
| 身份 / 锁 / AI 配置 / 用量 | SQLite（数据卷内） |
| 手册元数据 / 任务委派 | SQLite；手册指向工作区内的目录 |
| 发布产物 | `DITA_PUBLISH_DIR` |
| Git 仓库与 worktree | 项目目录下的本地仓库 |

## 测试策略

- `@dita/core`：黄金 fixture 往返、未知元素透传、CALS 网格、解析与 XPath。
- `@dita/api`：路由、锁、发布队列、AI SSE socket 行为。
- `@dita/web`：编辑器命令、语义面板、Diff 应用路径。
- `@dita/site`：i18n 键结构、路由工具、沙箱预设往返。

## 延伸阅读

- [功能导览](/docs/features)
- [本地开发](/docs/local-development)
- 仓库内 `docs/architecture-and-plan.md` 与 `docs/adr/`
