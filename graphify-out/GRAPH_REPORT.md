# Graph Report - DITAEditor  (2026-11-24)

## Corpus Check
- 327 files · ~255,237 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 69 file(s) not represented in the graph (top: .dita 31, .css 20, (none) 5)

## Summary
- 2973 nodes · 8458 edges · 156 communities (123 shown, 33 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 359 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `33c62ed1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- serializer.ts
- ai-prompt.ts
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
- ditaval.ts
- apiT
- converter.ts
- deploy-site.yml
- dita-rules.ts
- ref_react
- editor-store/types.ts
- SourceEditor.tsx
- dita-structure.ts
- locales.ts
- createServer
- UiLocale
- publish-service.ts
- dita-core/src/i18n/locale.ts
- 4. 核心元素写作细则
- 快速开始
- DocsLayout.astro
- semantic-engine.ts
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
- dita-structure.ts
- index.tsx
- keyspace.ts
- helpers.ts
- fragment-splice.ts
- VisualEditor.tsx
- en/architecture.md
- UiLocale
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- ai-fragment.test.ts
- zh/architecture.md
- MapNodeInspector.tsx
- 前端 DITA 1.3 结构化写作合规实施说明
- SearchModal.astro
- docker-entrypoint.sh
- ai-types.ts
- Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）
- modules/ai/types.ts
- devDependencies
- use-ai-panel-actions.ts
- en/features.md
- lucide-react
- zh/features.md
- MapTreePanel.tsx
- astro.config.ts
- en/ai-setup.md
- extractTargetFragment
- zh/ai-setup.md
- compilerOptions
- semantic-engine.ts
- e2e-ai-live.mts
- node-views.ts
- TopicAuthoringGuide.tsx
- roundtrip.golden.test.ts
- workspace-api.ts
- fragment-locator.ts
- MiniRoundTripDemo.tsx
- parser.ts
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
- Core features (Phase 0–8 implemented)
- xml/types.ts
- scripts
- playground-presets.ts
- @codemirror/state@^6.7.6
- @dita/core@workspace:*
- map-tree-utils.ts
- 4. Non-Negotiable Engineering Invariants
- README.md
- prosemirror-view@^1.43.0
- xml-bridge.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- lock-helpers.ts
- zh-CN.ts
- tailwindcss@^4.3.5
- InlineBubbleToolbar.tsx
- sync-hf-space.sh
- prosemirror-gapcursor@^1.4.1
- cals-table.test.ts
- @codemirror/state@^6.7.6
- astro
- @dita/core@workspace:*
- @codemirror/view@^6.43.15
- FileExplorerPanel.tsx
- prosemirror-dropcursor@^1.8.4
- Phase 6 AI Assistance — Implementation Contract
- task-model-switch.test.ts
- @codemirror/autocomplete@^6.20.4
- prosemirror-inputrules@^1.7.0
- @codemirror/language@^6.13.1
- prosemirror-view@^1.43.0
- @lezer/highlight@^1.2.1
- prosemirror-gapcursor@^1.4.1
- react-dom@^19.0.0
- react-resizable-panels
- tailwindcss@^4.3.5
- prosemirror-state@^1.4.4
- react@^19.0.0
- prosemirror-state@^1.4.4
- files.ts
- react@^19.0.0
- @codemirror/merge@^6.12.3
- @codemirror/search@^6.7.2
- prosemirror-keymap@^1.2.3
- prosemirror-model@^1.25.13
- react-dnd-html5-backend@^16.0.1

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 101 edges
2. `t()` - 71 edges
3. `App()` - 57 edges
4. `translate()` - 53 edges
5. `apiT()` - 49 edges
6. `checkXmlWellFormed()` - 49 edges
7. `getCurrentLocale()` - 48 edges
8. `WorkspaceManager` - 46 edges
9. `requestJson()` - 46 edges
10. `parseXml()` - 45 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `Website and GitHub Pages online demo (Phase 7)` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts
- `官网与 GitHub Pages 在线体验（Phase 7）` --references--> `main()`  [INFERRED]
  README.md → apps/api/scripts/e2e-ai-live.mts
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (156 total, 33 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.12
Nodes (32): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+24 more)

### Community 1 - "git-store.ts"
Cohesion: 0.13
Nodes (33): CheckinCandidate, CheckinDialogProps, DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch() (+25 more)

### Community 2 - "serializer.ts"
Cohesion: 0.14
Nodes (25): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+17 more)

### Community 3 - "ai-prompt.ts"
Cohesion: 0.16
Nodes (22): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+14 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.11
Nodes (15): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enCollab, enCommon, enEditor, en, enGuide (+7 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (27): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+19 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (38): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2 (+30 more)

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
Cohesion: 0.14
Nodes (31): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), useEditorStore, createInitialEditorState(), cancelAllPendingRefreshes(), cancelOverlayRefresh(), collectFileSetFromTree(), detectTopicTypeFromXml() (+23 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.17
Nodes (31): tempDirs, createMapTreeSlice(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo (+23 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (17): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+9 more)

### Community 21 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4 (+11 more)

### Community 22 - "AiAssistantPanel.tsx"
Cohesion: 0.14
Nodes (22): resetAiStore(), AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, AiTargetScope, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget(), normalizeSelectedText() (+14 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.12
Nodes (32): insertBlockDitaElementAtPos(), insertMissingTopicBody(), resolveSequenceAnchor(), TOPIC_BODY_WRAPPER, createDitaElementSkeleton(), exitCodeblockToParagraph(), handleDitaEnter(), insertInlineImage() (+24 more)

### Community 25 - "ditaval.ts"
Cohesion: 0.13
Nodes (19): PROFILING_BADGE_CLASSES, ProfilingAttrEditorProps, ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle (+11 more)

### Community 26 - "apiT"
Cohesion: 0.08
Nodes (43): firstHeaderValue(), RequestLike, resolveRequestLocale(), apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh (+35 more)

### Community 27 - "converter.ts"
Cohesion: 0.14
Nodes (28): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+20 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 29 - "dita-rules.ts"
Cohesion: 0.12
Nodes (15): ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS, ELEMENT_DESCRIPTIONS_ZH, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS (+7 more)

### Community 30 - "ref_react"
Cohesion: 0.07
Nodes (25): DiffDialog(), revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel(), TAB_TYPE_BADGE, LeftSidebarProps (+17 more)

### Community 31 - "editor-store/types.ts"
Cohesion: 0.12
Nodes (27): FileContentResult, WorkspaceMapSummary, EditorTabBarProps, FileExplorerPanelProps, NewMapDialogProps, NewTopicDialogProps, PublishDialogProps, WorkspaceDialogProps (+19 more)

### Community 32 - "SourceEditor.tsx"
Cohesion: 0.13
Nodes (29): WorkspaceDitavalSummary, WorkspaceFileNode, BranchIndexState, collectAllFilePaths(), SemanticContextResponse, summarizeDitaval(), buildReuseAttrValue(), ConrefAttrName (+21 more)

### Community 33 - "dita-structure.ts"
Cohesion: 0.08
Nodes (30): ditaXmlCompletionSource, buildStructureDecorations(), findBoldPos(), buildState(), buildTaskState(), completeAtEnd(), loadDoc(), noopCallbacks (+22 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "createServer"
Cohesion: 0.04
Nodes (51): createServer(), CreateServerOptions, AiChatModel, AiModelFactory, createLangChainModelFactory(), AiRouteDeps, AiConfigTestResult, resetDitaRuntimeCache() (+43 more)

### Community 36 - "UiLocale"
Cohesion: 0.11
Nodes (36): BlockHandleTarget, hydrateEmptyContainerAtPos(), sanitizeCssColor(), collectDitaDecorations(), createBlockGapInserterDom(), createDitaDecorationsPlugin(), createChevronCapSvg(), createDitavalFlagPillDom() (+28 more)

### Community 37 - "publish-service.ts"
Cohesion: 0.05
Nodes (53): PublishJobRow, publishJobs, ApiLocale, AiStreamContext, DitaDiagnostic, buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir() (+45 more)

### Community 38 - "dita-core/src/i18n/locale.ts"
Cohesion: 0.13
Nodes (14): interpolate(), Slice 8.1：同构 i18n 底座与 `@dita/core` 双语化（第 1–2 天）, COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, formatMessage(), FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES (+6 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "快速开始"
Cohesion: 0.14
Nodes (14): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 官网与 GitHub Pages 在线体验（Phase 7）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用） (+6 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.08
Nodes (20): bySlug, dict, groups, Props, paths, Props, Capability, DocSlug (+12 more)

### Community 42 - "semantic-engine.ts"
Cohesion: 0.22
Nodes (17): coreT(), formatStructureIssue(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild(), findTopicIdForElement(), getNormalizedText() (+9 more)

### Community 43 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+10 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "WorkspaceManager"
Cohesion: 0.07
Nodes (33): createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema, mkdirSchema, openWorkspaceSchema, registerWorkspaceFileRoutes(), renameSchema (+25 more)

### Community 46 - "createServer"
Cohesion: 0.20
Nodes (3): registerSemanticIndexerRoutes(), WorkspaceSemanticIndexer, normalizePosixPath()

### Community 47 - "Changelog"
Cohesion: 0.12
Nodes (16): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, Added, Added, Added, Changed (+8 more)

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
Cohesion: 0.10
Nodes (37): httpError(), isHttpError(), localizeErrorMessage(), handleWorkspaceError(), validateBranchName(), branchSchema, commitSchema, createBranchSchema (+29 more)

### Community 52 - "i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.11
Nodes (53): useAiStore, AiDiffDialog(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), useAiPanelActions(), App(), CheckinDialog() (+45 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/lang-xml@^6.1.0, @codemirror/lint@^6.9.8, @lezer/highlight@^1.2.5, lucide-react@^1.76.0, prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, react-arborist@^4.0.1 (+11 more)

### Community 55 - "ai-store.ts"
Cohesion: 0.12
Nodes (31): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+23 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.08
Nodes (35): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, FileLockRow, fileLocks (+27 more)

### Community 57 - "editor-handle.ts"
Cohesion: 0.16
Nodes (30): updateNodeRawAttr(), announce(), MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandle, VisualEditorHandleDeps, mergeCalsCellDown() (+22 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.13
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "dita-structure.ts"
Cohesion: 0.10
Nodes (21): 8.1 新增/修正一条顺序规则, 8.2 新增一个元素, 8.3 新增一种结构诊断码, 8. 扩展指南, ChildRemovalObstacle, ChildRemovalObstacleCode, DITA_SEQUENCE_MODEL, DitaSequenceSlot (+13 more)

### Community 61 - "index.tsx"
Cohesion: 0.11
Nodes (27): arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, dateTimeFormatter(), dateTimeFormatters, formatDateTime(), formatDuration(), formatRelativeTime() (+19 more)

### Community 62 - "keyspace.ts"
Cohesion: 0.20
Nodes (12): basenamePosix(), IMAGE_EXTENSIONS, ResolvedDitaHref, BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText(), findDirectChild() (+4 more)

### Community 63 - "helpers.ts"
Cohesion: 0.18
Nodes (15): countCalsTgroups(), findDirectElementIndexInPmParent(), findDirectPmChildByTag(), findNthDirectElementChild(), findPmPosByDitaId(), findPmPosByElementPath(), getPmDocTitle(), isDitaElementPmNode() (+7 more)

### Community 64 - "fragment-splice.ts"
Cohesion: 0.22
Nodes (18): element(), 1. `@dita/core` — `src/ai/`, DITA_TOPIC_ROOTS, doctypeSignature(), failedVerification(), failure(), firstElementTagName(), hasModelDecorations() (+10 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.10
Nodes (58): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, blockIndexInContainer(), BlockMovePlan, buildBlockHandleTarget(), buildConvertedBlock() (+50 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "UiLocale"
Cohesion: 0.18
Nodes (7): LocaleState, ResolvedOptions, UiLocale, ResolveConrefOptions, DitaSemanticIndex, ResolvedKeyrefResult, ParsedXmlDocument

### Community 68 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 69 - "ai-fragment.test.ts"
Cohesion: 0.19
Nodes (10): 4.1 文件清单与核心函数, extractTargetFragment(), AiExtractOptions, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport (+2 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "MapNodeInspector.tsx"
Cohesion: 0.19
Nodes (24): ProfilingAttrEditor(), createDitaXmlCompletionSource(), findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET, stripNonTagXml(), AttributesPanel(), GROUP_SUBTITLES (+16 more)

### Community 72 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.08
Nodes (25): entry(), 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次, 3.3 槽位语义 (+17 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "ai-types.ts"
Cohesion: 0.17
Nodes (16): AiPanelIntent, AiApiKeySource, AiDeltaEvent, AiDiagnosticContext, AiFixContext, AiSseEvent, AiSubAction, AiTaskType (+8 more)

### Community 76 - "Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 77 - "modules/ai/types.ts"
Cohesion: 0.04
Nodes (75): AiUsageLogRow, aiUsageLogs, createExplanationStreamFilter(), ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags(), AiService (+67 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "use-ai-panel-actions.ts"
Cohesion: 0.23
Nodes (14): AiAssistantPanelProps, AiPanelActions, UseAiPanelActionsDeps, ProblemsPanelProps, TopicAuthoringGuideSpec, InspectorTab, TABS, MessageKey (+6 more)

### Community 80 - "en/features.md"
Cohesion: 0.15
Nodes (12): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps (+4 more)

### Community 81 - "lucide-react"
Cohesion: 0.13
Nodes (17): changeLabelKey(), GitPanelProps, shortDate(), IdentitySwitcherProps, WorkbenchHeaderProps, GitFileChange, CURRENT_USER_STORAGE_KEY, IdentityResponse (+9 more)

### Community 82 - "zh/features.md"
Cohesion: 0.15
Nodes (12): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+4 more)

### Community 83 - "MapTreePanel.tsx"
Cohesion: 0.24
Nodes (13): profilingBadgeClasses(), CompositeMapTreeNode, MapNodeContextMenu(), MapNodeContextMenuProps, MapNodeMenuTarget, createMapTreeNodeRenderer(), MapNodeRowActions, NodeKindIcon() (+5 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.15
Nodes (5): site, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "extractTargetFragment"
Cohesion: 0.40
Nodes (6): close(), [1.0.0] — 2026-11-22, Added, Changed, Fixed, Phase 6 概要

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "semantic-engine.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.19
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 91 - "node-views.ts"
Cohesion: 0.05
Nodes (31): sourceEditorTheme, createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModelSetting(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP (+23 more)

### Community 92 - "TopicAuthoringGuide.tsx"
Cohesion: 0.10
Nodes (40): GROUP_LABEL_KEYS, GuideTreeNode(), GuideTreeNodeProps, readInitialExpanded(), TagFacts(), TagFactsProps, TopicAuthoringGuideProps, TopicGuideChipProps (+32 more)

### Community 93 - "roundtrip.golden.test.ts"
Cohesion: 0.27
Nodes (8): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry, __dirname, fixtureFiles, FIXTURES_DIR

### Community 94 - "workspace-api.ts"
Cohesion: 0.22
Nodes (20): createWorkspaceProject(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics(), fetchWorkspaces(), forgetWorkspaceProject() (+12 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.24
Nodes (15): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+7 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.17
Nodes (16): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, compactDiff(), computeLineDiff(), DiffLine, DiffLineType (+8 more)

### Community 97 - "parser.ts"
Cohesion: 0.24
Nodes (9): 4.2 三种靶向定位与无损回拼策略, 4. `@dita/core` 共享内核扩展设计, lineColumnToOffset(), parseSaxesError(), ParseXmlOptions, PositionTrackedSlimdomNode, XmlWellFormedResult, XmlNodeSourceRange (+1 more)

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

### Community 109 - "Core features (Phase 0–8 implemented)"
Cohesion: 0.22
Nodes (9): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5), 8. AI-assisted writing, semantic tag optimization, and error repair (Phase 6) (+1 more)

### Community 110 - "xml/types.ts"
Cohesion: 0.21
Nodes (11): TopicInspectorProps, AttributesPanelProps, baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes, SerializeXmlOptions (+3 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.15
Nodes (7): MINI_DEMO_XML, PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 115 - "map-tree-utils.ts"
Cohesion: 0.24
Nodes (13): buildCompositeMapTree(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), DitaMapTreeNode, InsertMapNodeOptions (+5 more)

### Community 116 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.15
Nodes (12): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`) (+4 more)

