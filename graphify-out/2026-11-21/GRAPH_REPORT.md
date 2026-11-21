# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 112 files · ~105,569 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .dita 20, .ditamap 3, .ditaval 2)

## Summary
- 1071 nodes · 3006 edges · 73 communities (53 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6ee25579`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- semantic-engine.ts
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
- map-tree-utils.ts
- WorkspaceManager
- scripts
- commands.ts
- editor-store.ts
- files/routes.ts
- @codemirror/lang-xml
- VisualEditor.tsx
- semantic-indexer.ts
- WorkspaceSemanticIndexer
- workspace-fs.ts
- block-transforms.ts
- decorations.ts
- schema.ts
- selection-info.ts
- inline-selection.ts
- react
- node-views.ts
- serializer.ts
- MapNodeInspector.tsx
- MapTreeNodeRenderer.tsx
- parser.ts
- devDependencies
- DocumentSemanticOverlay
- RawAttrs
- compare.ts
- ParsedDitaval
- AttributesPanel.tsx
- dita-core/src/index.ts
- createMapTemplate
- dita-elements.ts
- @codemirror/search
- @codemirror/view
- @dita/core@workspace:*
- XmlParseError
- prosemirror-commands
- prosemirror-dropcursor
- FileExplorerPanel.tsx
- react-arborist
- react-dnd-html5-backend@^16.0.1
- WorkspaceDialog.tsx
- tailwindcss@^4.3.5
- zustand
- scripts
- EditorTabBar.tsx
- LeftSidebar.tsx
- ProblemsPanel.tsx
- @codemirror/commands
- prosemirror-gapcursor
- prosemirror-model@^1.25.13
- react-dnd@^16.0.1
- react-resizable-panels

## God Nodes (most connected - your core abstractions)
1. `parseXml()` - 38 edges
2. `normalizePosixPath()` - 33 edges
3. `lucide-react` - 31 edges
4. `App()` - 31 edges
5. `react` - 29 edges
6. `parseDitaMap()` - 29 edges
7. `getPmNodeRawAttrs()` - 29 edges
8. `VisualEditor` - 28 edges
9. `XmlParseError` - 28 edges
10. `getRawAttr()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `5. 本地工作区、增量语义索引与资产后端（`@dita/api`）` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  README.md → apps/api/src/modules/files/workspace-fs.ts
- `5. 本地工作区、增量语义索引与资产后端（`@dita/api`）` --references--> `WorkspaceSemanticIndexer`  [INFERRED]
  README.md → apps/api/src/modules/indexer/semantic-indexer.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (73 total, 20 thin omitted)

### Community 0 - "semantic-engine.ts"
Cohesion: 0.07
Nodes (48): computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind(), computeRelativeDitaHref(), dirnamePosix(), IMAGE_EXTENSIONS, normalizePosixPath() (+40 more)

### Community 1 - "web/package.json"
Cohesion: 0.20
Nodes (8): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, browserStreamStubPlugin(), @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 2 - "converter.ts"
Cohesion: 0.14
Nodes (25): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+17 more)

### Community 3 - "ditaval.ts"
Cohesion: 0.08
Nodes (32): ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions() (+24 more)

### Community 4 - "App.tsx"
Cohesion: 0.16
Nodes (22): App(), EditorTabBar(), InsertKeyrefDialog(), KeyspacePanel(), LeftSidebar(), NewMapDialog(), NewTopicDialog(), ProblemsPanel() (+14 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.13
Nodes (19): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0, exports (+11 more)

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
Cohesion: 0.12
Nodes (26): CalsColspecNodeView, DitaCodeblockNodeView, DitaNoteNodeView, UnknownPassthroughNodeView, addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell (+18 more)

### Community 18 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/language@^6.13.1, @codemirror/state@^6.7.6, @lezer/highlight@^1.2.5, lucide-react@^1.76.0, prosemirror-history@^1.5.2, prosemirror-inputrules@^1.7.0 (+10 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.07
Nodes (61): DEMO_SOURCE_DIR, __dirname, tempDirs, computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource() (+53 more)

### Community 20 - "DITAEditor"
Cohesion: 0.06
Nodes (32): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests (+24 more)

### Community 21 - "map-tree-utils.ts"
Cohesion: 0.19
Nodes (17): buildCompositeMapTree(), CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), MapNodeContextMenu() (+9 more)

