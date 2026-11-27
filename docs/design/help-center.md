# 帮助中心与 DITA 规范文档

> 状态：已实现（v1.7.0）
> 范围：`@dita/web` 应用内帮助中心 + `@dita/site` 双语文档站新增两页（`DOC_SLUGS` 从 6 页增至 8 页）
> 相关代码：`apps/web/src/components/help/`、`apps/web/src/lib/help-links.ts`、`apps/site/src/content/docs/`

---

## 一、问题与目标

工作台此前**没有任何帮助入口**：`apps/web/src/components/WorkbenchHeader.tsx` 只有侧栏开关、模式切换、问题面板、语言与身份切换。唯一可称为"文档"的是 `apps/web/src/components/TopicAuthoringGuide.tsx`——它只解释"当前主题类型允许哪些子元素"，是上下文内嵌提示，不是可检索、可通读的帮助。

目标：

1. 工作台内一个随时可达的帮助入口，**离线可用**；
2. 覆盖 DITA 1.3 规范要点、功能说明与操作指南；
3. 能跳转到项目主页与完整文档站；
4. 帮助内容**不与代码漂移**（元素标签、结构顺序来自 `@dita/core` 单一真相源）。

---

## 二、已确认的八个决策

| # | 决策 | 理由 |
| :-- | :--- | :--- |
| 1 | **混合形态**：应用内帮助（快速上手、DITA 速查）+ 外跳（完整文档站、项目主页） | 纯外跳在离线的 GitHub Pages 工作台（`VITE_STATIC_DEMO=true`）与无网桌面端等于死链；纯应用内则会与文档站双份维护 |
| 2 | **"项目主页" = GitHub 仓库**（`https://github.com/Ericfeng84/DITAEditor`），文档站作为次级入口 | README 本身就是产品主页（截图、功能、快速开始），文档站只覆盖其中一部分 |
| 3 | **帮助必须离线可用** | 内容打包进 `apps/web` 的 i18n 目录，随语言切换实时热替换；外链只是增强 |
| 4 | **DITA 速查 = 派生 + 手写判断类内容**；文档站新增规范专页 | 元素标签用 `getTagLabel`，结构顺序用 `DITA_SEQUENCE_MODEL`，属性说明复用既有属性文档；只有命名约定、主题类型选择、常见误区是手写 |
| 5 | **模态对话框**（非新路由、非右侧抽屉）；入口 = header 按钮 + `?` 快捷键 + Hub 页入口 | `/help` 会成为 `apps/web/src/router/app-router.ts` 的第三条路由，且切换时会卸载编辑器、丢未保存光标与滚动位置；右侧抽屉会与 AI/属性检查器抢位置 |
| 6 | **7 章结构**，只写"写作者视角" | 部署与 AI Key 配置留给文档站 `ai-setup` / `local-development`，应用内只给一句链接，不重复维护 |
| 7 | **文档站新增 `authoring-guide`（guides 组）与 `dita-spec`（reference 组）** | 规范与操作步骤是两类读者意图，塞进 `features.md` 会让它继续膨胀 |
| 8 | **外链常量集中 + `VITE_*` 可覆盖 + 离线降级** | 见下节 |

---

## 三、应用内帮助中心

### 3.1 入口

| 入口 | 位置 | 说明 |
| :-- | :--- | :--- |
| header 按钮 | `WorkbenchHeader` 右侧簇，"问题"按钮左侧，`CircleHelp` + "帮助" | `sm` 以下只显示图标 |
| Hub 页按钮 | `apps/web/src/workbench/HubHeader.tsx` | 未进入手册时也能读帮助 |
| 快捷键 | `?`（`Shift+/`） | 焦点在 `input` / `textarea` / `contenteditable`（ProseMirror、CodeMirror）或带修饰键时**不触发** |
| 关闭 | `Esc`、右上角关闭按钮、点击遮罩 | — |

打开状态放在 `apps/web/src/store/help-center-store.ts`（zustand，与 `store/desktop-store.ts` 同构），`apps/web/src/components/help/HelpCenterHost.tsx` 在 `apps/web/src/main.tsx` 顶层挂载一次，负责注册 `?` 快捷键并渲染模态；header 只需 `useHelpCenterStore((state) => state.open)`——**不做 prop 逐层透传**（`apps/web/src/App.tsx` 已有 2600 行），也不需要 provider，因此单独渲染 header 的测试不会因为缺少上下文而崩。

### 3.2 交互与无障碍

