# Graph Report - DITAEditor  (2026-11-25)

## Corpus Check
- 402 files · ~322,441 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 79 file(s) not represented in the graph (top: .dita 36, .css 25, (none) 5)

## Summary
- 3866 nodes · 10790 edges · 185 communities (151 shown, 34 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 460 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5798377`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- ai-prompt.ts
- converter.ts
- zh-CN.ts
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
- editor-store/types.ts
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- httpError
- scripts
- structure-options.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- theme-runtime.js
- serializer.ts
- deploy-site.yml
- electron-builder.yml
- MapTreePanel.tsx
- manual-registry-service.ts
- translate
- ref_vitest
- locales.ts
- api/src/index.ts
- use-visual-editor-view.ts
- PublishQueue
- editor-store/index.ts
- 4. 核心元素写作细则
- 快速开始
- DocsLayout.astro
- publish-service.ts
- devDependencies
- DITA Concept（概念）主题编写规范
- WorkspaceManager
- createServer
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- DITA Reference（参考）主题编写规范
- api/src/index.ts
- workbench-store.ts
- App.tsx
- dependencies
- ai-types.ts
- lock-service.ts
- editor-handle.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- theme-enhancer.ts
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- paths.ts
- checkXmlWellFormed
- AppShell.tsx
- VisualEditor.tsx
- en/architecture.md
- semantic-engine.ts
- dita-rules.ts
- SourceEditor.tsx
- zh/architecture.md
- build.mjs
- 前端 DITA 1.3 结构化写作合规实施说明
- SearchModal.astro
- docker-entrypoint.sh
- AttributesPanel.tsx
- html-theme-model.ts
- ai-service.ts
- devDependencies
- identity-api.ts
- en/features.md
- html-themes.ts
- zh/features.md
- HomePage.astro
- astro.config.ts
- en/ai-setup.md
- phase10-workbench-assignments-plan.md
- zh/ai-setup.md
- compilerOptions
- xpath.ts
- e2e-ai-live.mts
- node-views.ts
- topicGuideTree.ts
- web/src/i18n/locale.ts
- workspace-api.ts
- fragment-locator.ts
- MiniRoundTripDemo.tsx
- DiffViewer
- en/getting-started.md
- web/package.json
- vite.config.ts
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- DITAEditor
- PublishDialog.tsx
- zh/introduction.md
- zh/local-development.md
- DITAEditor
- Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板
- ditaval.ts
- scripts
- playground-presets.ts
- @codemirror/lang-xml@^6.1.0
- xmlToPmDoc
- @codemirror/search@^6.7.2
- selection-info.ts
- README.md
- @tailwindcss/vite@^4.3.5
- api/test/phase12-html-themes.test.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- dita-core/src/i18n/locale.ts
- theme-preview.ts
- ConrefReusePanel.tsx
- fragment-splice.ts
- sync-hf-space.sh
- map-tree-utils.ts
- inline-selection.ts
- HtmlThemeSelector.tsx
- prosemirror-model@^1.25.13
- ThemePreviewModal.tsx
- createTopicTemplate
- @codemirror/view@^6.43.15
- @lezer/highlight@^1.2.5
- resolveThemeOptions
- conref-drag.test.ts
- @codemirror/language@^6.13.1
- prosemirror-inputrules@^1.7.0
- HTML5 publish themes
- HtmlThemeId
- cloudbuild.yaml
- useI18n
- react-dom@^19.0.0
- react-resizable-panels
- NewTopicDialog.tsx
- selectors.ts
- react@^19.0.0
- Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）
- Getting started
- prosemirror/schema.ts
- AGENTS.md
- @codemirror/lang-xml@^6.1.0
- [0.5.0] — 2026-11-21
- @codemirror/autocomplete@^6.20.4
- desktop/package.json
- stage.mjs
- @tailwindcss/vite@^4.3.5
- env
- devDependencies
- build-desktop
- with
- scripts
- main.ts
- @codemirror/commands@^6.11.1
- tag
- @codemirror/state@^6.7.6
- desktop/tsconfig.json
- prosemirror-dropcursor@^1.8.4
- release-desktop.yml
- prosemirror-gapcursor@^1.4.1
- react-dnd-html5-backend@^16.0.1
- steps
- zustand
- attach-to-release
- electron
- @dita/core@workspace:*
- @codemirror/search@^6.7.2
- @lezer/highlight@^1.2.1
- prosemirror-history@^1.5.2
- prosemirror-state@^1.4.4
- deploy-cloudrun.sh
- prosemirror-state@^1.4.4
- react-arborist
- tailwindcss@^4.3.5

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 135 edges
2. `t()` - 94 edges
3. `App()` - 67 edges
4. `httpError()` - 64 edges
5. `createServer()` - 63 edges
6. `requestJson()` - 62 edges
7. `lucide-react` - 60 edges
8. `WorkspaceManager` - 58 edges
9. `translate()` - 56 edges
10. `apiT()` - 54 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `Website and GitHub Pages online demo (Phase 7)` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts
- `Fixed` --references--> `resolveDitaSpawn()`  [INFERRED]
  CHANGELOG.md → apps/api/src/modules/dita-ot/dita-runtime.ts
- `4.9 HTML5 Publish Themes (`Phase 12`)` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  AGENTS.md → apps/api/src/modules/files/workspace-fs.ts

## Import Cycles
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/map-tree.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/tabs.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (185 total, 34 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.16
Nodes (27): cancelPublishJob(), createPublishJob(), CreatePublishJobInput, fetchHtmlThemes(), fetchPublishJob(), fetchPublishJobs(), fetchPublishProfile(), fetchPublishRuntime() (+19 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (37): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinOptions, CheckinResponse, checkoutFile(), createGitBranch(), fetchBranches() (+29 more)

### Community 2 - "ai-prompt.ts"
Cohesion: 0.12
Nodes (25): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+17 more)

### Community 3 - "converter.ts"
Cohesion: 0.12
Nodes (29): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+21 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.07
Nodes (22): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enAssignments, enCollab, enCommon, enEditor, en (+14 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.06
Nodes (41): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2 (+33 more)

### Community 7 - "Root Monorepo Manifest"
Cohesion: 0.12
Nodes (19): devDependencies, turbo@^2.5.0, typescript@^5.8.0, vitest@^3.1.0, engines, node, typescript, vitest (+11 more)

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
Cohesion: 0.20
Nodes (9): allowBuilds, better-sqlite3, electron, electron-winstaller, esbuild, sharp, overrides, @electron/get@^3.0.0 (+1 more)

### Community 17 - "editor-store/types.ts"
Cohesion: 0.08
Nodes (49): KeyspacePanelProps, NewMapDialogProps, PublishDialogProps, TaskModelSwitchProps, WorkspaceDialogProps, setTaskContentModelSetting(), MapBufferState, MapNodeInspectorProps (+41 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.17
Nodes (37): tempDirs, extractTitleFromCheck(), createMapTreeSlice(), extractElementAttrs(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode() (+29 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.11
Nodes (17): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+9 more)

### Community 21 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/state@^6.7.6, @codemirror/view@^6.43.15, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4 (+15 more)

### Community 22 - "httpError"
Cohesion: 0.11
Nodes (13): FileLockRow, ManualRow, TopicAssignmentRow, AssignmentService, normalizeTopicPath(), parseStatus(), todayIso(), httpError() (+5 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "structure-options.ts"
Cohesion: 0.15
Nodes (27): resolveTaskModelForDocument(), insertBlockDitaElement(), insertBlockDitaElementAtPos(), insertMissingTopicBody(), resolveSequenceAnchor(), TOPIC_BODY_WRAPPER, insertReuseElementAtPos(), createDitaElementSkeleton() (+19 more)

### Community 25 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.11
Nodes (17): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract, 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1. 目标与边界, 2. 端到端架构与数据流, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+9 more)

### Community 26 - "theme-runtime.js"
Cohesion: 0.07
Nodes (80): absolutePath(), activateOnpage(), addSkipLink(), applyMode(), assembleLayout(), boot(), buildOnpage(), buildPager() (+72 more)

### Community 27 - "serializer.ts"
Cohesion: 0.16
Nodes (22): DITA_STRUCTURAL_ELEMENT_CONTAINERS, isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild (+14 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "MapTreePanel.tsx"
Cohesion: 0.26
Nodes (12): profilingBadgeClasses(), CompositeMapTreeNode, MapNodeContextMenu(), MapNodeContextMenuProps, MapNodeMenuTarget, createMapTreeNodeRenderer(), MapNodeRowActions, NodeKindIcon() (+4 more)

### Community 31 - "manual-registry-service.ts"
Cohesion: 0.07
Nodes (25): ApiLocale, WorkspaceScaffold, repositoryIdFor(), firstHeader(), firstQuery(), ManualContextResolver, ManualContextResolverOptions, manualIdForRoot() (+17 more)

### Community 32 - "translate"
Cohesion: 0.10
Nodes (25): defaultInstruction(), targetLabel(), createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModelSetting(), hydrateEmptyContainerAtPos() (+17 more)

### Community 33 - "ref_vitest"
Cohesion: 0.06
Nodes (56): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), resolveTaskModelForXml(), 8.3 新增一种结构诊断码, 9. 关键文件索引, DITA_CORE_VERSION, DITA_BLOCK_TAGS, DITA_CONTENT_MODEL, DITA_ELEMENT_SPECS (+48 more)

### Community 34 - "locales.ts"
Cohesion: 0.14
Nodes (26): anchor(), columns, dict, home, Props, year, dict, isDocs (+18 more)

### Community 35 - "api/src/index.ts"
Cohesion: 0.04
Nodes (49): resetDitaRuntimeCache(), crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer(), ADMIN (+41 more)

### Community 36 - "use-visual-editor-view.ts"
Cohesion: 0.08
Nodes (47): AttributesPanelProps, collectDitaDecorations(), createBlockGapInserterDom(), createDitaDecorationsPlugin(), createChevronCapSvg(), createDitavalFlagPillDom(), createOxygenTagDom(), createProfilingBadgeDom() (+39 more)

### Community 37 - "PublishQueue"
Cohesion: 0.11
Nodes (12): PublishQueue, PublishQueueOptions, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 10. Manual workbench and topic assignment (Phase 10), 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL) (+4 more)

### Community 38 - "editor-store/index.ts"
Cohesion: 0.08
Nodes (33): AiPanelActions, useAiPanelActions(), UseAiPanelActionsDeps, EditorTabBar(), EditorTabBarProps, TAB_TYPE_BADGE, changeLabelKey(), GitPanel() (+25 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "快速开始"
Cohesion: 0.25
Nodes (8): 后端环境变量（`@dita/api`）, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版）, 方式二：本地源码 + 本机 DITA-OT, 方式四：仅编辑 / 语义写作（不安装 DITA-OT）, 本机 DITA-OT 配置, 环境要求

### Community 41 - "DocsLayout.astro"
Cohesion: 0.09
Nodes (18): bySlug, dict, groups, Props, paths, Props, Locale, dict (+10 more)

### Community 42 - "publish-service.ts"
Cohesion: 0.04
Nodes (72): PublishJobRow, apiCatalogue(), apiMessagesEn, apiMessagesZh, apiT(), CATALOGUES, CreateServerOptions, DITA_FILE (+64 more)

### Community 43 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, vitest@^3.1.0, @types/react, @types/react-dom (+3 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "WorkspaceManager"
Cohesion: 0.08
Nodes (23): registerWorkspaceFileRoutes(), resolveSafeWorkspacePathFor(), countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, isWithinRoot() (+15 more)

### Community 46 - "createServer"
Cohesion: 0.11
Nodes (9): collectAllFilePaths(), summarizeDitaval(), WorkspaceSemanticIndexer, 4.1 `ManualContextResolver`（请求级上下文解析器）, basenamePosix(), classifyDitaFileKind(), normalizePosixPath(), DitaSemanticIndex (+1 more)

### Community 47 - "Changelog"
Cohesion: 0.12
Nodes (17): [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.2.0] — 2026-11-22, [1.3.0] — 2026-11-24, Added, Added, Added (+9 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.11
Nodes (18): platforms, Props, Props, Props, Props, QuickStartTabs(), en, DICTIONARIES (+10 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "api/src/index.ts"
Cohesion: 0.05
Nodes (78): firstHeaderValue(), RequestLike, resolveRequestLocale(), ApiMessageKey, ApiMessageParams, createServer(), createLangChainModelFactory(), requireAdmin() (+70 more)

### Community 52 - "workbench-store.ts"
Cohesion: 0.06
Nodes (53): ManualAssignmentsPanelProps, Assignment, AssignmentCreateInput, AssignmentListQuery, AssignmentPerson, AssignmentScope, AssignmentStatus, AssignmentStatusFilter (+45 more)

### Community 53 - "App.tsx"
Cohesion: 0.13
Nodes (32): App(), AppProps, CheckinDialog(), DelegateTopicButton(), AssignmentBadge, BADGE_TONE, FileExplorerPanel(), FileIcon() (+24 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/merge@^6.12.3, @dita/core@workspace:*, lucide-react@^1.76.0, prosemirror-keymap@^1.2.3, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0 (+10 more)

### Community 55 - "ai-types.ts"
Cohesion: 0.06
Nodes (65): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+57 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.05
Nodes (59): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), AiUsageLogRow, aiUsageLogs, fileLocks, LockBackupRow (+51 more)

### Community 57 - "editor-handle.ts"
Cohesion: 0.17
Nodes (28): updateNodeRawAttr(), MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandle, VisualEditorHandleDeps, mergeCalsCellDown(), mergeCalsCellRight() (+20 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.14
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "theme-enhancer.ts"
Cohesion: 0.15
Nodes (27): appendBodyClasses(), buildSearchEntry(), collapseWhitespace(), collectHtmlFiles(), copySharedAsset(), copyWorkspaceAsset(), decodeEntities(), depthOf() (+19 more)

### Community 61 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 62 - "paths.ts"
Cohesion: 0.33
Nodes (7): startEmbeddedServer(), DesktopPathInput, DesktopRuntimePaths, ensureInitialWorkspace(), normalizeDesktopVersion(), resolveDesktopPaths(), tempDirs

### Community 63 - "checkXmlWellFormed"
Cohesion: 0.13
Nodes (25): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, 1. `@dita/core` — `src/ai/`, 4.2 三种靶向定位与无损回拼策略 (+17 more)

### Community 64 - "AppShell.tsx"
Cohesion: 0.09
Nodes (41): AppShell(), EditorState, t(), rootEl, AppRoute, BASE, currentRoute, editorPath() (+33 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.11
Nodes (43): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, blockIndexInContainer(), blockIndexInParent(), BlockMovePlan, buildBlockHandleTarget() (+35 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "semantic-engine.ts"
Cohesion: 0.09
Nodes (39): extractProfilingValuesFromDocument(), IMAGE_EXTENSIONS, ResolvedDitaHref, DITA_INLINE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+31 more)

### Community 68 - "dita-rules.ts"
Cohesion: 0.12
Nodes (16): ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS, DitaElementCategory, ELEMENT_DESCRIPTIONS_ZH, ELEMENT_SPEC_LIST (+8 more)

### Community 69 - "SourceEditor.tsx"
Cohesion: 0.08
Nodes (30): FileContentResult, WorkspaceDitavalSummary, WorkspaceFileNode, BranchIndexState, SemanticContextResponse, ConrefReusePanelProps, InsertKeyrefDialogProps, ProfilingAttrEditorProps (+22 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "build.mjs"
Cohesion: 0.29
Nodes (6): esbuild@^0.25.0, DESKTOP_ROOT, __dirname, DIST_DIR, esmCreateRequireBanner, esbuild

### Community 72 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.07
Nodes (30): buildStructureDecorations(), entry(), 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次 (+22 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "AttributesPanel.tsx"
Cohesion: 0.13
Nodes (31): ConrefReusePanel(), PROFILING_BADGE_CLASSES, ProfilingAttrEditor(), TopicInspector(), XrefImageDialog(), createDitaXmlCompletionSource(), getTaskContentModel(), AttributesPanel() (+23 more)

### Community 76 - "html-theme-model.ts"
Cohesion: 0.19
Nodes (16): applyThemeSelection(), clampText(), collectThemeAssetPaths(), defaultThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizeAccentColor(), normalizeThemeDraft() (+8 more)

### Community 77 - "ai-service.ts"
Cohesion: 0.03
Nodes (97): aiSettings, AiSettingsRow, AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice() (+89 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "identity-api.ts"
Cohesion: 0.17
Nodes (19): DelegateTopicButtonProps, IdentitySwitcher(), IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, TopicAssignmentBannerProps, WorkbenchHeader(), WorkbenchHeaderProps (+11 more)

### Community 80 - "en/features.md"
Cohesion: 0.14
Nodes (13): Bilingual UI, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Manual workbench and topic assignment (+5 more)

### Community 81 - "html-themes.ts"
Cohesion: 0.11
Nodes (24): ACCENT_DARK_TEXT, ACCENT_LIGHT_TEXT, accentScale(), contrastRatio(), DEFAULT_HTML_FEATURES, findRepoRoot(), HtmlThemeAccentScale, HtmlThemeCatalogEntry (+16 more)

### Community 82 - "zh/features.md"
Cohesion: 0.14
Nodes (13): Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 中英双语界面, 协作与版本, 单一信息源, 双模编辑 (+5 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.17
Nodes (11): dict, jsonLd, layerRows, Props, screenshotUrl(), showcaseImages, digest(), digests (+3 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.14
Nodes (9): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, collections, docs, astro, @astrojs/react (+1 more)

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "phase10-workbench-assignments-plan.md"
Cohesion: 0.11
Nodes (13): Consequences, Considered Options, Model each Manual as an independent workspace and Git repository, Consequences, Considered Options, Scope backend workspace and semantic index per request by Manual ID and branch, Consequences, Considered Options (+5 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "xpath.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.19
Nodes (14): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+6 more)

### Community 91 - "node-views.ts"
Cohesion: 0.06
Nodes (19): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView (+11 more)

### Community 92 - "topicGuideTree.ts"
Cohesion: 0.10
Nodes (40): GROUP_LABEL_KEYS, GuideTreeNode(), GuideTreeNodeProps, isTopicGuideType(), readInitialExpanded(), TagFacts(), TagFactsProps, TopicAuthoringGuide() (+32 more)

### Community 93 - "web/src/i18n/locale.ts"
Cohesion: 0.15
Nodes (18): interpolate(), DEFAULT_UI_LOCALE, detectBrowserLocale(), LOCALE_STORAGE_KEY, LocaleListener, localeListeners, LocaleState, notifyLocaleChange() (+10 more)

### Community 94 - "workspace-api.ts"
Cohesion: 0.18
Nodes (24): createWorkspaceDir(), createWorkspaceFile(), createWorkspaceProject(), deleteWorkspaceEntry(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace() (+16 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.21
Nodes (19): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+11 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "DiffViewer"
Cohesion: 0.11
Nodes (24): 4.7 AI Assistance (`Phase 6`), useAiStore, AiAssistantPanel(), AiDiffDialog(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), DiffDialog() (+16 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, @codemirror/commands, @codemirror/lint, prosemirror-commands, prosemirror-history (+5 more)

### Community 101 - "en/introduction.md"
Cohesion: 0.18
Nodes (10): Bilingual by default, Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy (+2 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "DITAEditor"
Cohesion: 0.10
Nodes (21): 10. 手册工作台与 Topic 委派（Phase 10）, 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, AI 辅助写作与安全 Diff (+13 more)

### Community 105 - "PublishDialog.tsx"
Cohesion: 0.35
Nodes (10): themeOptionsFromDraft(), HtmlThemeSelector(), formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+2 more)

### Community 106 - "zh/introduction.md"
Cohesion: 0.18
Nodes (10): 下一步, 为谁而写, 单一信息源, 双语是一等公民, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么 (+2 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "DITAEditor"
Cohesion: 0.14
Nodes (14): AI-assisted authoring with safe diffs, Architecture and technology stack, DITA-OT 4.x strict validation and async HTML5 / CJK PDF publishing, DITAEditor, Fully bilingual stack (Phase 8), License, Local Git versioning, check-out locks, and visual diffs, Manual workbench: distribute first, write second (Phase 10) (+6 more)

### Community 109 - "Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板"
Cohesion: 0.10
Nodes (19): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 HTML5 样式模板设计矩阵, 3.1 为什么将主题资产存放在 `dita-ot-plugins/html5-themes/`？, 3.2 `Html5ThemeEnhancer` 关键实现细节, 3. 总体架构与发布增强流水线, 4.1 SQLite 数据表：`manual_publish_profiles`, 4.2 TypeScript 类型契约 (+11 more)

### Community 110 - "ditaval.ts"
Cohesion: 0.13
Nodes (21): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), InMemoryDemoWorkspace, ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint (+13 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.11
Nodes (12): CAPABILITIES, Capability, FeatureIcon, QUICK_START_TABS, QuickStartTab, PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture (+4 more)

### Community 114 - "xmlToPmDoc"
Cohesion: 0.06
Nodes (28): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`), 4.9 HTML5 Publish Themes (`Phase 12`), 4. Non-Negotiable Engineering Invariants (+20 more)