### Community 22 - "WorkspaceManager"
Cohesion: 0.27
Nodes (6): registerWorkspaceFileRoutes(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.22
Nodes (17): createDitaElementSkeleton(), EMPTY_ATTRS, handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos(), insertInlineImage(), makeNode() (+9 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.13
Nodes (27): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext() (+19 more)

### Community 26 - "files/routes.ts"
Cohesion: 0.12
Nodes (19): fastify@^5.2.0, zod@^3.24.2, CreateServerOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema (+11 more)

### Community 28 - "VisualEditor.tsx"
Cohesion: 0.15
Nodes (19): BlockConvertOption, planBlockMove(), BlockHandle(), BlockHandleProps, MODE_LABEL, deleteDitaNodeAtPos(), exitCodeblockToParagraph(), handleDitaBackspace() (+11 more)

### Community 29 - "semantic-indexer.ts"
Cohesion: 0.09
Nodes (36): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, @codemirror/lint@^6.9.8, buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic (+28 more)

### Community 30 - "WorkspaceSemanticIndexer"
Cohesion: 0.21
Nodes (5): createServer(), registerSemanticIndexerRoutes(), collectAllFilePaths(), summarizeDitaval(), WorkspaceSemanticIndexer

### Community 31 - "workspace-fs.ts"
Cohesion: 0.16
Nodes (13): countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), WorkspaceCreateKind, WorkspaceDiagnostic (+5 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.12
Nodes (21): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps(), findBlockHandleTarget() (+13 more)

### Community 33 - "decorations.ts"
Cohesion: 0.13
Nodes (22): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createChevronCapSvg(), createConrefWidgetDom(), createDitaDecorationsPlugin(), createDitavalFlagPillDom(), createOxygenTagDom() (+14 more)

### Community 34 - "schema.ts"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 35 - "selection-info.ts"
Cohesion: 0.33
Nodes (12): getBlockConvertOptions(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot(), isInlineTagAllowedAtSelection(), makeBreadcrumbItem() (+4 more)

### Community 36 - "inline-selection.ts"
Cohesion: 0.13
Nodes (15): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, InlineBubbleInfo, resolveContextTag() (+7 more)

### Community 37 - "react"
Cohesion: 0.23
Nodes (8): EditorToolbar(), InlineBubbleAnchor, InlineBubbleToolbar(), TAG_ICONS, useInstantTitles(), UseInstantTitlesOptions, rootEl, react

### Community 38 - "node-views.ts"
Cohesion: 0.16
Nodes (8): CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaPrologNodeView, NOTE_TYPE_LABELS, NOTE_TYPES, XmlCommentNodeView, prosemirror-view

### Community 39 - "serializer.ts"
Cohesion: 0.28
Nodes (15): isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), escapeXmlAttr(), escapeXmlText(), formatDoctype(), hasBlockChildren(), hasNonWhitespaceTextOrInline() (+7 more)

### Community 40 - "MapNodeInspector.tsx"
Cohesion: 0.31
Nodes (8): ATTR_BADGE_COLORS, ProfilingAttrEditor(), findTreeNodeByPath(), GROUP_LABELS, MapNodeInspector(), formatProfilingAttrValue(), getAttributesForElement(), 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）

### Community 41 - "MapTreeNodeRenderer.tsx"
Cohesion: 0.20
Nodes (11): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, createMapTreeNodeRenderer() (+3 more)

### Community 42 - "parser.ts"
Cohesion: 0.18
Nodes (14): slimdom@^4.0.2, extractDoctype(), extractXmlDeclaration(), findRootElementStartOffset(), lineColumnToOffset(), parseSaxesError(), ParseXmlOptions, PositionTrackedSlimdomNode (+6 more)

### Community 43 - "devDependencies"
Cohesion: 0.19
Nodes (13): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, typescript, vitest, name (+5 more)

### Community 44 - "DocumentSemanticOverlay"
Cohesion: 0.20
Nodes (4): CreateDitaNodeViewsOptions, DitaImageNodeView, DitaRefInlineNodeView, DocumentSemanticOverlay

### Community 45 - "RawAttrs"
Cohesion: 0.43
Nodes (5): InsertKeyrefDialogProps, XrefImageDialogProps, VisualEditorHandle, UploadAssetResult, RawAttrs

### Community 46 - "compare.ts"
Cohesion: 0.53
Nodes (5): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 47 - "ParsedDitaval"
Cohesion: 0.23
Nodes (13): VisualSemanticContext, BuildCompositeMapTreeOptions, MapBufferState, MapNodeInspectorProps, MapTreePanelProps, WorkspaceDiagnostic, WorkspaceDitavalSummary, EditorWorkbenchState (+5 more)

### Community 48 - "AttributesPanel.tsx"
Cohesion: 0.23
Nodes (13): ConrefReusePanelProps, InspectorTab, TABS, TopicInspector(), TopicInspectorProps, AttributesPanel(), AttributesPanelProps, GROUP_LABELS (+5 more)

### Community 49 - "dita-core/src/index.ts"
Cohesion: 0.16
Nodes (10): NewMapDialogProps, DEFAULT_DIR_FOR_TYPE, NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS, InsertElementMenuProps, InsertContextGroup, MapOverviewPaneProps (+2 more)

### Community 50 - "createMapTemplate"
Cohesion: 0.23
Nodes (10): buildScaleDitaProject(), createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions, DitaSampleDocument (+2 more)

### Community 51 - "dita-elements.ts"
Cohesion: 0.17
Nodes (11): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+3 more)

### Community 55 - "XmlParseError"
Cohesion: 0.31
Nodes (8): FileContentResult, WorkbenchHeaderProps, FileContentResult, EditorViewMode, OpenEditorTab, DitaFileKind, DitaXmlParseError, XmlParseError

### Community 58 - "FileExplorerPanel.tsx"
Cohesion: 0.48
Nodes (6): FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), WorkspaceFileNode, WorkspaceMapSummary

