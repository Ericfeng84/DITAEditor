# Graph Report - DITAEditor  (2026-11-24)

## Corpus Check
- 383 files · ~293,796 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 69 file(s) not represented in the graph (top: .dita 31, .css 20, (none) 5)

## Summary
- 3530 nodes · 9858 edges · 186 communities (148 shown, 38 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 440 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7fc58bca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- ai-service.ts
- converter.ts
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
- editor-store/types.ts
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- httpError
- scripts
- commands.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- 4. Web wiring
- serializer.ts
- deploy-site.yml
- electron-builder.yml
- map-tree-utils.ts
- files/routes.ts
- task-model-switch.test.ts
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
- WorkbenchHubPage.tsx
- Assignment
- workbench-store.ts
- helpers.ts
- workspace-fs.ts
- VisualEditor.tsx
- en/architecture.md
- semantic-engine.ts
- dita-rules.ts
- editor-store/types.ts
- zh/architecture.md
- AiAssistantPanel.tsx
- 前端 DITA 1.3 结构化写作合规实施说明
- SearchModal.astro
- docker-entrypoint.sh
- ManualRegistryService
- Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）
- phase6-ai-api.test.ts
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
- InlineBubbleToolbar.tsx
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
- ai-workbench.test.ts
- normalizePosixPath
- scripts
- playground-presets.ts
- ai-types.ts
- @dita/core@workspace:*
- QuickStartTabs.tsx
- Core features (Phase 0–11 implemented)
- README.md
- MapTreeNodeRenderer.tsx
- ditaval.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- getCurrentLocale
- PublishDialog.tsx
- ai-output-parser.ts
- fragment-splice.ts
- sync-hf-space.sh
- @codemirror/language@^6.13.1
- 核心特性（已实现：Phase 0–11）
- prosemirror-commands@^1.7.2
- prosemirror-model@^1.25.13
- @codemirror/lint@^6.9.8
- PublishService
- @codemirror/view@^6.43.15
- @lezer/highlight@^1.2.5
- @codemirror/merge@^6.12.3
- @codemirror/state@^6.7.6
- @codemirror/language@^6.13.1
- prosemirror-inputrules@^1.7.0
- dita-log-parser.ts
- @lezer/highlight@^1.2.1
- prosemirror-gapcursor@^1.4.1
- prosemirror-state@^1.4.4
- react-dom@^19.0.0
- react-resizable-panels
- strict-validator.ts
- selectors.ts
- react@^19.0.0
- prosemirror-keymap@^1.2.3
- createTopicTemplate
- tailwindcss@^4.3.5
- 4. Non-Negotiable Engineering Invariants
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
- xml-bridge.ts
- tag
- .runJob
- desktop/tsconfig.json
- AGENTS.md
- release-desktop.yml
- main.tsx
- 5. REST API 契约设计
- steps
- 9. 分阶段垂直切片实施计划
- attach-to-release
- electron
- @codemirror/state@^6.7.6
- @codemirror/search@^6.7.2
- prosemirror-gapcursor@^1.4.1
- react-dnd-html5-backend@^16.0.1
- assignments-api.ts
- prosemirror-dropcursor@^1.8.4
- prosemirror-state@^1.4.4
- react-arborist
- tailwindcss@^4.3.5
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
- `Website and GitHub Pages online demo (Phase 7)` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts
- `Fixed` --references--> `resolveDitaSpawn()`  [INFERRED]
  CHANGELOG.md → apps/api/src/modules/dita-ot/dita-runtime.ts
- `5.1 手册管理接口（`apps/api/src/modules/manuals/routes.ts`）` --references--> `ManualRegistryService`  [INFERRED]
  docs/phase10-workbench-assignments-plan.md → apps/api/src/modules/manuals/manual-registry-service.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (186 total, 38 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.17
Nodes (23): StrictValidationDialogProps, getActiveScope(), getCurrentUserId(), cancelPublishJob(), createPublishJob(), fetchPublishJob(), fetchPublishJobs(), fetchPublishLog() (+15 more)

### Community 1 - "git-store.ts"
Cohesion: 0.10
Nodes (37): CheckinCandidate, CheckinDialogProps, ManualAssignmentsPanel(), STATUS_TONE, cancelCheckout(), checkinFiles(), CheckinOptions, CheckinResponse (+29 more)

### Community 2 - "ai-service.ts"
Cohesion: 0.06
Nodes (53): AiProjectContext, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), AiModelFactory, createExplanationStreamFilter() (+45 more)

### Community 3 - "converter.ts"
Cohesion: 0.12
Nodes (29): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+21 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.07
Nodes (22): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enAssignments, enCollab, enCommon, enEditor, en (+14 more)

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

### Community 17 - "editor-store/types.ts"
Cohesion: 0.16
Nodes (28): setTaskContentModelSetting(), createInMemoryDemoWorkspace(), useEditorStore, createInitialEditorState(), cancelAllPendingRefreshes(), cancelOverlayRefresh(), collectFileSetFromTree(), detectTopicTypeFromXml() (+20 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.17
Nodes (36): createMapTreeSlice(), extractElementAttrs(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo (+28 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.08
Nodes (23): astro@^5.18.2, bySlug, dict, groups, Props, dict, Props, getDictionary() (+15 more)

### Community 21 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, prosemirror-dropcursor@^1.8.4, prosemirror-view@^1.43.0 (+11 more)

### Community 22 - "httpError"
Cohesion: 0.11
Nodes (13): FileLockRow, ManualRow, TopicAssignmentRow, AssignmentService, normalizeTopicPath(), parseStatus(), todayIso(), httpError() (+5 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.11
Nodes (39): resolveTaskModelForDocument(), insertBlockDitaElement(), insertBlockDitaElementAtPos(), insertMissingTopicBody(), resolveSequenceAnchor(), TOPIC_BODY_WRAPPER, insertReuseElementAtPos(), createDitaElementSkeleton() (+31 more)

### Community 25 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.07
Nodes (27): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+19 more)

### Community 26 - "4. Web wiring"
Cohesion: 0.33
Nodes (6): errorMessage(), parseEventFrame(), 2. DB (`apps/api/src/db`), 3. REST contract, 4. Web wiring, Phase 6 AI Assistance — Implementation Contract

### Community 27 - "serializer.ts"
Cohesion: 0.13
Nodes (27): DITA_INLINE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind, isBlockElementName(), isInlineElementName() (+19 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "map-tree-utils.ts"
Cohesion: 0.15
Nodes (20): buildCompositeMapTree(), BuildCompositeMapTreeOptions, collectWorkspaceDirectoryPaths(), collectWorkspaceFilesByKind(), CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove() (+12 more)

### Community 31 - "files/routes.ts"
Cohesion: 0.05
Nodes (38): AssignmentScope, AssignmentServiceOptions, AssignmentStatus, AssignmentStatusFilter, AssignmentRouteOptions, createAssignmentSchema, parseStatusFilter(), queryString() (+30 more)

### Community 32 - "task-model-switch.test.ts"
Cohesion: 0.07
Nodes (40): TaskModelSwitch(), TaskModelSwitchProps, sourceEditorTheme, createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModelSetting() (+32 more)

### Community 33 - "ref_vitest"
Cohesion: 0.05
Nodes (53): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), ditaXmlCompletionSource, buildState(), buildTaskState(), completeAtEnd(), loadDoc(), noopCallbacks, cursorIntoTag() (+45 more)

### Community 34 - "locales.ts"
Cohesion: 0.14
Nodes (26): anchor(), columns, dict, home, Props, year, dict, isDocs (+18 more)

### Community 35 - "ref_node_path"
Cohesion: 0.04
Nodes (43): AiChatModel, createLangChainModelFactory(), AiConfigTestResult, defaultWebDistDir(), isInside(), MIME_TYPES, registerWebStaticRoutes(), ADMIN (+35 more)

### Community 36 - "UiLocale"
Cohesion: 0.14
Nodes (29): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement, XmlLikeNode, collectDitaDecorations(), createConrefWidgetDom() (+21 more)

### Community 37 - "dita-runtime.ts"
Cohesion: 0.14
Nodes (24): buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DetectRuntimeOptions, DitaRunOptions (+16 more)

### Community 38 - "index.tsx"
Cohesion: 0.08
Nodes (36): SOURCE_KEYS, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, BlockConvertOption, BlockHandleProps, MODE_LABEL_KEYS, dateTimeFormatter() (+28 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "快速开始"
Cohesion: 0.25
Nodes (8): 后端环境变量（`@dita/api`）, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版）, 方式二：本地源码 + 本机 DITA-OT, 方式四：仅编辑 / 语义写作（不安装 DITA-OT）, 本机 DITA-OT 配置, 环境要求

### Community 41 - "DocsLayout.astro"
Cohesion: 0.11
Nodes (14): collections, docs, Locale, dict, groups, index, jsonLd, links (+6 more)

### Community 42 - "AttributesPanel.tsx"
Cohesion: 0.14
Nodes (30): ProfilingAttrEditor(), TABS, createDitaXmlCompletionSource(), findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET, stripNonTagXml(), getTaskContentModel() (+22 more)

### Community 43 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, vitest@^3.1.0, @types/react, @types/react-dom (+3 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "WorkspaceManager"
Cohesion: 0.10
Nodes (16): CreateServerOptions, DitaRuntimeOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), handleWorkspaceError(), registerWorkspaceFileRoutes() (+8 more)

### Community 46 - "createServer"
Cohesion: 0.21
Nodes (5): createServer(), collectAllFilePaths(), summarizeDitaval(), WorkspaceSemanticIndexer, 4.1 `ManualContextResolver`（请求级上下文解析器）

### Community 47 - "Changelog"
Cohesion: 0.11
Nodes (19): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.3.0] — 2026-11-24, Added, Added, Added (+11 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), pickText(), DEFAULT_LOCALE, zh, docsRoot, here (+2 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "api/src/index.ts"
Cohesion: 0.09
Nodes (48): firstHeaderValue(), RequestLike, resolveRequestLocale(), apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh (+40 more)

### Community 52 - "AppShell.tsx"
Cohesion: 0.13
Nodes (24): AppShell(), EditorState, AppRoute, BASE, currentRoute, editorPath(), EditorRoute, emit() (+16 more)

### Community 53 - "App.tsx"
Cohesion: 0.09
Nodes (67): useAiStore, AiAssistantPanel(), AiSettingsDialog(), App(), AppProps, CheckinDialog(), ConrefReusePanel(), DelegateTopicButton() (+59 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/merge@^6.12.3, @dita/core@workspace:*, lucide-react@^1.76.0, prosemirror-keymap@^1.2.3, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0 (+10 more)

### Community 55 - "ai-store.ts"
Cohesion: 0.12
Nodes (29): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+21 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.05
Nodes (52): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), AiUsageLogRow, aiUsageLogs, fileLocks, LockBackupRow (+44 more)

### Community 57 - "editor-handle.ts"
Cohesion: 0.18
Nodes (27): announce(), MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandle, VisualEditorHandleDeps, mergeCalsCellDown(), mergeCalsCellRight() (+19 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.14
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "WorkbenchHubPage.tsx"
Cohesion: 0.30
Nodes (10): Manual, ManualCreateInput, ManualUpdateInput, WorkbenchState, ManualCardProps, ManualFormDialog(), ManualFormDialogProps, ManualFormMode (+2 more)

### Community 61 - "Assignment"
Cohesion: 0.13
Nodes (19): ManualAssignmentsPanelProps, Assignment, AssignmentSummary, AssignmentCardProps, statusTone(), MyAssignmentsPanelProps, PanelTab, 10. 风险与防呆清单 (+11 more)

### Community 62 - "workbench-store.ts"
Cohesion: 0.23
Nodes (12): cancelAssignment(), createManual(), fetchManuals(), ManualCreateMode, ManualListSnapshot, ManualStats, removeManual(), touchManual() (+4 more)

### Community 63 - "helpers.ts"
Cohesion: 0.27
Nodes (10): countCalsTgroups(), findDirectElementIndexInPmParent(), findNthDirectElementChild(), findPmPosByDitaId(), findPmPosByElementPath(), isDitaElementPmNode(), normalizeTitleText(), resolvePmElementPath() (+2 more)

### Community 64 - "workspace-fs.ts"
Cohesion: 0.09
Nodes (27): countMapTreeNodes(), FileContentResult, findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), sanitizeWorkspaceDirName() (+19 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.10
Nodes (44): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, blockIndexInContainer(), BlockMovePlan, buildBlockHandleTarget(), buildConvertedBlock() (+36 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "semantic-engine.ts"
Cohesion: 0.12
Nodes (30): MINI_DEMO_XML, PLAYGROUND_PRESETS, extractProfilingValuesFromDocument(), DITA_TOPIC_ROOT_TAGS, areConrefTagsCompatible(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText() (+22 more)

### Community 68 - "dita-rules.ts"
Cohesion: 0.12
Nodes (16): ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS, DitaElementCategory, ELEMENT_DESCRIPTIONS_ZH, ELEMENT_SPEC_LIST (+8 more)

### Community 69 - "editor-store/types.ts"
Cohesion: 0.12
Nodes (35): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, ConrefReusePanelProps, InsertKeyrefDialogProps, KeyspacePanelProps, NewMapDialogProps, PublishDialogProps (+27 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "AiAssistantPanel.tsx"
Cohesion: 0.17
Nodes (21): PromptStrings, AiPanelIntent, AiDiagnosticContext, AiStreamRequest, AiSubAction, AiTaskType, AiAssistantPanelProps, historyFromMessages() (+13 more)

### Community 72 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.06
Nodes (40): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), MODES, ConrefDragGhost, ConrefRowDragApi (+32 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "ManualRegistryService"
Cohesion: 0.18
Nodes (8): ApiLocale, AiContextInput, AiStreamContext, repositoryIdFor(), ManualContextResolverOptions, manualIdForRoot(), ManualRegistryService, CreatePublishJobInput

### Community 76 - "Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 77 - "phase6-ai-api.test.ts"
Cohesion: 0.05
Nodes (44): addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey(), toIso(), toLogView() (+36 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "lucide-react"
Cohesion: 0.10
Nodes (34): DelegateTopicButtonProps, EditorTabBarProps, TAB_TYPE_BADGE, changeLabelKey(), GitPanel(), GitPanelProps, shortDate(), IdentitySwitcher() (+26 more)

### Community 80 - "en/features.md"
Cohesion: 0.13
Nodes (14): AI assistance, Bilingual UI, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs (+6 more)

### Community 81 - "ai-settings-service.ts"
Cohesion: 0.20
Nodes (12): aiSettings, AiSettingsRow, AI_SETTINGS_ID, AiEnvDefaults, AiSettingsService, maskApiKey(), readAiEnvDefaults(), readEnvInt() (+4 more)

### Community 82 - "zh/features.md"
Cohesion: 0.13
Nodes (14): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 中英双语界面, 协作与版本, 单一信息源 (+6 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.11
Nodes (16): platforms, Props, dict, jsonLd, layerRows, Props, screenshotUrl(), showcaseImages (+8 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.22
Nodes (5): site, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, @astrojs/react, @astrojs/sitemap

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
Cohesion: 0.15
Nodes (15): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+7 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.19
Nodes (14): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+6 more)

### Community 91 - "use-visual-editor-view.ts"
Cohesion: 0.04
Nodes (39): SourceEditor(), hydrateEmptyContainerAtPos(), updateNodeRawAttr(), buildConrefDragSnippet(), CONREF_DRAG_MIME, escapeXmlAttrValue(), hasConrefDragPayload(), parseConrefDragPayload() (+31 more)

### Community 92 - "topicGuideTree.ts"
Cohesion: 0.09
Nodes (44): DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS, GROUP_LABEL_KEYS, GuideTreeNode(), GuideTreeNodeProps, readInitialExpanded() (+36 more)

### Community 94 - "workspace-api.ts"
Cohesion: 0.17
Nodes (30): XrefImageDialogProps, applyScopeHeaders(), createWorkspaceDir(), createWorkspaceFile(), createWorkspaceProject(), deleteWorkspaceEntry(), fetchFileContent(), fetchParsedDitaval() (+22 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.07
Nodes (37): 4.1 文件清单与核心函数, buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren() (+29 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.17
Nodes (16): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, compactDiff(), computeLineDiff(), DiffLine, DiffLineType (+8 more)

### Community 97 - "InlineBubbleToolbar.tsx"
Cohesion: 0.28
Nodes (6): EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbarProps, TAG_ICONS, useInstantTitles(), UseInstantTitlesOptions

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, @codemirror/commands, @codemirror/lint, prosemirror-commands, prosemirror-history (+5 more)

### Community 101 - "en/introduction.md"
Cohesion: 0.18
Nodes (10): Bilingual by default, Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy (+2 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "界面预览"
Cohesion: 0.15
Nodes (13): AI 辅助写作与安全 Diff, DITA-OT 4.x 严格校验与异步 HTML5 / 中文 PDF 发布, DITAEditor, 三栏工作台与双模编辑, 中英双语全栈界面（Phase 8）, 仓库目录结构, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 实施路线图（Roadmap） (+5 more)

### Community 105 - "Screenshots"
Cohesion: 0.14
Nodes (14): AI-assisted authoring with safe diffs, Architecture and technology stack, DITA-OT 4.x strict validation and async HTML5 / CJK PDF publishing, DITAEditor, Fully bilingual stack (Phase 8), License, Local Git versioning, check-out locks, and visual diffs, Manual workbench: distribute first, write second (Phase 10) (+6 more)

### Community 106 - "zh/introduction.md"
Cohesion: 0.18
Nodes (10): 下一步, 为谁而写, 单一信息源, 双语是一等公民, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么 (+2 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Backend environment variables (`@dita/api`), Getting started, Host DITA-OT setup, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT, Option 3: Desktop app (macOS Apple Silicon & Windows x64, lightweight), Option 4: Editing and semantic authoring only (no DITA-OT), Requirements

### Community 109 - "ai-workbench.test.ts"
Cohesion: 0.19
Nodes (15): resetAiStore(), AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, AiTargetScope, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget(), normalizeSelectedText() (+7 more)

### Community 110 - "normalizePosixPath"
Cohesion: 0.14
Nodes (11): resolveWorkspaceAssetUrl(), basenamePosix(), computeRelativeDitaHref(), dirnamePosix(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref, resolveDitaHref() (+3 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.12
Nodes (10): CAPABILITIES, Capability, FeatureIcon, QuickStartTab, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId (+2 more)

### Community 113 - "ai-types.ts"
Cohesion: 0.20
Nodes (13): AiApiKeySource, AiDeltaEvent, AiFixContext, AiHistoryTurn, AiSseEvent, AiUsageDayBucket, AiUsageModelBucket, AiUsageRecentEntry (+5 more)

### Community 115 - "QuickStartTabs.tsx"
Cohesion: 0.24
Nodes (6): Props, Props, Props, QuickStartTabs(), QUICK_START_TABS, SiteDictionary

### Community 116 - "Core features (Phase 0–11 implemented)"
Cohesion: 0.20
Nodes (10): 10. Manual workbench and topic assignment (Phase 10), 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5) (+2 more)

### Community 117 - "README.md"
Cohesion: 0.18
Nodes (7): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 118 - "MapTreeNodeRenderer.tsx"
Cohesion: 0.31
Nodes (7): PROFILING_BADGE_CLASSES, profilingBadgeClasses(), ProfilingAttrEditorProps, sanitizeCssColor(), createMapTreeNodeRenderer(), NodeKindIcon(), TAG_PILL_STYLES

### Community 119 - "ditaval.ts"
Cohesion: 0.16
Nodes (16): ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions() (+8 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "getCurrentLocale"
Cohesion: 0.18
Nodes (20): defaultInstruction(), targetLabel(), buildBlockInsertGroups(), NON_INSERTABLE_BLOCK_TAGS, InsertElementChoice, InsertElementMenuProps, ActiveTableInfo, buildInsertContextGroups() (+12 more)

### Community 122 - "PublishDialog.tsx"
Cohesion: 0.33
Nodes (8): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf()

### Community 123 - "ai-output-parser.ts"
Cohesion: 0.33
Nodes (4): ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags()

### Community 124 - "fragment-splice.ts"
Cohesion: 0.09
Nodes (39): 4.7 AI Assistance (`Phase 6`), close(), element(), [1.0.0] — 2026-11-22, Added, Changed, Fixed, Phase 6 概要 (+31 more)

### Community 127 - "核心特性（已实现：Phase 0–11）"
Cohesion: 0.20
Nodes (10): 10. 手册工作台与 Topic 委派（Phase 10）, 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5） (+2 more)

### Community 128 - "prosemirror-commands@^1.7.2"
Cohesion: 0.33
Nodes (4): prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, prosemirror-commands, prosemirror-history

### Community 138 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 144 - "strict-validator.ts"
Cohesion: 0.21
Nodes (13): fallbackDitaDiagnostic(), DitaRuntimeInfo, ensureInside(), resolveDitavalTarget(), resolveValidationTarget(), SingleTargetResult, StrictDiagnostic, StrictValidationInput (+5 more)

### Community 145 - "selectors.ts"
Cohesion: 0.09
Nodes (25): AiDiffDialog(), DiffDialogProps, revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel(), LockStatusBarProps (+17 more)

### Community 148 - "createTopicTemplate"
Cohesion: 0.16
Nodes (13): buildScaleDitaProject(), tempDirs, dropState(), createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate() (+5 more)

### Community 150 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.22
Nodes (9): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`), 4. Non-Negotiable Engineering Invariants, 4.6 行内元素与表格的额外保真规则 (+1 more)

### Community 152 - "publish-service.ts"
Cohesion: 0.16
Nodes (15): DitaDiagnostic, EXCLUDED_SNAPSHOT_ENTRIES, parseDiagnostics(), PublishFormat, PublishJobPatch, PublishJobView, PublishStatus, TERMINAL_STATUSES (+7 more)

### Community 153 - "phase5-publish.test.ts"
Cohesion: 0.20
Nodes (8): resetDitaRuntimeCache(), ADMIN, createApp(), PLUGIN_DIR, SAMPLE_ROOT, tempDirs, VIEWER, WRITER

### Community 155 - "desktop/package.json"
Cohesion: 0.20
Nodes (10): dependencies, @dita/api@workspace:*, description, license, main, name, private, type (+2 more)

### Community 156 - "stage.mjs"
Cohesion: 0.17
Nodes (9): apiPkg, DESKTOP_ROOT, desktopPkg, __dirname, REPO_ROOT, requiredPaths, STAGE_DIR, stagePkg (+1 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 159 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, electron@^35.2.0, electron-builder@^26.18.1, esbuild@^0.25.0, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, @types/node (+4 more)

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
Cohesion: 0.16
Nodes (11): ApiServer, __dirname, hasSingleInstanceLock, REPO_ROOT, startEmbeddedServer(), DesktopPathInput, DesktopRuntimePaths, ensureInitialWorkspace() (+3 more)

### Community 164 - "xml-bridge.ts"
Cohesion: 0.33
Nodes (7): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, getTabDiffStats()

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 166 - ".runJob"
Cohesion: 0.31
Nodes (4): findFirstPdf(), isInside(), readLogForDiagnostics(), sanitizeFileStem()

### Community 167 - "desktop/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ../../tsconfig.base.json

### Community 168 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`)

### Community 169 - "release-desktop.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 171 - "5. REST API 契约设计"
Cohesion: 0.50
Nodes (4): 5.1 手册管理接口（`apps/api/src/modules/manuals/routes.ts`）, 5.2 Topic 编辑任务接口（`apps/api/src/modules/assignments/routes.ts`）, 5.3 与既有模块的自动联动钩子, 5. REST API 契约设计

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "9. 分阶段垂直切片实施计划"
Cohesion: 0.50
Nodes (4): 9. 分阶段垂直切片实施计划, Slice 10.1：数据库底座、手册注册服务与多手册/多分支并发隔离（后端基座）, Slice 10.3：前端零依赖路由与「手册编辑工作台」首页（`/`）, Slice 10.5：双语 i18n 补齐、防退化门禁与构建验收

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "electron"
Cohesion: 0.50
Nodes (3): bridge, DitaDesktopBridge, electron

### Community 180 - "assignments-api.ts"
Cohesion: 0.13
Nodes (15): AssignmentCreateInput, AssignmentListQuery, AssignmentPerson, AssignmentScope, AssignmentStatus, AssignmentStatusFilter, AssignmentUpdateInput, createAssignment() (+7 more)

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1179 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `editor-store/types.ts` to `dita-map.ts`, `4. Non-Negotiable Engineering Invariants`, `map-tree-utils.ts`, `task-model-switch.test.ts`, `ref_vitest`, `xml-bridge.ts`, `.runJob`, `WorkspaceManager`, `Changelog`, `workspace-fs.ts`, `en/architecture.md`, `semantic-engine.ts`, `zh/architecture.md`, `前端 DITA 1.3 结构化写作合规实施说明`, `en/features.md`, `zh/features.md`, `xpath.ts`, `e2e-ai-live.mts`, `workspace-api.ts`, `fragment-locator.ts`, `ai-workbench.test.ts`, `normalizePosixPath`, `Core features (Phase 0–11 implemented)`, `fragment-splice.ts`, `核心特性（已实现：Phase 0–11）`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09725158562367865 - nodes in this community are weakly interconnected._
- **Why does `DITAEditor` connect `Screenshots` to `dita-runtime.ts`, `DITAEditor`, `BaseLayout.astro`, `Core features (Phase 0–11 implemented)`, `README.md`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `ai-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._