### Community 116 - "selection-info.ts"
Cohesion: 0.16
Nodes (21): BlockConvertOption, BlockHandleProps, InlineBubbleToolbarProps, buildBlockInsertGroups(), NON_INSERTABLE_BLOCK_TAGS, InsertElementChoice, InsertElementMenuProps, ActiveTableInfo (+13 more)

### Community 117 - "README.md"
Cohesion: 0.31
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 119 - "api/test/phase12-html-themes.test.ts"
Cohesion: 0.15
Nodes (9): DEFAULT_HTML_THEME_ID, HTML_THEME_IDS, HTML_THEME_LABELS, htmlThemeOptionsSchema, THEME_OPTION_LIMITS, HtmlThemeSearchEntry, OUTPUT_FILES, tempDirs (+1 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "dita-core/src/i18n/locale.ts"
Cohesion: 0.16
Nodes (10): COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey, coreMessagesEn (+2 more)

### Community 122 - "theme-preview.ts"
Cohesion: 0.35
Nodes (10): getHtmlTheme(), buildBrandVarsCss(), escapeHtmlText(), headerMarkup(), HtmlThemePreviewError, readOptional(), renderHtmlThemePreview(), SAMPLE_SEARCH_ENTRIES (+2 more)

### Community 123 - "ConrefReusePanel.tsx"
Cohesion: 0.19
Nodes (15): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), MODES, ConrefDragGhost, ConrefRowDragApi (+7 more)

