# Web 版 DITA 编辑器：架构设计、技术选型与实施计划

> 本文档为本项目的架构设计基线与分阶段实施计划，面向**单人 / AI 辅助独立推进**模式，围绕**团队级轻量 Web DITA 工作台**定义系统架构、核心难点攻关方案、技术选型矩阵与垂直切片落地路线。

---

## 一、需求共识总览（Design Tree 决策清单）

| 维度 | 已确认决策 | 对架构的关键约束 |
| :--- | :--- | :--- |
| **产品定位** | 团队级轻量 Web DITA 工作台（面向技术文档工程师） | 聚焦专业结构化写作效率，不做重型 CCMS 审批流 |
| **编辑模式** | 双模式切换（可视化结构化 WYSIWYG + XML 源码视图） | **标准 DITA XML 为唯一真相源**，必须保证无损往返（Round-trip） |
| **DITA 规范** | DITA 1.3 核心精渲染 + 未知/特化元素通用结构块兜底 | 核心类型精细建模，未知标签用通用容器节点保真透传，源码全量编辑 |
| **Map 编辑形态** | 双栏工作台（左侧可视化 Map 树 + 右侧多 Tab 单 Topic 编辑） | Map 树支持拖拽调层级、新建/挂载 Topic、属性编辑与源码切换 |
| **核心 DITA 语义 (V1)** | `keydef/keyref`、`conref/conkeyref`、`DITAVAL` 条件过滤 | 必须构建围绕 **Root Map** 的项目级语义解析引擎与循环引用检测 |
| **存储与版本控制** | 服务端托管本地 Git 工作区（不依赖外部 Git 平台） | 保留原生目录结构，支持本地仓库初始化、分支管理、Commit 历史与版本 Diff 对比，与本地工具互通 |
| **多人并发机制** | **仅支持 Check-out 独占锁**（单文件同时仅 1 人编辑） | 不做 CRDT 实时协同；按分支维度隔离 worktree，文件级悲观锁 + 管理员强解 |
| **校验策略** | 双层校验（前端实时约束 + 语义索引 + DITA-OT CLI 权威校验） | 日常编辑 0 延迟由 `@dita/core` 与语义索引器校验；按需/检入前/发布前调用 `dita` CLI 跑官方 DITA 1.3 DTD/RNG 严格校验 |
| **发布与预览** | 服务端 DITA-OT CLI 异步发布（Root Map + DITAVAL → HTML5 / PDF） | 异步构建队列、实时日志流、产物在线预览与打包下载，预置 Noto CJK 字体与纯 XML 字体插件 |
| **前后端技术栈** | React + TS + Vite / TS 主后端 + DITA-OT 4.x CLI | 纯 TypeScript Monorepo（零 Java 业务代码），Node 后端直接调度系统/容器内预装的 `dita` CLI |
| **部署与权限** | 私有化/团队内网单组织部署（Docker Compose / K8s） | 轻量身份切换（免密码工具栏切换作者与管理员 / 编辑者 / 只读角色），零外部认证依赖 |
| **推进方式** | 个人 / AI 辅助垂直切片迭代 | Phase 0 先攻克最高风险的 XML 无损双模内核，再逐层叠加能力 |

---

## 二、系统总体架构

系统采用 **纯 TypeScript 全栈 Monorepo + DITA-OT 4.x CLI 外部工具** 的分层架构。核心设计原则是：**把 DITA 词法/AST 模型与基础语义规则沉淀在共享包 `@dita/core` 中，不自建 Java 微服务，由 TS 后端通过子进程直接调度预装的 `dita` CLI 完成官方 DITA 1.3 DTD/RNG 权威校验与 HTML5/PDF 发布。**

