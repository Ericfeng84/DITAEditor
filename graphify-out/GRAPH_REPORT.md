# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 151 files · ~142,117 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 35 file(s) not represented in the graph (top: .dita 20, (none) 4, .xml 3)

## Summary
- 1528 nodes · 4245 edges · 86 communities (64 shown, 22 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b897af3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- converter.ts
- normalizePosixPath
- MapNodeInspector.tsx
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
- dependencies
- dita-map.ts
- DITAEditor
- computeRelativeDitaHref
- map-tree-utils.ts
- scripts
- commands.ts
- editor-store.ts
- WorkspaceManager
- dita-log-parser.ts
- PublishService
- PublishQueue
- workspace-fs.ts
- serializer.ts
- block-transforms.ts
- decorations.ts
- vite.config.ts
- zip-store.ts
- ref_vitest
- createTopicTemplate
- DITAEditor
- parser.ts
- 快速开始
- AGENTS.md
- selection-info.ts
- devDependencies
- Getting started
- useGitStore
- lucide-react
- [0.5.0] — 2026-11-21
- prosemirror-commands
- locks/routes.ts
- api/src/index.ts
- 核心特性（已实现：Phase 0–3）
- @codemirror/view
- App.tsx
- prosemirror-gapcursor
- Core features (Phase 0–3 implemented)
- lock-service.ts
- table-commands.ts
- prosemirror-keymap
- GitManager
- NewTopicDialog.tsx
- @codemirror/language
- @dita/core@workspace:*
- react-dnd-html5-backend@^16.0.1
- ditaval.ts
- lucide-react
- prosemirror-model@^1.25.13
- @codemirror/search
- semantic-engine.ts
- react-dnd@^16.0.1
- react-dom
- react-resizable-panels
- tailwindcss@^4.3.5
- docker-entrypoint.sh
- dita-core/src/index.ts
- DiffDialog.tsx
- lock-helpers.ts
- AttributesPanel.tsx
- publish-service.ts
- WorkspaceDialog.tsx
- EditorWorkbenchState
- createMapTemplate
- @codemirror/lang-xml
- @codemirror/merge
- prosemirror-inputrules@^1.7.0

## God Nodes (most connected - your core abstractions)
1. `WorkspaceManager` - 41 edges
2. `App()` - 40 edges
3. `requestJson()` - 40 edges
4. `lucide-react` - 39 edges
5. `parseXml()` - 38 edges
6. `react` - 36 edges
7. `HttpError` - 33 edges
8. `normalizePosixPath()` - 33 edges
9. `createServer()` - 32 edges
10. `GitManager` - 31 edges

## Surprising Connections (you probably didn't know these)
- `7. DITA-OT 4.x 权威校验与异步发布（Phase 5）` --references--> `PublishQueue`  [INFERRED]
  README.md → apps/api/src/modules/publish/publish-queue.ts
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts
- `4. 单一信息源语义引擎（Keys / Conref / DITAVAL）` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `4. Single-sourcing semantic engine (Keys / Conref / DITAVAL)` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.en.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (86 total, 22 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.14
Nodes (28): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+20 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (31): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch(), fetchBranches(), fetchFileAtRevision() (+23 more)

### Community 2 - "converter.ts"
Cohesion: 0.11
Nodes (32): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+24 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.06
Nodes (47): WorkspaceDitavalSummary, registerSemanticIndexerRoutes(), BranchIndexState, collectAllFilePaths(), SemanticContextResponse, WorkspaceSemanticIndexer, buildReuseAttrValue(), ConrefAttrName (+39 more)

### Community 4 - "MapNodeInspector.tsx"
Cohesion: 0.22
Nodes (11): ATTR_BADGE_COLORS, ProfilingAttrEditor(), InspectorTab, TABS, TopicInspector(), AttributesPanel(), findTreeNodeByPath(), GROUP_LABELS (+3 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (34): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, simple-git@^4.1.0 (+26 more)

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
Nodes (16): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaPrologNodeView (+8 more)

### Community 18 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, @codemirror/state@^6.7.6, @lezer/highlight@^1.2.5, lucide-react@^1.76.0, prosemirror-dropcursor@^1.8.4 (+11 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.06
Nodes (73): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, computeXmlLineDiffStats(), formatDitaXml() (+65 more)

### Community 20 - "DITAEditor"
Cohesion: 0.20
Nodes (10): DITAEditor, 三栏工作台与 Phase 4 版本协作面板, 仓库目录结构, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 可视化与 XML 源码双栏对比模式, 实施路线图（Roadmap）, 开发、构建与测试, 本地 Git 版本、Check-out 独占锁与可视化 Diff (+2 more)

### Community 21 - "computeRelativeDitaHref"
Cohesion: 0.36
Nodes (6): XrefImageDialog(), XrefImageDialogProps, MountExistingDialog(), MountExistingDialogProps, UploadAssetResult, computeRelativeDitaHref()

### Community 22 - "map-tree-utils.ts"
Cohesion: 0.11
Nodes (32): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, VisualSemanticContext (+24 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.18
Nodes (21): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+13 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.12
Nodes (29): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceDir(), createWorkspaceFile(), createWorkspaceProject(), deleteWorkspaceEntry(), fetchFileContent(), fetchParsedDitaval() (+21 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.13
Nodes (15): createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema, mkdirSchema, openWorkspaceSchema, registerWorkspaceFileRoutes(), renameSchema (+7 more)

### Community 27 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 30 - "workspace-fs.ts"
Cohesion: 0.12
Nodes (18): countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), sanitizeWorkspaceDirName(), WORKSPACE_SCAFFOLD_DIRS (+10 more)

### Community 31 - "serializer.ts"
Cohesion: 0.13
Nodes (26): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+18 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.10
Nodes (33): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps() (+25 more)

### Community 33 - "decorations.ts"
Cohesion: 0.13
Nodes (22): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createChevronCapSvg(), createConrefWidgetDom(), createDitaDecorationsPlugin(), createDitavalFlagPillDom(), createOxygenTagDom() (+14 more)

### Community 34 - "vite.config.ts"
Cohesion: 0.25
Nodes (6): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, vite@^6.2.0, browserStreamStubPlugin(), @tailwindcss/vite, vite

### Community 35 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 36 - "ref_vitest"
Cohesion: 0.10
Nodes (14): DitaDecorationsCallbacks, buildState(), loadDoc(), noopCallbacks, pmDocToXml(), xmlToPmDoc(), ditaSchema, __dirname (+6 more)

### Community 37 - "createTopicTemplate"
Cohesion: 0.28
Nodes (8): EditorTabBarProps, OpenEditorTab, createTopicTemplate(), CreateTopicTemplateOptions, DitaSampleDocument, DitaTopicTemplateType, escapeText(), sanitizeId()

### Community 38 - "DITAEditor"
Cohesion: 0.15
Nodes (12): Architecture and technology stack, Develop, build, and test, DITAEditor, Local Git versioning, check-out locks, and visual diffs, Repository layout, Roadmap, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL) (+4 more)

### Community 39 - "parser.ts"
Cohesion: 0.19
Nodes (15): ResolveConrefOptions, compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry, extractDoctype(), findRootElementStartOffset() (+7 more)

### Community 40 - "快速开始"
Cohesion: 0.33
Nodes (6): Docker 单容器部署（推荐）, 后端环境变量（`@dita/api`）, 安装与启动, 快速开始, 本机 DITA-OT 配置, 环境要求

### Community 41 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), 7. Implementation Roadmap Status

### Community 42 - "selection-info.ts"
Cohesion: 0.12
Nodes (28): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, InlineBubbleInfo (+20 more)

### Community 43 - "devDependencies"
Cohesion: 0.17
Nodes (15): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, typescript, vitest (+7 more)

### Community 44 - "Getting started"
Cohesion: 0.33
Nodes (6): Backend environment variables (`@dita/api`), Getting started, Install and run, Local DITA-OT setup, Requirements, Single-container Docker deployment (recommended)

### Community 45 - "useGitStore"
Cohesion: 0.60
Nodes (4): GitPanel(), GitPanelProps, shortDate(), useGitStore

### Community 46 - "lucide-react"
Cohesion: 0.13
Nodes (14): TAB_TYPE_BADGE, LeftSidebarProps, SOURCE_LABELS, EditorToolbar(), InlineBubbleAnchor, InlineBubbleToolbar(), TAG_ICONS, useInstantTitles() (+6 more)

### Community 47 - "[0.5.0] — 2026-11-21"
Cohesion: 0.15
Nodes (13): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, Added, Added, Changed, Changed, Changed (+5 more)

### Community 49 - "locks/routes.ts"
Cohesion: 0.10
Nodes (36): HttpError, isHttpError(), handleWorkspaceError(), validateBranchName(), branchSchema, commitSchema, createBranchSchema, GitRouteOptions (+28 more)

### Community 50 - "api/src/index.ts"
Cohesion: 0.06
Nodes (31): createServer(), resetDitaRuntimeCache(), ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), WorkspaceRouteSecurity, IdentityService (+23 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.25
Nodes (8): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 核心特性（已实现：Phase 0–5）

### Community 53 - "App.tsx"
Cohesion: 0.16
Nodes (22): App(), CheckinDialog(), EditorTabBar(), InsertKeyrefDialog(), KeyspacePanel(), LeftSidebar(), LockStatusBar(), NewMapDialog() (+14 more)

### Community 55 - "Core features (Phase 0–3 implemented)"
Cohesion: 0.25
Nodes (8): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5), Core features (Phase 0–5 implemented)

### Community 56 - "lock-service.ts"
Cohesion: 0.10
Nodes (24): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), fileLocks, LockBackupRow, lockBackups, publishJobs (+16 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.25
Nodes (21): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+13 more)

### Community 59 - "GitManager"
Cohesion: 0.10
Nodes (19): FileLockRow, changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions (+11 more)

### Community 60 - "NewTopicDialog.tsx"
Cohesion: 0.40
Nodes (4): DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS

### Community 65 - "ditaval.ts"
Cohesion: 0.16
Nodes (17): summarizeDitaval(), ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule (+9 more)

### Community 66 - "lucide-react"
Cohesion: 0.27
Nodes (11): IdentitySwitcher(), IdentitySwitcherProps, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY, getCurrentUserId(), IdentityResponse, IdentityRoleInfo, IdentityUser (+3 more)

### Community 69 - "semantic-engine.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 76 - "dita-core/src/index.ts"
Cohesion: 0.12
Nodes (32): extractProfilingValuesFromDocument(), DITA_CORE_VERSION, IMAGE_EXTENSIONS, ResolvedDitaHref, resolveDitaHref(), areConrefTagsCompatible(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT (+24 more)

### Community 77 - "DiffDialog.tsx"
Cohesion: 0.39
Nodes (6): DiffDialog(), revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel()

### Community 78 - "lock-helpers.ts"
Cohesion: 0.18
Nodes (12): CheckinCandidate, CheckinDialogProps, LockStatusBarProps, stateStyles, FileLock, IdentityRole, describeLock(), FileEditability (+4 more)

### Community 79 - "AttributesPanel.tsx"
Cohesion: 0.20
Nodes (14): AttributesPanelProps, GROUP_LABELS, EditorToolbarProps, CreateDitaNodeViewsOptions, EditorSelectionSnapshot, VisualEditorProps, baseAttrs(), makeBlockContainerSpec() (+6 more)

### Community 80 - "publish-service.ts"
Cohesion: 0.07
Nodes (46): CreateServerOptions, DitaDiagnostic, fallbackDitaDiagnostic(), buildRuntimeEnv(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry (+38 more)

### Community 81 - "WorkspaceDialog.tsx"
Cohesion: 0.43
Nodes (6): arrayBufferToBase64(), formatRelativeTime(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody()

### Community 82 - "EditorWorkbenchState"
Cohesion: 0.14
Nodes (19): FileContentResult, WorkspaceFileNode, FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), ProblemsPanelProps, PublishDialogProps (+11 more)

### Community 83 - "createMapTemplate"
Cohesion: 0.32
Nodes (7): buildScaleDitaProject(), NewMapDialogProps, createMapTemplate(), CreateMapTemplateOptions, DitaMapTemplateType, escapeText(), sanitizeId()

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 405 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `dita-map.ts` to `normalizePosixPath`, `semantic-engine.ts`, `parser.ts`, `dita-core/src/index.ts`, `[0.5.0] — 2026-11-21`, `核心特性（已实现：Phase 0–3）`, `map-tree-utils.ts`, `Core features (Phase 0–3 implemented)`, `editor-store.ts`, `WorkspaceManager`, `workspace-fs.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14204545454545456 - nodes in this community are weakly interconnected._
- **Why does `GitManager` connect `GitManager` to `lock-service.ts`, `locks/routes.ts`, `api/src/index.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1140819964349376 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `PublishDialog.tsx`, `block-transforms.ts`, `lucide-react`, `normalizePosixPath`, `MapNodeInspector.tsx`, `selection-info.ts`, `devDependencies`, `DiffDialog.tsx`, `lock-helpers.ts`, `useGitStore`, `AttributesPanel.tsx`, `WorkspaceDialog.tsx`, `dependencies`, `EditorWorkbenchState`, `App.tsx`, `computeRelativeDitaHref`, `map-tree-utils.ts`, `NewTopicDialog.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1140819964349376 - nodes in this community are weakly interconnected._