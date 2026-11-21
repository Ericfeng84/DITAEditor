# Graph Report - DITAEditor  (2026-11-21)

## Corpus Check
- Corpus is ~12,848 words - fits in a single context window. You may not need a graph.

## Summary
- 314 nodes · 517 edges · 17 communities (15 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Core Barrel & XML Parser
- Web App Package Manifest
- DITA Element Registry & Serializer
- CALS Table & XPath Utilities
- ProseMirror Schema & Converter
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `parseXml()` - 12 edges
3. `serializeElementNode()` - 12 edges
4. `slimdom` - 11 edges
5. `convertBlockElement()` - 9 edges
6. `isWhitespacePreservingElement()` - 8 edges
7. `convertBlockContainerChildren()` - 8 edges
8. `isBlockElementName()` - 7 edges
9. `serializeInlineNode()` - 7 edges
10. `serializeXml()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md Graphify Rules` --conceptually_related_to--> `.claude/CLAUDE.md Graphify Trigger`  [INFERRED]
  CLAUDE.md → .claude/CLAUDE.md
- `CalsColSpec` --references--> `XmlAttributeEntry`  [EXTRACTED]
  packages/dita-core/src/cals/cals-table.ts → packages/dita-core/src/xml/types.ts
- `convertBlockElement()` --calls--> `isWhitespacePreservingElement()`  [EXTRACTED]
  packages/dita-core/src/prosemirror/converter.ts → packages/dita-core/src/model/dita-elements.ts
- `isBlockChildElement()` --calls--> `isBlockElementName()`  [EXTRACTED]
  packages/dita-core/src/prosemirror/converter.ts → packages/dita-core/src/model/dita-elements.ts
- `xmlToPmDoc()` --calls--> `parseXml()`  [EXTRACTED]
  packages/dita-core/src/prosemirror/converter.ts → packages/dita-core/src/xml/parser.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (17 total, 2 thin omitted)

### Community 0 - "Core Barrel & XML Parser"
Cohesion: 0.08
Nodes (24): hasMultipleTgroups(), updateCalsEntrySpanAttrs(), DITA_CORE_VERSION, ditaSchema, RawAttrs, getNodeSourceRange(), ConrefUsage, evaluateXPathToFirstNode() (+16 more)

### Community 1 - "Web App Package Manifest"
Cohesion: 0.07
Nodes (31): dependencies, @dita/core@workspace:*, react@^19.0.0, react-dom@^19.0.0, devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0 (+23 more)

### Community 2 - "DITA Element Registry & Serializer"
Cohesion: 0.12
Nodes (30): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind, isBlockElementName(), isInlineElementName() (+22 more)

### Community 3 - "CALS Table & XPath Utilities"
Cohesion: 0.13
Nodes (30): CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+22 more)

### Community 4 - "ProseMirror Schema & Converter"
Cohesion: 0.12
Nodes (24): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes, checkXmlWellFormed(), DitaXmlParseError, extractDoctype() (+16 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

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

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter`, `Visual-Source Dual-Mode State Machine` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 123 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastify` connect `API Package Manifest` to `Core Barrel & XML Parser`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Barrel & XML Parser` be split into smaller, more focused modules?**
  _Cohesion score 0.0782051282051282 - nodes in this community are weakly interconnected._
- **Why does `slimdom` connect `Core Package Manifest` to `Core Barrel & XML Parser`, `DITA Element Registry & Serializer`, `CALS Table & XPath Utilities`, `ProseMirror Schema & Converter`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `Web App Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._
- **Should `DITA Element Registry & Serializer` be split into smaller, more focused modules?**
  _Cohesion score 0.11931818181818182 - nodes in this community are weakly interconnected._
- **Should `CALS Table & XPath Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.1310483870967742 - nodes in this community are weakly interconnected._