```mermaid
flowchart TB
    subgraph Client["前端工作台 (React + TypeScript + Vite)"]
        UI["工作台布局 (Map 树 / 多 Tab / 属性与校验面板 / DITAVAL 切换)"]
        PM["可视化编辑器 (ProseMirror + DITA 1.3 Schema + 兜底节点)"]
        CM["XML 源码编辑器 (CodeMirror 6 + 语法补全 + Lint 标红)"]
        CoreFE["共享内核 @dita/core (XML DOM / 序列化 / 规则表)"]
        UI --> PM
        UI --> CM
        PM <--> CoreFE
        CM <--> CoreFE
    end

    subgraph Server["TS 主后端 (Fastify + TypeScript)"]
        API["REST API & SSE 日志/事件推送"]
        Auth["轻量身份与角色切换 (免密码本地身份 / Admin-Writer-Viewer)"]
        Lock["Check-out 文件独占锁服务 (DB 唯一约束 + 强制解锁)"]
        GitMgr["本地 Git 工作区管理 (按分支隔离 git worktree / 版本历史 / Diff 对比)"]
        Indexer["项目级语义索引器 (Root Map Keyspace / Conref / ID / DITAVAL)"]
        Queue["异步任务调度 (BullMQ)"]
        CoreBE["共享内核 @dita/core"]
        API --> Auth
        API --> Lock
        API --> GitMgr
        API --> Indexer
        API --> Queue
        Indexer --> CoreBE
    end

    subgraph DitaCLI["DITA-OT 4.x CLI 运行时 (容器/本机预装 JRE + dita 命令)"]
        ValSvc["内置权威校验 (OASIS DITA 1.3 DTD/RNG + XML Catalog, processing-mode=strict)"]
        PubSvc["DITA-OT 4.x 发布执行器 (HTML5 / PDF2 + Noto CJK 纯 XML 字体插件)"]
    end

    subgraph Infra["基础设施"]
        DB[("SQLite (身份/项目/Check-out 锁/发布记录)")]
        Redis[("Redis (BullMQ 队列 / 构建日志流 / 索引缓存)")]
        FS[("共享磁盘卷 (本地 Git Repos / Worktrees / 发布产物)")]
    end

    Client <-->|"HTTP / SSE"| API
    Lock --> DB
    Auth --> DB
    Queue <--> Redis
    GitMgr <--> FS
    Indexer --> FS
    API -->|"spawn dita CLI (按需/检入前严格校验)"| ValSvc
    Queue -->|"spawn dita CLI (异步快照构建 + SSE 日志)"| PubSvc
    ValSvc --> FS
    PubSvc --> FS
```

### 关键架构决策解读

1. **为什么按分支建 `git worktree`，而不是整个仓库共用一个工作目录？**
   - 协作模型采用单文件 Check-out 独占锁，但团队里完全可能出现“A 在 `main` 分支检出 `install.dita`，B 切到 `release/2.0` 分支查看文档或触发发布”。
   - 后端使用一个 bare/主克隆目录，为每个活跃分支按需维护独立的 `git worktree` 目录。Check-out 锁的粒度精确到 `(repo_id, branch, file_path)`，分支之间互不干扰，且 DITA-OT 发布前会对目标分支工作区做只读快照，避免发布途中文件变更导致构建失败。
2. **为什么直接由 Node 后端调度 `dita` CLI，而不单独开发维护常驻 Java Worker？**
   - 编辑器日常输入与保存时的实时反馈，已由前端 ProseMirror/CodeMirror 约束、`@dita/core` 规则表与 TS 跨文件语义索引器（断链、`keyref`、`conref` 环路）以 0 延迟覆盖。
   - DITA-OT 4.x 本身已内置官方 OASIS DITA 1.3 DTD/RNG 校验器与发布引擎，且中文 PDF 字体映射插件仅为纯 XML 配置（`plugin.xml` + `font-mappings.xml` + `fop.xconf`）。通过 `spawn('dita', ...)` 按需在检入前/发布前做严格校验和异步构建，可实现**零 Java 业务代码**、免去独立 JVM 微服务的开发与运维；若未来确需 50ms 级保存期 DTD 校验，再平滑外挂常驻校验服务即可。

---

## 三、五大核心技术难点攻关设计

Web DITA 编辑器 80% 的工程风险集中在下面 5 个模块，必须在编码前明确边界与实现策略：

### 1. XML 无损往返（Lossless Round-trip）与双模同步内核

这是整个项目**风险最高、决定成败的内核**。普通富文本编辑器（如 Tiptap/Quill）面向 HTML，直接用于 DITA 会丢失 `DOCTYPE`、XML 注释、`<?processing-instruction?>`、未识别属性以及原始标签结构，导致 Git Diff 满屏噪音。

- **底层 XML 表示层**：选用 `slimdom` + `slimdom-sax-parser` + `fontoxpath`（正是商业级 Web DITA 编辑器 Fonto 开源的基础 XML 栈）：
  - `slimdom` 完整保留 `DocumentType`、`Comment`、`ProcessingInstruction`、`CDATASection`、属性顺序和命名空间。
  - `slimdom-sax-parser` 在解析时为每个节点记录源码起止行列号（`line/col/offset`），用于可视化视图与源码视图光标互跳、校验报错精准定位。
  - `fontoxpath` 提供标准 XPath 3.1 查询，直接支撑 `#topicId/elemId` 解析、`keydef` 提取和 `conref` 目标定位。