### Community 124 - "fragment-splice.ts"
Cohesion: 0.14
Nodes (24): AI assistance, AI 辅助, 4.1 文件清单与核心函数, DITA_TOPIC_ROOTS, doctypeSignature(), failedVerification(), failure(), firstElementTagName() (+16 more)

### Community 126 - "map-tree-utils.ts"
Cohesion: 0.19
Nodes (13): buildCompositeMapTree(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), noopCallbacks, DitaMapTreeNode (+5 more)

### Community 127 - "inline-selection.ts"
Cohesion: 0.18
Nodes (11): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+3 more)

### Community 128 - "HtmlThemeSelector.tsx"
Cohesion: 0.24
Nodes (13): FileExplorerPanelProps, ThemeDraft, themeThumbnailStyle(), ACCENT_PRESETS, FEATURE_ROWS, HtmlThemeSelectorProps, ThemeThumbnail(), ThemePreviewModalProps (+5 more)

### Community 130 - "ThemePreviewModal.tsx"
Cohesion: 0.15
Nodes (12): DEVICE_WIDTH, PreviewDevice, PreviewStatus, ActiveScope, activeScope, applyScopeHeaders(), getActiveScope(), API_BASE (+4 more)

### Community 131 - "createTopicTemplate"
Cohesion: 0.23
Nodes (10): buildScaleDitaProject(), createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions, DitaSampleDocument (+2 more)

