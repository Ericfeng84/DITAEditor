---
title: 功能导览
description: 手册工作台与任务委派、双模编辑、文档大纲与结构重排、无损往返、CALS 表格、键空间与 conref、DITAVAL 投影、DITA Map、Check-out 锁、成对翻译与双语审校、DITA-OT 发布与 AI 审阅。
updated: '2026-11-28'
---

DITAEditor 的功能围绕一条链路组织：**分发 → 编辑 → 语义 → 编排 → 协作 → 翻译 → 发布 → AI 辅助**。每一环都作用于同一份标准 DITA XML，界面与文档站均提供中英双语。

## 手册工作台与 Topic 委派

打开工作台先进入**手册列表**：每张卡片展示该手册的 Topic / Map 数量、当前分支、挂载目录与「待我处理」的任务数，支持挂载本地目录、新建手册、归档与恢复。

右侧是**我的编辑任务**，分「我收到的 / 我委派的」两个视图：

- 任务绑定 `(手册, 分支, Topic, 负责人, 截止日期, 备注)`，状态在「待开始 / 进行中 / 已完成」之间流转；
- 逾期任务以红色标记，完成后立即从待办中移除；
- 委派、转派与完成都只写 SQLite，不修改任何 DITA XML，也不产生额外 Git 提交。

手册与任务让「谁在什么时候写哪一篇」变得可见，而文档本身仍然是仓库里的标准 XML。

## 双模编辑

- **可视化模式**：ProseMirror 原生 Schema，DITA 元素是节点而不是 mark，因此空元素、嵌套顺序与逐元素属性都能保留。
- **源码模式**：CodeMirror 6，带 XML 语法、良构诊断与基于 `@dita/core` 的补全。
- **切换守卫**：切回可视化前会运行 `checkXmlWellFormed()`；失败时阻止切换并给出行、列、偏移与消息。
- **结构引导**：`DITA_SEQUENCE_MODEL` 集中声明有序容器的子元素顺序与基数，编辑器只给出提示而不拦截；`conref` / `conkeyref` 元素跳过必填子元素检查。

混合内容不会强行包 `<p>`：`<li>`、`<dd>`、`<entry>` 中的裸文本映射为 `xml_text_block`，序列化时自动展开。

## 文档大纲与结构重排

编辑器左侧常驻一份可折叠大纲（`DocumentOutlinePanel`），分「结构骨架」与「全部块级」两种密度，可按文本、标签或 ID 即时过滤。

- **双向定位**：点击大纲条目跳到可视化、分栏或源码视图中的对应位置；光标移动时大纲同步高亮当前块。
- **拖拽重排**：节点移动先经 `DITA_SEQUENCE_MODEL` 校验，跨容器移动（段落进另一 `section`、列表项进另一列表）只在内容模型允许时放行，非法目标给出原因。
- **键盘与撤销**：`Alt+↑/↓` 等价于拖拽；一次重排在单个 ProseMirror 事务内完成，一次撤销即可回退。
- **安全边界**：只读角色、他人检出的文件与多 `tgroup` 表格禁止拖动；拖动失败始终走提示而不拦截文档编辑。
- **快捷键**：`Cmd/Ctrl+Shift+O` 切换大纲面板，面板宽度可拖动并记忆（默认 240px，最小 180px）。

## 无损往返与最小 Diff

往返路径是 `XML → slimdom → ProseMirror Doc → slimdom → XML`。以下内容必须逐字节保留：

- XML 声明与 `<!DOCTYPE>`（包括 PUBLIC/SYSTEM 与内部子集）
- 注释、处理指令（`<?xml-model?>`、审阅标记等）、CDATA
- 命名空间与 `xml:*`、`ditaarch:*` 属性
- 属性顺序（每个节点保存 `rawAttrs: XmlAttributeEntry[]`）

序列化是确定性的：`roundTrip(roundTrip(xml)) === roundTrip(xml)`。改一个文本节点，只会改变对应的一行。

## OASIS CALS 表格

- `<colspec>` 作为 `cals_tgroup` 的显式子节点保留，注释与 PI 不会被挪走。
- `namest` / `nameend` / `morerows` 被换算为 `colspan` / `rowspan` 与占用网格，同时保留原始属性。
- 检测到多个 `tgroup` 时，界面会避免破坏性的可视化编辑，引导回源码模式。

## 单一信息源

### 键空间

从 Root Map 出发 BFS 解析 `keydef`（含 `keyscope`），得到 `key → href/text/shortdesc` 的映射。编辑器的 `Keys` 面板可搜索、跳转与插入 `keyref`。

### Conref

`conref` / `conkeyref` / `conrefend` 在编辑器内**只读展开**，底层 XML 不变。解析器带 DFS 环检测与 specialization 检查，循环引用会给出明确诊断。支持从复用面板、`BlockHandle` 块操作菜单或属性检查器一键新建标准 `processing-role="resource-only"` 复用仓库、原地生成语义 `id` 或将已有段落提取为可复用片段，并可通过 `/` 斜杠菜单、块间 `+` 与工具栏直接插入复用引用。