- **ProseMirror Schema 与 XML 映射规则**：
  - **精细映射的核心类型**：
    - 文档级：`topic`、`concept`、`task`、`reference`（含 `title`、`shortdesc`、`prolog`、`body`/`conbody`/`taskbody`/`refbody`、`section`、`example`、`steps`/`step`/`cmd`/`info`/`stepresult` 等）。
    - 块级与行内：`p`、`ul`/`ol`/`li`、`dl`/`dlentry`/`dt`/`dd`、`note`（含 `type` 属性）、`codeblock`/`pre`、`fig`/`image`、`simpletable`、`table`（CALS）、`b`/`i`/`u`/`codeph`/`uicontrol`/`filepath`/`varname`/`ph`/`keyword`/`xref`/`fn`。
  - **未知/特化元素兜底机制（Passthrough Nodes）**：
    - 定义 `unknown_block` 和 `unknown_inline` 两种通用 ProseMirror 节点，保存原始 `tagName` 与 `rawAttrs`（JSON Map）。
    - 遇到未精细建模的 DITA 1.3 冷门标签（如 `hazardstatement`、`syntaxdiagram`）或自定义特化标签时，在可视化视图中以带标签徽章的边框容器/胶囊渲染，允许编辑内部文本或属性，序列化回 XML 时**原样输出原始标签名与全部属性**。
  - **特殊元信息保留**：XML 声明、`<!DOCTYPE ...>`、文档级注释与处理指令（PI）存储在 ProseMirror Document 的顶层元数据（或不可见锚点节点 `xml_comment` / `xml_pi`）中，切回源码或保存时无损还原。
- **CALS 表格专项处理**：
  - DITA `<simpletable>` 可直接映射为常规表格；而标准 `<table>` 采用 OASIS CALS 模型（`<tgroup cols="3"><colspec colname="c1"/>...<entry namest="c1" nameend="c2" morerows="1">`）。
  - **策略**：Phase 1 先将 `<simpletable>` 做到原生完整编辑体验，将 CALS `<table>` 通过专用适配器把 `namest/nameend/morerows` 转换为 `colspan/rowspan` 映射到 ProseMirror 表格节点（并保留 `colspec` 元数据），确保读写往返不破坏复杂合并单元格。
- **双模切换状态机**：
  - **Visual → Source**：ProseMirror `Doc` → `slimdom` → 格式化序列化为 XML 字符串（保持确定性缩进，最小化 Git Diff），刷新 CodeMirror 6。
  - **Source → Visual**：先检查 XML 良构性（Well-formed）。若存在未闭合标签等语法错误，**禁止切回 Visual 模式**并在源码视图高亮报错位置，待修复后再解析回 ProseMirror `Doc`，从根源避免非法 XML 破坏可视化树。

### 2. Map 可视化树与双栏工作台

- 左侧 Map 编辑器同样基于 `slimdom` 解析 `.ditamap` / `.bookmap`：
  - 将 `topicref`、`chapter`、`part`、`appendix`、`mapref`、`topichead`、`topicgroup`、`keydef` 映射为树节点模型，保留未建模节点（如 `topicmeta`、`reltable`、`bookmeta`）在 DOM 中原位不动。
  - 拖拽重排/调层级直接操作底层 `slimdom` 节点移动并即时写回 Map 缓冲区，支持一键切换查看/编辑该 Map 的 XML 源码。
  - 支持右键“新建 Topic 并挂载”（按 `concept`/`task`/`reference`/`topic` 模板创建标准 `.dita` 文件并自动生成相对路径 `href`）。
  - 顶部提供**当前激活 Root Map 选择器**与 **DITAVAL 预览选择器**，全局驱动右侧所有已打开 Topic 的语义解析。

### 3. Root Map 驱动的跨文件语义引擎（Keys / Conref / DITAVAL）

这是决定产品是否是“真 DITA 编辑器”的分水岭。后端维护按 `(repoId, branch)` 缓存的增量语义索引器（修改单个文件仅增量重算受影响节点）：

