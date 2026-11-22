# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 180 files · ~173,396 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 36 file(s) not represented in the graph (top: .dita 21, (none) 4, .xml 3)

## Summary
- 1899 nodes · 5267 edges · 93 communities (84 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 179 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `08141413`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- converter.ts
- normalizePosixPath
- ai-settings-service.ts
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
- DITAEditor
- ai/routes.ts
- map-tree-utils.ts
- scripts
- commands.ts
- editor-store.ts
- WorkspaceManager
- dita-log-parser.ts
- PublishQueue
- LockService
- ai-store.ts
- serializer.ts
- block-transforms.ts
- decorations.ts
- xpath.ts
- zip-store.ts
- lock-helpers.ts
- modules/ai/types.ts
- DITAEditor
- keyspace.ts
- 快速开始
- AGENTS.md
- VisualEditor.tsx
- devDependencies
- Getting started
- ai-service.ts
- lucide-react
- Changelog
- PublishService
- dita-elements.ts
- HttpError
- 核心特性（已实现：Phase 0–3）
- DocumentSemanticOverlay
- App.tsx
- .getOrInitBranch
- Core features (Phase 0–6 implemented)
- identity-service.ts
- table-commands.ts
- buildDitaConstraintSummary
- GitManager
- dita-core/src/index.ts
- helpers.ts
- checkXmlWellFormed
- ai-config-and-model.test.ts
- checkXmlWellFormed
- ditaval.ts
- lucide-react
- phase6-ai-api.test.ts
- DitaDatabase
- semantic-engine.ts
- semantic-indexer.ts
- docker-entrypoint.sh
- AiDiffDialog
- AttributesPanel.tsx
- dita-runtime.ts
- WorkspaceDialog.tsx
- ai-prompt.ts
- dita-completion.ts
- fragment-locator.ts
- e2e-ai-live.mts
- publish-service.ts
- strict-validator.ts
- Phase 6 AI Assistance — Implementation Contract
- ai-fragment.test.ts
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- ConrefReusePanel.tsx
- api/src/index.ts
- api/src/index.ts
- compare.ts
- 4. Non-Negotiable Engineering Invariants
- 界面预览
- [0.5.0] — 2026-11-21

## God Nodes (most connected - your core abstractions)
1. `App()` - 47 edges
2. `WorkspaceManager` - 46 edges
3. `requestJson()` - 45 edges
4. `lucide-react` - 42 edges
5. `createServer()` - 41 edges
6. `HttpError` - 41 edges
7. `parseXml()` - 41 edges
8. `react` - 40 edges
9. `normalizePosixPath()` - 33 edges
10. `checkXmlWellFormed()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `7. DITA-OT 4.x 权威校验与异步发布（Phase 5）` --references--> `PublishQueue`  [INFERRED]
  README.md → apps/api/src/modules/publish/publish-queue.ts
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts
- `6) 自动校验失败后的纠错重试提示词（`RETRY_CORRECTION_PROMPT`）` --references--> `spliceAndVerifyAiXml()`  [INFERRED]
  docs/phase6-ai-implementation-plan.md → packages/dita-core/src/ai/fragment-splice.ts
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (93 total, 9 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.12
Nodes (33): zustand@^5.1.0, JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META (+25 more)

### Community 1 - "git-store.ts"
Cohesion: 0.10
Nodes (35): DiffDialogProps, GitPanel(), GitPanelProps, shortDate(), cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile() (+27 more)

### Community 2 - "converter.ts"
Cohesion: 0.11
Nodes (34): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+26 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.21
Nodes (6): collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, classifyDitaFileKind(), normalizePosixPath(), DitaSemanticIndex

### Community 4 - "ai-settings-service.ts"
Cohesion: 0.20
Nodes (13): aiSettings, AiSettingsRow, AiServiceDeps, AI_SETTINGS_ID, AiEnvDefaults, AiSettingsService, maskApiKey(), readAiEnvDefaults() (+5 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (36): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2 (+28 more)

### Community 7 - "Root Monorepo Manifest"
Cohesion: 0.12
Nodes (18): devDependencies, turbo@^2.5.0, typescript@^5.8.0, vitest@^3.1.0, engines, node, typescript, vitest (+10 more)

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
Cohesion: 0.40
Nodes (4): allowBuilds, better-sqlite3, esbuild, packages

### Community 17 - "table-commands.ts"
Cohesion: 0.07
Nodes (15): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView (+7 more)

### Community 18 - "web/package.json"
Cohesion: 0.06
Nodes (47): dependencies, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, @dita/core@workspace:*, @lezer/highlight@^1.2.5 (+39 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.18
Nodes (29): tempDirs, extractTitleSafe(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo (+21 more)

### Community 20 - "DITAEditor"
Cohesion: 0.25
Nodes (7): Architecture and technology stack, Develop, build, and test, DITAEditor, Repository layout, Roadmap, Workspace, semantics, and asset REST API, Workspace、Semantics & Asset REST API 速览

### Community 21 - "ai/routes.ts"
Cohesion: 0.17
Nodes (14): AiService, AiServiceLogger, AiUsageService, AiRouteDeps, failureMessage(), parseBody(), registerAiRoutes(), requireAdmin() (+6 more)

### Community 22 - "map-tree-utils.ts"
Cohesion: 0.06
Nodes (53): ATTR_BADGE_COLORS, ProfilingAttrEditor(), ProfilingAttrEditorProps, AttributesPanel(), GROUP_LABELS, VisualSemanticContext, buildCompositeMapTree(), BuildCompositeMapTreeOptions (+45 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.12
Nodes (31): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+23 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.08
Nodes (47): FileContentResult, WorkspaceFileNode, FileExplorerPanelProps, ProblemsPanelProps, SOURCE_LABELS, PublishDialogProps, WorkspaceDialogProps, getCurrentUserId() (+39 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.06
Nodes (43): createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema, mkdirSchema, openWorkspaceSchema, registerWorkspaceFileRoutes(), renameSchema (+35 more)

### Community 27 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 29 - "LockService"
Cohesion: 0.32
Nodes (3): FileLockRow, IdentityUser, LockService

### Community 30 - "ai-store.ts"
Cohesion: 0.06
Nodes (68): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+60 more)

### Community 31 - "serializer.ts"
Cohesion: 0.28
Nodes (15): isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), escapeXmlAttr(), escapeXmlText(), formatDoctype(), hasBlockChildren(), hasNonWhitespaceTextOrInline() (+7 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.15
Nodes (17): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), INLINE_HOST_TAGS (+9 more)

### Community 33 - "decorations.ts"
Cohesion: 0.12
Nodes (24): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, BlockGapOpenMenuPayload (+16 more)

### Community 34 - "xpath.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 35 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 36 - "lock-helpers.ts"
Cohesion: 0.21
Nodes (11): CheckinCandidate, LockStatusBarProps, stateStyles, FileLock, IdentityRole, describeLock(), FileEditability, LockLike (+3 more)

### Community 37 - "modules/ai/types.ts"
Cohesion: 0.10
Nodes (30): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey() (+22 more)

### Community 38 - "DITAEditor"
Cohesion: 0.33
Nodes (6): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 39 - "keyspace.ts"
Cohesion: 0.21
Nodes (14): basenamePosix(), computeRelativeDitaHref(), dirnamePosix(), IMAGE_EXTENSIONS, ResolvedDitaHref, resolveDitaHref(), BfsFrame, buildKeyspace() (+6 more)

### Community 40 - "快速开始"
Cohesion: 0.29
Nodes (7): 后端环境变量（`@dita/api`）, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT）, 方式二：本地源码 + 本机 DITA-OT, 本机 DITA-OT 配置, 环境要求

### Community 41 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), 7. Implementation Roadmap Status

### Community 42 - "VisualEditor.tsx"
Cohesion: 0.13
Nodes (32): findBlockHandleTarget(), getBlockConvertOptions(), planBlockMove(), BlockHandle(), convertDitaBlockAtPos(), deleteDitaNodeAtPos(), duplicateDitaBlockAtPos(), moveDitaBlockToGap() (+24 more)

### Community 43 - "devDependencies"
Cohesion: 0.12
Nodes (15): @tailwindcss/vite@^4.3.5, devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0 (+7 more)

### Community 44 - "Getting started"
Cohesion: 0.29
Nodes (7): Backend environment variables (`@dita/api`), Getting started, Host DITA-OT setup, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT, Option 3: Editing and semantic authoring only (no DITA-OT), Requirements

### Community 45 - "ai-service.ts"
Cohesion: 0.11
Nodes (26): AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), createExplanationStreamFilter(), ExplanationStreamFilter (+18 more)

### Community 46 - "lucide-react"
Cohesion: 0.11
Nodes (20): FileExplorerPanel(), FileIcon(), filterTreeNodes(), LeftSidebarProps, NewMapDialogProps, XrefImageDialogProps, EditorToolbar(), InlineBubbleAnchor (+12 more)

### Community 47 - "Changelog"
Cohesion: 0.25
Nodes (8): [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, Added, Changed, Changed, Changelog, Known limitations, Known limitations

### Community 49 - "dita-elements.ts"
Cohesion: 0.18
Nodes (10): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+2 more)

### Community 50 - "HttpError"
Cohesion: 0.11
Nodes (33): zod@^3.24.2, HttpError, isHttpError(), handleWorkspaceError(), validateBranchName(), branchSchema, commitSchema, createBranchSchema (+25 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.25
Nodes (8): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 8. AI 辅助写作、语义标签优化与错误修复（Phase 6）, 核心特性（已实现：Phase 0–6）

### Community 52 - "DocumentSemanticOverlay"
Cohesion: 0.29
Nodes (9): TABS, TopicInspectorProps, AttributesPanelProps, EditorToolbarProps, EditorSelectionSnapshot, VisualEditorProps, DocumentSemanticOverlay, XmlDeclaration (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.09
Nodes (39): useAiStore, AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), App(), CheckinDialog(), EditorTabBar(), InsertKeyrefDialog() (+31 more)

### Community 55 - "Core features (Phase 0–6 implemented)"
Cohesion: 0.29
Nodes (7): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5), Core features (Phase 0–6 implemented)

### Community 56 - "identity-service.ts"
Cohesion: 0.08
Nodes (31): fileLocks, LockBackupRow, lockBackups, repositories, UserRow, users, changeLabel(), GitBranchInfo (+23 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.22
Nodes (23): updateNodeRawAttr(), addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell() (+15 more)

### Community 58 - "buildDitaConstraintSummary"
Cohesion: 0.40
Nodes (4): buildDitaConstraintSummary(), COMMON_ATTRIBUTES, DITA_CORE_INLINE_TAGS, getAllowedChildElementTags()

### Community 60 - "dita-core/src/index.ts"
Cohesion: 0.08
Nodes (21): computeBlockGaps(), CONTAINER_QUICK_BLOCK_TAGS, DITA_DECORATIONS_KEY, DitaDecorationsCallbacks, findBoldPos(), buildState(), noopCallbacks, loadDoc() (+13 more)

### Community 61 - "helpers.ts"
Cohesion: 0.26
Nodes (11): getRawAttr(), countCalsTgroups(), findDirectElementIndexInPmParent(), findNthDirectElementChild(), findPmPosByDitaId(), findPmPosByElementPath(), isDitaElementPmNode(), pmHasMultipleTgroups() (+3 more)

### Community 62 - "checkXmlWellFormed"
Cohesion: 0.20
Nodes (14): @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult (+6 more)

### Community 63 - "ai-config-and-model.test.ts"
Cohesion: 0.12
Nodes (11): AiChatModel, AiModelFactory, createLangChainModelFactory(), AiConfigTestResult, ADMIN, createApp(), createFixture(), tempDirs (+3 more)

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.18
Nodes (22): element(), [0.8.0] — 2026-11-22, Added, Changed, 1. `@dita/core` — `src/ai/`, 4.2 三种靶向定位与无损回拼策略, DITA_TOPIC_ROOTS, doctypeSignature() (+14 more)

### Community 65 - "ditaval.ts"
Cohesion: 0.15
Nodes (15): summarizeDitaval(), ConditionGroup, createDitavalTemplate(), DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, extractConditionGroups() (+7 more)

### Community 66 - "lucide-react"
Cohesion: 0.22
Nodes (13): EditorTabBarProps, TAB_TYPE_BADGE, IdentitySwitcher(), IdentitySwitcherProps, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY, IdentityResponse, IdentityRoleInfo (+5 more)

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.10
Nodes (15): DitaDatabaseHandle, migratePublishJobs(), openDatabase(), AiMetaPayload, ADMIN, createApp(), Fixture, readUsage() (+7 more)

### Community 69 - "semantic-engine.ts"
Cohesion: 0.17
Nodes (23): extractProfilingValuesFromDocument(), DITA_TOPIC_ROOT_TAGS, cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild(), findTopicIdForElement(), getNormalizedText() (+15 more)

### Community 71 - "semantic-indexer.ts"
Cohesion: 0.13
Nodes (23): WorkspaceDitavalSummary, WorkspaceMapSummary, BranchIndexState, SemanticContextResponse, ConrefReusePanelProps, InsertKeyrefDialogProps, KeyspacePanelProps, SourceSemanticCompletionContext (+15 more)

### Community 77 - "AiDiffDialog"
Cohesion: 0.09
Nodes (27): 4.7 AI Assistance Boundaries (Phase 6), AiDiffDialog(), CheckinDialogProps, DiffDialog(), revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps (+19 more)

### Community 79 - "AttributesPanel.tsx"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 80 - "dita-runtime.ts"
Cohesion: 0.18
Nodes (19): buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DetectRuntimeOptions, DitaRunOptions (+11 more)

### Community 81 - "WorkspaceDialog.tsx"
Cohesion: 0.43
Nodes (6): arrayBufferToBase64(), formatRelativeTime(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody()

### Community 83 - "ai-prompt.ts"
Cohesion: 0.20
Nodes (17): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+9 more)

### Community 86 - "dita-completion.ts"
Cohesion: 0.23
Nodes (11): @codemirror/autocomplete@^6.20.4, @codemirror/state@^6.7.6, createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag(), PROFILING_ATTR_SET, completeAtEnd(), DITA_PROFILING_ATTRS (+3 more)

### Community 89 - "fragment-locator.ts"
Cohesion: 0.22
Nodes (16): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+8 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.19
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 91 - "publish-service.ts"
Cohesion: 0.15
Nodes (15): publishJobs, DitaDiagnostic, CreatePublishJobInput, EXCLUDED_SNAPSHOT_ENTRIES, findFirstPdf(), isInside(), parseDiagnostics(), PublishFormat (+7 more)

### Community 92 - "strict-validator.ts"
Cohesion: 0.14
Nodes (20): CreateServerOptions, fallbackDitaDiagnostic(), DitaRuntimeInfo, DitaRuntimeOptions, PublishServiceOptions, errorReply(), registerStrictValidationRoutes(), StrictValidationRouteOptions (+12 more)

### Community 93 - "Phase 6 AI Assistance — Implementation Contract"
Cohesion: 0.33
Nodes (4): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract

### Community 94 - "ai-fragment.test.ts"
Cohesion: 0.19
Nodes (10): 4.1 文件清单与核心函数, extractTargetFragment(), AiExtractOptions, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport (+2 more)

### Community 95 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 96 - "ConrefReusePanel.tsx"
Cohesion: 0.33
Nodes (8): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, IndexedTopicElement

### Community 97 - "api/src/index.ts"
Cohesion: 0.11
Nodes (15): createServer(), registerAssetRoutes(), sanitizeAssetFilename(), IdentityService, toIdentityUser(), registerIdentityRoutes(), resolveConrefSchema, resolveDocumentSchema (+7 more)

### Community 98 - "api/src/index.ts"
Cohesion: 0.09
Nodes (18): resetDitaRuntimeCache(), ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, ADMIN, SAMPLE_ROOT, tempDirs, VIEWER, WRITER_A (+10 more)

### Community 99 - "compare.ts"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 100 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.22
Nodes (9): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, browserStreamStubPlugin() (+1 more)

### Community 104 - "界面预览"
Cohesion: 0.18
Nodes (11): DITAEditor, Phase 5：DITA-OT 严格校验与异步 HTML5 / 中文 PDF 发布, 三栏工作台与 Phase 4 版本协作面板, 仓库目录结构, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 可视化与 XML 源码双栏对比模式, 实施路线图（Roadmap）, 开发、构建与测试 (+3 more)

### Community 105 - "[0.5.0] — 2026-11-21"
Cohesion: 0.40
Nodes (5): [0.5.0] — 2026-11-21, Added, Changed, Known limitations, Removed

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 501 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `checkXmlWellFormed`, `xpath.ts`, `WorkspaceManager`, `4. Non-Negotiable Engineering Invariants`, `normalizePosixPath`, `semantic-engine.ts`, `[0.5.0] — 2026-11-21`, `dita-map.ts`, `核心特性（已实现：Phase 0–3）`, `Core features (Phase 0–6 implemented)`, `map-tree-utils.ts`, `ai-fragment.test.ts`, `editor-store.ts`, `e2e-ai-live.mts`, `ai-store.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `createServer()` (e.g. with `.getRootDir()` and `.setMutationCallbacks()`) actually correct?**
  _`createServer()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11806543385490754 - nodes in this community are weakly interconnected._
- **Why does `slimdom` connect `semantic-engine.ts` to `ditaval.ts`, `converter.ts`, `compare.ts`, `xpath.ts`, `Core Package Manifest`, `keyspace.ts`, `dita-map.ts`, `fragment-locator.ts`, `dita-core/src/index.ts`, `helpers.ts`, `serializer.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Why does `PublishQueue` connect `PublishQueue` to `PublishService`, `核心特性（已实现：Phase 0–3）`, `DITAEditor`, `App.tsx`, `Core features (Phase 0–6 implemented)`, `publish-service.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._