### Community 61 - "WorkspaceDialog.tsx"
Cohesion: 0.50
Nodes (4): arrayBufferToBase64(), RELEVANT_EXTENSIONS, WorkspaceDialog(), WorkspaceDialogProps

### Community 64 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, test, test:watch, typecheck

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 280 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `slimdom` connect `parser.ts` to `semantic-engine.ts`, `converter.ts`, `ditaval.ts`, `Core Package Manifest`, `serializer.ts`, `compare.ts`, `dita-map.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `semantic-engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06893106893106893 - nodes in this community are weakly interconnected._
- **Why does `checkXmlWellFormed()` connect `semantic-engine.ts` to `parser.ts`, `dita-map.ts`, `DITAEditor`, `map-tree-utils.ts`, `WorkspaceManager`, `editor-store.ts`, `semantic-indexer.ts`, `workspace-fs.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1396011396011396 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `dita-core/src/index.ts` to `EditorTabBar.tsx`, `LeftSidebar.tsx`, `ProblemsPanel.tsx`, `App.tsx`, `react`, `MapNodeInspector.tsx`, `MapTreeNodeRenderer.tsx`, `devDependencies`, `RawAttrs`, `AttributesPanel.tsx`, `dependencies`, `WorkspaceDialog.tsx`, `map-tree-utils.ts`, `XmlParseError`, `FileExplorerPanel.tsx`, `VisualEditor.tsx`, `semantic-indexer.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `ditaval.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0761904761904762 - nodes in this community are weakly interconnected._