```mermaid
flowchart LR
    RootMap["选定 Root Map (.ditamap / .bookmap)"] --> Walker["广度优先 Map 遍历器 (含 mapref 递归)"]
    Walker --> Keyspace["Keyspace 映射表 (First Definition Wins + keyscope)"]
    Walker --> FileGraph["文件引用图与断链检测"]
    Topics["分支内全部 Topic 文件"] --> IdIndex["ID 索引库 (filePath#topicId/elemId)"]
    Keyspace --> Resolver["Conref / Conkeyref 解析器 (含 DFS 循环引用检测)"]
    IdIndex --> Resolver
    Ditaval["选定 .ditaval 文件"] --> FilterEval["条件属性求值器 (include / exclude / flag)"]
    Resolver --> EditorPreview["编辑器实时渲染 (变量替换 / 复用只读展开 / 条件高亮隐藏)"]
    FilterEval --> EditorPreview
```

- **Keyspace 解析（`keydef` / `keyref`）**：
  - 严格遵循 DITA 1.3 规范的 **广度优先 + 先定义生效（First Definition Wins）** 原则，同时支持基础 `keyscope` 作用域前缀。
  - 索引每个 key 的 `href` 目标及内联文本（`topicmeta/keywords/keyword` 或 `linktext`）。
  - 在可视化编辑器中，`<keyword keyref="prod_name"/>` 或 `<ph keyref="ver"/>` 实时显示解析后的变量文本（带虚线下划线徽章提示，悬停显示定义来源 Map，若未定义则标红告警）。
- **内容复用（`conref` / `conkeyref`）**：
  - 插入向导支持先选目标文件/Key，再从该 Topic 的 ID 列表中挑选目标元素（自动校验目标元素与当前元素类型兼容性）。
  - 解析时执行 **DFS 访问栈检测**，一旦发现 `A → B → A` 循环引用立即中断并返回语义错误。
  - 在可视化编辑器中以 **只读嵌套块/行内装饰（Read-only NodeView）** 展开真实复用内容，并提供“跳转到源定义”快捷按钮；底层 XML 仅保存引用属性，不污染源标签。
- **条件过滤（Profiling & `DITAVAL`）**：
  - 所有支持过滤的元素在右侧属性面板均提供 `audience`、`platform`、`product`、`otherprops`、`props`、`rev` 的结构化多值编辑（支持从项目内已有值自动提示，减少拼写错误）。
  - 工具栏可选择项目中的 `.ditaval` 文件（或关闭过滤），实时在左侧 Map 树和右侧 Topic 编辑器中切换三种视觉模式：**全部显示（带属性彩色标签） / 淡化被排除内容 / 完全隐藏被排除内容**（外加 `flag` 规则的颜色/标记高亮）。整个过滤仅为视图层投影，不改动底层 XML。

### 4. Check-out 独占锁与本地 Git 版本管理状态机

- **锁模型**：在 SQLite（Drizzle ORM）`file_locks` 表建立唯一索引 `UNIQUE(project_id, branch, file_path)`，彻底杜绝并发抢锁竞态，零外部数据库依赖。
- **轻量身份切换**：免密码登录门槛，工具栏直接切换当前作者身份与角色（管理员 / 编辑者 / 只读），Check-out 锁归属与本地 Git Commit 作者信息均自动关联当前身份。
- **单文件生命周期**：
  1. **打开文件**：默认以**只读模式**打开（可直接浏览、复制、预览 `conref`/DITAVAL），顶部状态栏显示当前锁定人（若已被他人检出）。
  2. **Check out（检出）**：点击检出 → 后端检查当前分支工作区与锁状态 → 写入锁记录 → 编辑器切换为可编辑态。编辑过程中的自动保存写入工作区文件并标记为未提交（Dirty）。
  3. **Check in（检入）**：点击检入 → 可选先跑一次权威校验（有 Error 时拦截或二次确认）→ 展示单文件/批量 Git Diff → 填写 Commit Message → 仅 `git add` 当前身份检出的文件并执行本地 `git commit` → 释放数据库锁。
  4. **Cancel Check-out（撤销检出）**：执行 `git checkout -- <file>` 回滚本地改动并释放锁。
  5. **管理员强制解锁**：管理员在锁管理面板可强制释放他人占用的锁（默认先备份未提交内容为补丁/草稿，防止误删他人工作）。
- **版本管理与对比（无外部平台依赖）**：提供本地仓库自动初始化、分支切换/新建、项目级与单文件 Commit 历史浏览、工作区未提交改动与任意两个历史版本之间的可视化并排/行内 Diff 对比（基于 CodeMirror 6 MergeView），以及查看历史只读快照或按版本回滚。

### 5. 双层校验与 DITA-OT 异步发布（含中文 PDF 关键处理）

