# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 109 files · ~104,330 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .dita 20, .ditamap 3, .ditaval 2)

## Summary
- 1054 nodes · 2962 edges · 38 communities (36 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f55b317`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- semantic-engine.ts
- web/package.json
- converter.ts
- decorations.ts
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
- dita-rules.ts
- WorkspaceManager
- scripts
- commands.ts
- editor-store.ts
- files/routes.ts
- SourceEditor.tsx
- VisualEditor.tsx
- SourceEditor.tsx
- WorkspaceSemanticIndexer
- workspace-fs.ts
- block-transforms.ts
- decorations-and-inserter.test.ts
- VisualEditor
- selection-info.ts
- inline-selection.ts
- scripts

## God Nodes (most connected - your core abstractions)
1. `parseXml()` - 38 edges
2. `normalizePosixPath()` - 33 edges
3. `App()` - 32 edges
4. `lucide-react` - 30 edges
5. `react` - 30 edges
6. `parseDitaMap()` - 29 edges
7. `getPmNodeRawAttrs()` - 29 edges
8. `VisualEditor` - 28 edges
9. `XmlParseError` - 28 edges
10. `getRawAttr()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `4. 本地工作区与资产后端（`@dita/api`）` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  README.md → apps/api/src/modules/files/workspace-fs.ts
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）` --references--> `checkXmlWellFormed()`  [INFERRED]
  README.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `4.5 Isomorphic `@dita/core` & Runtime Gotchas` --references--> `browserStreamStubPlugin()`  [INFERRED]
  AGENTS.md → apps/web/vite.config.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (38 total, 2 thin omitted)

### Community 0 - "semantic-engine.ts"
Cohesion: 0.05
Nodes (68): InsertConrefDialogProps, KeyspacePanelProps, computeMemoryDiagnostics(), extractProfilingValuesFromDocument(), basenamePosix(), dirnamePosix(), IMAGE_EXTENSIONS, normalizePosixPath() (+60 more)

### Community 1 - "web/package.json"
Cohesion: 0.11
Nodes (17): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4 (+9 more)

### Community 2 - "converter.ts"
Cohesion: 0.06
Nodes (57): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+49 more)

### Community 3 - "decorations.ts"
Cohesion: 0.05
Nodes (68): summarizeDitaval(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode (+60 more)

### Community 4 - "App.tsx"
Cohesion: 0.05
Nodes (71): App(), EditorTabBar(), TAB_TYPE_BADGE, FileExplorerPanel(), FileExplorerPanelProps, FileIcon(), filterTreeNodes(), InsertConrefDialog() (+63 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.12
Nodes (22): dependencies, @dita/core@workspace:*, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, zod@^3.24.2, devDependencies, tsx@^4.19.3, @types/node@^22.13.0 (+14 more)

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
Cohesion: 0.07
Nodes (40): dependencies, @dita/core@workspace:*, @lezer/highlight@^1.2.5, lucide-react@^1.76.0, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4, prosemirror-gapcursor@^1.4.1, prosemirror-history@^1.5.2 (+32 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.06
Nodes (64): DEMO_SOURCE_DIR, __dirname, tempDirs, computeXmlLineDiffStats(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult (+56 more)

### Community 20 - "DITAEditor"
Cohesion: 0.06
Nodes (31): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests (+23 more)

### Community 21 - "dita-rules.ts"
Cohesion: 0.15
Nodes (12): BODY_BLOCKS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DitaElementCategory, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS, FLOW_BLOCKS, MAP_ENTRY_COMMON_ATTRS (+4 more)

### Community 22 - "WorkspaceManager"
Cohesion: 0.26
Nodes (6): registerWorkspaceFileRoutes(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.22
Nodes (19): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+11 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.05
Nodes (70): FileContentResult, WorkspaceDitavalSummary, WorkspaceFileNode, BranchIndexState, collectAllFilePaths(), SemanticContextResponse, buildScaleDitaProject(), EditorTabBarProps (+62 more)

### Community 26 - "files/routes.ts"
Cohesion: 0.13
Nodes (17): fastify@^5.2.0, CreateServerOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, handleWorkspaceError() (+9 more)

### Community 27 - "SourceEditor.tsx"
Cohesion: 0.14
Nodes (16): @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, formatDitaXml(), SourceEditor() (+8 more)

### Community 28 - "VisualEditor.tsx"
Cohesion: 0.21
Nodes (13): BlockConvertOption, BlockHandle(), BlockHandleProps, MODE_LABEL, moveDitaNodeSibling(), InlineBubbleInfo, InlineBubbleToolbarProps, InsertElementChoice (+5 more)

### Community 29 - "SourceEditor.tsx"
Cohesion: 0.17
Nodes (14): @codemirror/autocomplete@^6.20.4, @codemirror/state@^6.7.6, createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag(), PROFILING_ATTR_SET, DitaDecorationsCallbacks, completeAtEnd() (+6 more)

### Community 30 - "WorkspaceSemanticIndexer"
Cohesion: 0.24
Nodes (3): createServer(), registerSemanticIndexerRoutes(), WorkspaceSemanticIndexer

### Community 31 - "workspace-fs.ts"
Cohesion: 0.18
Nodes (12): countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot(), WorkspaceCreateKind, WorkspaceDiagnostic (+4 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.17
Nodes (15): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), INLINE_HOST_TAGS, isInlineOnlyContent() (+7 more)

### Community 33 - "decorations-and-inserter.test.ts"
Cohesion: 0.25
Nodes (6): updateNodeRawAttr(), createDitaDecorationsPlugin(), DITA_DECORATIONS_KEY, noopCallbacks, pmDocToXml(), DITA_SAMPLE_DOCUMENTS

### Community 34 - "VisualEditor"
Cohesion: 0.15
Nodes (13): computeBlockGaps(), findBlockHandleTarget(), planBlockMove(), deleteDitaNodeAtPos(), duplicateDitaBlockAtPos(), moveDitaBlockToGap(), selectNodeAtPos(), SemanticViewRegistry (+5 more)

### Community 35 - "selection-info.ts"
Cohesion: 0.33
Nodes (12): getBlockConvertOptions(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot(), isInlineTagAllowedAtSelection(), makeBreadcrumbItem() (+4 more)

### Community 36 - "inline-selection.ts"
Cohesion: 0.17
Nodes (12): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+4 more)

### Community 37 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `semantic-engine.ts` to `decorations.ts`, `dita-map.ts`, `DITAEditor`, `WorkspaceManager`, `editor-store.ts`, `SourceEditor.tsx`, `workspace-fs.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `semantic-engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05343993267410057 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `decorations.ts`, `dependencies`, `editor-store.ts`, `SourceEditor.tsx`, `VisualEditor.tsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `slimdom` connect `semantic-engine.ts` to `dita-map.ts`, `converter.ts`, `decorations.ts`, `Core Package Manifest`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06345848757271286 - nodes in this community are weakly interconnected._