### Community 134 - "resolveThemeOptions"
Cohesion: 0.24
Nodes (8): cleanPath(), cleanText(), isHtmlThemeId(), isRecord(), resolveThemeOptions(), defaultProfile(), normalizeStoredOptions(), baseEnhanceInput()

### Community 135 - "conref-drag.test.ts"
Cohesion: 0.24
Nodes (8): buildConrefDragSnippet(), CONREF_DRAG_MIME, escapeXmlAttrValue(), hasConrefDragPayload(), parseConrefDragPayload(), readConrefDragPayload(), CONKEYREF_ATTRS, dropState()

### Community 138 - "HTML5 publish themes"
Cohesion: 0.15
Nodes (12): close(), [1.0.0] — 2026-11-22, Changed, Fixed, Phase 6 概要, Adding a theme, Design tokens, Feature flags (+4 more)

### Community 139 - "HtmlThemeId"
Cohesion: 0.24
Nodes (11): DitaDiagnostic, HtmlThemeFeatures, HtmlThemeId, HtmlThemeOptions, ManualPublishProfile, CreatePublishJobInput, PublishJobView, EnhanceHtml5Options (+3 more)

### Community 140 - "cloudbuild.yaml"
Cohesion: 0.18
Nodes (10): images, options, logging, steps, args, name, substitutions, _DITA_BASE_PATH (+2 more)