- **双层校验闭环**：
  - **第一层（日常实时，0 延迟）**：ProseMirror Schema 限制合法子节点与属性；CodeMirror 6 基于 `@dita/core` 规则表做标签与属性自动补全及 XML 良构检查；TS 语义索引器实时报出断链 `href`、未定义 `keyref`、无效/循环 `conref`。
  - **第二层（官方权威，手动触发 / 检入前 / 发布前）**：TS 后端通过子进程调用 `dita` CLI（启用 `-Dvalidate=true -Dprocessing-mode=strict`，使用 DITA-OT 内置 OASIS DITA 1.3 DTD/RNG 与 XML Catalog），解析 DOTJ/DOTX 诊断日志并合并 TS 语义诊断，统一归一为 `{ filePath, line, column, severity, source, message }` 结构，在底部“问题面板”、源码红线和可视化节点旁同步高亮。
- **DITA-OT CLI 异步发布流水线**：
  - 用户选择 `Root Map` + `Output Format (HTML5 / PDF)` + 可选 `DITAVAL` → TS 后端将当前分支工作区文件快照到独立构建目录 → 写入 BullMQ 任务 → 后端 Worker 进程调用 `dita` CLI 执行构建，将 stdout/stderr 实时通过 SSE 回传前端构建日志抽屉。
  - HTML5 产物通过受鉴权的静态预览路由直接在浏览器新标签页/抽屉内在线预览，同时提供 `.zip` 打包下载；PDF 支持在线预览与下载。
  - **中文 PDF 避坑方案（必做）**：DITA-OT 默认 `pdf2`（Apache FOP）不含中文字体，中文会全部渲染成 `###`。在 `api` 容器镜像内预装 **Noto Sans CJK SC / Noto Serif CJK SC**，并在仓库内置纯 XML 的 DITA-OT PDF 字体映射插件（`dita-ot-plugins/com.ditaeditor.pdf-cjk/`，含 `plugin.xml`、`fop.xconf` 与 `font-mappings.xml`），通过 `dita install` 注册（或通过 `-Dcustomization.dir` / `-Dargs.fo.userconfig` 传入），确保零 Java 代码即可开箱导出中文 PDF。

---

## 四、技术选型矩阵

| 层级 / 模块 | 推荐选型 | 核心理由 | 备选方案（何时切换） |
| :--- | :--- | :--- | :--- |
| **工程组织** | **pnpm Workspace + Turborepo** | 原生支持 TS Monorepo，让前后端直接共享 `@dita/core` | Nx（团队规模扩大后再考虑） |
| **前端框架** | **React 19 + TypeScript + Vite** | 复杂工作台与自定义 NodeView 生态最成熟 | 已确认选型 |
| **UI 与工作台布局** | **Tailwind CSS + shadcn/ui (Radix) + `react-resizable-panels`** | 零运行时侵入、极适合高密度专业工具/IDE 风格 | Ant Design（偏后台表单风，工作台定制略重） |
| **可视化编辑引擎** | **原生 ProseMirror**（薄封装 React NodeView） | Content Expression 语法天然贴合 DTD 结构约束，无 Tiptap 的 HTML 抽象包袱 | Lexical / Slate（缺少原生声明式结构约束） |
| **XML 源码引擎** | **CodeMirror 6** (`@codemirror/lang-xml`, `lint`, `merge`) | 体积轻、切 Tab 极快、内置 Schema 补全/Lint/Diff | Monaco Editor（体积大，仅当强依赖 VS Code 体验时选） |
| **Map 树组件** | **`react-arborist`**（或 `@dnd-kit` 自定义虚拟树） | 专为 IDE 目录/大纲树设计，自带拖拽层级调整、快捷键与大树虚拟滚动 | `@dnd-kit/core`（完全手控定制） |
| **前端状态管理** | **Zustand + TanStack Query** | 区分本地工作台状态（Tab/锁/DITAVAL）与服务端异步缓存 | Redux Toolkit（样板代码偏多） |
| **XML 无损内核 (`@dita/core`)** | **`slimdom` + `slimdom-sax-parser` + `fontoxpath`** | Fonto 开源技术栈，完整保留 DOCTYPE/注释/PI/位置信息，支持 XPath 3.1 | `@xml-tools/parser`（纯 CST，缺少 DOM 与 XPath 生态） |
| **TS 主后端** | **Fastify + TypeScript + Zod** | 轻量高性能、开发心智负担低，非常适合个人/AI 快速迭代 | NestJS（多人强约束规范团队可选） |
| **Git 引擎** | **`simple-git`**（封装系统 git） | 原生支持本地仓库初始化、`git worktree`、分支、历史日志与 Diff，零外部平台依赖 | `isomorphic-git`（大仓库和 worktree 支持较弱） |
| **数据库 & ORM** | **SQLite + Drizzle ORM** | 零外部服务依赖、单文件开箱即用，强事务唯一索引支撑 Check-out 独占锁，Drizzle 类型安全轻量 | PostgreSQL（若后期多实例横向扩展可平滑迁移） |
| **队列与实时通信** | **Redis 7 + BullMQ + SSE** | 异步调度 DITA-OT 构建，SSE 轻量推送日志与锁状态变更 | WebSocket（若后期加协同再升级） |
| **DITA-OT 发布与校验运行时** | **DITA-OT 4.x CLI + JRE 21 + 纯 XML 中文 PDF 插件** | 零 Java 业务代码，直接复用官方 DITA 1.3 DTD/RNG 校验与 HTML5/PDF2 发布引擎 | 独立常驻 Java Worker（仅在强需求 50ms 级保存期 DTD 校验时按需扩展） |
| **部署交付** | **Docker Compose**（`web` + `api`（内置 JRE/DITA-OT/Noto CJK）+ `redis`） | 私有化内网一键启动，SQLite 与本地 Git 仓库持久化在共享卷，后续可平滑拆成 K8s Manifest | 单机裸部署（本机安装 `dita` CLI 与 Noto CJK 字体亦可直接运行） |

