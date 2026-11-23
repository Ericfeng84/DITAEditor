# Graph Report - DITAEditor  (2026-11-24)

## Corpus Check
- 324 files · ~250,510 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 68 file(s) not represented in the graph (top: .dita 30, .css 20, (none) 5)

## Summary
- 2933 nodes · 8308 edges · 155 communities (123 shown, 32 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 359 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `adab1e19`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- converter.ts
- dita-core/src/i18n/locale.ts
- zh-CN.ts
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
- internals.ts
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- AiAssistantPanel.tsx
- scripts
- commands.ts
- editor-store/types.ts
- httpError
- ai-types.ts
- deploy-site.yml
- demo-workspace.ts
- task-model-switch.test.ts
- serializer.ts
- SourceEditor.tsx
- ref_vitest
- locales.ts
- ai-service.ts
- translate
- publish-service.ts
- parser.ts
- 4. 核心元素写作细则
- 快速开始
- DocsLayout.astro
- normalizePosixPath
- devDependencies
- DITA Concept（概念）主题编写规范
- WorkspaceManager
- createServer
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- DITA Reference（参考）主题编写规范
- httpError
- i18n/index.ts
- App.tsx
- dependencies
- ai-store.ts
- lock-service.ts
- editor-handle.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- dependencies
- index.tsx
- use-visual-editor-view.ts
- ref_react
- fragment-splice.ts
- VisualEditor.tsx
- en/architecture.md
- ref_react
- helpers.ts
- LockStatusBar.tsx
- zh/architecture.md
- dita-rules.ts
- dita-structure.ts
- SearchModal.astro
- docker-entrypoint.sh
- dita-core/src/index.ts
- Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）
- ai-prompt.ts
- devDependencies
- astro
- en/features.md
- use-ai-panel-actions.ts
- zh/features.md
- PublishQueue
- astro.config.ts
- en/ai-setup.md
- compare.ts
- zh/ai-setup.md
- compilerOptions
- semantic-engine.ts
- e2e-ai-live.mts
- identity-api.ts
- MessageKey
- keyspace.ts
- workspace-api.ts
- fragment-locator.ts
- MiniRoundTripDemo.tsx
- createServer
- en/getting-started.md
- @codemirror/commands@^6.11.1
- site/package.json
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- Screenshots
- zh/introduction.md
- zh/local-development.md
- DITAEditor
- @codemirror/language@^6.13.1
- @lezer/highlight@^1.2.1
- scripts
- playground-presets.ts
- @codemirror/state@^6.7.6
- @dita/core@workspace:*
- prosemirror-gapcursor@^1.4.1
- prosemirror-state@^1.4.4
- README.md
- prosemirror-view@^1.43.0
- checkXmlWellFormed
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- react@^19.0.0
- tailwindcss@^4.3.5
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- sync-hf-space.sh
- @codemirror/autocomplete@^6.20.4
- createServer
- @codemirror/state@^6.7.6
- @codemirror/view@^6.43.15
- @dita/core@workspace:*
- ai-fragment.test.ts
- map-tree-utils.ts
- prosemirror-dropcursor@^1.8.4
- prosemirror-gapcursor@^1.4.1
- phase4-git-locks.test.ts
- Core features (Phase 0–8 implemented)
- prosemirror-inputrules@^1.7.0
- prosemirror-state@^1.4.4
- prosemirror-view@^1.43.0
- react@^19.0.0
- AiProposal
- react-dom@^19.0.0
- react-resizable-panels
- tailwindcss@^4.3.5
- MapTreePanel.tsx
- @codemirror/merge@^6.12.3
- @codemirror/search@^6.7.2
- files.ts
- prosemirror-keymap@^1.2.3
- AiDiffDialog
- prosemirror-model@^1.25.13
- react-dnd-html5-backend@^16.0.1
- FileExplorerPanel.tsx

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 96 edges
2. `t()` - 66 edges
3. `App()` - 55 edges
4. `translate()` - 53 edges
5. `apiT()` - 49 edges
6. `checkXmlWellFormed()` - 49 edges
7. `getCurrentLocale()` - 48 edges
8. `WorkspaceManager` - 46 edges
9. `requestJson()` - 46 edges
10. `lucide-react` - 44 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `Website and GitHub Pages online demo (Phase 7)` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts
- `官网与 GitHub Pages 在线体验（Phase 7）` --references--> `main()`  [INFERRED]
  README.md → apps/api/scripts/e2e-ai-live.mts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (155 total, 32 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.14
Nodes (29): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+21 more)

### Community 1 - "git-store.ts"
Cohesion: 0.10
Nodes (35): DiffDialogProps, changeLabelKey(), GitPanelProps, shortDate(), cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile() (+27 more)

### Community 2 - "converter.ts"
Cohesion: 0.12
Nodes (30): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+22 more)

