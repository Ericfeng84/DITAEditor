# Changelog

DITAEditor 的重要变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.5.0] — 2026-11-21

首个里程碑版本，覆盖架构基线中的 **Phase 0–3**：无损 XML 内核、双模式 Topic 编辑器、
可视化 Map/Bookmap 工作台，以及 Keys / Conref / DITAVAL 单一信息源语义引擎。

### Added

- **`@dita/core` 无损 XML 内核（Phase 0）**
  - `slimdom` + `slimdom-sax-parser` + `fontoxpath` 构建同构 DITA XML 内核，解析时记录源码起止行列号。
  - 往返零丢失：XML 声明、`<!DOCTYPE>`（含 PUBLIC/SYSTEM 与内部子集）、注释、处理指令、CDATA、
    `xml:*` / `xmlns:*` / `ditaarch:*` 命名空间，以及元素原始属性顺序（`rawAttrs`）。
  - 幂等确定性序列化（`roundTrip(roundTrip(xml)) === roundTrip(xml)`），仅改动文本时不扰动其他节点格式。
  - 10 份复杂 DITA 1.3 黄金往返测试样本（`packages/dita-core/test/fixtures/`）。
  - 原生 ProseMirror Schema 与无损 `slimdom ⇄ PM Doc` 转换：行内元素建模为 inline node 而非 mark，
    `xml_text_block` 承载混合内容，未知/特化标签透传为 `unknown_block` / `unknown_pre_block` /
    `unknown_inline` / `unknown_inline_block`。
  - OASIS CALS 表格适配（`cals_colspec` 显式子节点、`namest`/`nameend`/`morerows` 与
    `colspan`/`rowspan` 互转、多 `tgroup` 保护），并支持 `<simpletable>`。
- **双模式 Topic 编辑器（Phase 1）**
  - ProseMirror 可视化结构化编辑：上下文感知 `/` 插入菜单、选区悬浮气泡工具栏、块级操作手柄与块间 `+` 插块、
    三种标签渲染模式（无标签 / 标签 / 含属性）。
  - CodeMirror 6 XML 源码编辑：DITA 1.3 标签/属性智能补全、实时良构性 Lint、源码格式化。
  - Source → Visual 切换保护：`checkXmlWellFormed()` 校验失败时拦截切换并定位 `{ line, column }`。
  - 右侧属性检查器（保持原始 XML 属性顺序）、条件属性编辑器、可点击元素面包屑。
- **可视化 Map / Bookmap 工作台（Phase 2）**
  - `react-arborist` Map 树：拖拽调整 `topicref` / `mapref` / `topichead` / `chapter` / `keydef` 层级与顺序，
    右键按模板新建并挂载 Topic、挂载已有文件、编辑属性、查看 Map 源码，原位保留 `<reltable>`、`<topicmeta>`、注释与 PI。
  - 多 Tab 编辑、未保存追踪、单文件/全部保存、还原基线，底部项目级诊断面板
    （XML 良构错误、断链 `href`、循环 `<mapref>`、缺失图片、未定义 `keyref`、非法/循环 `conref`、`.ditaval` 语法错误）。
  - Fastify 本地工作区文件 CRUD 与 multipart 资源接口、POSIX 相对路径工具、
    `samples/demo-dita-project/` 示例工程。
- **单一信息源语义引擎（Phase 3）**
  - Root Map BFS 键空间（`keydef` / `keyref` / `keyscope`，First Definition Wins 冲突裁决与作用域隔离）。
  - `conref` / `conkeyref` / `conrefend` 解析与 DFS 循环引用检测、特化标签兼容性校验。
  - `.ditaval` 解析与三态投影（全部 / 淡化 / 隐藏）联动 Map 树与可视化编辑器，Flag 标记高亮，全程不改写 XML。
  - 增量语义索引 API（`/api/semantics/*`）、Keys 面板、插入 Keyref 对话框、条件属性编辑器、
    CodeMirror 6 语义自动补全。
- **复用的可视化入口**：右侧检视区新增「复用」tab（`ConrefReusePanel`），按 Key 或相对路径挑选带 `id` 的
  可复用元素，实时展示循环校验与内容预览，并支持「新建复用元素」与「绑定到当前元素」两种写入方式。

### Changed

- 工作台顶栏精简为品牌、视图切换（可视化 / 双栏对比 / XML 源码）、保存、诊断与属性入口；
  工作区切换与 Root Map 选择器移入左侧文件面板，DITAVAL 条件过滤配置与三态投影开关移入 Map 树面板。
- 替换原「插入复用」模态框为检视区 tab，`@dita/core` 复用逻辑抽为
  `apps/web/src/components/conref-reuse-model.ts` 并通过单元测试覆盖。
- 可视化标签药丸（tag pill）开合对齐改用 `vertical-align: middle`，修复行内元素开/闭标签基线错位。

### Removed

- 移除 `apps/web/src/components/InsertConrefDialog.tsx` 模态框及其状态管理，改由右侧检视区「复用」tab 承担。

### Known limitations

- Phase 4（PostgreSQL + Drizzle、OAuth/PAT、`git worktree` 分支隔离、Check-out 独占锁与 PR/MR 流程）尚未实现。
- Phase 5（Java 21 Worker + Xerces2/Jing + DITA 1.3 Catalog + DITA-OT 4.x 发布、BullMQ + SSE、Docker Compose）尚未实现。
- 当前为单机本地工作区模式，无多用户协作与文件锁。

[0.5.0]: https://github.com/Ericfeng84/DITAEditor/releases/tag/v0.5.0
