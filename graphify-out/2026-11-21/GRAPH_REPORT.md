# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 92 files · ~82,075 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 35 file(s) not represented in the graph (top: .dita 25, .ditamap 4, .ditaval 3)

## Summary
- 872 nodes · 2250 edges · 49 communities (37 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17bd3b64`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dita-core/src/index.ts
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
- editor-store.ts
- AGENTS.md
- dita-rules.ts
- dita-core/src/index.ts
- scripts
- commands.ts
- XmlParseError
- vite.config.ts
- @codemirror/search
- VisualEditor.tsx
- SourceEditor.tsx
- parser.ts
- prosemirror-model@^1.25.13
- block-transforms.ts
- serializer.ts
- VisualEditor
- selection-info.ts
- inline-selection.ts
- cals-table.ts
- dita-elements.ts
- schema.ts
- compare.ts
- @codemirror/lang-xml
- @codemirror/language
- @codemirror/view
- prosemirror-view
- react-dnd-html5-backend@^16.0.1
- react-resizable-panels
- tailwindcss@^4.3.5
- zustand

## God Nodes (most connected - your core abstractions)
1. `App()` - 29 edges
2. `parseXml()` - 29 edges
3. `parseDitaMap()` - 28 edges
4. `lucide-react` - 26 edges
5. `react` - 26 edges
6. `getPmNodeRawAttrs()` - 26 edges
7. `VisualEditor` - 24 edges
8. `getRawAttr()` - 21 edges
9. `getPmNodeTagName()` - 21 edges
10. `resolveDitaHref()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `4.5 Isomorphic `@dita/core` & Runtime Gotchas` --references--> `browserStreamStubPlugin()`  [INFERRED]
  AGENTS.md → apps/web/vite.config.ts
- `4.4 OASIS CALS Table Fidelity` --references--> `hasMultipleTgroups()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/cals/cals-table.ts
- `WorkspaceMapSummary` --references--> `XmlParseError`  [EXTRACTED]
  apps/api/src/modules/files/workspace-fs.ts → packages/dita-core/src/xml/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (49 total, 12 thin omitted)

### Community 0 - "dita-core/src/index.ts"
Cohesion: 0.08
Nodes (22): loadDoc(), xmlToPmDoc(), ditaSchema, ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages() (+14 more)

### Community 1 - "web/package.json"
Cohesion: 0.14
Nodes (17): @lezer/highlight@^1.2.5, devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, typescript (+9 more)

### Community 2 - "converter.ts"
Cohesion: 0.19
Nodes (18): appendPmNodeToDom(), applyRawAttrs(), convertBlockContainerChildren(), convertInlineChildren(), convertInlineNode(), elementContainsBlockChild(), INLINE_PREFERRED_PARENTS, isBlockChildElement() (+10 more)

### Community 3 - "decorations.ts"
Cohesion: 0.14
Nodes (21): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createDitaDecorationsPlugin(), createOxygenTagDom(), createProfilingBadgeDom() (+13 more)

### Community 4 - "App.tsx"
Cohesion: 0.06
Nodes (54): App(), EditorTabBar(), LeftSidebar(), LeftSidebarProps, NewMapDialog(), DEFAULT_DIR_FOR_TYPE, NewTopicDialog(), NewTopicDialogProps (+46 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.09
Nodes (28): dependencies, @dita/core@workspace:*, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, zod@^3.24.2, devDependencies, tsx@^4.19.3 (+20 more)

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
Cohesion: 0.05
Nodes (45): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaPrologNodeView (+37 more)

### Community 18 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, @codemirror/commands@^6.11.1, @dita/core@workspace:*, lucide-react@^1.76.0, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4, prosemirror-gapcursor@^1.4.1, prosemirror-history@^1.5.2 (+16 more)

### Community 19 - "editor-store.ts"
Cohesion: 0.07
Nodes (78): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, buildCompositeMapTree(), CompositeMapTreeResult (+70 more)

### Community 20 - "AGENTS.md"
Cohesion: 0.13
Nodes (13): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests (+5 more)

### Community 21 - "dita-rules.ts"
Cohesion: 0.14
Nodes (13): BODY_BLOCKS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DITA_ELEMENT_SPECS, DitaElementCategory, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS, FLOW_BLOCKS (+5 more)

### Community 22 - "dita-core/src/index.ts"
Cohesion: 0.06
Nodes (45): createServer(), CreateServerOptions, ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, handleWorkspaceError() (+37 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.21
Nodes (19): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+11 more)

### Community 25 - "XmlParseError"
Cohesion: 0.09
Nodes (33): FileContentResult, WorkspaceFileNode, react-arborist@^4.0.1, EditorTabBarProps, TAB_TYPE_BADGE, FileExplorerPanel(), FileExplorerPanelProps, FileIcon() (+25 more)

### Community 26 - "vite.config.ts"
Cohesion: 0.25
Nodes (6): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, vite@^6.2.0, browserStreamStubPlugin(), @tailwindcss/vite, vite

### Community 28 - "VisualEditor.tsx"
Cohesion: 0.14
Nodes (23): BlockConvertOption, BlockHandle(), BlockHandleProps, MODE_LABEL, moveDitaNodeSibling(), EditorToolbar(), EditorToolbarProps, InlineBubbleInfo (+15 more)

### Community 29 - "SourceEditor.tsx"
Cohesion: 0.21
Nodes (13): @codemirror/autocomplete@^6.20.4, @codemirror/lint@^6.9.8, @codemirror/state@^6.7.6, ditaXmlCompletionSource(), findEnclosingXmlTag(), SourceEditor(), sourceEditorTheme, createDitaXmlLinter() (+5 more)

### Community 30 - "parser.ts"
Cohesion: 0.18
Nodes (15): AttributesPanelProps, extractDoctype(), extractXmlDeclaration(), findRootElementStartOffset(), lineColumnToOffset(), parseSaxesError(), ParseXmlOptions, PositionTrackedSlimdomNode (+7 more)

### Community 32 - "block-transforms.ts"
Cohesion: 0.17
Nodes (15): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), INLINE_HOST_TAGS, isInlineOnlyContent() (+7 more)

### Community 33 - "serializer.ts"
Cohesion: 0.28
Nodes (15): isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), escapeXmlAttr(), escapeXmlText(), formatDoctype(), hasBlockChildren(), hasNonWhitespaceTextOrInline() (+7 more)

### Community 34 - "VisualEditor"
Cohesion: 0.17
Nodes (11): computeBlockGaps(), findBlockHandleTarget(), planBlockMove(), deleteDitaNodeAtPos(), duplicateDitaBlockAtPos(), moveDitaBlockToGap(), selectNodeAtPos(), createDitaNodeViews() (+3 more)

### Community 35 - "selection-info.ts"
Cohesion: 0.36
Nodes (11): getBlockConvertOptions(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot(), isInlineTagAllowedAtSelection(), makeBreadcrumbItem() (+3 more)

### Community 36 - "inline-selection.ts"
Cohesion: 0.29
Nodes (10): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+2 more)

### Community 37 - "cals-table.ts"
Cohesion: 0.31
Nodes (10): CalsCellSpan, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows(), resolveCalsEntrySpan() (+2 more)

### Community 38 - "dita-elements.ts"
Cohesion: 0.18
Nodes (10): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+2 more)

### Community 39 - "schema.ts"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 40 - "compare.ts"
Cohesion: 0.43
Nodes (6): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry, ParsedXmlDocument

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 237 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `slimdom` connect `cals-table.ts` to `dita-core/src/index.ts`, `serializer.ts`, `converter.ts`, `Core Package Manifest`, `compare.ts`, `node-views.ts`, `editor-store.ts`, `parser.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dita-core/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `prosemirror-state` connect `decorations.ts` to `block-transforms.ts`, `web/package.json`, `VisualEditor`, `selection-info.ts`, `inline-selection.ts`, `dita-core/src/index.ts`, `node-views.ts`, `dependencies`, `commands.ts`, `VisualEditor.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `VisualEditor.tsx` to `web/package.json`, `App.tsx`, `dependencies`, `dita-core/src/index.ts`, `XmlParseError`, `SourceEditor.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `decorations.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._