---

## 五、推荐 Monorepo 目录结构

```text
DITAEditor/
├── apps/
│   ├── web/                    # React + Vite 前端工作台
│   │   ├── src/
│   │   │   ├── components/     # 通用 UI、工作台分栏、弹窗
│   │   │   ├── editor/
│   │   │   │   ├── visual/     # ProseMirror Schema、NodeViews、Toolbar、属性面板
│   │   │   │   ├── source/     # CodeMirror 6 XML 编辑器、补全、Lint 桥接
│   │   │   │   └── bridge/     # Visual <-> Source 双模无损同步与光标映射
│   │   │   ├── map-tree/       # 可视化 Map/Bookmap 树形编辑器
│   │   │   ├── git-panel/      # 分支管理、Check-out 状态、版本历史、Diff 对比、Commit
│   │   │   └── publish/        # DITA-OT 发布配置、实时日志抽屉、产物预览
│   └── api/                    # Fastify + TypeScript 主后端
│       ├── src/
│       │   ├── modules/
│       │   │   ├── identity/   # 轻量身份与角色切换 (Admin / Writer / Viewer)
│       │   │   ├── projects/   # 项目配置、本地 Git 仓库与分支 worktree 管理
│       │   │   ├── locks/      # Check-out 独占锁与管理员强制解锁
│       │   │   ├── files/      # 文件读写、图片资产、重命名与引用影响检查
│       │   │   ├── indexer/    # Root Map Keyspace / Conref / ID / DITAVAL 语义引擎
│       │   │   ├── validate/   # 校验编排（调用 dita CLI 严格校验 + 解析日志 + 合并语义诊断）
│       │   │   └── publish/    # BullMQ 任务派发、工作区快照、spawn dita CLI、SSE 日志与静态预览路由
│       │   └── db/             # Drizzle Schema & Migrations
├── packages/
│   └── dita-core/              # @dita/core 前后端共享核心库
│       ├── xml/                # slimdom 解析、位置追踪、确定性无损序列化
│       ├── model/              # DITA 1.3 核心元素定义、内容约束规则、属性元数据
│       ├── cals/               # CALS 表格 <-> 矩阵模型双向转换
│       ├── ditaval/            # .ditaval 解析与元素条件求值器
│       └── templates/          # concept / task / reference / topic / map 新建模板
└── dita-ot-plugins/            # 纯 XML DITA-OT 定制插件（零 Java 代码）
    └── com.ditaeditor.pdf-cjk/ # 内置中文 PDF 字体映射插件 (plugin.xml + fop.xconf + font-mappings.xml)
├── docker-compose.yml          # 一键拉起全套服务
└── docs/                       # 架构文档、ADR 与接口契约
```

---

## 六、分阶段垂直切片实施计划

面向**个人 / AI 辅助独立推进**，遵循 **“高风险内核先行（Spike）→ 单机闭环 → 语义深化 → 团队协作 → 发布闭环”** 的原则，每个阶段产出可运行、可验收的垂直切片，总计约 **10–14 周**（按全职或高强度 AI 辅助推进估算；兼职可按比例顺延）。

