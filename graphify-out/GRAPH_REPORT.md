# Graph Report - DITAEditor  (2026-11-24)

## Corpus Check
- 381 files · ~290,174 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 69 file(s) not represented in the graph (top: .dita 31, .css 20, (none) 5)

## Summary
- 3504 nodes · 9808 edges · 181 communities (143 shown, 38 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 430 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `428c680d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- serializer.ts
- ai-prompt.ts
- messages/en.ts
- Core Package Manifest
- API Package Manifest
- Root Monorepo Manifest
- Base TypeScript Config
- Turborepo Pipeline Config
- Architecture & Design Spec
- API TypeScript Config
- Core TypeScript Config
- Web TypeScript Config
- pnpm Workspace Config
- Graphify Agent Instructions
- Web HTML Entrypoint
- editor-store/index.ts
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- httpError
- scripts
- commands.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- translate
- converter.ts
- deploy-site.yml
- electron-builder.yml
- editor-store/types.ts
- ManualContextResolver
- AiAssistantPanel.tsx
- ref_vitest
- locales.ts
- ref_node_path
- UiLocale
- dita-runtime.ts
- index.tsx
- 4. 核心元素写作细则
- 快速开始
- DocsLayout.astro
- AttributesPanel.tsx
- devDependencies
- DITA Concept（概念）主题编写规范
- WorkspaceManager
- createServer
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- DITA Reference（参考）主题编写规范
- api/src/index.ts
- AppShell.tsx
- App.tsx
- dependencies
- ai-store.ts
- lock-service.ts
- editor-handle.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- 4. Non-Negotiable Engineering Invariants
- TopicAuthoringGuide.tsx
- workbench-store.ts
- checkXmlWellFormed
- web/src/i18n/locale.ts
- VisualEditor.tsx
- en/architecture.md
- semantic-engine.ts
- dita-rules.ts
- semantic-indexer.ts
- zh/architecture.md
- @codemirror/lang-xml@^6.1.0
- dita-structure.ts
- SearchModal.astro
- docker-entrypoint.sh
- zh-CN.ts
- Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）
- modules/ai/types.ts
- devDependencies
- lucide-react
- en/features.md
- ai-settings-service.ts
- zh/features.md
- HomePage.astro
- astro.config.ts
- en/ai-setup.md
- phase10-workbench-assignments-plan.md
- zh/ai-setup.md
- compilerOptions
- xpath.ts
- e2e-ai-live.mts
- use-visual-editor-view.ts
- topicGuideTree.ts
- PublishQueue
- workspace-api.ts
- fragment-locator.ts
- MiniRoundTripDemo.tsx
- AttributesPanel.tsx
- en/getting-started.md
- web/package.json
- vite.config.ts
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- Screenshots
- zh/introduction.md
- zh/local-development.md
- DITAEditor
- conref.ts
- normalizePosixPath
- scripts
- playground-presets.ts
- ConrefReusePanel.tsx
- @dita/core@workspace:*
- parser.ts
- map-tree-utils.ts
- README.md
- @codemirror/autocomplete@^6.20.4
- ditaval.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- SourceEditor.tsx
- @codemirror/commands@^6.11.1
- ai-output-parser.ts
- fragment-splice.ts
- sync-hf-space.sh
- @codemirror/search@^6.7.2
- Core features (Phase 0–8 implemented)
- prosemirror-history@^1.5.2
- prosemirror-model@^1.25.13
- @tailwindcss/vite@^4.3.5
- PublishService
- @codemirror/view@^6.43.15
- @lezer/highlight@^1.2.5
- ai-workbench.test.ts
- prosemirror-state@^1.4.4
- @codemirror/language@^6.13.1
- prosemirror-inputrules@^1.7.0
- dita-log-parser.ts
- @lezer/highlight@^1.2.1
- tailwindcss@^4.3.5
- prosemirror-state@^1.4.4
- react-dom@^19.0.0
- react-resizable-panels
- strict-validator.ts
- DiffViewer
- react@^19.0.0
- ai-types.ts
- createTopicTemplate
- @codemirror/search@^6.7.2
- react-arborist
- @codemirror/lang-xml@^6.1.0
- publish-service.ts
- phase5-publish.test.ts
- desktop/package.json
- stage.mjs
- @tailwindcss/vite@^4.3.5
- env
- devDependencies
- build-desktop
- with
- scripts
- main.ts
- paths.ts
- tag
- .runJob
- desktop/tsconfig.json
- DitaPrologNodeView
- release-desktop.yml
- zip-store.ts
- build.mjs
- steps
- i18n-parity.test.ts
- attach-to-release
- electron
- @codemirror/state@^6.7.6
- prosemirror-dropcursor@^1.8.4
- prosemirror-gapcursor@^1.4.1
- react-dnd-html5-backend@^16.0.1
- zustand

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 127 edges
2. `t()` - 88 edges
3. `App()` - 65 edges
4. `requestJson()` - 62 edges
5. `httpError()` - 61 edges
6. `createServer()` - 60 edges
7. `WorkspaceManager` - 58 edges
8. `lucide-react` - 56 edges
9. `translate()` - 56 edges
10. `apiT()` - 51 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `5.1 手册管理接口（`apps/api/src/modules/manuals/routes.ts`）` --references--> `ManualRegistryService`  [INFERRED]
  docs/phase10-workbench-assignments-plan.md → apps/api/src/modules/manuals/manual-registry-service.ts
- `7. DITA-OT 4.x 权威校验与异步发布（Phase 5）` --references--> `PublishQueue`  [INFERRED]
  README.md → apps/api/src/modules/publish/publish-queue.ts
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (181 total, 38 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.14
Nodes (29): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+21 more)

### Community 1 - "git-store.ts"
Cohesion: 0.10
Nodes (43): CheckinCandidate, CheckinDialogProps, changeLabelKey(), GitPanel(), GitPanelProps, shortDate(), LockStatusBarProps, stateStyles (+35 more)

### Community 2 - "serializer.ts"
Cohesion: 0.14
Nodes (25): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+17 more)

### Community 3 - "ai-prompt.ts"
Cohesion: 0.12
Nodes (25): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+17 more)

### Community 4 - "messages/en.ts"
Cohesion: 0.18
Nodes (8): enAi, enAssignments, enCollab, enCommon, enEditor, enGuide, enStructure, enWorkbench

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.06
Nodes (41): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2 (+33 more)

### Community 7 - "Root Monorepo Manifest"
Cohesion: 0.12
Nodes (19): devDependencies, turbo@^2.5.0, typescript@^5.8.0, vitest@^3.1.0, engines, node, typescript, vitest (+11 more)

### Community 8 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module (+8 more)

### Community 9 - "Turborepo Pipeline Config"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 10 - "Architecture & Design Spec"
Cohesion: 0.22
Nodes (8): OASIS CALS Table Adapter, @dita/core Shared Kernel, Visual-Source Dual-Mode State Machine, Unknown Element Passthrough Nodes, Persistent Java Worker (Xerces2 + Jing + DITA-OT), Phase 0 Technical Spike, Root Map Semantic Engine, Web DITA Workbench

### Community 11 - "API TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, lib, outDir, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 12 - "Core TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 13 - "Web TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, noEmit, extends, include, ../../tsconfig.base.json

### Community 14 - "pnpm Workspace Config"
Cohesion: 0.20
Nodes (9): allowBuilds, better-sqlite3, electron, electron-winstaller, esbuild, sharp, overrides, @electron/get@^3.0.0 (+1 more)

### Community 17 - "editor-store/index.ts"
Cohesion: 0.16
Nodes (20): setTaskContentModelSetting(), createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), renameWorkspaceEntry(), saveFileContent(), useEditorStore, createInitialEditorState() (+12 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.19
Nodes (35): createMapTreeSlice(), extractElementAttrs(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo (+27 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (16): dict, Props, LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical, dict (+8 more)

### Community 21 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/state@^6.7.6, @codemirror/view@^6.43.15, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4 (+15 more)

### Community 22 - "httpError"
Cohesion: 0.11
Nodes (13): FileLockRow, ManualRow, TopicAssignmentRow, AssignmentService, normalizeTopicPath(), parseStatus(), todayIso(), httpError() (+5 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.10
Nodes (38): resolveTaskModelForDocument(), insertBlockDitaElement(), insertBlockDitaElementAtPos(), insertMissingTopicBody(), resolveSequenceAnchor(), TOPIC_BODY_WRAPPER, insertReuseElementAtPos(), createDitaElementSkeleton() (+30 more)

### Community 25 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.06
Nodes (30): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+22 more)

### Community 26 - "translate"
Cohesion: 0.11
Nodes (24): defaultInstruction(), targetLabel(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement, XmlLikeNode (+16 more)

### Community 27 - "converter.ts"
Cohesion: 0.13
Nodes (26): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+18 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "editor-store/types.ts"
Cohesion: 0.10
Nodes (32): FileContentResult, EditorTabBarProps, FileExplorerPanelProps, NewMapDialogProps, NewTopicDialogProps, PublishDialogProps, WorkspaceDialogProps, CompositeMapTreeNode (+24 more)

### Community 31 - "ManualContextResolver"
Cohesion: 0.06
Nodes (29): ApiLocale, AiContextInput, AiStreamContext, DetectRuntimeOptions, WorkspaceScaffold, repositoryIdFor(), firstHeader(), firstQuery() (+21 more)

### Community 32 - "AiAssistantPanel.tsx"
Cohesion: 0.14
Nodes (23): PromptStrings, AiPanelIntent, AiTargetScope, AiDiagnosticContext, AiFixContext, AiHistoryTurn, AiSubAction, AiTaskType (+15 more)

### Community 33 - "ref_vitest"
Cohesion: 0.06
Nodes (58): TaskModelSwitchProps, getTaskContentModel(), resolveTaskModelForXml(), buildStructureDecorations(), DITA_STRUCTURE_KEY, DitaStructurePluginMeta, DitaStructurePluginState, isTextOnlyContent() (+50 more)

### Community 34 - "locales.ts"
Cohesion: 0.14
Nodes (26): anchor(), columns, dict, home, Props, year, dict, isDocs (+18 more)

### Community 35 - "ref_node_path"
Cohesion: 0.06
Nodes (28): isInside(), MIME_TYPES, registerWebStaticRoutes(), ADMIN, bootstrap(), CHEN, createFixture(), LIN (+20 more)

### Community 36 - "UiLocale"
Cohesion: 0.15
Nodes (28): collectDitaDecorations(), createBlockGapInserterDom(), createDitaDecorationsPlugin(), createChevronCapSvg(), createDitavalFlagPillDom(), createOxygenTagDom(), createProfilingBadgeDom(), formatAttrsForTag() (+20 more)

### Community 37 - "dita-runtime.ts"
Cohesion: 0.16
Nodes (21): buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DitaRunOptions, DitaRunResult (+13 more)

### Community 38 - "index.tsx"
Cohesion: 0.08
Nodes (27): LeftSidebarProps, DEFAULT_DIR_FOR_TYPE, NewTopicMountContext, TOPIC_OPTIONS, SOURCE_KEYS, TABS, RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS (+19 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "快速开始"
Cohesion: 0.15
Nodes (13): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT） (+5 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.09
Nodes (18): bySlug, dict, groups, Props, paths, Props, Locale, dict (+10 more)

### Community 42 - "AttributesPanel.tsx"
Cohesion: 0.14
Nodes (22): PROFILING_BADGE_CLASSES, profilingBadgeClasses(), ProfilingAttrEditor(), getTagLabel(), AttributesPanel(), sanitizeCssColor(), onLocaleChange(), findTreeNodeByPath() (+14 more)

### Community 43 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, vitest@^3.1.0, @types/react, @types/react-dom (+3 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "WorkspaceManager"
Cohesion: 0.06
Nodes (37): ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema (+29 more)

### Community 47 - "Changelog"
Cohesion: 0.09
Nodes (22): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.0.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.2.0] — 2026-11-22, Added, Added (+14 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.14
Nodes (15): Props, Props, Props, QuickStartTabs(), en, DICTIONARIES, getDictionary(), isLocale() (+7 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "api/src/index.ts"
Cohesion: 0.06
Nodes (65): firstHeaderValue(), RequestLike, resolveRequestLocale(), apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh (+57 more)

### Community 52 - "AppShell.tsx"
Cohesion: 0.10
Nodes (27): AppShell(), EditorState, rootEl, AppRoute, BASE, currentRoute, editorPath(), EditorRoute (+19 more)

### Community 53 - "App.tsx"
Cohesion: 0.07
Nodes (86): 4.7 AI Assistance (`Phase 6`), useAiStore, AiAssistantPanel(), AiDiffDialog(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), useAiPanelActions() (+78 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/merge@^6.12.3, @dita/core@workspace:*, lucide-react@^1.76.0, prosemirror-keymap@^1.2.3, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0 (+10 more)

### Community 55 - "ai-store.ts"
Cohesion: 0.13
Nodes (29): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+21 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.05
Nodes (52): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), AiUsageLogRow, aiUsageLogs, fileLocks, LockBackupRow (+44 more)

### Community 57 - "editor-handle.ts"
Cohesion: 0.19
Nodes (26): updateNodeRawAttr(), MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandleDeps, mergeCalsCellDown(), mergeCalsCellRight(), mergeCellContents() (+18 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.14
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.13
Nodes (14): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas (+6 more)

### Community 61 - "TopicAuthoringGuide.tsx"
Cohesion: 0.15
Nodes (16): GROUP_LABEL_KEYS, GuideTreeNodeProps, isTopicGuideType(), readInitialExpanded(), TagFactsProps, TOPIC_AUTHORING_GUIDES, TopicAuthoringGuideProps, TopicAuthoringGuideSpec (+8 more)

### Community 62 - "workbench-store.ts"
Cohesion: 0.05
Nodes (68): ManualAssignmentsPanelProps, STATUS_TONE, dateTimeFormatter(), formatDateTime(), Assignment, AssignmentCreateInput, AssignmentListQuery, AssignmentPerson (+60 more)

### Community 63 - "checkXmlWellFormed"
Cohesion: 0.19
Nodes (16): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc(), findDirectElementIndexInPmParent() (+8 more)

### Community 64 - "web/src/i18n/locale.ts"
Cohesion: 0.08
Nodes (28): interpolate(), DEFAULT_UI_LOCALE, detectBrowserLocale(), LOCALE_STORAGE_KEY, LocaleListener, localeListeners, LocaleState, notifyLocaleChange() (+20 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.08
Nodes (60): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, blockIndexInContainer(), blockIndexInParent(), BlockMovePlan (+52 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "semantic-engine.ts"
Cohesion: 0.12
Nodes (19): DITA_PROFILING_ATTRS, basenamePosix(), IMAGE_EXTENSIONS, ResolvedDitaHref, BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText() (+11 more)

### Community 68 - "dita-rules.ts"
Cohesion: 0.11
Nodes (17): ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS, DitaAttributeGroup, DitaElementCategory, ELEMENT_DESCRIPTIONS_ZH (+9 more)

### Community 69 - "semantic-indexer.ts"
Cohesion: 0.21
Nodes (15): WorkspaceDitavalSummary, BranchIndexState, collectAllFilePaths(), SemanticContextResponse, summarizeDitaval(), InsertKeyrefDialogProps, KeyspacePanelProps, ProfilingAttrEditorProps (+7 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 72 - "dita-structure.ts"
Cohesion: 0.05
Nodes (50): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), StructureIssueLike, 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.3 槽位语义 (+42 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "zh-CN.ts"
Cohesion: 0.18
Nodes (8): zhCNAi, zhCNAssignments, zhCNCollab, zhCNCommon, zhCNEditor, zhCNGuide, zhCNStructure, zhCNWorkbench

### Community 76 - "Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 77 - "modules/ai/types.ts"
Cohesion: 0.04
Nodes (88): apiT(), buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), AiChatModel, AiModelFactory (+80 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "lucide-react"
Cohesion: 0.16
Nodes (23): DelegateTopicButtonProps, IdentitySwitcher(), IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, TopicAssignmentBannerProps, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY (+15 more)

### Community 80 - "en/features.md"
Cohesion: 0.15
Nodes (12): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps (+4 more)

### Community 81 - "ai-settings-service.ts"
Cohesion: 0.23
Nodes (10): aiSettings, AiSettingsRow, AI_SETTINGS_ID, AiEnvDefaults, AiSettingsService, maskApiKey(), readAiEnvDefaults(), readEnvInt() (+2 more)

### Community 82 - "zh/features.md"
Cohesion: 0.15
Nodes (12): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+4 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.14
Nodes (12): dict, jsonLd, layerRows, Props, showcaseImages, CAPABILITIES, Capability, FeatureIcon (+4 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.14
Nodes (9): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, collections, docs, astro, @astrojs/react (+1 more)

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "phase10-workbench-assignments-plan.md"
Cohesion: 0.11
Nodes (13): Consequences, Considered Options, Model each Manual as an independent workspace and Git repository, Consequences, Considered Options, Scope backend workspace and semantic index per request by Manual ID and branch, Consequences, Considered Options (+5 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "xpath.ts"
Cohesion: 0.14
Nodes (13): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findKeyrefUsages(), FontoXPathApi, KeyrefUsage (+5 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (15): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+7 more)

### Community 91 - "use-visual-editor-view.ts"
Cohesion: 0.06
Nodes (31): hydrateEmptyContainerAtPos(), hasConrefDragPayload(), CalsColspecNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView (+23 more)

### Community 92 - "topicGuideTree.ts"
Cohesion: 0.17
Nodes (22): TagFacts(), buildChildChips(), buildNode(), buildTopicGuideTree(), EXPANDED_CONTAINERS, formatSlotLabel(), getAllowedChildren(), getGuideElementRuleKey() (+14 more)

### Community 94 - "workspace-api.ts"
Cohesion: 0.12
Nodes (38): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceProject(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics() (+30 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.22
Nodes (16): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+8 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.17
Nodes (16): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, compactDiff(), computeLineDiff(), DiffLine, DiffLineType (+8 more)

### Community 97 - "AttributesPanel.tsx"
Cohesion: 0.20
Nodes (13): AttributesPanelProps, GROUP_SUBTITLES, GROUP_TITLE_KEYS, EditorToolbarProps, EditorSelectionSnapshot, VisualEditorProps, baseAttrs(), makeBlockContainerSpec() (+5 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, @codemirror/commands, @codemirror/lint, prosemirror-commands, prosemirror-history (+5 more)

### Community 101 - "en/introduction.md"
Cohesion: 0.20
Nodes (9): Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy, What is in the box (+1 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.20
Nodes (9): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 端口与数据卷, 第一次使用 (+1 more)

### Community 104 - "界面预览"
Cohesion: 0.25
Nodes (8): Phase 5：DITA-OT 严格校验与异步 HTML5 / 中文 PDF 发布, Phase 6：AI 辅助写作、语义标签优化与错误修复, 三栏工作台与 Keys 键空间, 三栏工作台与 Phase 4 版本协作面板, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 可视化与 XML 源码双栏对比模式, 本地 Git 版本、Check-out 独占锁与可视化 Diff, 界面预览

### Community 105 - "Screenshots"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "DITAEditor"
Cohesion: 0.15
Nodes (13): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+5 more)

### Community 109 - "conref.ts"
Cohesion: 0.23
Nodes (14): areConrefTagsCompatible(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild(), findTopicIdForElement(), getNormalizedText(), indexTopicElements() (+6 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.15
Nodes (7): MINI_DEMO_XML, PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 113 - "ConrefReusePanel.tsx"
Cohesion: 0.15
Nodes (19): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanelProps, MODES, TopicInspectorProps (+11 more)

### Community 115 - "parser.ts"
Cohesion: 0.18
Nodes (15): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry, lineColumnToOffset(), parseSaxesError(), ParseXmlOptions (+7 more)

### Community 116 - "map-tree-utils.ts"
Cohesion: 0.24
Nodes (12): buildCompositeMapTree(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), ElementConditionEvaluation, DitaMapTreeNode (+4 more)

### Community 117 - "README.md"
Cohesion: 0.31
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 118 - "@codemirror/autocomplete@^6.20.4"
Cohesion: 0.33
Nodes (4): @codemirror/autocomplete@^6.20.4, prosemirror-view@^1.43.0, @codemirror/autocomplete, prosemirror-view

### Community 119 - "ditaval.ts"
Cohesion: 0.18
Nodes (15): ConditionGroup, createDitavalTemplate(), DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions(), extractConditionGroups() (+7 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "SourceEditor.tsx"
Cohesion: 0.09
Nodes (23): createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET, stripNonTagXml(), sourceEditorTheme, createDitaXmlLinter() (+15 more)

### Community 123 - "ai-output-parser.ts"
Cohesion: 0.33
Nodes (4): ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags()

### Community 124 - "fragment-splice.ts"
Cohesion: 0.10
Nodes (34): errorMessage(), 1. `@dita/core` — `src/ai/`, 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract, 4.1 文件清单与核心函数, 4.2 三种靶向定位与无损回拼策略, extractTargetFragment() (+26 more)

### Community 127 - "Core features (Phase 0–8 implemented)"
Cohesion: 0.12
Nodes (16): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 1. 100% lossless XML round-trip kernel (`@dita/core`) (+8 more)

### Community 134 - "ai-workbench.test.ts"
Cohesion: 0.22
Nodes (12): resetAiStore(), AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget(), normalizeSelectedText(), offsetToLineColumn() (+4 more)

### Community 138 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 144 - "strict-validator.ts"
Cohesion: 0.23
Nodes (12): fallbackDitaDiagnostic(), DitaRuntimeInfo, ensureInside(), resolveDitavalTarget(), resolveValidationTarget(), SingleTargetResult, StrictDiagnostic, StrictValidationResult (+4 more)

### Community 145 - "DiffViewer"
Cohesion: 0.22
Nodes (9): close(), DiffDialog(), DiffDialogProps, revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel() (+1 more)

### Community 147 - "ai-types.ts"
Cohesion: 0.24
Nodes (11): AiApiKeySource, AiDeltaEvent, AiSseEvent, AiUsageDayBucket, AiUsageModelBucket, AiUsageRecentEntry, AiUsageTaskBucket, AiUsageTokens (+3 more)

### Community 148 - "createTopicTemplate"
Cohesion: 0.19
Nodes (11): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions (+3 more)

### Community 152 - "publish-service.ts"
Cohesion: 0.20
Nodes (10): DitaDiagnostic, EXCLUDED_SNAPSHOT_ENTRIES, parseDiagnostics(), PublishFormat, PublishJobPatch, PublishJobView, PublishStatus, sanitizeFileStem() (+2 more)

### Community 153 - "phase5-publish.test.ts"
Cohesion: 0.20
Nodes (8): resetDitaRuntimeCache(), ADMIN, createApp(), PLUGIN_DIR, SAMPLE_ROOT, tempDirs, VIEWER, WRITER

### Community 155 - "desktop/package.json"
Cohesion: 0.20
Nodes (10): dependencies, @dita/api@workspace:*, description, license, main, name, private, type (+2 more)

### Community 156 - "stage.mjs"
Cohesion: 0.18
Nodes (9): apiPkg, DESKTOP_ROOT, desktopPkg, __dirname, REPO_ROOT, requiredPaths, STAGE_DIR, stagePkg (+1 more)

### Community 158 - "env"
Cohesion: 0.18
Nodes (11): APPLE_APP_SPECIFIC_PASSWORD, APPLE_ID, APPLE_TEAM_ID, CSC_IDENTITY_AUTO_DISCOVERY, CSC_KEY_PASSWORD, CSC_LINK, DESKTOP_VERSION, RELEASE_TAG (+3 more)

### Community 159 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, electron@^35.2.0, electron-builder@^26.18.1, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, @types/node, typescript (+2 more)

### Community 160 - "build-desktop"
Cohesion: 0.20
Nodes (10): name, runs-on, strategy, os, script, target, build-desktop, include (+2 more)

### Community 161 - "with"
Cohesion: 0.20
Nodes (10): with, cache, files, if-no-files-found, merge-multiple, name, node-version, path (+2 more)

### Community 162 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, dist, dist:mac, dist:win, stage, test (+1 more)

### Community 163 - "main.ts"
Cohesion: 0.22
Nodes (4): ApiServer, __dirname, hasSingleInstanceLock, REPO_ROOT

### Community 164 - "paths.ts"
Cohesion: 0.33
Nodes (7): startEmbeddedServer(), DesktopPathInput, DesktopRuntimePaths, ensureInitialWorkspace(), normalizeDesktopVersion(), resolveDesktopPaths(), tempDirs

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 166 - ".runJob"
Cohesion: 0.36
Nodes (3): findFirstPdf(), isInside(), readLogForDiagnostics()

### Community 167 - "desktop/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ../../tsconfig.base.json

### Community 169 - "release-desktop.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 170 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 171 - "build.mjs"
Cohesion: 0.29
Nodes (6): esbuild@^0.25.0, DESKTOP_ROOT, __dirname, DIST_DIR, esmCreateRequireBanner, esbuild

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "i18n-parity.test.ts"
Cohesion: 0.33
Nodes (4): en, zhCN, enKeys, zhKeys

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "electron"
Cohesion: 0.50
Nodes (3): bridge, DitaDesktopBridge, electron

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1166 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `ai-workbench.test.ts`, `editor-store/index.ts`, `dita-map.ts`, `ref_vitest`, `.runJob`, `WorkspaceManager`, `Changelog`, `4. Non-Negotiable Engineering Invariants`, `en/architecture.md`, `semantic-engine.ts`, `zh/architecture.md`, `dita-structure.ts`, `en/features.md`, `zh/features.md`, `xpath.ts`, `e2e-ai-live.mts`, `workspace-api.ts`, `normalizePosixPath`, `playground-presets.ts`, `parser.ts`, `map-tree-utils.ts`, `fragment-splice.ts`, `Core features (Phase 0–8 implemented)`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1354723707664884 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `electron` to `desktop/package.json`, `main.ts`, `devDependencies`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._