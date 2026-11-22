# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 239 files · ~200,073 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .dita 24, (none) 5, .ditaval 4)

## Summary
- 2463 nodes · 6237 edges · 120 communities (111 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 277 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cf5199d4`
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
- api/src/index.ts
- dita-map.ts
- BaseLayout.astro
- site/package.json
- semantic-indexer.ts
- scripts
- commands.ts
- editor-store.ts
- WorkspaceManager
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
- web/package.json
- Core features (Phase 0–6 implemented)
- identity-service.ts
- table-commands.ts
- 3.2 四项关键技术机制
- GitManager
- ref_vitest
- dita-core/src/index.ts
- ai-workbench.test.ts
- ai-config-and-model.test.ts
- checkXmlWellFormed
- ditaval.ts
- lucide-react
- phase6-ai-api.test.ts
- inline-selection.ts
- workspace-fs.ts
- ai/routes.ts
- lucide-react
- workspace-api.test.ts
- SearchModal.astro
- docker-entrypoint.sh
- en/architecture.md
- zh/architecture.md
- AiDiffDialog
- devDependencies
- ai-settings-service.ts
- en/features.md
- WorkspaceDialog.tsx
- zh/features.md
- ai-prompt.ts
- astro.config.ts
- en/ai-setup.md
- SourceEditor.tsx
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
- ExplanationStreamFilter
- Added
- scripts
- phase5-publish.test.ts
- FileExplorerPanel.tsx
- zip-store.ts
- DITAEditor
- DITAEditor
- getCurrentUserId
- main.tsx

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
- `7. DITA-OT 4.x 权威校验与异步发布（Phase 5）` --references--> `PublishQueue`  [INFERRED]
  README.md → apps/api/src/modules/publish/publish-queue.ts
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts
- `4. 单一信息源语义引擎（Keys / Conref / DITAVAL）` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.md → apps/web/src/components/ProfilingAttrEditor.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (120 total, 9 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.14
Nodes (28): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+20 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (32): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch(), fetchBranches(), fetchFileAtRevision() (+24 more)

### Community 2 - "converter.ts"
Cohesion: 0.13
Nodes (30): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+22 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.13
Nodes (7): createServer(), registerSemanticIndexerRoutes(), WorkspaceSemanticIndexer, computeMemoryDiagnostics(), normalizePosixPath(), DitaSemanticIndex, findEnclosingTopicInfo()

### Community 4 - "DitaPlayground.tsx"
Cohesion: 0.08
Nodes (26): DiffRow(), DisplayMode, DitaPlayground(), applyPreset(), INSERT_KINDS, presetLabel(), ViewMode, SandboxSourceEditor() (+18 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (37): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/openai@^1.8.4 (+29 more)

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
Cohesion: 0.06
Nodes (14): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaPrologNodeView (+6 more)

### Community 18 - "api/src/index.ts"
Cohesion: 0.09
Nodes (31): DitaRuntimeOptions, isHttpError(), ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, createWorkspaceSchema (+23 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.21
Nodes (29): applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle(), extractElementPlainText() (+21 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (16): dict, Props, LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical, dict (+8 more)

### Community 21 - "site/package.json"
Cohesion: 0.05
Nodes (52): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+44 more)

### Community 22 - "semantic-indexer.ts"
Cohesion: 0.11
Nodes (27): WorkspaceDitavalSummary, WorkspaceMapSummary, BranchIndexState, collectAllFilePaths(), SemanticContextResponse, VisualSemanticContext, CreateDitaNodeViewsOptions, BuildCompositeMapTreeOptions (+19 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.20
Nodes (19): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+11 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.11
Nodes (34): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceDir(), createWorkspaceFile(), createWorkspaceProject(), deleteWorkspaceEntry(), fetchFileContent(), fetchParsedDitaval() (+26 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.17
Nodes (7): registerWorkspaceFileRoutes(), resolveSafeWorkspacePathFor(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError

### Community 27 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.06
Nodes (36): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+28 more)

### Community 30 - "ai-store.ts"
Cohesion: 0.09
Nodes (45): AiStreamHandlers, fetchAiConfig(), fetchAiUsage(), ParsedSseFrame, saveAiConfig(), testAiConfig(), AiChatMessage, AiPanelIntent (+37 more)

### Community 31 - "serializer.ts"
Cohesion: 0.11
Nodes (31): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind, isBlockElementName(), isInlineElementName() (+23 more)

### Community 32 - "dita-rules.ts"
Cohesion: 0.12
Nodes (14): COMMON_ATTRIBUTES, BODY_BLOCKS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DITA_ELEMENT_SPECS, DitaElementCategory, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS (+6 more)

### Community 33 - "decorations.ts"
Cohesion: 0.11
Nodes (27): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, collectDitaDecorations() (+19 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (27): 4.6.1 Static Site Invariants (`apps/site`, Phase 7), anchor(), columns, dict, home, Props, year, dict (+19 more)

### Community 35 - "3.2 四项关键技术机制"
Cohesion: 0.12
Nodes (21): AiSettingsDialog(), formatNumber(), CheckinCandidate, CheckinDialog(), CheckinDialogProps, DiffDialog(), revisionLabel(), diffTheme (+13 more)

### Community 36 - "lock-helpers.ts"
Cohesion: 0.23
Nodes (10): LockStatusBarProps, stateStyles, FileLock, IdentityRole, describeLock(), FileEditability, LockLike, ResolveEditabilityInput (+2 more)

### Community 37 - "modules/ai/types.ts"
Cohesion: 0.10
Nodes (29): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey() (+21 more)

### Community 38 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 39 - "semantic-engine.ts"
Cohesion: 0.11
Nodes (32): KeyspacePanelProps, extractProfilingValuesFromDocument(), basenamePosix(), IMAGE_EXTENSIONS, ResolvedDitaHref, DITA_TOPIC_ROOT_TAGS, cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT (+24 more)

### Community 40 - "快速开始"
Cohesion: 0.29
Nodes (7): 后端环境变量（`@dita/api`）, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT）, 方式二：本地源码 + 本机 DITA-OT, 本机 DITA-OT 配置, 环境要求

### Community 41 - "DocsLayout.astro"
Cohesion: 0.08
Nodes (20): bySlug, dict, groups, Props, paths, Props, collections, docs (+12 more)

### Community 42 - "VisualEditor.tsx"
Cohesion: 0.08
Nodes (50): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps() (+42 more)

### Community 43 - "devDependencies"
Cohesion: 0.12
Nodes (13): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+5 more)

### Community 44 - "Getting started"
Cohesion: 0.29
Nodes (7): Backend environment variables (`@dita/api`), Getting started, Host DITA-OT setup, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT, Option 3: Editing and semantic authoring only (no DITA-OT), Requirements

### Community 45 - "ai-service.ts"
Cohesion: 0.13
Nodes (25): AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), createExplanationStreamFilter(), parseAiOutput() (+17 more)

### Community 46 - "ref_react"
Cohesion: 0.11
Nodes (19): EditorTabBar(), TAB_TYPE_BADGE, LeftSidebar(), LeftSidebarProps, LockStatusBar(), ProblemsPanel(), SOURCE_LABELS, WorkbenchHeader() (+11 more)

### Community 47 - "Changelog"
Cohesion: 0.12
Nodes (16): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, Added, Added, Added, Changed (+8 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.09
Nodes (20): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+12 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "HttpError"
Cohesion: 0.09
Nodes (33): requireAdmin(), HttpError, WorkspaceRouteSecurity, validateBranchName(), branchSchema, commitSchema, createBranchSchema, GitRouteOptions (+25 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.25
Nodes (8): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 核心特性（已实现：Phase 0–6）

### Community 52 - "i18n/index.ts"
Cohesion: 0.15
Nodes (15): en, DICTIONARIES, getDictionary(), isLocale(), DEFAULT_LOCALE, LOCALES, zh, dict (+7 more)

### Community 53 - "App.tsx"
Cohesion: 0.09
Nodes (36): App(), InsertKeyrefDialog(), InsertKeyrefDialogProps, KeyspacePanel(), NewMapDialog(), DEFAULT_DIR_FOR_TYPE, NewTopicDialog(), NewTopicDialogProps (+28 more)

### Community 54 - "web/package.json"
Cohesion: 0.04
Nodes (65): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+57 more)

### Community 55 - "Core features (Phase 0–6 implemented)"
Cohesion: 0.25
Nodes (8): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5), Core features (Phase 0–6 implemented)

### Community 56 - "identity-service.ts"
Cohesion: 0.11
Nodes (23): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), FileLockRow, fileLocks, LockBackupRow, lockBackups (+15 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.24
Nodes (22): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+14 more)

### Community 58 - "3.2 四项关键技术机制"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 59 - "GitManager"
Cohesion: 0.14
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "ref_vitest"
Cohesion: 0.09
Nodes (20): buildConditionPlugin(), buildInsertNode(), buildKeyrefPlugin(), conditionsKey, InsertKind, keyrefsKey, Props, SandboxVisualEditor() (+12 more)

### Community 61 - "dita-core/src/index.ts"
Cohesion: 0.16
Nodes (15): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncVisualToSource(), VisualToSourceResult, PM_NODE_TO_DITA_TAG, countCalsTgroups(), findDirectElementIndexInPmParent() (+7 more)

### Community 62 - "ai-workbench.test.ts"
Cohesion: 0.14
Nodes (22): resetAiStore(), useAiStore, AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, AiTargetScope, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget() (+14 more)

### Community 63 - "ai-config-and-model.test.ts"
Cohesion: 0.14
Nodes (9): @langchain/core@^1.4.2, AiChatModel, AiConfigTestResult, ADMIN, createApp(), createFixture(), tempDirs, WRITER (+1 more)

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.15
Nodes (27): AI assistance, 1. `@dita/core` — `src/ai/`, 4.2 三种靶向定位与无损回拼策略, DITA_TOPIC_ROOTS, doctypeSignature(), failedVerification(), failure(), firstElementTagName() (+19 more)

### Community 65 - "ditaval.ts"
Cohesion: 0.11
Nodes (26): summarizeDitaval(), buildCompositeMapTree(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), ConditionGroup (+18 more)

### Community 66 - "lucide-react"
Cohesion: 0.26
Nodes (12): EditorTabBarProps, IdentitySwitcher(), IdentitySwitcherProps, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY, IdentityResponse, IdentityRoleInfo, IdentityUser (+4 more)

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.10
Nodes (13): AiDonePayload, AiProposal, ADMIN, createApp(), Fixture, readUsage(), SAMPLE_ROOT, SseFrame (+5 more)

### Community 68 - "inline-selection.ts"
Cohesion: 0.29
Nodes (10): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+2 more)

### Community 69 - "workspace-fs.ts"
Cohesion: 0.11
Nodes (20): countMapTreeNodes(), FileContentResult, findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), sanitizeWorkspaceDirName() (+12 more)

### Community 70 - "ai/routes.ts"
Cohesion: 0.16
Nodes (16): CreateServerOptions, AiModelFactory, AiService, AiServiceDeps, AiServiceLogger, AiUsageService, AiRouteDeps, failureMessage() (+8 more)

### Community 71 - "lucide-react"
Cohesion: 0.14
Nodes (23): ATTR_BADGE_COLORS, ProfilingAttrEditor(), InspectorTab, TABS, TopicInspector(), TopicInspectorProps, AttributesPanel(), AttributesPanelProps (+15 more)

### Community 72 - "workspace-api.test.ts"
Cohesion: 0.19
Nodes (11): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions (+3 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 76 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 77 - "AiDiffDialog"
Cohesion: 0.11
Nodes (21): AiDiffDialog(), resolveFileEditability(), resolveAiApplyMode(), 4. Web wiring, 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1. 目标与边界, 2. 端到端架构与数据流, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+13 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "ai-settings-service.ts"
Cohesion: 0.19
Nodes (13): aiSettings, AiSettingsRow, createLangChainModelFactory(), AI_SETTINGS_ID, AiEnvDefaults, AiSettingsService, maskApiKey(), readAiEnvDefaults() (+5 more)

### Community 80 - "en/features.md"
Cohesion: 0.17
Nodes (11): Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps, OASIS CALS tables (+3 more)

### Community 81 - "WorkspaceDialog.tsx"
Cohesion: 0.17
Nodes (14): NewMapDialogProps, ProblemsPanelProps, arrayBufferToBase64(), formatRelativeTime(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialogProps, WorkspaceRowBody() (+6 more)

### Community 82 - "zh/features.md"
Cohesion: 0.15
Nodes (12): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+4 more)

### Community 83 - "ai-prompt.ts"
Cohesion: 0.20
Nodes (17): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+9 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.22
Nodes (6): astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, astro, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "SourceEditor.tsx"
Cohesion: 0.08
Nodes (32): Props, xmlLinter, ditaEditorTheme, ditaHighlightStyle, buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic (+24 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "fragment-locator.ts"
Cohesion: 0.18
Nodes (20): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+12 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (15): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+7 more)

### Community 91 - "publish-service.ts"
Cohesion: 0.15
Nodes (15): publishJobs, DitaDiagnostic, CreatePublishJobInput, EXCLUDED_SNAPSHOT_ENTRIES, findFirstPdf(), isInside(), parseDiagnostics(), PublishFormat (+7 more)

### Community 92 - "dita-runtime.ts"
Cohesion: 0.18
Nodes (19): buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DetectRuntimeOptions, DitaRunOptions (+11 more)

### Community 93 - "Phase 6 AI Assistance — Implementation Contract"
Cohesion: 0.33
Nodes (4): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract

### Community 94 - "ai-fragment.test.ts"
Cohesion: 0.18
Nodes (10): 4.1 文件清单与核心函数, 4. `@dita/core` 共享内核扩展设计, AiExtractOptions, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport (+2 more)

### Community 95 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.15
Nodes (16): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, computeLineDiff(), DiffLine, DiffLineType (+8 more)

### Community 97 - "ref_vitest"
Cohesion: 0.06
Nodes (29): 4.4 OASIS CALS Table Fidelity, ADMIN, SAMPLE_ROOT, tempDirs, VIEWER, WRITER_A, WRITER_B, SAMPLE_ROOT (+21 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "strict-validator.ts"
Cohesion: 0.23
Nodes (12): fallbackDitaDiagnostic(), DitaRuntimeInfo, ensureInside(), resolveDitavalTarget(), resolveValidationTarget(), SingleTargetResult, StrictDiagnostic, StrictValidationResult (+4 more)

### Community 100 - "AGENTS.md"
Cohesion: 0.29
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

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 110 - "Added"
Cohesion: 0.15
Nodes (14): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4.7 AI Assistance Boundaries (Phase 6), 4. Non-Negotiable Engineering Invariants, close() (+6 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "phase5-publish.test.ts"
Cohesion: 0.20
Nodes (8): resetDitaRuntimeCache(), ADMIN, createApp(), PLUGIN_DIR, SAMPLE_ROOT, tempDirs, VIEWER, WRITER

### Community 113 - "FileExplorerPanel.tsx"
Cohesion: 0.39
Nodes (7): FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), PublishDialogProps, WorkspaceFileNode, WorkspaceMapSummary

### Community 114 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 115 - "DITAEditor"
Cohesion: 0.33
Nodes (6): DITAEditor, 仓库目录结构, 实施路线图（Roadmap）, 开发、构建与测试, 系统架构与技术栈, 许可证

### Community 116 - "DITAEditor"
Cohesion: 0.33
Nodes (6): Architecture and technology stack, Develop, build, and test, DITAEditor, License, Repository layout, Roadmap

### Community 117 - "getCurrentUserId"
Cohesion: 0.40
Nodes (5): abortError(), dispatchFrame(), parseAiSseFrame(), streamAiRequest(), getCurrentUserId()

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 797 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lucide-react` connect `lucide-react` to `PublishDialog.tsx`, `lucide-react`, `3.2 四项关键技术机制`, `lock-helpers.ts`, `VisualEditor.tsx`, `ref_react`, `FileExplorerPanel.tsx`, `WorkspaceDialog.tsx`, `App.tsx`, `web/package.json`, `ai-store.ts`, `SourceEditor.tsx`, `semantic-indexer.ts`, `ai-workbench.test.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13911290322580644 - nodes in this community are weakly interconnected._
- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `normalizePosixPath`, `DitaPlayground.tsx`, `dita-map.ts`, `editor-store.ts`, `WorkspaceManager`, `semantic-engine.ts`, `Changelog`, `核心特性（已实现：Phase 0–3）`, `Core features (Phase 0–6 implemented)`, `dita-core/src/index.ts`, `ai-workbench.test.ts`, `ditaval.ts`, `workspace-fs.ts`, `en/architecture.md`, `zh/architecture.md`, `en/features.md`, `zh/features.md`, `SourceEditor.tsx`, `e2e-ai-live.mts`, `ai-fragment.test.ts`, `ref_vitest`, `Added`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `checkXmlWellFormed()` (e.g. with `4.3 Source ↔ Visual Transition Safety` and `Editor data flow`) actually correct?**
  _`checkXmlWellFormed()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1092436974789916 - nodes in this community are weakly interconnected._