### Phase 0：技术尖刺与工程底座（第 1 周）
> **目标**：在写任何业务页面之前，用自动化测试证明最难的“DITA XML 无损往返 + 双模互转”可行。
- 初始化 pnpm Monorepo（`apps/web`、`apps/api`、`packages/dita-core`）与基础测试框架（Vitest）。
- 在 `@dita/core` 跑通 `slimdom` + `slimdom-sax-parser` + `fontoxpath`。
- **核心验证（Spike）**：编写 10 份真实复杂的 DITA 1.3 样本文档（包含 `DOCTYPE`、XML 注释、PI、`task/steps`、CALS 合并单元格、未知特化标签、`conkeyref`），跑通 `XML → slimdom → ProseMirror Doc → slimdom → XML` 的双向转换黄金快照测试（Golden Tests），确保结构与属性 **100% 无损且 Diff 干净**。
- **验收标准**：10 份复杂 DITA 样本往返序列化测试全绿；`unknown_block` / `unknown_inline` 保真机制验证通过。

### Phase 1：双模式 Topic 编辑器核心 MVP（第 2–4 周）
> **目标**：单文件层面的专业 DITA Topic 编辑体验成型（暂用本地目录/内存样本驱动，快速打磨编辑器手感）。
- 实现 DITA 1.3 核心 Schema（`topic` / `concept` / `task` / `reference`）及高频元素渲染与编辑命令（标题、段落、列表、步骤 `steps/step/cmd`、`note`、`codeblock`、`fig/image`、`simpletable`、CALS `table`、行内格式化与 `xref`）。
- 实现上下文感知元素插入菜单（斜杠命令 `/` 或插入面板，仅展示当前光标处 DITA 规范允许插入的合法元素）、底部元素面包屑路径栏与右侧属性面板。
- 集成 CodeMirror 6 XML 源码视图，接入基于 `@dita/core` 规则表的标签/属性自动补全、XML 良构检查与 Visual ↔ Source 双向无损切换（带源码非法拦截保护）。
- **验收标准**：可流畅新建并编辑标准 Concept / Task / Reference 文档，在可视化与源码间反复切换无数据丢失，可编辑复杂表格和元素属性。

### Phase 2：Map 可视化树与多文件工作台（第 5–6 周）
> **目标**：从“单文件编辑器”升级为“多文件 DITA 项目工作台”。
- 搭建三栏可拖拽工作台（左侧 Map 树 / 文件浏览切换，中间多 Tab 编辑器，右侧属性面板，底部问题诊断面板）。
- 实现 Map / Bookmap 解析与 `react-arborist` 树形编辑器：支持拖拽调整 `topicref`/`mapref`/`topichead`/`chapter` 层级、右键按模板新建并挂载 Topic、编辑 `topicref` 属性、一键切换 Map 源码视图。
- 搭建 Fastify 后端与本地项目文件读写 API、图片上传与相对路径引用预览。
- **验收标准**：导入一份包含 50+ Topic 和嵌套子 Map 的真实 DITA 项目，可完整浏览、拖拽重构目录结构、多 Tab 编辑并保存落盘。

### Phase 3：单一信息源语义引擎（Keys + Conref + DITAVAL）（第 7–9 周）
> **目标**：交付团队最看重的三大 DITA 高级语义能力。
- 在后端构建按分支缓存的增量语义索引器（启动扫描 + 文件变更增量更新），并在工作台顶部接入 **Root Map 上下文选择器**。
- **Keyspace 能力**：实现广度优先 + `keyscope` 的 `keydef` 解析；编辑器支持插入 `keyref`、实时内联预览变量值、跳转到 Key 定义、未定义 Key 标红。
- **Conref / Conkeyref 能力**：实现复用插入选择器、跨文件片段解析、DFS 循环引用检测，以及可视化编辑器内只读内联展开渲染与一键跳转源文件。
- **DITAVAL 条件过滤能力**：实现 `.ditaval` 解析与求值器；右侧面板支持编辑条件属性；工作台顶部支持切换激活 `.ditaval` 文件并在 Map 树与 Topic 编辑器内实时高亮/淡化/隐藏条件内容。
- **验收标准**：在真实单源多版本测试项目中，切换不同 Root Map 或 DITAVAL 时，变量值、复用片段和条件显示均能毫秒级准确更新，循环引用能被精准拦截告警。