### DITAVAL 投影

`.ditaval` 被解析为规则集，对带 profiling 属性的元素求值，得到 `include` / `exclude` / `flag` 三态。视图可以全部显示、淡化排除或隐藏排除；导出与发布仍按原始 XML 进行。

## DITA Map

- `react-arborist` 驱动的树形结构，支持 `topicref`、`mapref`、`topichead`、`topicgroup`、`keydef` 与 `<reltable>`。
- 路径工具为 POSIX 语义，跨平台一致。
- 与主题编辑共享多标签工作台，状态不丢失。

## 协作与版本

- **干净基线 + 个人草稿层**：共享分支的 `workDir` 永远等于 Git `HEAD`；未检入的编辑、新建、删除、重命名与草稿图片全部隔离在 SQLite `working_drafts` 中，只有持锁人看得到。同分支两人共编同一 Map，彼此的校验、AI 上下文与发布快照互不污染。
- **Check-out 独占锁**：键为 `(project, branch, file_path)`；过期时间由 `DITA_LOCK_TTL_HOURS` 控制，续期按 `updatedAt` 判定。
- **显式目标视图**：语法/跨文件诊断、严格 DITA-OT 校验（默认 `my_drafts`）与 AI 上下文读「基线 + 本人草稿」；正式发布默认走干净基线（`HEAD` / `Tag` / `Commit` 快照），可选预览只含自己的草稿。
- **合并与回滚**：`git merge-tree` 预检后隔离合成 merge commit，冲突在 MergeView 中逐文件求解；支持 Tag、单文件恢复（草稿 / 提交两种模式）与提交回滚，保护分支拒绝删除。
- **版本审计**：`version_audit_logs` 记录检出、转派、撤销、强解、检入、分支、标签、合并、回滚与发布，只写 SQLite，不碰 XML 与 Git 元数据。
- **Admin 强制解锁**：释放前先把草稿与当前内容备份为补丁，避免覆盖他人工作。

## 成对翻译与双语审校

目标语言不是翻译库里的一个字段，而是一本**真实手册**：独立目录、Git 仓库、分支、锁与发布主题。翻译中心把源手册与目标手册按文件配成一对，在配对上完成扫描、增量翻译、双语审校与签入。

- **语言血缘**：目标语言可以继续作为下一级源语言（如 `zh-CN → en-US → ar-SA`），上游未同步时给出非阻断提示。
- **增量同步**：按 `git diff` 识别新增、修改、重命名与删除；`S0 × S1 × T0` 三方对齐后，未变段落直接复用旧译，只把真正变化的段落交给模型。
- **双语审校**：左右对照 / 双语交错 / 沉浸对照 / XML 差异四种视图；逐段富文本或 XML 编辑，缺标签可补插，`id` / `href` / `keyref` 等属性必须与源文一致。
- **术语与 QA**：全局或手册级术语库、DNT 与禁用译法、占位符与行内标签守恒、可选独立 AI 审校与 DITA-OT 严格校验；
- **签入才生效**：审校结果先写入目标草稿层，签入后才推进目标分支基线；解除配对不会删除译文。

完整流程与边界见 [成对翻译与双语审校](/docs/translation)。

## 发布与严格校验

- 严格校验：`dita --validate=yes --processing-mode=strict`，DTD/RNG 问题带位置返回。
- 发布格式：HTML5 与 PDF；PDF 使用纯 XML 的 Noto CJK font-mappings 插件。
- 异步队列：SQLite + 进程内并发限制，SSE 流式日志，支持取消与产物保留。
- 单容器：Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK。

## AI 辅助

AI 只做「候选片段」：

1. 客户端发送目标范围（默认整篇主题）与上下文；
2. 服务端调用 OpenAI 兼容模型，要求返回 XML 片段；
3. 片段经 `normalizeCandidateXml` 清洗；
4. `spliceAndVerifyAiXml` 做无损拼接并校验；
5. 客户端在 Diff 对话框中审阅，选择应用、先 Check-out 再应用，或仅预览；
6. 应用时可视化是单个 ProseMirror transaction，源码是单次 CodeMirror 替换，`Cmd/Ctrl+Z` 一步撤销。

## 中英双语界面

- `zh-CN` 与 `en` 两套字典结构完全一致：`en` 以 `zh` 的类型约束，缺键会让 `pnpm -r typecheck` 直接失败。
- 语言偏好写入本地存储，切换即时生效，无需刷新；日期、时长与相对时间通过 `Intl` 按语言格式化。
- 官网、文档站与工作台共用同一套双语约定，`/` 与 `/en` 内容完全对称。
- DITA-OT 发布链路同样感知语言：PDF 标题、字体映射与构建日志都会跟随界面语言。

## 现在就想试

[打开在线工作台](https://www.cemplatformcvs.cloud/dita)：切换预设项目、编辑正文、查看 Map 树与单一信息源，并可直接校验与发布；或阅读 [AI 接入与安全边界](/docs/ai-setup) 了解模型配置。