### Community 141 - "useI18n"
Cohesion: 0.08
Nodes (37): LeftSidebarProps, JobLogViewerProps, SaveControls(), SaveControlsProps, TaskModelSwitch(), arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS (+29 more)

### Community 144 - "NewTopicDialog.tsx"
Cohesion: 0.28
Nodes (8): WorkspaceSnapshot, DEFAULT_DIR_FOR_TYPE, NewTopicDialog(), NewTopicDialogProps, NewTopicMountContext, TOPIC_OPTIONS, TopicStructurePreview(), DitaTopicTemplateType

### Community 145 - "selectors.ts"
Cohesion: 0.09
Nodes (25): CheckinCandidate, CheckinDialogProps, LockStatusBarProps, stateStyles, ReadOnlyBanner(), ReadOnlyBannerProps, toneStyles, FileLock (+17 more)

### Community 147 - "Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 148 - "Getting started"
Cohesion: 0.25
Nodes (8): Backend environment variables (`@dita/api`), Getting started, Host DITA-OT setup, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT, Option 3: Desktop app (macOS Apple Silicon & Windows x64, lightweight), Option 4: Editing and semantic authoring only (no DITA-OT), Requirements

### Community 149 - "prosemirror/schema.ts"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 150 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`)

### Community 152 - "[0.5.0] — 2026-11-21"
Cohesion: 0.40
Nodes (5): [0.5.0] — 2026-11-21, Added, Changed, Known limitations, Removed

