# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 242 files · ~200,481 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .dita 24, (none) 5, .ditaval 4)

## Summary
- 2494 nodes · 6260 edges · 135 communities (108 shown, 27 thin omitted)
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
- web/package.json
- dita-map.ts
- BaseLayout.astro
- site/package.json
- map-tree-utils.ts
- scripts
- commands.ts
- editor-store.ts
- WorkspaceManager
- dita-log-parser.ts
- deploy-site.yml
- LockService
- ai-store.ts
- serializer.ts
- block-transforms.ts
- decorations.ts
- locales.ts
- content.d.ts
- lock-helpers.ts
- modules/ai/types.ts
- DITAEditor
- keyspace.ts
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
- ref_vitest
- helpers.ts
- xml-bridge.ts
- AiChatModel
- checkXmlWellFormed
- ditaval.ts
- lucide-react
- phase6-ai-api.test.ts
- inline-selection.ts
- semantic-engine.ts
- ai-usage-service.ts
- semantic-indexer.ts
- workspace-api.test.ts
- SearchModal.astro
- docker-entrypoint.sh
- en/architecture.md
- zh/architecture.md
- AiDiffDialog
- devDependencies
- AttributesPanel.tsx
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
- strict-validator.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- ai-fragment.test.ts
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- ConrefReusePanel.tsx
- api/src/index.ts
- en/getting-started.md
- compare.ts
- 4. Non-Negotiable Engineering Invariants
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- [0.5.0] — 2026-11-21
- zh/introduction.md
- zh/local-development.md
- ai-context.ts
- ai-output-parser.ts
- Added
- scripts
- prosemirror-commands@^1.7.2
- prosemirror-history@^1.5.2
- react-dom@^19.0.0
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
- `7. DITA-OT 4.x 权威校验与异步发布（Phase 5）` --references--> `PublishQueue`  [INFERRED]
  README.md → apps/api/src/modules/publish/publish-queue.ts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts
- `4. 单一信息源语义引擎（Keys / Conref / DITAVAL）` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `4. Single-sourcing semantic engine (Keys / Conref / DITAVAL)` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.en.md → apps/web/src/components/ProfilingAttrEditor.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (135 total, 27 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.13
Nodes (31): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+23 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (33): CheckinCandidate, CheckinDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch(), fetchBranches() (+25 more)

### Community 2 - "converter.ts"
Cohesion: 0.13
Nodes (30): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+22 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.11
Nodes (14): registerSemanticIndexerRoutes(), collectAllFilePaths(), summarizeDitaval(), collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind() (+6 more)

### Community 4 - "DitaPlayground.tsx"
Cohesion: 0.06
Nodes (41): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, DiffRow(), DisplayMode, DitaPlayground(), applyPreset() (+33 more)

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
Cohesion: 0.07
Nodes (16): updateNodeRawAttr(), CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView (+8 more)

### Community 18 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/merge@^6.12.3, @dita/core@workspace:*, react-dnd-html5-backend@^16.0.1, @codemirror/commands, @codemirror/merge, @dita/core, license (+5 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.17
Nodes (32): extractTitleSafe(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle() (+24 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.13
Nodes (16): LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical, dict, ogImage, Props (+8 more)

### Community 21 - "site/package.json"
Cohesion: 0.06
Nodes (46): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+38 more)

### Community 22 - "map-tree-utils.ts"
Cohesion: 0.15
Nodes (23): VisualSemanticContext, buildCompositeMapTree(), BuildCompositeMapTreeOptions, CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult (+15 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.20
Nodes (19): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+11 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.09
Nodes (40): FileContentResult, WorkspaceFileNode, FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace() (+32 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.08
Nodes (24): registerWorkspaceFileRoutes(), countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), sanitizeWorkspaceDirName() (+16 more)

### Community 27 - "dita-log-parser.ts"
Cohesion: 0.11
Nodes (21): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+13 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.06
Nodes (36): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+28 more)

### Community 29 - "LockService"
Cohesion: 0.34
Nodes (3): IdentityUser, LockService, Phase4Scope

### Community 30 - "ai-store.ts"
Cohesion: 0.06
Nodes (71): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+63 more)

### Community 31 - "serializer.ts"
Cohesion: 0.14
Nodes (24): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+16 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.08
Nodes (29): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), INLINE_HOST_TAGS (+21 more)