### Community 117 - "README.md"
Cohesion: 0.31
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 119 - "xml-bridge.ts"
Cohesion: 0.36
Nodes (7): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc()

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "lock-helpers.ts"
Cohesion: 0.09
Nodes (24): 4.7 AI Assistance (`Phase 6`), LockStatusBarProps, stateStyles, describeLock(), FileEditability, resolveFileEditability(), resolveAiApplyMode(), LOCK (+16 more)

### Community 122 - "zh-CN.ts"
Cohesion: 0.23
Nodes (6): zhCNAi, zhCNCollab, zhCNCommon, zhCNEditor, zhCNGuide, zhCNStructure

### Community 124 - "InlineBubbleToolbar.tsx"
Cohesion: 0.27
Nodes (7): EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbarProps, TAG_ICONS, EditorSelectionSnapshot, useInstantTitles(), UseInstantTitlesOptions

### Community 127 - "cals-table.test.ts"
Cohesion: 0.33
Nodes (5): 4.4 OASIS CALS Table Fidelity, 4.6 行内元素与表格的额外保真规则, hasMultipleTgroups(), __dirname, FIXTURES_DIR

### Community 129 - "astro"
Cohesion: 0.40
Nodes (4): astro@^5.18.2, collections, docs, astro

### Community 132 - "FileExplorerPanel.tsx"
Cohesion: 0.83
Nodes (3): FileExplorerPanel(), FileIcon(), filterTreeNodes()

