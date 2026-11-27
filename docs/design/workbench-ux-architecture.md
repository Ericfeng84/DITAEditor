# 工作台信息结构与交互设计规范

> 状态：已实现（v1.7.x）
> 范围：`@dita/web` 主编辑工作台壳层、Map 导航栏、可视化画布工具栏、标签装饰渲染、AI 检查器与底栏状态条
> 相关代码：`apps/web/src/App.tsx`、`apps/web/src/components/`、`apps/web/src/map-tree/`、`apps/web/src/editor/visual/`、`apps/web/src/ai/`、`apps/web/src/store/editor-store/`、`apps/web/src/styles/`

---

## 一、背景与设计原则

随着 Phase 0–15 功能持续演进，主编辑工作台在顶部、左栏、画布与右栏累积了多层局部控制条与重复状态入口。本规范以**信息结构（Information Architecture）**与**交互一致性（Interaction Design）**为锚点，确立五条长期设计原则：

1. **严格包含层级（Containment Hierarchy）**：全局壳层控件（视图模式、手册发布、全局问题诊断、语言与身份）归属顶部 `WorkbenchHeader`；文档级控件（格式化工具栏、规范抽屉、标签模式、保存/锁操作）归属当前活动文档窗格内部，绝不横跨 `EditorTabBar` 或右侧 Inspector 之上，避免切换编辑/只读态或视图模式时引发跨列跳动。
2. **单一信源（Single Source of Truth）**：同一状态与高频入口不在多个区域重复摆放（左/右面板折叠展开对称、问题诊断只在顶栏唯一呈现、身份角色不重复渲染、AI 范围切换不附带同义说明胶囊）。
3. **内容优先与按需显露（Content First & Progressive Disclosure）**：默认界面优先让位于文档正文与 Map 目录树；低频或前提未满足的控件（如未启用 DITAVAL 时的 `全显/淡化/隐藏`、只读态下置灰的 `保存` 按钮）默认隐藏，触发条件成立时再展开。
4. **阅读态与编辑态自适应（Mode-Adaptive Defaults）**：只读浏览聚焦可读性，编辑写作聚焦 DITA 结构感知——标签显示模式按编辑权限分别记忆并自动切换。
5. **不破坏工程不变量**：所有优化均限于 `@dita/web` 表现层与 UI 状态，不改变 `@dita/core` 无损 XML 往返语义、Phase 13 草稿叠加层与独占锁机制，且保持完整的中英双语 i18n 一致性。

---

## 二、已确认的核心设计决策

| # | 决策项 | 规范方案 | 理由 |
| :-- | :--- | :--- | :--- |
| 1 | **标签模式按编辑态自适应** | **只读模式默认 `none`（无标签）**，**编辑模式默认 `tags`（仅标签）**；两套偏好分别持久化到 `localStorage`（`ditaeditor.tagDisplayMode.readOnly` / `ditaeditor.tagDisplayMode.edit`） | 未检出查阅时正文纯净无干扰；点击“检出”进入写作后自动浮现结构标签，兼顾新手可读性与 DITA 写作者的结构掌控感；手动切换仍可按模式持久记忆 |
| 2 | **`发布` 入口提升至顶栏** | 将手册级主动作 `发布` 提升至 `WorkbenchHeader` 右侧；从 `MapTreePanel` 紧凑树操作条中移除，保持树操作单行清爽 | 发布是全手册交付级动作，放在顶栏更符合全局心智模型，同时缓解左栏窄屏拥挤 |
| 3 | **`问题诊断` 保留顶栏单一入口** | 保留 `WorkbenchHeader` 的问题诊断胶囊作为唯一入口，移除 `BreadcrumbBar` 中重复的 `诊断: 0` | 顶栏错误/警告色标在全局视线焦点区更易发现，消除底栏重复点击入口 |
| 4 | **工具栏归位文档内部** | 移除跨列 `showActionRow`；可视化格式化 `EditorToolbar` 迁入 `VisualEditor` 内部（位于 `VisualEditorSubHeader` 正下方），源码/Map 概览控制条收入中栏内部且无内容时不渲染 | 彻底修复只读可视化态下的 9px 空白占位条，以及编辑态格式化条压在 Tab 与右栏上方导致的层级倒置与布局跳动 |
| 5 | **全量实施 P0 + P1 + P2** | 一次性完成壳层重构与 Bug 修复（P0）、跨区降噪与结构重排（P1）、画布视觉层级与 AI/只读交互引导（P2） | 保证信息架构整体自洽，避免半成品过渡态 |

---

## 三、信息结构蓝图

