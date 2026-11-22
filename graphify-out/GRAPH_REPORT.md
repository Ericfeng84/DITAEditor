# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 245 files · ~201,731 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .dita 24, (none) 5, .ditaval 4)

## Summary
- 2527 nodes · 6306 edges · 155 communities (118 shown, 37 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 278 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f68495d0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- converter.ts
- normalizePosixPath
- DitaPlayground.tsx
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
- table-commands.ts
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- semantic-indexer.ts
- scripts
- commands.ts
- editor-store.ts
- workspace-fs.ts
- dita-log-parser.ts
- deploy-site.yml
- LockService
- ai-store.ts
- serializer.ts
- dita-rules.ts
- decorations.ts
- locales.ts
- 3.2 四项关键技术机制
- lock-helpers.ts
- modules/ai/types.ts
- DITAEditor
- semantic-engine.ts
- 快速开始
- DocsLayout.astro
- VisualEditor.tsx
- devDependencies
- Getting started
- ai-service.ts
- ref_react
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- HttpError
- 核心特性（已实现：Phase 0–3）
- i18n/index.ts
- App.tsx
- dependencies
- Core features (Phase 0–6 implemented)
- identity-service.ts
- table-commands.ts
- 3.2 四项关键技术机制
- GitManager
- SandboxVisualEditor.tsx
- dita-core/src/index.ts
- block-transforms.ts
- ai-config-and-model.test.ts
- checkXmlWellFormed
- checkXmlWellFormed
- createServer
- phase6-ai-api.test.ts
- inline-selection.ts
- xpath.ts
- api/src/index.ts
- lucide-react
- git-manager.ts
- SearchModal.astro
- docker-entrypoint.sh
- en/architecture.md
- web/package.json
- AiDiffDialog
- devDependencies
- ai-settings-service.ts
- en/features.md
- DocumentSemanticOverlay
- zh/features.md
- ai-prompt.ts
- astro.config.ts
- en/ai-setup.md
- dita-core/src/index.ts
- zh/ai-setup.md
- compilerOptions
- fragment-locator.ts
- e2e-ai-live.mts
- publish-service.ts
- dita-runtime.ts
- Phase 6 AI Assistance — Implementation Contract
- ai-fragment.test.ts
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- MiniRoundTripDemo.tsx
- ref_vitest
- en/getting-started.md
- strict-validator.ts
- AGENTS.md
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- PublishService
- zh/introduction.md
- zh/local-development.md
- PublishQueue
- Header.astro
- AiSettingsDialog.tsx
- scripts
- playground-presets.ts
- FileExplorerPanel.tsx
- zip-store.ts
- sandbox.ts
- DocsLayout.astro
- GitHub Pages 免费部署指南（官网 + 离线三栏工作台）
- parser.ts
- main.tsx
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- 4. Non-Negotiable Engineering Invariants
- compare.ts
- 6. 分阶段实施切片（垂直交付，预计 1.5–2 周）
- react@^19.0.0
- sync-hf-space.sh
- @codemirror/lang-xml@^6.1.0
- @codemirror/lint@^6.9.8
- @codemirror/merge@^6.12.3
- @codemirror/search@^6.7.2
- @codemirror/state@^6.7.6
- @codemirror/view@^6.43.15
- prosemirror-commands@^1.7.2
- prosemirror-dropcursor@^1.8.4
- prosemirror-model@^1.25.13
- react-dom@^19.0.0
- @tailwindcss/vite@^4.3.5
- @codemirror/lang-xml@^6.1.0
- @codemirror/language@^6.13.1
- @codemirror/search@^6.7.2
- @codemirror/state@^6.7.6
- @codemirror/view@^6.43.15
- @lezer/highlight@^1.2.5
- prosemirror-commands@^1.7.2
- prosemirror-dropcursor@^1.8.4
- prosemirror-history@^1.5.2
- prosemirror-inputrules@^1.7.0
- prosemirror-keymap@^1.2.3
- prosemirror-state@^1.4.4
- react-dnd@^16.0.1
- react-dom@^19.0.0
- react-resizable-panels
- tailwindcss@^4.3.5
- zustand

## God Nodes (most connected - your core abstractions)
1. `App()` - 48 edges
2. `WorkspaceManager` - 46 edges
3. `requestJson()` - 45 edges
4. `checkXmlWellFormed()` - 43 edges
5. `HttpError` - 42 edges
6. `lucide-react` - 42 edges
7. `parseXml()` - 42 edges
8. `createServer()` - 41 edges
9. `normalizePosixPath()` - 33 edges
10. `GitManager` - 32 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `7. DITA-OT 4.x 权威校验与异步发布（Phase 5）` --references--> `PublishQueue`  [INFERRED]
  README.md → apps/api/src/modules/publish/publish-queue.ts
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (155 total, 37 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.12
Nodes (32): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+24 more)

### Community 1 - "git-store.ts"
Cohesion: 0.09
Nodes (41): DiffDialogProps, IdentitySwitcherProps, WorkbenchHeaderProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch() (+33 more)

### Community 2 - "converter.ts"
Cohesion: 0.13
Nodes (29): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+21 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.16
Nodes (10): collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref (+2 more)

### Community 4 - "DitaPlayground.tsx"
Cohesion: 0.18
Nodes (13): DiffRow(), DisplayMode, DitaPlayground(), applyPreset(), INSERT_KINDS, presetLabel(), ViewMode, SandboxSourceEditor() (+5 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (36): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/openai@^1.8.4 (+28 more)

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

### Community 17 - "table-commands.ts"
Cohesion: 0.07
Nodes (16): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView (+8 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.18
Nodes (31): extractTitleSafe(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle() (+23 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.10
Nodes (21): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+13 more)

### Community 21 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/language@^6.13.1, @dita/core@workspace:*, @lezer/highlight@^1.2.1, prosemirror-gapcursor@^1.4.1, prosemirror-history@^1.5.2 (+13 more)

### Community 22 - "semantic-indexer.ts"
Cohesion: 0.13
Nodes (29): buildCompositeMapTree(), BuildCompositeMapTreeOptions, CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath(), MapBufferState, planMapNodeMove(), PlannedMapMoveResult (+21 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.17
Nodes (22): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+14 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.07
Nodes (52): FileContentResult, WorkspaceFileNode, FileExplorerPanelProps, PublishDialogProps, formatRelativeTime(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialogProps (+44 more)

### Community 26 - "workspace-fs.ts"
Cohesion: 0.05
Nodes (47): ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema (+39 more)

### Community 27 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 30 - "ai-store.ts"
Cohesion: 0.06
Nodes (68): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+60 more)

### Community 31 - "serializer.ts"
Cohesion: 0.15
Nodes (23): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind, isBlockElementName() (+15 more)

### Community 32 - "dita-rules.ts"
Cohesion: 0.12
Nodes (15): COMMON_ATTRIBUTES, BODY_BLOCKS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DITA_ELEMENT_SPECS, DitaElementCategory, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS (+7 more)

### Community 33 - "decorations.ts"
Cohesion: 0.11
Nodes (27): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, collectDitaDecorations() (+19 more)

### Community 34 - "locales.ts"
Cohesion: 0.22
Nodes (20): 4.6.1 Static Site Invariants (`apps/site`, Phase 7), anchor(), columns, dict, home, Props, year, DOC_SLUGS (+12 more)

### Community 35 - "3.2 四项关键技术机制"
Cohesion: 0.15
Nodes (17): AiDiffDialog(), CheckinCandidate, CheckinDialog(), CheckinDialogProps, DiffDialog(), revisionLabel(), diffTheme, DiffViewer() (+9 more)

### Community 36 - "lock-helpers.ts"
Cohesion: 0.29
Nodes (7): LockStatusBarProps, stateStyles, describeLock(), FileEditability, ResolveEditabilityInput, resolveFileEditability(), LOCK

### Community 37 - "modules/ai/types.ts"
Cohesion: 0.09
Nodes (31): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey() (+23 more)

### Community 38 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 39 - "semantic-engine.ts"
Cohesion: 0.08
Nodes (42): summarizeDitaval(), KeyspacePanelProps, ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle (+34 more)

### Community 40 - "快速开始"
Cohesion: 0.15
Nodes (13): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT） (+5 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.12
Nodes (10): bySlug, dict, groups, Props, Props, collections, docs, Locale (+2 more)

### Community 42 - "VisualEditor.tsx"
Cohesion: 0.10
Nodes (28): BlockConvertOption, computeBlockGaps(), findBlockHandleTarget(), planBlockMove(), BlockHandle(), BlockHandleProps, MODE_LABEL, deleteDitaNodeAtPos() (+20 more)

### Community 43 - "devDependencies"
Cohesion: 0.12
Nodes (13): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+5 more)

### Community 44 - "Getting started"
Cohesion: 0.15
Nodes (13): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+5 more)

### Community 45 - "ai-service.ts"
Cohesion: 0.11
Nodes (26): AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), createExplanationStreamFilter(), ExplanationStreamFilter (+18 more)

### Community 46 - "ref_react"
Cohesion: 0.09
Nodes (24): EditorTabBarProps, TAB_TYPE_BADGE, InsertKeyrefDialogProps, LeftSidebarProps, NewMapDialogProps, DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext (+16 more)

### Community 47 - "Changelog"
Cohesion: 0.12
Nodes (16): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, Added, Added, Added, Changed (+8 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.10
Nodes (19): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+11 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.12
Nodes (16): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+8 more)

### Community 50 - "HttpError"
Cohesion: 0.11
Nodes (33): zod@^3.24.2, HttpError, isHttpError(), handleWorkspaceError(), validateBranchName(), branchSchema, commitSchema, createBranchSchema (+25 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.25
Nodes (8): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 核心特性（已实现：Phase 0–6）

### Community 52 - "i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.11
Nodes (34): App(), EditorTabBar(), IdentitySwitcher(), InsertKeyrefDialog(), KeyspacePanel(), LeftSidebar(), LockStatusBar(), NewMapDialog() (+26 more)

### Community 54 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/lint@^6.9.8, lucide-react@^1.76.0, prosemirror-gapcursor@^1.4.1, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0, react@^19.0.0 (+9 more)

### Community 55 - "Core features (Phase 0–6 implemented)"
Cohesion: 0.25
Nodes (8): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5), Core features (Phase 0–6 implemented)

### Community 56 - "identity-service.ts"
Cohesion: 0.14
Nodes (19): FileLockRow, fileLocks, LockBackupRow, lockBackups, repositories, UserRow, users, DEFAULT_ADMIN_ID (+11 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.25
Nodes (21): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+13 more)

### Community 58 - "3.2 四项关键技术机制"
Cohesion: 0.17
Nodes (11): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 6. 分阶段实施切片（垂直交付，预计 1.5–2 周）, 7. 验收标准（Definition of Done） (+3 more)

### Community 60 - "SandboxVisualEditor.tsx"
Cohesion: 0.12
Nodes (12): buildConditionPlugin(), buildInsertNode(), buildKeyrefPlugin(), conditionsKey, InsertKind, keyrefsKey, Props, textNode() (+4 more)

### Community 61 - "dita-core/src/index.ts"
Cohesion: 0.17
Nodes (16): computeXmlLineDiffStats(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, PM_NODE_TO_DITA_TAG, slimdomToPmDoc(), countCalsTgroups() (+8 more)

### Community 62 - "block-transforms.ts"
Cohesion: 0.13
Nodes (28): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), getBlockConvertOptions(), INLINE_HOST_TAGS (+20 more)

### Community 63 - "ai-config-and-model.test.ts"
Cohesion: 0.14
Nodes (10): @langchain/core@^1.4.2, AiChatModel, createLangChainModelFactory(), AiConfigTestResult, ADMIN, createApp(), createFixture(), tempDirs (+2 more)

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.24
Nodes (17): AI assistance, 1. `@dita/core` — `src/ai/`, DITA_TOPIC_ROOTS, doctypeSignature(), failedVerification(), failure(), firstElementTagName(), hasModelDecorations() (+9 more)

### Community 65 - "checkXmlWellFormed"
Cohesion: 0.14
Nodes (13): Props, xmlLinter, ditaEditorTheme, ditaHighlightStyle, formatDitaXml(), createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag() (+5 more)

### Community 66 - "createServer"
Cohesion: 0.22
Nodes (4): createServer(), registerSemanticIndexerRoutes(), collectAllFilePaths(), WorkspaceSemanticIndexer

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.10
Nodes (14): DitaDatabaseHandle, migratePublishJobs(), openDatabase(), ADMIN, createApp(), Fixture, readUsage(), SAMPLE_ROOT (+6 more)

### Community 68 - "inline-selection.ts"
Cohesion: 0.19
Nodes (10): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+2 more)

### Community 69 - "xpath.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 70 - "api/src/index.ts"
Cohesion: 0.09
Nodes (28): CreateServerOptions, AiModelFactory, AiService, AiServiceDeps, AiServiceLogger, AiUsageService, AiRouteDeps, failureMessage() (+20 more)

### Community 71 - "lucide-react"
Cohesion: 0.17
Nodes (17): ATTR_BADGE_COLORS, ProfilingAttrEditor(), ProfilingAttrEditorProps, TABS, AttributesPanel(), GROUP_LABELS, findTreeNodeByPath(), GROUP_LABELS (+9 more)

### Community 72 - "git-manager.ts"
Cohesion: 0.14
Nodes (13): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManagerOptions, GitStatusSummary, GitWorktreeInfo (+5 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "en/architecture.md"
Cohesion: 0.07
Nodes (26): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+18 more)

### Community 76 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/merge@^6.12.3, @dita/core@workspace:*, react-dnd-html5-backend@^16.0.1, @codemirror/commands, @codemirror/merge, @dita/core, license (+5 more)

### Community 77 - "AiDiffDialog"
Cohesion: 0.12
Nodes (16): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1. 目标与边界, 2. 端到端架构与数据流, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`）, 3.2 配置优先级与密钥安全, 3. 数据库与配置设计（SQLite + Drizzle）, 6.1 新增模块布局, 6.3 Check-out 独占锁与角色交互矩阵 (+8 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "ai-settings-service.ts"
Cohesion: 0.21
Nodes (12): aiSettings, AiSettingsRow, AI_SETTINGS_ID, AiEnvDefaults, AiSettingsService, maskApiKey(), readAiEnvDefaults(), readEnvInt() (+4 more)

### Community 80 - "en/features.md"
Cohesion: 0.17
Nodes (11): Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps, OASIS CALS tables (+3 more)

### Community 81 - "DocumentSemanticOverlay"
Cohesion: 0.21
Nodes (12): TopicInspectorProps, AttributesPanelProps, VisualSemanticContext, VisualEditorProps, baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec() (+4 more)

### Community 82 - "zh/features.md"
Cohesion: 0.15
Nodes (12): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+4 more)

### Community 83 - "ai-prompt.ts"
Cohesion: 0.20
Nodes (17): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+9 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.18
Nodes (7): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, astro, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "dita-core/src/index.ts"
Cohesion: 0.13
Nodes (24): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics() (+16 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "fragment-locator.ts"
Cohesion: 0.22
Nodes (16): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+8 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (15): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+7 more)

### Community 91 - "publish-service.ts"
Cohesion: 0.12
Nodes (16): DitaDatabase, publishJobs, DitaDiagnostic, fallbackDitaDiagnostic(), CreatePublishJobInput, EXCLUDED_SNAPSHOT_ENTRIES, findFirstPdf(), isInside() (+8 more)

### Community 92 - "dita-runtime.ts"
Cohesion: 0.16
Nodes (23): buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DetectRuntimeOptions, DitaRunOptions (+15 more)

### Community 93 - "Phase 6 AI Assistance — Implementation Contract"
Cohesion: 0.33
Nodes (4): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract

### Community 94 - "ai-fragment.test.ts"
Cohesion: 0.16
Nodes (13): 4.1 文件清单与核心函数, extractTargetFragment(), buildDitaConstraintSummary(), AiExtractOptions, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess (+5 more)

### Community 95 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.20
Nodes (14): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, compactDiff(), computeLineDiff(), DiffLineType, DiffSummary (+6 more)

### Community 97 - "ref_vitest"
Cohesion: 0.06
Nodes (26): resetDitaRuntimeCache(), ADMIN, SAMPLE_ROOT, tempDirs, VIEWER, WRITER_A, WRITER_B, ADMIN (+18 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "strict-validator.ts"
Cohesion: 0.18
Nodes (13): DitaRuntimeInfo, DitaRuntimeOptions, StrictValidationRouteOptions, ensureInside(), resolveDitavalTarget(), resolveValidationTarget(), SingleTargetResult, StrictDiagnostic (+5 more)

### Community 100 - "AGENTS.md"
Cohesion: 0.22
Nodes (6): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), 7. Implementation Roadmap Status

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

### Community 105 - "PublishService"
Cohesion: 0.24
Nodes (4): PublishJobRow, parseDiagnostics(), PublishService, toIso()

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 109 - "Header.astro"
Cohesion: 0.17
Nodes (10): dict, isDocs, isPlayground, nav, navItems, Props, toggle, paths (+2 more)

### Community 110 - "AiSettingsDialog.tsx"
Cohesion: 0.16
Nodes (15): 4.7 AI Assistance Boundaries (Phase 6), close(), useAiStore, AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), InspectorTab, resolveAiApplyMode() (+7 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.20
Nodes (4): MINI_DEMO_XML, PLAYGROUND_PRESETS, PlaygroundKeyspaceFixture, PlaygroundPresetId

### Community 113 - "FileExplorerPanel.tsx"
Cohesion: 0.83
Nodes (3): FileExplorerPanel(), FileIcon(), filterTreeNodes()

### Community 114 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 115 - "sandbox.ts"
Cohesion: 0.20
Nodes (11): PlaygroundPreset, analyseXml(), ConditionRow, conditionRows(), KeyRow, MinimalNode, PROFILING_ATTRIBUTES, safeParseDitaval() (+3 more)

### Community 116 - "DocsLayout.astro"
Cohesion: 0.20
Nodes (9): dict, groups, index, jsonLd, links, path, Props, sections (+1 more)

### Community 117 - "GitHub Pages 免费部署指南（官网 + 离线三栏工作台）"
Cohesion: 0.20
Nodes (7): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 118 - "parser.ts"
Cohesion: 0.24
Nodes (9): 4.2 三种靶向定位与无损回拼策略, 4. `@dita/core` 共享内核扩展设计, lineColumnToOffset(), parseSaxesError(), PositionTrackedSlimdomNode, XmlWellFormedResult, XmlDoctypeInfo, XmlNodeSourceRange (+1 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.25
Nodes (8): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, hasMultipleTgroups()

### Community 122 - "compare.ts"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 123 - "6. 分阶段实施切片（垂直交付，预计 1.5–2 周）"
Cohesion: 0.40
Nodes (5): 6. 分阶段实施切片（垂直交付，预计 1.5–2 周）, Slice 7.1：工程底座、设计系统与 Docker 兼容性适配（第 1–2 天）, Slice 7.2：官网首页（Landing Page）与真实素材升级（第 3–5 天）, Slice 7.4：双语快速上手与部署文档站 + 静态搜索（第 9–11 天）, Slice 7.5：SEO、自动部署流水线与综合验收（第 12–14 天）

### Community 124 - "react@^19.0.0"
Cohesion: 0.33
Nodes (4): react@^19.0.0, tailwindcss@^4.3.5, react, tailwindcss

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 836 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `normalizePosixPath`, `dita-map.ts`, `semantic-indexer.ts`, `editor-store.ts`, `workspace-fs.ts`, `ai-store.ts`, `semantic-engine.ts`, `Changelog`, `核心特性（已实现：Phase 0–3）`, `Core features (Phase 0–6 implemented)`, `dita-core/src/index.ts`, `checkXmlWellFormed`, `xpath.ts`, `en/architecture.md`, `en/features.md`, `zh/features.md`, `e2e-ai-live.mts`, `ai-fragment.test.ts`, `playground-presets.ts`, `sandbox.ts`, `parser.ts`, `4. Non-Negotiable Engineering Invariants`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `ref_react` to `PublishDialog.tsx`, `git-store.ts`, `checkXmlWellFormed`, `3.2 四项关键技术机制`, `lock-helpers.ts`, `lucide-react`, `VisualEditor.tsx`, `web/package.json`, `AiSettingsDialog.tsx`, `FileExplorerPanel.tsx`, `App.tsx`, `dependencies`, `dita-core/src/index.ts`, `semantic-indexer.ts`, `editor-store.ts`, `ai-store.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `checkXmlWellFormed()` (e.g. with `4.3 Source ↔ Visual Transition Safety` and `Editor data flow`) actually correct?**
  _`checkXmlWellFormed()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08880666049953746 - nodes in this community are weakly interconnected._