### Community 135 - "task-model-switch.test.ts"
Cohesion: 0.11
Nodes (30): TaskModelSwitchProps, getTaskContentModel(), resolveTaskModelForXml(), setDetectedTaskContentModel(), setTaskContentModelSetting(), shouldShowTaskModelSwitch(), DITA_STRUCTURE_KEY, DitaStructurePluginMeta (+22 more)

### Community 136 - "@codemirror/autocomplete@^6.20.4"
Cohesion: 0.33
Nodes (4): @codemirror/autocomplete@^6.20.4, @codemirror/language@^6.13.1, @codemirror/autocomplete, @codemirror/language

### Community 148 - "files.ts"
Cohesion: 0.11
Nodes (24): buildScaleDitaProject(), createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), renameWorkspaceEntry(), saveFileContent(), createFilesSlice(), createMapTemplate() (+16 more)

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 951 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `internals.ts` to `task-model-switch.test.ts`, `dita-map.ts`, `files.ts`, `AiAssistantPanel.tsx`, `dita-structure.ts`, `semantic-engine.ts`, `WorkspaceManager`, `Changelog`, `fragment-splice.ts`, `en/architecture.md`, `ai-fragment.test.ts`, `zh/architecture.md`, `前端 DITA 1.3 结构化写作合规实施说明`, `en/features.md`, `zh/features.md`, `semantic-engine.ts`, `e2e-ai-live.mts`, `workspace-api.ts`, `parser.ts`, `Core features (Phase 0–8 implemented)`, `playground-presets.ts`, `map-tree-utils.ts`, `4. Non-Negotiable Engineering Invariants`, `xml-bridge.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `ref_react` to `PublishDialog.tsx`, `git-store.ts`, `FileExplorerPanel.tsx`, `AiAssistantPanel.tsx`, `ditaval.ts`, `SourceEditor.tsx`, `devDependencies`, `App.tsx`, `dependencies`, `index.tsx`, `VisualEditor.tsx`, `MapNodeInspector.tsx`, `use-ai-panel-actions.ts`, `lucide-react`, `MapTreePanel.tsx`, `node-views.ts`, `TopicAuthoringGuide.tsx`, `lock-helpers.ts`, `InlineBubbleToolbar.tsx`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13363363363363365 - nodes in this community are weakly interconnected._