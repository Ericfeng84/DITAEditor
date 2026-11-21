# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 69 files · ~52,918 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .dita 10, (none) 1, .css 1)

## Summary
- 664 nodes · 1543 edges · 36 communities (25 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `156d30d3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dita-core/src/index.ts
- devDependencies
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
- helpers.ts
- AGENTS.md
- dita-rules.ts
- @codemirror/commands
- scripts
- VisualEditor.tsx
- table-commands.ts
- vite.config.ts
- web/package.json
- @lezer/highlight@^1.2.5
- prosemirror-commands
- prosemirror-keymap
- prosemirror-model@^1.25.13
- prosemirror-dropcursor
- prosemirror-gapcursor
- prosemirror-inputrules@^1.7.0
- react-dom

## God Nodes (most connected - your core abstractions)
1. `getPmNodeRawAttrs()` - 26 edges
2. `VisualEditor` - 24 edges
3. `getPmNodeTagName()` - 21 edges
4. `xmlToPmDoc()` - 16 edges
5. `compilerOptions` - 16 edges
6. `prosemirror-state` - 15 edges
7. `react` - 15 edges
8. `App()` - 15 edges
9. `getAllowedChildElements()` - 15 edges
10. `getRawAttr()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `4.5 Isomorphic `@dita/core` & Runtime Gotchas` --references--> `browserStreamStubPlugin()`  [INFERRED]
  AGENTS.md → apps/web/vite.config.ts
- `4.4 OASIS CALS Table Fidelity` --references--> `hasMultipleTgroups()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/cals/cals-table.ts
- `InlineBubbleToolbarProps` --references--> `DitaElementSpec`  [EXTRACTED]
  apps/web/src/editor/visual/InlineBubbleToolbar.tsx → packages/dita-core/src/model/dita-rules.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (36 total, 11 thin omitted)

### Community 0 - "dita-core/src/index.ts"
Cohesion: 0.09
Nodes (22): buildState(), loadDoc(), xmlToPmDoc(), ditaSchema, ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings() (+14 more)

### Community 1 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, typescript, vitest, @types/react (+1 more)

### Community 2 - "converter.ts"
Cohesion: 0.05
Nodes (79): AttributesPanelProps, CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs() (+71 more)

### Community 3 - "decorations.ts"
Cohesion: 0.15
Nodes (19): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createOxygenTagDom(), createProfilingBadgeDom(), DITA_DECORATIONS_KEY (+11 more)

### Community 4 - "App.tsx"
Cohesion: 0.06
Nodes (61): lucide-react@^1.76.0, react@^19.0.0, App(), NewTopicDialog(), NewTopicDialogProps, TOPIC_OPTIONS, BADGE_COLORS, WorkbenchHeader() (+53 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, @dita/core@workspace:*, fastify@^5.2.0, zod@^3.24.2, devDependencies, tsx@^4.19.3, @types/node@^22.13.0, typescript@^5.8.0 (+18 more)

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
Cohesion: 0.08
Nodes (14): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaPrologNodeView (+6 more)

### Community 18 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, prosemirror-history@^1.5.2, prosemirror-state@^1.4.4, prosemirror-view@^1.43.0, react-resizable-panels@^4.24.1 (+8 more)

### Community 19 - "helpers.ts"
Cohesion: 0.31
Nodes (9): countCalsTgroups(), findDirectElementIndexInPmParent(), findNthDirectElementChild(), findPmPosByElementPath(), isDitaElementPmNode(), pmHasMultipleTgroups(), resolvePmElementPath(), UNKNOWN_NODE_TYPES (+1 more)

### Community 20 - "AGENTS.md"
Cohesion: 0.13
Nodes (13): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests (+5 more)

### Community 21 - "dita-rules.ts"
Cohesion: 0.10
Nodes (24): @codemirror/autocomplete@^6.20.4, @codemirror/state@^6.7.6, ditaXmlCompletionSource(), findEnclosingXmlTag(), GROUP_LABELS, completeAtEnd(), BODY_BLOCKS, DITA_CONTENT_MODEL (+16 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "VisualEditor.tsx"
Cohesion: 0.06
Nodes (82): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps() (+74 more)

### Community 25 - "table-commands.ts"
Cohesion: 0.23
Nodes (23): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+15 more)

### Community 26 - "vite.config.ts"
Cohesion: 0.20
Nodes (8): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, browserStreamStubPlugin(), @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 27 - "web/package.json"
Cohesion: 0.18
Nodes (10): @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, @dita/core@workspace:*, @dita/core, name, private, type, version (+2 more)

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 196 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `slimdom` connect `converter.ts` to `dita-core/src/index.ts`, `helpers.ts`, `Core Package Manifest`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dita-core/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08907563025210084 - nodes in this community are weakly interconnected._
- **Why does `prosemirror-state` connect `VisualEditor.tsx` to `decorations.ts`, `table-commands.ts`, `dependencies`, `web/package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.051201671891327065 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05730238025271819 - nodes in this community are weakly interconnected._
- **Should `Core Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._