```mermaid
flowchart TB
  H["顶部全局栏 WorkbenchHeader<br/>左栏展开(仅折叠时) | 视图模式(可视化/双栏/源码) | 发布 CTA · 唯一问题诊断 · 精简身份 · 设置(含语言切换) · 右栏展开(仅折叠时) · 帮助(最右)"]
  subgraph Shell["三栏工作台主体（紧贴顶栏，无跨列工具条）"]
    direction LR
    L["左侧导航栏 LeftSidebar<br/>Map 树: Root 标题+源码 → 二级 Tab(目录/Keys) → 树操作(挂载/分组/撤销重做/展开收起) → 搜索+按需 DITAVAL 过滤 → 目录树<br/>底部一级 Tab 栏: 文件 / Map 树 / 版本 / 任务"]
    C["中栏文档工作区<br/>EditorTabBar → ReadOnlyBanner(含只读轻引导高亮)<br/>→ VisualEditorSubHeader(大纲 · 合并规范胶囊 | 标签模式 · 委派 · 锁状态单图标下拉 · 保存)<br/>→ EditorToolbar(仅可视化可编辑态) → 层次化标签画布"]
    R["右侧检查器 TopicInspector<br/>唯一顶栏: AI / 属性 / 复用 + 折叠按钮<br/>AI 面板: 单行模型/设置与范围条(片段时才显靶向) → 对话/空态快捷提示词 → 底部输入区"]
  end
  F["底栏状态条 BreadcrumbBar<br/>DITA 元素路径面包屑 | 当前文件路径 · 基线行差异 · 无损内核图标(Tooltip)"]
  H --> Shell --> F
```

---

## 四、分项设计规范

### 4.1 P0：壳层包含层级重构与渲染/交互缺陷修复

1. **左右边栏折叠/展开按钮严格对称**
   - `LeftSidebar` 展开时仅由其顶部自带的 `PanelLeftClose` 负责收起；`WorkbenchHeader` 左侧的 `<PanelLeft />` 展开按钮仅在 `!leftSidebarOpen` 时显示，与右侧 `showInspectorExpand` 完全对称。
2. **消除空白 `showActionRow` 与归位 `EditorToolbar`**
   - 删除 `App.tsx` 中位于 `WorkbenchHeader` 下方、横跨中栏与右侧 Inspector 的 `showActionRow`。
   - `VisualEditor` 新增 `formattingBarSlot?: ReactNode`；当 `showTopicVisual && canEdit` 时将 `<EditorToolbar />` 渲染于 `VisualEditorSubHeader` 与画布滚动区之间。
   - 非可视化模式（纯源码 / Map 概览）下，仅当 `saveControlsNode`、`TopicGuideChip` 或 `topicContextNode` 存在实际可渲染内容时，在中栏 `center-workbench-pane` 内部渲染单行文档控制条。
3. **修复 Oxygen 风格标签属性粘连缺陷（`conceptid="..."`）**
   - 根因：`.dita-ox-body` 为 `display: inline-flex`，Flex 子项自动折叠 `attrsSpan.textContent` 的前导空格。
   - 修复：在 `apps/web/src/styles/tag-chrome.css` 中为 `.dita-ox-body` 增加 `gap: 4px`，并在 `apps/web/src/editor/visual/decorations/tag-dom.ts` 中直接输出 `attrsText`（不再依赖前导空格）。
4. **移除 AI 面板重复顶栏与失效 `X` 按钮**
   - `TopicInspector` 已统一承载右侧面板 Tab 与折叠按钮；移除 `AiAssistantPanel` 内部的二次标题栏与调用 `useAiStore.closePanel()` 的死按钮 `X`。
   - 将模型名称胶囊（点击可直达 AI 设置）与设置图标整合进顶部范围上下文栏；当 `scope === 'document'` 时隐藏与选中按钮同义的 `整篇模式 · 完整 Topic` 胶囊，仅在 `scope === 'fragment'` 时展示具体命中元素与选中片段预览。

### 4.2 P1：左栏、文档工具栏、身份与底栏降噪

1. **`MapTreePanel` 垂直层级压缩（5 层 → 3 层）**
   - 顺序调整为：**Root Map 标题行** → **`目录结构 | Keys (N)` 二级 Tab** → **树操作与搜索区（仅 `tree` 视图渲染）**，切换 `Keys` 视图时二级 Tab 位置固定不跳动。
   - `发布` 按钮移至 `WorkbenchHeader`，树操作条仅保留 `挂载 v`、`分组 v` 与右侧 `撤销/重做/展开/收起`。
   - 搜索框与 DITAVAL 过滤触发器合并为同一行：未选择 DITAVAL 时右侧仅展示紧凑的过滤选择触发器（不渲染 3 个禁用的 `全显/淡化/隐藏` 按钮）；选择 DITAVAL 或展开过滤面板后，再显示青色激活条（含 `全显/淡化/隐藏` 与排除/标记统计）。
   - 移除底部常驻静态提示行，释放目录树可视高度；将操作提示保留在空态与树标题 Tooltip 中。