- 左侧章节导航（当前章节高亮），右侧内容区，顶部过滤输入框（纯客户端 `includes` 匹配，只过滤条目文本，不做分词与高亮，**0 依赖**）。
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`；打开时焦点进入过滤框，`Esc` 关闭；`Tab` 在对话框内循环，背后的工作台不可聚焦；打开期间锁定 `body` 滚动。
- 过滤无结果时给出空态文案，而不是空白面板。
- 步骤型区块用**显式序号徽标**渲染（Tailwind preflight 会清掉 `ol` 的编号，靠 `list-decimal` 会失去步骤感），每步可挂一张截图；截图按界面语言取 `src/assets/help/{zh,en}/` 下的本地资源，缩略图限制高度 `max-h-72`，点击在对话框之上再开一层放大视图（`z-[70]`），`Esc` 先关放大、再关帮助，`aria-label`/`alt` 均来自 i18n。

### 3.3 章节（7 章）

| 章节 | 内容 | 来源 |
| :-- | :--- | :--- |
| 快速上手 | 打开手册 → 检出 → 编辑 → 草稿 → 签入 → 发布，6 步；第 1/3/4/6 步带截图（工作台、双栏对比、问题诊断、发布对话框） | i18n 手写 + `assets/help/{zh,en}/` 实拍图 |
| 编辑与可视化 | 三模式切换、标签胶囊、只列合法插入项、表格合并与复杂表告警、conref/keyconref 只读投影、条件过滤、AI 差异提案、大纲拖拽。**面向作者的措辞**：不出现 ProseMirror / `rawAttrs` / `DITA_SEQUENCE_MODEL` / `normalizeCandidateXml` 等实现词汇，只说作者看得见的结果 | i18n 手写 |
| DITA 1.3 速查 | 四种主题类型（每类含"何时选用"一句判断依据与必需子元素）、有序容器（`conbody` / `taskbody` / `ul` / `ol` / `table`）、常用块级/内联元素、常用属性与"必填于"标注、命名规则、常见误区 | **派生**（`getSequenceSlots`、`getAllowedChildren().requiredTags`、`getTagLabel`、`getTagDescription`、`getAttributesForElement('ph')`、`getAttributeLabel` / `getAttributeDescription`）+ 手写规则 |
| 校验与发布 | 严格校验门禁、HTML5 主题、PDF 主题与字体、日志排错 | i18n 手写 |
| 协作与版本 | 独占锁、个人草稿叠加层、合并冲突、回滚 | i18n 手写 |
| 快捷键 | 全局 / 可视化编辑器 / 大纲与对话框三组 | i18n 手写 |
| 外部资源 | 文档站、GitHub、OASIS DITA 1.3 Part 2/3、DITA-OT | `help-links.ts` |

### 3.4 外链与离线降级

`apps/web/src/lib/help-links.ts` 集中定义：

```ts
HELP_SITE_URL   = VITE_SITE_URL   ?? 'https://ericfeng84.github.io/DITAEditor'
HELP_REPO_URL   = VITE_REPO_URL   ?? 'https://github.com/Ericfeng84/DITAEditor'
HELP_OASIS_TECH_CONTENT / HELP_OASIS_LANG_REFERENCE / HELP_DITA_OT_URL = 固定权威地址
HELP_OFFLINE    = VITE_STATIC_DEMO === 'true'
```

- 文档站默认指向 GitHub Pages 部署（`https://ericfeng84.github.io/DITAEditor`），`helpDocsUrl(locale)` 在其后拼 `/docs`（中文）或 `/en/docs`（英文），因此**子路径部署天然可用**；改用独立域名时只设 `VITE_SITE_URL`（不带尾斜杠）。
- 离线（`HELP_OFFLINE`）时**隐藏**"完整文档站"与"项目主页"两个网络链接，改为一句说明"离线版已内置写作者所需的全部内容"，不灰置一排点不动的按钮。
- 外链必须 `target="_blank" rel="noopener noreferrer"`：桌面端 `apps/desktop/src/main.ts:308` 的 `setWindowOpenHandler` 对 http/https 一律 `shell.openExternal` 后 `deny`，普通 `<a href>` 会在 Electron 里静默失败。

### 3.5 防漂移规则

