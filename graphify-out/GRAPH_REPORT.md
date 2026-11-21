# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 109 files · ~104,420 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .dita 20, .ditamap 3, .ditaval 2)

## Summary
- 1056 nodes · 2963 edges · 63 communities (48 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3977bb9a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- normalizePosixPath
- web/package.json
- converter.ts
- ditaval.ts
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
- node-views.ts
- dependencies
- dita-map.ts
- DITAEditor
- xpath.ts
- WorkspaceManager
- scripts
- commands.ts
- editor-store.ts
- files/routes.ts
- web/package.json
- VisualEditor.tsx
- semantic-indexer.ts
- WorkspaceSemanticIndexer
- workspace-fs.ts
- block-transforms.ts
- decorations.ts
- helpers.ts
- selection-info.ts
- inline-selection.ts
- lucide-react
- dita-core/src/index.ts
- serializer.ts
- MapNodeInspector.tsx
- conref.ts
- parser.ts
- devDependencies
- computeRelativeDitaHref
- RawAttrs
- compare.ts
- 核心特性（已实现：Phase 0–3）
- EditorToolbar.tsx
- NewTopicDialog.tsx
- @codemirror/lint
- @codemirror/search
- @codemirror/view
- @dita/core@workspace:*
- @lezer/highlight@^1.2.5
- prosemirror-commands
- prosemirror-dropcursor
- prosemirror-inputrules@^1.7.0
- react-arborist
- react-dnd-html5-backend@^16.0.1
- react-dom
- tailwindcss@^4.3.5
- zustand

## God Nodes (most connected - your core abstractions)
1. `parseXml()` - 38 edges
2. `normalizePosixPath()` - 33 edges
3. `App()` - 32 edges
4. `lucide-react` - 30 edges
5. `react` - 29 edges
6. `parseDitaMap()` - 29 edges
7. `getPmNodeRawAttrs()` - 29 edges
8. `VisualEditor` - 28 edges
9. `XmlParseError` - 28 edges
10. `getRawAttr()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `4. 单一信息源语义引擎（Keys / Conref / DITAVAL）` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `5. 本地工作区、增量语义索引与资产后端（`@dita/api`）` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  README.md → apps/api/src/modules/files/workspace-fs.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (63 total, 15 thin omitted)

### Community 0 - "normalizePosixPath"
Cohesion: 0.19
Nodes (8): collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind(), normalizePosixPath(), DitaSemanticIndex, findEnclosingTopicInfo()

### Community 1 - "web/package.json"
Cohesion: 0.20
Nodes (8): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, browserStreamStubPlugin(), @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 2 - "converter.ts"
Cohesion: 0.13
Nodes (29): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+21 more)

### Community 3 - "ditaval.ts"
Cohesion: 0.07
Nodes (39): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, createConrefWidgetDom() (+31 more)

### Community 4 - "App.tsx"
Cohesion: 0.14
Nodes (25): App(), EditorTabBar(), InsertKeyrefDialog(), KeyspacePanel(), LeftSidebar(), NewMapDialog(), NewTopicDialog(), ProblemsPanel() (+17 more)

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

### Community 17 - "node-views.ts"
Cohesion: 0.06
Nodes (37): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView (+29 more)

### Community 18 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/state@^6.7.6, lucide-react@^1.76.0, prosemirror-history@^1.5.2, prosemirror-keymap@^1.2.3, prosemirror-model@^1.25.13 (+9 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.07
Nodes (59): tempDirs, CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), applyElementAttrsPreservingOrder(), computeElementPath() (+51 more)

### Community 20 - "DITAEditor"
Cohesion: 0.07
Nodes (27): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests (+19 more)

### Community 21 - "xpath.ts"
Cohesion: 0.09
Nodes (21): DEMO_SOURCE_DIR, __dirname, ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId() (+13 more)

### Community 22 - "WorkspaceManager"
Cohesion: 0.23
Nodes (8): registerWorkspaceFileRoutes(), countMapTreeNodes(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError, checkXmlWellFormed()

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.19
Nodes (21): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+13 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.06
Nodes (58): FileContentResult, buildScaleDitaProject(), FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), WorkbenchHeaderProps, MapBufferState (+50 more)

### Community 26 - "files/routes.ts"
Cohesion: 0.12
Nodes (19): fastify@^5.2.0, zod@^3.24.2, CreateServerOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema (+11 more)

### Community 27 - "web/package.json"
Cohesion: 0.15
Nodes (12): @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, prosemirror-gapcursor@^1.4.1, react-dnd@^16.0.1, name, private, type, version (+4 more)

### Community 28 - "VisualEditor.tsx"
Cohesion: 0.16
Nodes (19): BlockConvertOption, planBlockMove(), BlockHandle(), BlockHandleProps, MODE_LABEL, deleteDitaNodeAtPos(), moveDitaBlockToGap(), moveDitaNodeSibling() (+11 more)

### Community 29 - "semantic-indexer.ts"
Cohesion: 0.17
Nodes (23): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, InsertConrefDialogProps, createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag(), PROFILING_ATTR_SET (+15 more)

### Community 30 - "WorkspaceSemanticIndexer"
Cohesion: 0.21
Nodes (5): createServer(), registerSemanticIndexerRoutes(), collectAllFilePaths(), summarizeDitaval(), WorkspaceSemanticIndexer

### Community 31 - "workspace-fs.ts"
Cohesion: 0.18
Nodes (12): findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), WorkspaceCreateKind, WorkspaceDiagnostic, WorkspaceFileNode (+4 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.12
Nodes (19): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps(), findBlockHandleTarget() (+11 more)

### Community 33 - "decorations.ts"
Cohesion: 0.13
Nodes (22): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createDitaDecorationsPlugin(), createDitavalFlagPillDom(), createOxygenTagDom() (+14 more)

### Community 34 - "helpers.ts"
Cohesion: 0.12
Nodes (22): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), VisualToSourceResult, slimdomToPmDoc(), countCalsTgroups(), findDirectElementIndexInPmParent() (+14 more)

### Community 35 - "selection-info.ts"
Cohesion: 0.33
Nodes (12): getBlockConvertOptions(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot(), isInlineTagAllowedAtSelection(), makeBreadcrumbItem() (+4 more)

### Community 36 - "inline-selection.ts"
Cohesion: 0.16
Nodes (13): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+5 more)

### Community 37 - "lucide-react"
Cohesion: 0.09
Nodes (22): EditorTabBarProps, TAB_TYPE_BADGE, KeyspacePanelProps, LeftSidebarProps, NewMapDialogProps, ProblemsPanelProps, SOURCE_LABELS, arrayBufferToBase64() (+14 more)

### Community 38 - "dita-core/src/index.ts"
Cohesion: 0.16
Nodes (17): IMAGE_EXTENSIONS, ResolvedDitaHref, BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText(), findDirectChild(), getNormalizedText() (+9 more)

### Community 39 - "serializer.ts"
Cohesion: 0.17
Nodes (21): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind, isBlockElementName(), isInlineElementName() (+13 more)

### Community 40 - "MapNodeInspector.tsx"
Cohesion: 0.23
Nodes (13): ATTR_BADGE_COLORS, ProfilingAttrEditor(), ProfilingAttrEditorProps, AttributesPanel(), GROUP_LABELS, findTreeNodeByPath(), GROUP_LABELS, MapNodeInspector() (+5 more)

### Community 41 - "conref.ts"
Cohesion: 0.28
Nodes (12): extractProfilingValuesFromDocument(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild(), findTopicIdForElement(), getNormalizedText(), indexTopicElements() (+4 more)

### Community 42 - "parser.ts"
Cohesion: 0.26
Nodes (11): extractDoctype(), findRootElementStartOffset(), lineColumnToOffset(), parseSaxesError(), PositionTrackedSlimdomNode, XmlWellFormedResult, ParsedXmlDocument, XmlDoctypeInfo (+3 more)

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, typescript, vitest, @types/react (+1 more)

### Community 44 - "computeRelativeDitaHref"
Cohesion: 0.43
Nodes (5): InsertConrefDialog(), MountExistingDialog(), MountExistingDialogProps, computeRelativeDitaHref(), areConrefTagsCompatible()

### Community 45 - "RawAttrs"
Cohesion: 0.43
Nodes (5): InsertKeyrefDialogProps, XrefImageDialogProps, VisualEditorHandle, UploadAssetResult, RawAttrs

### Community 46 - "compare.ts"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 47 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.33
Nodes (6): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 核心特性（已实现：Phase 0–3）

### Community 48 - "EditorToolbar.tsx"
Cohesion: 0.43
Nodes (6): AttributesPanelProps, EditorToolbarProps, EditorSelectionSnapshot, VisualEditorProps, XmlDeclaration, XmlPrologItem

### Community 49 - "NewTopicDialog.tsx"
Cohesion: 0.40
Nodes (4): DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `WorkspaceManager` to `normalizePosixPath`, `helpers.ts`, `ditaval.ts`, `dita-core/src/index.ts`, `parser.ts`, `核心特性（已实现：Phase 0–3）`, `dita-map.ts`, `DITAEditor`, `xpath.ts`, `editor-store.ts`, `semantic-indexer.ts`, `workspace-fs.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12688172043010754 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `ditaval.ts`, `App.tsx`, `MapNodeInspector.tsx`, `computeRelativeDitaHref`, `RawAttrs`, `EditorToolbar.tsx`, `NewTopicDialog.tsx`, `dependencies`, `editor-store.ts`, `web/package.json`, `VisualEditor.tsx`, `semantic-indexer.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `ditaval.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07215541165587419 - nodes in this community are weakly interconnected._
- **Why does `核心特性（已实现：Phase 0–3）` connect `核心特性（已实现：Phase 0–3）` to `DITAEditor`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1402116402116402 - nodes in this community are weakly interconnected._