2. **`IdentitySwitcher` 去重**
   - 保留 `<select>` 内的 `{displayName} · {roleLabel}` 清晰展示，移除右侧重复的灰色角色小标签。
3. **`TopicGuideChip` 合并与 `SaveControls` 只读隐藏**
   - 将 `概念主题` 徽章与 `展开编写规范 v` 合并为一枚统一的交互胶囊按钮（图标 + 主题类型名 + 展开/收起箭头，点击整枚胶囊即可切换规范面板；有结构问题时紧邻展示结构问题角标）。
   - `SaveControls` 在 `readOnly && dirtyCount === 0` 时返回 `null`，不在只读工具栏中展示置灰的 `保存` 按钮。
4. **`BreadcrumbBar` 精简**
   - 移除重复的 `诊断: 0` 入口（由顶栏统一承接）。
   - 将静态文字 `@dita/core 无损内核` 收敛为带 `title` 与 `aria-label` 的紧凑绿色 `ShieldCheck` 状态图标，为左侧 DITA 元素路径面包屑腾出横向空间。

### 4.3 P2：自适应标签默认态、视觉层次与交互引导

1. **按编辑权限自适应与持久化的 `tagDisplayMode`**
   - 在 `editor-store` 中维护 `readOnlyTagDisplayMode`（默认 `'none'`，持久化键 `ditaeditor.tagDisplayMode.readOnly`）与 `editTagDisplayMode`（默认 `'tags'`，持久化键 `ditaeditor.tagDisplayMode.edit`），同时保留 `tagDisplayMode` 字段与 `setTagDisplayMode(mode, scope?)` 向后兼容。
   - `App.tsx` 根据 `canEdit` 自动映射当前生效模式：`canEdit ? editTagDisplayMode : readOnlyTagDisplayMode`。用户签出文件时自动从“无标签阅读”切入“仅标签编辑”；签入/释放锁回退只读时自动恢复纯净阅读；用户在任一模式下手动切换标签档位均被持久记住。
2. **标签视觉权重分级与 `titlealts` 轻量化**
   - `.dita-ox-strip:not([data-ox-selected="true"])` 降低非焦点容器开/闭标签的视觉噪音（更柔和边框与 `opacity: 0.72`，悬停恢复 `1`），聚焦与祖先选中态保持蓝色高亮。
   - 弱化 `titlealts` / `navtitle` 区域字号与灰度，避免与文档主标题 `<h1>` 争夺第一视觉焦点。
3. **AI 空态快捷指令引导**
   - 当对话为空且无待处理提案时，在说明卡片下方提供 3 个一键填入的常用提示词按钮（检查 DITA 1.3 结构规范 / 润色 `<shortdesc>` 摘要 / 提炼本主题要点），点击自动选择对应任务类型、填入输入框并聚焦文本框（不自动消耗 Token）。
4. **只读画布键入轻引导**
   - 当 `VisualEditor` 处于 `readOnly` 状态且用户在画布内敲击可打印字符或退格/删除键（忽略方向键、Esc 及复制/全选/查找快捷键）时，触发 `onReadOnlyEditAttempt`，短时高亮 `ReadOnlyBanner` 的 `检出` 按钮并播报无障碍状态提示，消除“敲键盘无响应”的困惑。

---

## 五、验收与回归要求

- 全仓构建、类型检查与测试全部通过：`pnpm -r build && pnpm -r typecheck && pnpm -r test`。
- 国际化契约守护：`i18n-parity.test.ts` 与 `no-hardcoded-cjk.test.ts` 零报错。
- 核心 UI 回归测试覆盖：
  - `WorkbenchHeader` 左栏按钮对称性与顶栏 `发布` 按钮；
  - `MapTreePanel` 二级 Tab 顺序、DITAVAL 未激活时不渲染禁用模式按钮；
  - `createOxygenTagDom` 属性无前导空格与 CSS `gap` 协作；
  - `editor-store` 只读/编辑两套 `tagDisplayMode` 默认值与 `localStorage` 持久化；
  - `SaveControls` 只读干净态隐藏、`AiAssistantPanel` 无冗余关闭按钮与空态快捷提示词、`BreadcrumbBar` 去重。
