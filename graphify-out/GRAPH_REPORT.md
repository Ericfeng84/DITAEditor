# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 135 files · ~126,262 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .dita 20, .ditamap 3, .ditaval 2)

## Summary
- 1343 nodes · 3748 edges · 90 communities (73 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `30aa44da`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- files/routes.ts
- git-store.ts
- converter.ts
- XmlParseError
- dita-core/src/index.ts
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
- normalizePosixPath
- map-tree-utils.ts
- scripts
- commands.ts
- editor-store.ts
- WorkspaceManager
- WorkspaceSemanticIndexer
- VisualEditor.tsx
- MapNodeInspector.tsx
- workspace-fs.ts
- serializer.ts
- block-transforms.ts
- decorations.ts
- vite.config.ts
- Screenshots
- block-handle.test.ts
- createMapTemplate
- DITAEditor
- parser.ts
- schema.ts
- AGENTS.md
- selection-info.ts
- devDependencies
- 4. Non-Negotiable Engineering Invariants
- @lezer/highlight@^1.2.5
- App.tsx
- [0.6.0] — 2026-11-21
- prosemirror-commands
- locks/routes.ts
- cals-table.test.ts
- 核心特性（已实现：Phase 0–3）
- web/package.json
- map-tree-utils.ts
- prosemirror-gapcursor
- Core features (Phase 0–3 implemented)
- lock-service.ts
- table-commands.ts
- prosemirror-keymap
- GitManager
- helpers.ts
- conref-renderer.ts
- slimdom
- 界面预览
- react-dnd-html5-backend@^16.0.1
- ditaval.ts
- lucide-react
- checkXmlWellFormed
- @codemirror/search
- semantic-engine.ts
- LockService
- react-dom
- IdentityService
- git-manager.ts
- conref.ts
- dita-rules.ts
- keyspace.ts
- CheckinDialog.tsx
- lock-helpers.ts
- AttributesPanel.tsx
- api/src/index.ts
- WorkspaceDialog.tsx
- FileExplorerPanel.tsx
- NewMapDialog.tsx
- @codemirror/lang-xml
- @codemirror/merge
- prosemirror-dropcursor
- prosemirror-inputrules@^1.7.0
- react-arborist
- zustand

## God Nodes (most connected - your core abstractions)
1. `parseXml()` - 38 edges
2. `App()` - 37 edges
3. `WorkspaceManager` - 36 edges
4. `lucide-react` - 36 edges
5. `requestJson()` - 35 edges
6. `normalizePosixPath()` - 33 edges
7. `react` - 32 edges
8. `GitManager` - 31 edges
9. `parseDitaMap()` - 29 edges
10. `getPmNodeRawAttrs()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `4. 单一信息源语义引擎（Keys / Conref / DITAVAL）` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `4. Single-sourcing semantic engine (Keys / Conref / DITAVAL)` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.en.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts
- `2. Dual-mode topic editor (visual / split / XML source)` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.en.md → packages/dita-core/src/xml/parser.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (90 total, 17 thin omitted)

### Community 0 - "files/routes.ts"
Cohesion: 0.22
Nodes (8): createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema, mkdirSchema, openWorkspaceSchema, renameSchema, writeFileSchema

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (33): GitPanel(), GitPanelProps, shortDate(), cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch() (+25 more)

### Community 2 - "converter.ts"
Cohesion: 0.14
Nodes (28): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+20 more)

### Community 3 - "XmlParseError"
Cohesion: 0.16
Nodes (22): WorkspaceDitavalSummary, BranchIndexState, collectAllFilePaths(), SemanticContextResponse, @codemirror/autocomplete@^6.20.4, createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag() (+14 more)

### Community 4 - "dita-core/src/index.ts"
Cohesion: 0.15
Nodes (17): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), ConrefReusePanelProps, MODES (+9 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.08
Nodes (33): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, simple-git@^4.1.0 (+25 more)

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
Nodes (14): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView (+6 more)

### Community 18 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/commands@^6.11.1, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/state@^6.7.6, lucide-react@^1.76.0, prosemirror-history@^1.5.2, prosemirror-model@^1.25.13 (+9 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.21
Nodes (29): applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle(), extractElementPlainText() (+21 more)

### Community 20 - "DITAEditor"
Cohesion: 0.20
Nodes (10): DITAEditor, Workspace、Semantics & Asset REST API 速览, 仓库目录结构, 后端环境变量（`@dita/api`）, 安装与启动, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始 (+2 more)

### Community 21 - "normalizePosixPath"
Cohesion: 0.14
Nodes (14): collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind(), computeRelativeDitaHref(), dirnamePosix(), IMAGE_EXTENSIONS (+6 more)

### Community 22 - "map-tree-utils.ts"
Cohesion: 0.26
Nodes (12): sanitizeCssColor(), buildCompositeMapTree(), CompositeMapTreeNode, MapNodeContextMenu(), MapNodeContextMenuProps, MapNodeMenuTarget, createMapTreeNodeRenderer(), NodeKindIcon() (+4 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.16
Nodes (23): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+15 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.09
Nodes (43): FileContentResult, WorkspaceFileNode, FileExplorerPanelProps, WorkspaceDialogProps, getCurrentUserId(), buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceDir() (+35 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.16
Nodes (8): registerWorkspaceFileRoutes(), resolveSafeWorkspacePathFor(), isWithinRoot(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError

### Community 27 - "WorkspaceSemanticIndexer"
Cohesion: 0.26
Nodes (3): createServer(), registerSemanticIndexerRoutes(), WorkspaceSemanticIndexer

### Community 28 - "VisualEditor.tsx"
Cohesion: 0.18
Nodes (19): findBlockHandleTarget(), planBlockMove(), BlockHandle(), deleteDitaNodeAtPos(), duplicateDitaBlockAtPos(), moveDitaBlockToGap(), selectNodeAtPos(), createDitaDecorationsPlugin() (+11 more)

### Community 29 - "MapNodeInspector.tsx"
Cohesion: 0.26
Nodes (11): VisualSemanticContext, BuildCompositeMapTreeOptions, MapBufferState, findTreeNodeByPath(), GROUP_LABELS, MapNodeInspector(), MapNodeInspectorProps, MapNodeRowActions (+3 more)

### Community 30 - "workspace-fs.ts"
Cohesion: 0.12
Nodes (17): countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, sanitizeWorkspaceDirName(), WORKSPACE_SCAFFOLD_DIRS, WorkspaceCreateKind (+9 more)

### Community 31 - "serializer.ts"
Cohesion: 0.14
Nodes (25): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+17 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.13
Nodes (20): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps() (+12 more)

### Community 33 - "decorations.ts"
Cohesion: 0.12
Nodes (23): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createConrefWidgetDom(), createDitavalFlagPillDom(), createOxygenTagDom() (+15 more)

### Community 34 - "vite.config.ts"
Cohesion: 0.25
Nodes (6): @tailwindcss/vite@^4.3.5, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 35 - "Screenshots"
Cohesion: 0.50
Nodes (4): Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench with a visual Map tree, Visual and XML source side-by-side mode

### Community 36 - "block-handle.test.ts"
Cohesion: 0.20
Nodes (5): buildState(), loadDoc(), pmDocToXml(), xmlToPmDoc(), prosemirror-state

### Community 37 - "createMapTemplate"
Cohesion: 0.19
Nodes (11): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions (+3 more)

### Community 38 - "DITAEditor"
Cohesion: 0.20
Nodes (10): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Install and run, Repository layout, Requirements (+2 more)

### Community 39 - "parser.ts"
Cohesion: 0.21
Nodes (12): extractDoctype(), extractXmlDeclaration(), findRootElementStartOffset(), lineColumnToOffset(), parseSaxesError(), ParseXmlOptions, PositionTrackedSlimdomNode, XmlWellFormedResult (+4 more)

### Community 40 - "schema.ts"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 41 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), 7. Implementation Roadmap Status

### Community 42 - "selection-info.ts"
Cohesion: 0.18
Nodes (21): getBlockConvertOptions(), buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS (+13 more)

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, typescript, vitest, @types/react (+1 more)

### Community 44 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.22
Nodes (9): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, browserStreamStubPlugin() (+1 more)

### Community 46 - "App.tsx"
Cohesion: 0.07
Nodes (42): App(), InsertKeyrefDialog(), InsertKeyrefDialogProps, KeyspacePanel(), KeyspacePanelProps, LeftSidebar(), LeftSidebarProps, DEFAULT_DIR_FOR_TYPE (+34 more)

### Community 47 - "[0.6.0] — 2026-11-21"
Cohesion: 0.28
Nodes (5): [0.6.0] — 2026-11-21, Added, Changed, Changelog, Known limitations

### Community 49 - "locks/routes.ts"
Cohesion: 0.14
Nodes (22): zod@^3.24.2, HttpError, isHttpError(), handleWorkspaceError(), validateBranchName(), branchSchema, commitSchema, createBranchSchema (+14 more)

### Community 50 - "cals-table.test.ts"
Cohesion: 0.10
Nodes (15): ADMIN, SAMPLE_ROOT, tempDirs, VIEWER, WRITER_A, WRITER_B, DEMO_SOURCE_DIR, __dirname (+7 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.29
Nodes (7): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 核心特性（已实现：Phase 0–3）

### Community 52 - "web/package.json"
Cohesion: 0.15
Nodes (12): @codemirror/view@^6.43.15, @dita/core@workspace:*, react-resizable-panels@^4.24.1, tailwindcss@^4.3.5, @dita/core, name, private, type (+4 more)

### Community 53 - "map-tree-utils.ts"
Cohesion: 0.21
Nodes (12): collectWorkspaceDirectoryPaths(), collectWorkspaceFilesByKind(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), DitaMapTreeNode (+4 more)

### Community 55 - "Core features (Phase 0–3 implemented)"
Cohesion: 0.29
Nodes (7): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), Core features (Phase 0–3 implemented)

### Community 56 - "lock-service.ts"
Cohesion: 0.13
Nodes (21): DitaDatabase, DitaDatabaseHandle, FileLockRow, fileLocks, LockBackupRow, lockBackups, repositories, UserRow (+13 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.25
Nodes (21): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+13 more)

### Community 60 - "helpers.ts"
Cohesion: 0.18
Nodes (18): computeXmlLineDiffStats(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc(), countCalsTgroups(), findDirectElementIndexInPmParent() (+10 more)

### Community 61 - "conref-renderer.ts"
Cohesion: 0.32
Nodes (6): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement, XmlLikeNode

### Community 62 - "slimdom"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 63 - "界面预览"
Cohesion: 0.50
Nodes (4): 三栏工作台与可视化 Map 结构树, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 可视化与 XML 源码双栏对比模式, 界面预览

### Community 65 - "ditaval.ts"
Cohesion: 0.17
Nodes (17): summarizeDitaval(), ConditionGroup, createDitavalTemplate(), DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions() (+9 more)

### Community 66 - "lucide-react"
Cohesion: 0.19
Nodes (16): EditorTabBar(), EditorTabBarProps, TAB_TYPE_BADGE, IdentitySwitcher(), IdentitySwitcherProps, WorkbenchHeader(), WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY (+8 more)

### Community 67 - "checkXmlWellFormed"
Cohesion: 0.22
Nodes (10): formatDitaXml(), SourceEditor(), createDitaXmlLinter(), [0.5.0] — 2026-11-21, Added, Changed, Known limitations, Removed (+2 more)

### Community 69 - "semantic-engine.ts"
Cohesion: 0.16
Nodes (14): DITA_PROFILING_ATTRS, findEnclosingTopicInfo(), ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId() (+6 more)

### Community 72 - "IdentityService"
Cohesion: 0.19
Nodes (7): WorkspaceRouteSecurity, GitRouteOptions, IdentityService, toIdentityUser(), registerIdentityRoutes(), LockRouteOptions, fastify

### Community 73 - "git-manager.ts"
Cohesion: 0.14
Nodes (13): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManagerOptions, GitStatusSummary, GitWorktreeInfo (+5 more)

### Community 74 - "conref.ts"
Cohesion: 0.23
Nodes (13): MapOverviewPane(), MapOverviewPaneProps, resolveWorkspaceAssetUrl(), resolveDitaHref(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild() (+5 more)

### Community 75 - "dita-rules.ts"
Cohesion: 0.13
Nodes (14): BODY_BLOCKS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DitaAttributeGroup, DitaAttributeSpec, DitaElementCategory, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS (+6 more)

### Community 76 - "keyspace.ts"
Cohesion: 0.20
Nodes (12): BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText(), findDirectChild(), getNormalizedText(), isSubmapReference(), NON_KEY_CONTAINER_TAGS (+4 more)

### Community 77 - "CheckinDialog.tsx"
Cohesion: 0.23
Nodes (10): CheckinCandidate, CheckinDialog(), CheckinDialogProps, DiffDialog(), DiffDialogProps, diffTheme, DiffViewer(), DiffViewerProps (+2 more)

### Community 78 - "lock-helpers.ts"
Cohesion: 0.22
Nodes (10): LockStatusBar(), LockStatusBarProps, stateStyles, IdentityRole, describeLock(), FileEditability, LockLike, ResolveEditabilityInput (+2 more)

### Community 79 - "AttributesPanel.tsx"
Cohesion: 0.27
Nodes (11): ATTR_BADGE_COLORS, ProfilingAttrEditor(), ProfilingAttrEditorProps, AttributesPanelProps, GROUP_LABELS, EditorSelectionSnapshot, VisualEditorProps, formatProfilingAttrValue() (+3 more)

### Community 80 - "api/src/index.ts"
Cohesion: 0.24
Nodes (6): openDatabase(), CreateServerOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename()

### Community 81 - "WorkspaceDialog.tsx"
Cohesion: 0.43
Nodes (6): arrayBufferToBase64(), formatRelativeTime(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody()

### Community 82 - "FileExplorerPanel.tsx"
Cohesion: 0.83
Nodes (3): FileExplorerPanel(), FileIcon(), filterTreeNodes()

### Community 83 - "NewMapDialog.tsx"
Cohesion: 0.67
Nodes (3): NewMapDialog(), NewMapDialogProps, DitaMapTemplateType

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 356 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `semantic-engine.ts`, `parser.ts`, `4. Non-Negotiable Engineering Invariants`, `dita-map.ts`, `核心特性（已实现：Phase 0–3）`, `map-tree-utils.ts`, `map-tree-utils.ts`, `normalizePosixPath`, `Core features (Phase 0–3 implemented)`, `editor-store.ts`, `WorkspaceManager`, `helpers.ts`, `workspace-fs.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10810810810810811 - nodes in this community are weakly interconnected._
- **Why does `核心特性（已实现：Phase 0–3）` connect `核心特性（已实现：Phase 0–3）` to `DITAEditor`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.135632183908046 - nodes in this community are weakly interconnected._
- **Why does `GitManager` connect `GitManager` to `IdentityService`, `git-manager.ts`, `api/src/index.ts`, `locks/routes.ts`, `lock-service.ts`, `WorkspaceSemanticIndexer`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `dita-core/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._