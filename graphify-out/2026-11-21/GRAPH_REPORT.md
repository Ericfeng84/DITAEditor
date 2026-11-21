# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- 60 files · ~43,621 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .dita 10, (none) 1, .css 1)

## Summary
- 579 nodes · 1277 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a78d008b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Core Barrel & XML Parser
- devDependencies
- converter.ts
- VisualEditor.tsx
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
- web/package.json
- SourceEditor.tsx
- AGENTS.md
- dita-rules.ts
- dita-completion.ts
- scripts

## God Nodes (most connected - your core abstractions)
1. `getPmNodeRawAttrs()` - 24 edges
2. `compilerOptions` - 16 edges
3. `App()` - 15 edges
4. `getRawAttr()` - 15 edges
5. `parseXml()` - 15 edges
6. `RawAttrs` - 13 edges
7. `react` - 12 edges
8. `slimdom` - 12 edges
9. `serializeElementNode()` - 12 edges
10. `createDitaNodeViews()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Source ↔ Visual Transition Safety` --references--> `checkXmlWellFormed()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/parser.ts
- `4.1 Lossless XML Round-Trip & Minimal Git Diff` --references--> `serializeXml()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/xml/serializer.ts
- `4.5 Isomorphic `@dita/core` & Runtime Gotchas` --references--> `browserStreamStubPlugin()`  [INFERRED]
  AGENTS.md → apps/web/vite.config.ts
- `4.4 OASIS CALS Table Fidelity` --references--> `hasMultipleTgroups()`  [INFERRED]
  AGENTS.md → packages/dita-core/src/cals/cals-table.ts
- `NewTopicDialogProps` --references--> `DitaTopicTemplateType`  [EXTRACTED]
  apps/web/src/components/NewTopicDialog.tsx → packages/dita-core/src/templates/topic-templates.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (24 total, 2 thin omitted)

### Community 0 - "Core Barrel & XML Parser"
Cohesion: 0.06
Nodes (41): SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, DITA_CORE_VERSION, findDirectElementIndexInPmParent(), findDomElementByPath(), findElementPathAtOffset() (+33 more)

### Community 1 - "devDependencies"
Cohesion: 0.11
Nodes (17): 4.5 Isomorphic `@dita/core` & Runtime Gotchas, @tailwindcss/vite@^4.3.5, devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4 (+9 more)

### Community 2 - "converter.ts"
Cohesion: 0.05
Nodes (77): SourceEditorProps, CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs() (+69 more)

### Community 3 - "VisualEditor.tsx"
Cohesion: 0.08
Nodes (48): createDitaElementSkeleton(), deleteDitaNodeAtPos(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement() (+40 more)

### Community 4 - "App.tsx"
Cohesion: 0.07
Nodes (44): lucide-react@^1.76.0, react@^19.0.0, App(), NewTopicDialog(), NewTopicDialogProps, TOPIC_OPTIONS, BADGE_COLORS, WorkbenchHeader() (+36 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (25): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+17 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.10
Nodes (25): dependencies, @dita/core@workspace:*, fastify@^5.2.0, zod@^3.24.2, devDependencies, tsx@^4.19.3, @types/node@^22.13.0, typescript@^5.8.0 (+17 more)

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
Cohesion: 0.11
Nodes (28): CalsColspecNodeView, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaRefInlineNodeView, addTableColumn(), addTableRow(), buildCalsSectionGrid() (+20 more)

### Community 18 - "web/package.json"
Cohesion: 0.08
Nodes (35): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/lint@^6.9.8, @dita/core@workspace:*, @lezer/highlight@^1.2.5, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4, prosemirror-gapcursor@^1.4.1 (+27 more)

### Community 19 - "SourceEditor.tsx"
Cohesion: 0.15
Nodes (16): @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, formatDitaXml(), SourceEditor(), sourceEditorTheme (+8 more)

### Community 20 - "AGENTS.md"
Cohesion: 0.13
Nodes (13): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.6 Golden Regression Tests (+5 more)

### Community 21 - "dita-rules.ts"
Cohesion: 0.14
Nodes (13): BODY_BLOCKS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DITA_ELEMENT_SPECS, DitaElementCategory, ELEMENT_SPEC_LIST, ELEMENT_SPECIFIC_ATTRS, FLOW_BLOCKS (+5 more)

### Community 22 - "dita-completion.ts"
Cohesion: 0.36
Nodes (8): @codemirror/state@^6.7.6, ditaXmlCompletionSource(), findEnclosingXmlTag(), completeAtEnd(), getAllowedChildElementTags(), getAttributesForElement(), @codemirror/autocomplete, @codemirror/state

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 171 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastify` connect `API Package Manifest` to `Core Barrel & XML Parser`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Barrel & XML Parser` be split into smaller, more focused modules?**
  _Cohesion score 0.062003968253968256 - nodes in this community are weakly interconnected._
- **Why does `slimdom` connect `converter.ts` to `Core Barrel & XML Parser`, `Core Package Manifest`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `4. Non-Negotiable Engineering Invariants` connect `AGENTS.md` to `devDependencies`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `converter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05170998632010944 - nodes in this community are weakly interconnected._