### Community 33 - "decorations.ts"
Cohesion: 0.11
Nodes (26): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, BlockGapOpenMenuPayload (+18 more)

### Community 34 - "locales.ts"
Cohesion: 0.13
Nodes (28): 4.6.1 Static Site Invariants (`apps/site`, Phase 7), anchor(), columns, dict, home, Props, year, dict (+20 more)

### Community 35 - "content.d.ts"
Cohesion: 0.06
Nodes (30): AllValuesOf, AnyEntryMap, astro:content, CollectionEntry, CollectionKey, ContentCollectionKey, ContentConfig, ContentEntryMap (+22 more)

### Community 36 - "lock-helpers.ts"
Cohesion: 0.24
Nodes (9): LockStatusBarProps, stateStyles, IdentityRole, describeLock(), FileEditability, LockLike, ResolveEditabilityInput, ResolveAiApplyModeInput (+1 more)

### Community 37 - "modules/ai/types.ts"
Cohesion: 0.12
Nodes (20): AiConfigTestInput, aiConfigTestSchema, aiConfigUpdateSchema, aiDiagnosticSchema, AiDonePayload, aiHistoryTurnSchema, AiMetaPayload, AiProposal (+12 more)

### Community 38 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 39 - "keyspace.ts"
Cohesion: 0.17
Nodes (16): KeyspacePanelProps, BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText(), findDirectChild(), getNormalizedText(), isSubmapReference() (+8 more)

### Community 40 - "快速开始"
Cohesion: 0.15
Nodes (13): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT） (+5 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.09
Nodes (20): bySlug, dict, groups, Props, paths, Props, Props, DOC_SLUGS (+12 more)

### Community 42 - "VisualEditor.tsx"
Cohesion: 0.17
Nodes (15): computeBlockGaps(), findBlockHandleTarget(), planBlockMove(), BlockHandle(), convertDitaBlockAtPos(), deleteDitaNodeAtPos(), duplicateDitaBlockAtPos(), moveDitaBlockToGap() (+7 more)

### Community 43 - "devDependencies"
Cohesion: 0.12
Nodes (13): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+5 more)

### Community 44 - "Getting started"
Cohesion: 0.15
Nodes (13): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+5 more)

### Community 45 - "ai-service.ts"
Cohesion: 0.20
Nodes (16): createExplanationStreamFilter(), AiStreamContext, buildChangesSummary(), buildProposal(), chunkText(), collectTagNames(), countLines(), DITA_TOPIC_ROOT_TAGS (+8 more)

### Community 46 - "ref_react"
Cohesion: 0.07
Nodes (29): EditorTabBarProps, TAB_TYPE_BADGE, InsertKeyrefDialogProps, LeftSidebarProps, NewMapDialogProps, DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext (+21 more)