### Community 153 - "@codemirror/autocomplete@^6.20.4"
Cohesion: 0.33
Nodes (4): @codemirror/autocomplete@^6.20.4, prosemirror-view@^1.43.0, @codemirror/autocomplete, prosemirror-view

### Community 155 - "desktop/package.json"
Cohesion: 0.20
Nodes (10): dependencies, @dita/api@workspace:*, description, license, main, name, private, type (+2 more)

### Community 156 - "stage.mjs"
Cohesion: 0.17
Nodes (9): apiPkg, DESKTOP_ROOT, desktopPkg, __dirname, REPO_ROOT, requiredPaths, STAGE_DIR, stagePkg (+1 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 159 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, electron@^35.2.0, electron-builder@^26.18.1, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, @types/node, typescript (+2 more)

### Community 160 - "build-desktop"
Cohesion: 0.20
Nodes (10): name, runs-on, strategy, os, script, target, build-desktop, include (+2 more)

### Community 161 - "with"
Cohesion: 0.20
Nodes (10): with, cache, files, if-no-files-found, merge-multiple, name, node-version, path (+2 more)

### Community 162 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, dist, dist:mac, dist:win, stage, test (+1 more)

### Community 163 - "main.ts"
Cohesion: 0.22
Nodes (4): ApiServer, __dirname, hasSingleInstanceLock, REPO_ROOT

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 167 - "desktop/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ../../tsconfig.base.json

### Community 169 - "release-desktop.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "electron"
Cohesion: 0.50
Nodes (3): bridge, DitaDesktopBridge, electron

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1272 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lucide-react` connect `useI18n` to `HtmlThemeSelector.tsx`, `ThemePreviewModal.tsx`, `NewTopicDialog.tsx`, `selectors.ts`, `MapTreePanel.tsx`, `editor-store/index.ts`, `workbench-store.ts`, `App.tsx`, `dependencies`, `ai-types.ts`, `AppShell.tsx`, `SourceEditor.tsx`, `AttributesPanel.tsx`, `identity-api.ts`, `topicGuideTree.ts`, `DiffViewer`, `web/package.json`, `PublishDialog.tsx`, `ConrefReusePanel.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10897435897435898 - nodes in this community are weakly interconnected._
- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `editor-store/types.ts`, `dita-map.ts`, `[0.5.0] — 2026-11-21`, `ref_vitest`, `PublishQueue`, `publish-service.ts`, `WorkspaceManager`, `createServer`, `ai-types.ts`, `en/architecture.md`, `semantic-engine.ts`, `zh/architecture.md`, `前端 DITA 1.3 结构化写作合规实施说明`, `en/features.md`, `zh/features.md`, `xpath.ts`, `e2e-ai-live.mts`, `workspace-api.ts`, `DITAEditor`, `xmlToPmDoc`, `fragment-splice.ts`, `map-tree-utils.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `ai-prompt.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12169312169312169 - nodes in this community are weakly interconnected._