- 文案只进 `apps/web/src/i18n/messages/{zh-CN,en}/help.ts`，中英条目数必须一致（`apps/web/test/i18n-parity.test.ts` 与新用例共同守护，源码里出现中文会被 `apps/web/test/no-hardcoded-cjk.test.ts` 拒绝）；`en/help.ts` 用 `Record<Extract<MessageKey, 'help.${string}'>, string>` 约束键空间。
- DITA 速查的**结构**不允许手写：主题类型必需子元素来自 `DITA_SEQUENCE_MODEL`，标签名与一句话说明来自元素注册表；`@dita/core` 改模型时帮助自动跟随。
- **文风规则**：帮助正文只描述作者能看见的结果，禁止出现 `ProseMirror` / `rawAttrs` / `DITA_SEQUENCE_MODEL` / `normalizeCandidateXml` / `spliceAndVerifyAiXml` 这类实现词汇；实现细节留在本设计文档与 `docs/architecture-and-plan.md`。速查表里的结构事实可以精确（内容模型、属性），但要用"必需子元素/何时选用"的说法，而不是内部数据来源。
- **截图规则**：只在 `help-sections.ts` 的 `HELP_SHOTS` 表里登记，中英成对；测试校验每语言恰好 4 张、`src` 是打包后的本地 `.png`（不得是远程 URL）、两种语言不共用同一文件。没有如实可拍的步骤（检出、签入）只写文字，不造假图。
- 新增章节 = 在 `help-sections.ts` 加一节（`id` / `navKey` / `icon` / 标题键 + `blocks`）并补两组 i18n 键，不需要改模态组件；`filterHelpSections` 与 `helpEntryCount` 自动覆盖新块类型。

实现文件：

| 文件 | 职责 |
| :-- | :--- |
| `apps/web/src/store/help-center-store.ts` | `isOpen` / `open` / `close` / `toggle` + `isTypingTarget()` 焦点守卫 |
| `apps/web/src/components/help/HelpCenterHost.tsx` | 全局 `?` 监听（忽略修饰键与输入控件）+ 渲染模态 |
| `apps/web/src/components/help/HelpCenterDialog.tsx` | 左侧导航、过滤框、`dl` 表格、`kbd` 快捷键、外链、Esc/Tab 焦点管理 |
| `apps/web/src/components/help/help-sections.ts` | 从 `@dita/core` 派生 DITA 速查 + 过滤/计数 |
| `apps/web/src/lib/help-links.ts` | 外链常量、`helpDocsUrl(locale)`、`HELP_OFFLINE` |
| `apps/web/src/assets/help/{zh,en}/*.png` | 中英各 4 张实拍截图（工作台、双栏对比、问题诊断、发布对话框），宽度 1200 调色板压缩，随包分发，离线可用 |

---

## 四、文档站扩展（`@dita/site`）

| 页面 | 分组 | 内容 |
| :-- | :--- | :--- |
| `authoring-guide` | guides | 操作指南：手册工作台 → 检出 → 双模编辑 → 结构引导 → 复用 → 校验 → 签入 → 发布，逐步说明每个动作的前提与结果 |
| `dita-spec` | reference | DITA 1.3 规范：四种主题类型的内容模型、常用元素与属性、`id`/命名规则、`conref`/`keyref` 语义、常见合规误区；权威细节外链 OASIS |

落地要点：

- `apps/site/src/i18n/locales.ts` 的 `DOC_SLUGS` 增两项（`apps/site/test/i18n.test.ts` 会强制 `zh/en` 两套 `.md` 与之齐平）；
- `apps/site/src/components/DocsIndex.astro` 与 `apps/site/src/layouts/DocsLayout.astro` 的 `groups` 同步；
- `apps/site/src/i18n/{zh,en}.ts` 的 `docsUi.titles` 补两条标题。

---

## 五、验收

1. `pnpm -r build && pnpm -r typecheck && pnpm -r test`；
2. 新增 `apps/web/test/help-center-ui.test.tsx`：七章渲染、派生结构与"必填于"标注、过滤与空态、外链形态、`?` 开关与输入框/修饰键守卫、Esc 关闭、Hub 入口、步骤截图（每语言 4 张、`src` 非远程、中英不共用文件）与放大层（Esc 只关放大、帮助仍在）；
3. 浏览器实拍：中英两版帮助中心 + 离线（`VITE_STATIC_DEMO=true`）形态 + 文档站两页；
4. 文风验收：编辑/可视化与快速上手两章按"作者视角"复核，步骤式且带图，`DITA 1.3 速查`的主题类型表能回答"该用哪一种、为什么"。

## 六、明确不做

- 不做 `/help` 路由；
- 不做帮助全文搜索索引（Pagefind 只覆盖文档站）；
- 不做上下文感应式帮助（"当前元素怎么填"仍由 `TopicAuthoringGuide` 与属性面板负责）；
- 不在应用内复制 Docker 部署与 AI Key 配置文档。