### Phase 4：本地 Git 版本管理、Check-out 独占锁与版本对比（第 10–11 周）
> **目标**：不依赖 GitHub / GitLab / Gitee 等外部平台，落地开箱即用的本地 Git 版本管理、Check-out 独占锁与可视化版本对比闭环。
- 接入 SQLite + Drizzle ORM，实现轻量身份切换（免密码在工具栏切换当前作者与三档角色：管理员 / 编辑者 / 只读），零外部服务依赖。
- 实现后端本地 Git 工作区管理器（基于 `simple-git` + 按分支隔离 `git worktree`）：支持为项目自动初始化或绑定本地 Git 仓库、分支切换/新建、项目与单文件 Commit 历史浏览，以及工作区未提交改动或任意两版本之间的可视化 Diff 对比（CodeMirror 6 MergeView）。
- 实现 **Check-out 独占锁服务**：打开默认只读、点击检出加锁、编辑草稿自动保存、检入前预览 Diff 并仅提交本人检出文件后释放锁、撤销检出回滚、管理员强制解锁（带补丁备份）。
- **验收标准**：在工具栏切换两个不同作者身份打开同一仓库同一分支，验证同一文件互斥检出、不同文件互不干扰、跨分支互不阻塞，以及完整 Check-out → 编辑 → Diff 对比 → Check-in（本地 Commit）→ 历史版本对比链路。

### Phase 5：DITA-OT CLI 权威校验、异步发布与容器部署（第 12–14 周）
> **目标**：零 Java 业务代码打通 DITA-OT 4.x 官方严格校验与 HTML5 / 中文 PDF 一键发布交付，达到团队生产可用状态。
- 构建纯 XML 的中文 PDF 字体插件 `dita-ot-plugins/com.ditaeditor.pdf-cjk/`（`plugin.xml` + `fop.xconf` + `font-mappings.xml`），并在后端运行镜像中预装 JRE 21 + DITA-OT 4.x + Noto CJK 字体（通过 `dita install` 注册或 CLI 参数加载）。
- 打通**双层校验**：在现有实时前端约束与 TS 语义索引之上，新增 `/api/validate/strict`（手动触发 / Check-in 前 / 发布前调用 `dita` CLI `-Dvalidate=true -Dprocessing-mode=strict`），解析 DOTJ/DOTX 报错并统一汇总到底部问题面板，点击精准定位到可视化节点或源码对应行/列。
- 接入 Redis + BullMQ 异步发布流水线（`apps/api/src/modules/publish/`）：工作区快照隔离构建、子进程调度 `dita` CLI、SSE 实时构建日志流、HTML5 在线预览与 ZIP 导出、中文 PDF 正确渲染与下载、历史发布记录管理。
- 编写 `docker-compose.yml`（`web` + 内置 DITA-OT CLI 的 `api` + `redis`），补齐内网部署文档、本机 `dita` CLI 配置说明与备份方案。
- **验收标准**：通过 `docker compose up`（或本机安装 DITA-OT CLI）一键运行；故意写入违反 DITA 1.3 DTD 的标签可在严格校验中准确标红定位；选定 Root Map + DITAVAL 一键产出排版正常、中文无乱码的 HTML5 与 PDF。

---

## 七、主要工程风险与应对策略

| 风险点 | 触发场景 | 应对策略 |
| :--- | :--- | :--- |
| **Git Diff 污染** | 可视化编辑改了一个字，保存后整篇 XML 缩进、属性顺序全变 | Phase 0 即引入确定性序列化器，严格保留属性顺序、注释与未改动节点格式，并建立 Round-trip 回归测试集 |
| **CALS 复杂表格损坏** | 带多行跨列（`namest`/`nameend`/`morerows`）与多 `tgroup` 的技术规格表 | 编写独立 `@dita/core/cals` 单元测试；对含多个 `tgroup` 等极端结构自动降级为源码编辑提示，绝不静默丢数据 |
| **DITA-OT 构建阻塞与磁盘膨胀** | 多人同时发布大手册，临时构建目录和历史产物占满磁盘 | BullMQ 限制并发度（如 1–2 个构建并发），构建超时强制 kill，定时清理超过 N 天的历史构建产物 |
| **DITA-OT 中文 PDF 乱码** | 默认 FOP 找不到 CJK 字形导致方块/`###` | 后端镜像内置 Noto CJK 字体 + 纯 XML 定制 `font-mappings` 插件（`dita install` 注册），纳入 Phase 5 必检验收项 |
| **Check-out 死锁** | 成员检出文件后长期休假或忘记检入 | 提供清晰的锁定人/锁定时间展示、锁到期提醒，以及管理员带补丁备份的一键强制解锁 |
