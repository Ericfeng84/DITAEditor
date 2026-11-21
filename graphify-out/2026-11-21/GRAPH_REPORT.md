# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 114 files · ~112,027 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .dita 20, .ditamap 3, .ditaval 2)

## Summary
- 1123 nodes · 3106 edges · 72 communities (56 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb91ab3a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- files/routes.ts
- @codemirror/state
- converter.ts
- dita-core/src/index.ts
- App.tsx
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
- semantic-engine.ts
- map-tree-utils.ts
- scripts
- commands.ts
- editor-store.ts
- WorkspaceManager
- WorkspaceSemanticIndexer
- VisualEditor.tsx
- resolveDitaHref
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
- inline-selection.ts
- devDependencies
- 4. Non-Negotiable Engineering Invariants
- @lezer/highlight@^1.2.5
- lucide-react
- [0.5.0] — 2026-11-21
- prosemirror-commands
- computeRelativeDitaHref
- cals-table.test.ts
- 核心特性（已实现：Phase 0–3）
- web/package.json
- dita-elements.ts
- prosemirror-gapcursor
- Core features (Phase 0–3 implemented)
- prosemirror-history
- prosemirror-keymap
- cals-table.ts
- prosemirror-view
- conref-renderer.ts
- slimdom
- 界面预览
- react-dnd-html5-backend@^16.0.1
- NewTopicDialog.tsx
- LeftSidebar.tsx
- @codemirror/lint
- @codemirror/search
- @dita/core@workspace:*
- prosemirror-model@^1.25.13
- react-dom

## God Nodes (most connected - your core abstractions)
1. `parseXml()` - 38 edges
2. `normalizePosixPath()` - 33 edges
3. `lucide-react` - 31 edges
4. `App()` - 31 edges
5. `WorkspaceManager` - 29 edges
6. `react` - 29 edges
7. `parseDitaMap()` - 29 edges
8. `getPmNodeRawAttrs()` - 29 edges
9. `VisualEditor` - 28 edges
10. `XmlParseError` - 28 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts
- `2. Dual-mode topic editor (visual / split / XML source)` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.en.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `5. 本地工作区、增量语义索引与资产后端（`@dita/api`）` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  README.md → apps/api/src/modules/files/workspace-fs.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (72 total, 16 thin omitted)

### Community 0 - "files/routes.ts"
Cohesion: 0.11
Nodes (21): fastify@^5.2.0, zod@^3.24.2, CreateServerOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema (+13 more)

### Community 2 - "converter.ts"
Cohesion: 0.23
Nodes (16): appendPmNodeToDom(), applyRawAttrs(), convertBlockContainerChildren(), convertBlockElement(), convertInlineChildren(), convertInlineNode(), elementContainsBlockChild(), INLINE_PREFERRED_PARENTS (+8 more)

### Community 3 - "dita-core/src/index.ts"
Cohesion: 0.05
Nodes (74): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, summarizeDitaval(), @codemirror/autocomplete@^6.20.4, buildReuseAttrValue(), ConrefAttrName, filterReusableElements() (+66 more)

### Community 4 - "App.tsx"
Cohesion: 0.16
Nodes (19): App(), EditorTabBar(), TAB_TYPE_BADGE, KeyspacePanel(), NewMapDialog(), ProblemsPanel(), SOURCE_LABELS, InspectorTab (+11 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.10
Nodes (25): dependencies, @dita/core@workspace:*, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, devDependencies, tsx@^4.19.3, @types/node@^22.13.0, typescript@^5.8.0 (+17 more)

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
Cohesion: 0.50
Nodes (3): allowBuilds, esbuild, packages

### Community 17 - "table-commands.ts"
Cohesion: 0.06
Nodes (36): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaPrologNodeView (+28 more)

### Community 18 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/view@^6.43.15, lucide-react@^1.76.0, prosemirror-dropcursor@^1.8.4, prosemirror-state@^1.4.4, react@^19.0.0 (+10 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.07
Nodes (63): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, extractTitleSafe(), applyElementAttrsPreservingOrder() (+55 more)

### Community 20 - "DITAEditor"
Cohesion: 0.20
Nodes (10): DITAEditor, Workspace、Semantics & Asset REST API 速览, 仓库目录结构, 后端环境变量（`@dita/api`）, 安装与启动, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始 (+2 more)

### Community 21 - "semantic-engine.ts"
Cohesion: 0.07
Nodes (42): collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref (+34 more)

### Community 22 - "map-tree-utils.ts"
Cohesion: 0.14
Nodes (24): sanitizeCssColor(), buildCompositeMapTree(), BuildCompositeMapTreeOptions, collectWorkspaceDirectoryPaths(), collectWorkspaceFilesByKind(), CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath() (+16 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.18
Nodes (22): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+14 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.06
Nodes (60): FileContentResult, WorkspaceFileNode, EditorTabBarProps, FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), NewMapDialogProps (+52 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.21
Nodes (6): registerWorkspaceFileRoutes(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError

### Community 27 - "WorkspaceSemanticIndexer"
Cohesion: 0.22
Nodes (4): createServer(), registerSemanticIndexerRoutes(), collectAllFilePaths(), WorkspaceSemanticIndexer

### Community 28 - "VisualEditor.tsx"
Cohesion: 0.16
Nodes (28): getBlockConvertOptions(), planBlockMove(), convertDitaBlockAtPos(), deleteDitaNodeAtPos(), moveDitaBlockToGap(), moveDitaNodeSibling(), selectNodeAtPos(), InlineBubbleToolbar() (+20 more)

### Community 29 - "resolveDitaHref"
Cohesion: 0.16
Nodes (15): MapBufferState, findTreeNodeByPath(), GROUP_LABELS, MapNodeInspector(), MapNodeInspectorProps, MapOverviewPane(), MapOverviewPaneProps, MountExistingDialog() (+7 more)

### Community 30 - "workspace-fs.ts"
Cohesion: 0.12
Nodes (18): countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), sanitizeWorkspaceDirName(), WORKSPACE_SCAFFOLD_DIRS (+10 more)

### Community 31 - "serializer.ts"
Cohesion: 0.28
Nodes (15): isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), escapeXmlAttr(), escapeXmlText(), formatDoctype(), hasBlockChildren(), hasNonWhitespaceTextOrInline() (+7 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.14
Nodes (18): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), INLINE_HOST_TAGS (+10 more)

### Community 33 - "decorations.ts"
Cohesion: 0.15
Nodes (21): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createConrefWidgetDom(), createDitaDecorationsPlugin(), createDitavalFlagPillDom() (+13 more)

### Community 34 - "vite.config.ts"
Cohesion: 0.20
Nodes (8): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, browserStreamStubPlugin(), @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 35 - "Screenshots"
Cohesion: 0.50
Nodes (4): Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench with a visual Map tree, Visual and XML source side-by-side mode

### Community 36 - "block-handle.test.ts"
Cohesion: 0.13
Nodes (8): computeBlockGaps(), findBlockHandleTarget(), duplicateDitaBlockAtPos(), buildState(), loadDoc(), noopCallbacks, pmDocToXml(), xmlToPmDoc()

### Community 37 - "createMapTemplate"
Cohesion: 0.19
Nodes (11): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions (+3 more)

### Community 38 - "DITAEditor"
Cohesion: 0.20
Nodes (10): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Install and run, Repository layout, Requirements (+2 more)

### Community 39 - "parser.ts"
Cohesion: 0.18
Nodes (14): ResolveConrefOptions, extractDoctype(), extractXmlDeclaration(), findRootElementStartOffset(), lineColumnToOffset(), parseSaxesError(), ParseXmlOptions, PositionTrackedSlimdomNode (+6 more)

### Community 40 - "schema.ts"
Cohesion: 0.19
Nodes (11): CalsCursor, CalsColSpec, DitaMapTreeNode, InsertMapNodeOptions, DomToPmContext, baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec() (+3 more)

### Community 41 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), 7. Implementation Roadmap Status

### Community 42 - "inline-selection.ts"
Cohesion: 0.25
Nodes (10): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, InlineBubbleInfo, resolveContextTag() (+2 more)

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, typescript, vitest, @types/react (+1 more)

### Community 44 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.29
Nodes (7): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, hasMultipleTgroups()

### Community 46 - "lucide-react"
Cohesion: 0.20
Nodes (9): EditorToolbar(), EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbarProps, TAG_ICONS, useInstantTitles(), UseInstantTitlesOptions, rootEl (+1 more)

### Community 47 - "[0.5.0] — 2026-11-21"
Cohesion: 0.33
Nodes (6): [0.5.0] — 2026-11-21, Added, Changed, Changelog, Known limitations, Removed

### Community 49 - "computeRelativeDitaHref"
Cohesion: 0.31
Nodes (7): InsertKeyrefDialog(), InsertKeyrefDialogProps, XrefImageDialog(), XrefImageDialogProps, VisualEditorHandle, UploadAssetResult, RawAttrs

### Community 50 - "cals-table.test.ts"
Cohesion: 0.14
Nodes (10): DEMO_SOURCE_DIR, __dirname, ditaSchema, __dirname, FIXTURES_DIR, __dirname, FIXTURES_DIR, __dirname (+2 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.40
Nodes (5): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 核心特性（已实现：Phase 0–3）

### Community 52 - "web/package.json"
Cohesion: 0.15
Nodes (12): @codemirror/language@^6.13.1, prosemirror-inputrules@^1.7.0, react-arborist@^4.0.1, react-dnd@^16.0.1, name, private, type, version (+4 more)

### Community 53 - "dita-elements.ts"
Cohesion: 0.18
Nodes (10): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+2 more)

### Community 55 - "Core features (Phase 0–3 implemented)"
Cohesion: 0.40
Nodes (5): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), Core features (Phase 0–3 implemented)

### Community 59 - "cals-table.ts"
Cohesion: 0.36
Nodes (8): CalsCellSpan, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows(), resolveCalsEntrySpan()

### Community 61 - "conref-renderer.ts"
Cohesion: 0.32
Nodes (6): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement, XmlLikeNode

### Community 62 - "slimdom"
Cohesion: 0.43
Nodes (6): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry, slimdom

### Community 63 - "界面预览"
Cohesion: 0.50
Nodes (4): 三栏工作台与可视化 Map 结构树, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 可视化与 XML 源码双栏对比模式, 界面预览

### Community 65 - "NewTopicDialog.tsx"
Cohesion: 0.33
Nodes (5): DEFAULT_DIR_FOR_TYPE, NewTopicDialog(), NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS

### Community 66 - "LeftSidebar.tsx"
Cohesion: 0.67
Nodes (3): LeftSidebar(), LeftSidebarProps, LeftSidebarTab

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 304 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `dita-map.ts` to `dita-core/src/index.ts`, `parser.ts`, `4. Non-Negotiable Engineering Invariants`, `[0.5.0] — 2026-11-21`, `核心特性（已实现：Phase 0–3）`, `semantic-engine.ts`, `map-tree-utils.ts`, `Core features (Phase 0–3 implemented)`, `editor-store.ts`, `WorkspaceManager`, `workspace-fs.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `files/routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Why does `getRawAttr()` connect `dita-map.ts` to `decorations.ts`, `dita-core/src/index.ts`, `App.tsx`, `table-commands.ts`, `VisualEditor.tsx`, `resolveDitaHref`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `dita-core/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05239075726378403 - nodes in this community are weakly interconnected._
- **Why does `核心特性（已实现：Phase 0–3）` connect `核心特性（已实现：Phase 0–3）` to `dita-core/src/index.ts`, `DITAEditor`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Core Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._