### Community 3 - "dita-core/src/i18n/locale.ts"
Cohesion: 0.16
Nodes (10): COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey, coreMessagesEn (+2 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.09
Nodes (18): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enCollab, enCommon, enEditor, en, enGuide (+10 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.10
Nodes (23): @dita/core@workspace:*, devDependencies, tsx@^4.19.3, @types/better-sqlite3@^9.6.0, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, @dita/core (+15 more)

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
Cohesion: 0.33
Nodes (5): allowBuilds, better-sqlite3, esbuild, sharp, packages

### Community 17 - "internals.ts"
Cohesion: 0.18
Nodes (23): useEditorStore, createInitialEditorState(), cancelAllPendingRefreshes(), cancelOverlayRefresh(), collectFileSetFromTree(), detectTopicTypeFromXml(), EMPTY_PROFILING_CATALOG, extractTitleFromCheck() (+15 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.19
Nodes (31): createWorkspaceFile(), createMapTreeSlice(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo (+23 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (17): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+9 more)

### Community 21 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4 (+11 more)

### Community 22 - "AiAssistantPanel.tsx"
Cohesion: 0.13
Nodes (21): resetAiStore(), AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, AiTargetScope, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget(), normalizeSelectedText() (+13 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.10
Nodes (34): InsertKeyrefDialogProps, insertMissingTopicBody(), resolveSequenceAnchor(), TOPIC_BODY_WRAPPER, createDitaElementSkeleton(), exitCodeblockToParagraph(), handleDitaEnter(), insertInlineImage() (+26 more)

### Community 25 - "editor-store/types.ts"
Cohesion: 0.17
Nodes (18): FileExplorerPanelProps, NewMapDialogProps, PublishDialogProps, WorkspaceDialogProps, MapBufferState, MapTreePanelProps, WorkspaceDitavalSummary, WorkspaceFileNode (+10 more)

### Community 26 - "httpError"
Cohesion: 0.31
Nodes (3): IdentityUser, LockService, Phase4Scope

### Community 27 - "ai-types.ts"
Cohesion: 0.17
Nodes (16): AiPanelIntent, AiApiKeySource, AiDeltaEvent, AiDiagnosticContext, AiFixContext, AiSseEvent, AiSubAction, AiTaskType (+8 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 29 - "demo-workspace.ts"
Cohesion: 0.28
Nodes (8): FileContentResult, WorkspaceFileNode, buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), FileContentResult, InMemoryDemoWorkspace, extractDitaDocumentTitle(), DitaFileKind

### Community 30 - "task-model-switch.test.ts"
Cohesion: 0.19
Nodes (9): EditorTabBarProps, TAB_TYPE_BADGE, resolveTaskModelForXml(), setDetectedTaskContentModel(), setTaskContentModelSetting(), shouldShowTaskModelSwitch(), rootEl, OpenEditorTab (+1 more)

### Community 31 - "serializer.ts"
Cohesion: 0.14
Nodes (24): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+16 more)

### Community 32 - "SourceEditor.tsx"
Cohesion: 0.13
Nodes (21): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics() (+13 more)

### Community 33 - "ref_vitest"
Cohesion: 0.06
Nodes (44): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), DEMO_SOURCE_DIR, __dirname, tempDirs, buildStructureDecorations(), buildState(), buildTaskState(), collectFiles() (+36 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "ai-service.ts"
Cohesion: 0.04
Nodes (75): AiUsageLogRow, aiUsageLogs, CreateServerOptions, AiModelFactory, createExplanationStreamFilter(), ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput (+67 more)

### Community 36 - "translate"
Cohesion: 0.05
Nodes (32): createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModelSetting(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom() (+24 more)

### Community 37 - "publish-service.ts"
Cohesion: 0.05
Nodes (78): publishJobs, ApiLocale, firstHeaderValue(), RequestLike, apiCatalogue(), apiMessagesEn, apiMessagesZh, apiT() (+70 more)

### Community 38 - "parser.ts"
Cohesion: 0.16
Nodes (16): TopicInspectorProps, AttributesPanelProps, baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes, lineColumnToOffset() (+8 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "快速开始"
Cohesion: 0.14
Nodes (14): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 官网与 GitHub Pages 在线体验（Phase 7）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用） (+6 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.08
Nodes (20): bySlug, dict, groups, Props, paths, Props, Capability, DocSlug (+12 more)

### Community 42 - "normalizePosixPath"
Cohesion: 0.18
Nodes (8): basenamePosix(), classifyDitaFileKind(), dirnamePosix(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref, resolveDitaHref(), DitaSemanticIndex

### Community 43 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+10 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "WorkspaceManager"
Cohesion: 0.08
Nodes (24): registerWorkspaceFileRoutes(), countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), sanitizeWorkspaceDirName() (+16 more)

### Community 46 - "createServer"
Cohesion: 0.21
Nodes (4): registerSemanticIndexerRoutes(), collectAllFilePaths(), summarizeDitaval(), WorkspaceSemanticIndexer

### Community 47 - "Changelog"
Cohesion: 0.11
Nodes (19): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.2.0] — 2026-11-22, Added, Added, Added (+11 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.11
Nodes (15): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+7 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "httpError"
Cohesion: 0.07
Nodes (61): resolveRequestLocale(), ApiMessageKey, ApiMessageParams, parseBody(), registerAiRoutes(), requireAdmin(), HttpError, httpError() (+53 more)

### Community 52 - "i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.14
Nodes (49): useAiStore, AiAssistantPanel(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), useAiPanelActions(), App(), CheckinDialog() (+41 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/lang-xml@^6.1.0, @codemirror/lint@^6.9.8, @lezer/highlight@^1.2.5, lucide-react@^1.76.0, prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, react-arborist@^4.0.1 (+11 more)

### Community 55 - "ai-store.ts"
Cohesion: 0.13
Nodes (26): abortError(), dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig(), streamAiRequest() (+18 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.08
Nodes (35): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, FileLockRow, fileLocks (+27 more)

### Community 57 - "editor-handle.ts"
Cohesion: 0.18
Nodes (27): updateNodeRawAttr(), MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandleDeps, mergeCalsCellDown(), mergeCalsCellRight(), mergeCellContents() (+19 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.14
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, better-sqlite3@^13.2.0, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/openai@^1.8.4, simple-git@^4.1.0 (+6 more)

### Community 61 - "index.tsx"
Cohesion: 0.10
Nodes (33): arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody(), dateTimeFormatter(), dateTimeFormatters, formatDateTime() (+25 more)

### Community 62 - "use-visual-editor-view.ts"
Cohesion: 0.12
Nodes (28): hydrateEmptyContainerAtPos(), collectDitaDecorations(), createBlockGapInserterDom(), createDitaDecorationsPlugin(), createChevronCapSvg(), createDitavalFlagPillDom(), createOxygenTagDom(), createProfilingBadgeDom() (+20 more)

### Community 63 - "ref_react"
Cohesion: 0.15
Nodes (13): BlockConvertOption, BlockHandleProps, MODE_LABEL_KEYS, EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbarProps, TAG_ICONS, InsertElementChoice (+5 more)

### Community 64 - "fragment-splice.ts"
Cohesion: 0.12
Nodes (33): 4.7 AI Assistance (`Phase 6`), close(), AI assistance, AI 辅助, element(), [1.0.0] — 2026-11-22, Added, Changed (+25 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.10
Nodes (57): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, blockIndexInContainer(), BlockMovePlan, buildBlockHandleTarget() (+49 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "ref_react"
Cohesion: 0.11
Nodes (16): CheckinDialogProps, DiffDialog(), revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel(), LeftSidebarProps (+8 more)

### Community 68 - "helpers.ts"
Cohesion: 0.23
Nodes (9): countCalsTgroups(), findDirectPmChildByTag(), getPmDocTitle(), normalizeTitleText(), pmHasMultipleTgroups(), UNKNOWN_NODE_TYPES, XML_META_NODE_TYPES, SAMPLES (+1 more)

### Community 69 - "LockStatusBar.tsx"
Cohesion: 0.47
Nodes (5): CheckinCandidate, LockStatusBarProps, stateStyles, FileLock, FileEditability

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "dita-rules.ts"
Cohesion: 0.06
Nodes (64): ATTR_BADGE_COLORS, ProfilingAttrEditor(), ProfilingAttrEditorProps, createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET (+56 more)

### Community 72 - "dita-structure.ts"
Cohesion: 0.05
Nodes (50): 4.4 OASIS CALS Table Fidelity, entry(), 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次, 3.3 槽位语义 (+42 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "dita-core/src/index.ts"
Cohesion: 0.10
Nodes (31): TaskModelSwitchProps, DitavalTopicSummary, DITA_STRUCTURE_KEY, DitaStructurePluginMeta, DitaStructurePluginState, isTextOnlyContent(), keepsStructure(), ReplaceStepLike (+23 more)

### Community 76 - "Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 77 - "ai-prompt.ts"
Cohesion: 0.19
Nodes (19): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+11 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "astro"
Cohesion: 0.40
Nodes (4): astro@^5.18.2, collections, docs, astro

### Community 80 - "en/features.md"
Cohesion: 0.17
Nodes (11): Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps, OASIS CALS tables (+3 more)

### Community 81 - "use-ai-panel-actions.ts"
Cohesion: 0.26
Nodes (13): AiAssistantPanelProps, AiPanelActions, UseAiPanelActionsDeps, ProblemsPanelProps, StrictValidationDialogProps, InspectorTab, VisualEditorHandle, MessageParams (+5 more)

### Community 82 - "zh/features.md"
Cohesion: 0.17
Nodes (11): Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+3 more)

### Community 83 - "PublishQueue"
Cohesion: 0.11
Nodes (11): PublishQueue, PublishQueueOptions, 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4） (+3 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.15
Nodes (5): site, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "compare.ts"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "semantic-engine.ts"
Cohesion: 0.11
Nodes (31): extractProfilingValuesFromDocument(), parseDitaval(), coreT(), DITA_TOPIC_ROOT_TAGS, cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild() (+23 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.19
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 91 - "identity-api.ts"
Cohesion: 0.11
Nodes (24): IdentitySwitcher(), IdentitySwitcherProps, OPTIONS, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY, IdentityResponse, IdentityRole, IdentityRoleInfo (+16 more)

### Community 92 - "MessageKey"
Cohesion: 0.21
Nodes (12): DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS, isTopicGuideType(), readInitialExpanded(), TopicAuthoringGuide(), TopicAuthoringGuideProps (+4 more)

### Community 93 - "keyspace.ts"
Cohesion: 0.14
Nodes (17): KeyspacePanelProps, BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText(), findDirectChild(), getNormalizedText(), isSubmapReference() (+9 more)

### Community 94 - "workspace-api.ts"
Cohesion: 0.27
Nodes (20): createWorkspaceProject(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics(), fetchWorkspaces(), forgetWorkspaceProject() (+12 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.22
Nodes (16): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+8 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "createServer"
Cohesion: 0.05
Nodes (35): @langchain/core@^1.4.2, createServer(), AiChatModel, createLangChainModelFactory(), AiConfigTestResult, resetDitaRuntimeCache(), crc32(), CRC_TABLE (+27 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 100 - "site/package.json"
Cohesion: 0.12
Nodes (15): @codemirror/lang-xml@^6.1.0, @codemirror/merge@^6.12.3, prosemirror-history@^1.5.2, prosemirror-model@^1.25.13, react-dom@^19.0.0, @codemirror/lang-xml, @codemirror/merge, prosemirror-history (+7 more)

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
Cohesion: 0.14
Nodes (14): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+6 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.15
Nodes (6): PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 117 - "README.md"
Cohesion: 0.16
Nodes (9): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配） (+1 more)

### Community 119 - "checkXmlWellFormed"
Cohesion: 0.15
Nodes (19): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`), 4. Non-Negotiable Engineering Invariants, computeXmlLineDiffStats(), formatDitaXml() (+11 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.13
Nodes (13): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1. 目标与边界, 2. 端到端架构与数据流, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`）, 3.2 配置优先级与密钥安全, 3. 数据库与配置设计（SQLite + Drizzle）, 4. `@dita/core` 共享内核扩展设计, 7. 分切片实施计划（Vertical Slices） (+5 more)

### Community 124 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 126 - "@codemirror/autocomplete@^6.20.4"
Cohesion: 0.33
Nodes (4): @codemirror/autocomplete@^6.20.4, @codemirror/language@^6.13.1, @codemirror/autocomplete, @codemirror/language

### Community 127 - "createServer"
Cohesion: 0.20
Nodes (4): PublishJobRow, parseDiagnostics(), PublishService, toIso()

### Community 131 - "ai-fragment.test.ts"
Cohesion: 0.19
Nodes (9): 4.1 文件清单与核心函数, AiExtractOptions, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport, extract() (+1 more)

### Community 132 - "map-tree-utils.ts"
Cohesion: 0.27
Nodes (10): buildCompositeMapTree(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), DitaMapTreeNode, InsertMapNodeOptions (+2 more)

### Community 135 - "phase4-git-locks.test.ts"
Cohesion: 0.25
Nodes (6): ADMIN, SAMPLE_ROOT, tempDirs, VIEWER, WRITER_A, WRITER_B

### Community 136 - "Core features (Phase 0–8 implemented)"
Cohesion: 0.25
Nodes (8): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 9. Fully bilingual zh-CN / English UI (Phase 8), Core features (Phase 0–8 implemented)

### Community 141 - "AiProposal"
Cohesion: 0.33
Nodes (7): PromptStrings, AiStreamHandlers, AiErrorEvent, AiMetaEvent, AiProposal, AiDiffDialogProps, AiTargetMode

### Community 145 - "MapTreePanel.tsx"
Cohesion: 0.25
Nodes (11): sanitizeCssColor(), CompositeMapTreeNode, MapNodeContextMenuProps, MapNodeMenuTarget, createMapTreeNodeRenderer(), MapNodeRowActions, NodeKindIcon(), TAG_PILL_STYLES (+3 more)

### Community 148 - "files.ts"
Cohesion: 0.27
Nodes (10): buildScaleDitaProject(), createWorkspaceDir(), deleteWorkspaceEntry(), renameWorkspaceEntry(), saveFileContent(), createFilesSlice(), createMapTemplate(), CreateMapTemplateOptions (+2 more)

### Community 150 - "AiDiffDialog"
Cohesion: 0.40
Nodes (6): AiDiffDialog(), 6.1 新增模块布局, 6.2 与现有组件的精确接入点, 6.3 Check-out 独占锁与角色交互矩阵, 6. 前端工作台集成设计（`apps/web/src/ai/` 及现有组件）, Slice 6.4：前端 AI 核心体验（`TopicInspector` 第 3 Tab + MergeView 审阅 + Admin 设置）

### Community 153 - "FileExplorerPanel.tsx"
Cohesion: 0.83
Nodes (3): FileExplorerPanel(), FileIcon(), filterTreeNodes()

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 948 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `ai-fragment.test.ts`, `map-tree-utils.ts`, `Core features (Phase 0–8 implemented)`, `internals.ts`, `dita-map.ts`, `AiAssistantPanel.tsx`, `ref_vitest`, `parser.ts`, `normalizePosixPath`, `WorkspaceManager`, `Changelog`, `fragment-splice.ts`, `en/architecture.md`, `zh/architecture.md`, `dita-structure.ts`, `dita-core/src/index.ts`, `en/features.md`, `zh/features.md`, `PublishQueue`, `semantic-engine.ts`, `e2e-ai-live.mts`, `workspace-api.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13725490196078433 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `ref_react` to `SourceEditor.tsx`, `git-store.ts`, `PublishDialog.tsx`, `LockStatusBar.tsx`, `dita-rules.ts`, `devDependencies`, `dita-core/src/index.ts`, `MapTreePanel.tsx`, `App.tsx`, `dependencies`, `AiAssistantPanel.tsx`, `FileExplorerPanel.tsx`, `identity-api.ts`, `MessageKey`, `index.tsx`, `task-model-switch.test.ts`, `ref_react`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._