### Community 47 - "Changelog"
Cohesion: 0.15
Nodes (11): [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, Added, Added, Changed, Changed, Changed (+3 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.10
Nodes (18): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+10 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (22): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+14 more)

### Community 50 - "HttpError"
Cohesion: 0.07
Nodes (47): HttpError, isHttpError(), ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, createWorkspaceSchema (+39 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.25
Nodes (8): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 核心特性（已实现：Phase 0–6）

### Community 52 - "i18n/index.ts"
Cohesion: 0.18
Nodes (13): en, DICTIONARIES, getDictionary(), isLocale(), DEFAULT_LOCALE, LOCALES, zh, dict (+5 more)

### Community 53 - "App.tsx"
Cohesion: 0.09
Nodes (49): useAiStore, AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), App(), CheckinDialog(), EditorTabBar(), IdentitySwitcher() (+41 more)

### Community 54 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/lint@^6.9.8, lucide-react@^1.76.0, prosemirror-gapcursor@^1.4.1, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0, react@^19.0.0 (+9 more)

### Community 55 - "Core features (Phase 0–6 implemented)"
Cohesion: 0.25
Nodes (8): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 8. AI-assisted writing, semantic tag optimization, and error repair (Phase 6), Core features (Phase 0–6 implemented)

### Community 56 - "identity-service.ts"
Cohesion: 0.07
Nodes (36): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, FileLockRow, fileLocks (+28 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.25
Nodes (21): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+13 more)

### Community 58 - "3.2 四项关键技术机制"
Cohesion: 0.13
Nodes (15): GitPanel(), GitPanelProps, shortDate(), DitaDecorationMeta, DitaDecorationPluginState, TagDisplayMode, 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界 (+7 more)

### Community 59 - "GitManager"
Cohesion: 0.13
Nodes (15): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+7 more)

### Community 60 - "ref_vitest"
Cohesion: 0.07
Nodes (17): buildConditionPlugin(), buildInsertNode(), conditionsKey, InsertKind, Props, textNode(), findBoldPos(), buildState() (+9 more)

### Community 61 - "helpers.ts"
Cohesion: 0.17
Nodes (21): getBlockConvertOptions(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot(), isInlineTagAllowedAtSelection(), makeBreadcrumbItem() (+13 more)

### Community 62 - "xml-bridge.ts"
Cohesion: 0.39
Nodes (6): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.22
Nodes (18): 1. `@dita/core` — `src/ai/`, 4.2 三种靶向定位与无损回拼策略, DITA_TOPIC_ROOTS, doctypeSignature(), failedVerification(), failure(), firstElementTagName(), hasModelDecorations() (+10 more)

### Community 65 - "ditaval.ts"
Cohesion: 0.14
Nodes (19): ATTR_BADGE_COLORS, ProfilingAttrEditor(), ProfilingAttrEditorProps, ConditionGroup, createDitavalTemplate(), DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle (+11 more)

### Community 66 - "lucide-react"
Cohesion: 0.29
Nodes (10): IdentitySwitcherProps, PublishDialogProps, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY, IdentityResponse, IdentityRoleInfo, IdentityUser, ROLE_LABELS (+2 more)

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.12
Nodes (11): ADMIN, createApp(), Fixture, readUsage(), SAMPLE_ROOT, SseFrame, stream(), tempDirs (+3 more)

### Community 68 - "inline-selection.ts"
Cohesion: 0.19
Nodes (15): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, InlineBubbleInfo (+7 more)

### Community 69 - "semantic-engine.ts"
Cohesion: 0.10
Nodes (35): extractProfilingValuesFromDocument(), DITA_TOPIC_ROOT_TAGS, cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild(), findTopicIdForElement(), getNormalizedText() (+27 more)

### Community 70 - "ai-usage-service.ts"
Cohesion: 0.19
Nodes (13): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey() (+5 more)

### Community 71 - "semantic-indexer.ts"
Cohesion: 0.15
Nodes (27): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, ConrefReusePanelProps, TopicInspectorProps, SourceSemanticCompletionContext, SourceEditorProps, AttributesPanelProps (+19 more)

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
Cohesion: 0.10
Nodes (25): 4.7 AI Assistance Boundaries (Phase 6), AiDiffDialog(), DiffDialog(), DiffDialogProps, revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps (+17 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "AttributesPanel.tsx"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 80 - "en/features.md"
Cohesion: 0.15
Nodes (12): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps (+4 more)

### Community 81 - "WorkspaceDialog.tsx"
Cohesion: 0.31
Nodes (9): arrayBufferToBase64(), formatRelativeTime(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceDialogProps, WorkspaceRowBody(), WorkspaceListItem (+1 more)

### Community 82 - "zh/features.md"
Cohesion: 0.15
Nodes (12): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+4 more)

### Community 83 - "ai-prompt.ts"
Cohesion: 0.20
Nodes (17): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+9 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.17
Nodes (8): astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, collections, docs, astro, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "SourceEditor.tsx"
Cohesion: 0.12
Nodes (14): Props, xmlLinter, ditaEditorTheme, ditaHighlightStyle, createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag(), PROFILING_ATTR_SET (+6 more)

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
Cohesion: 0.07
Nodes (25): PublishJobRow, publishJobs, DitaDiagnostic, PublishQueue, PublishQueueOptions, CreatePublishJobInput, EXCLUDED_SNAPSHOT_ENTRIES, findFirstPdf() (+17 more)

### Community 92 - "strict-validator.ts"
Cohesion: 0.10
Nodes (37): fallbackDitaDiagnostic(), buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DetectRuntimeOptions (+29 more)

### Community 93 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.14
Nodes (12): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract, 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1. 目标与边界, 2. 端到端架构与数据流, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+4 more)

### Community 94 - "ai-fragment.test.ts"
Cohesion: 0.14
Nodes (14): 4.1 文件清单与核心函数, extractTargetFragment(), buildDitaConstraintSummary(), COMMON_ATTRIBUTES, AiExtractOptions, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult (+6 more)

### Community 95 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 96 - "ConrefReusePanel.tsx"
Cohesion: 0.28
Nodes (9): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, areConrefTagsCompatible() (+1 more)

### Community 97 - "api/src/index.ts"
Cohesion: 0.05
Nodes (46): @langchain/core@^1.4.2, createServer(), CreateServerOptions, AiModelFactory, createLangChainModelFactory(), AiService, AiServiceDeps, AiServiceLogger (+38 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "compare.ts"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 100 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.13
Nodes (14): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas (+6 more)

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

### Community 105 - "[0.5.0] — 2026-11-21"
Cohesion: 0.40
Nodes (5): [0.5.0] — 2026-11-21, Added, Changed, Known limitations, Removed

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "ai-context.ts"
Cohesion: 0.43
Nodes (6): AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice()

### Community 109 - "ai-output-parser.ts"
Cohesion: 0.33
Nodes (4): ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags()

### Community 110 - "Added"
Cohesion: 0.33
Nodes (7): close(), element(), [1.0.0] — 2026-11-22, Added, Changed, Fixed, Phase 6 概要

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 829 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `semantic-engine.ts` to `normalizePosixPath`, `DitaPlayground.tsx`, `dita-map.ts`, `map-tree-utils.ts`, `editor-store.ts`, `WorkspaceManager`, `ai-store.ts`, `核心特性（已实现：Phase 0–3）`, `Core features (Phase 0–6 implemented)`, `xml-bridge.ts`, `checkXmlWellFormed`, `ditaval.ts`, `en/architecture.md`, `zh/architecture.md`, `en/features.md`, `zh/features.md`, `SourceEditor.tsx`, `e2e-ai-live.mts`, `ai-fragment.test.ts`, `4. Non-Negotiable Engineering Invariants`, `[0.5.0] — 2026-11-21`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12857142857142856 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `ref_react` to `PublishDialog.tsx`, `git-store.ts`, `web/package.json`, `map-tree-utils.ts`, `editor-store.ts`, `ai-store.ts`, `block-transforms.ts`, `lock-helpers.ts`, `VisualEditor.tsx`, `App.tsx`, `dependencies`, `3.2 四项关键技术机制`, `ditaval.ts`, `lucide-react`, `inline-selection.ts`, `semantic-indexer.ts`, `AiDiffDialog`, `WorkspaceDialog.tsx`, `SourceEditor.tsx`, `ConrefReusePanel.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `checkXmlWellFormed()` (e.g. with `4.3 Source ↔ Visual Transition Safety` and `Editor data flow`) actually correct?**
  _`checkXmlWellFormed()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11261261261261261 - nodes in this community are weakly interconnected._