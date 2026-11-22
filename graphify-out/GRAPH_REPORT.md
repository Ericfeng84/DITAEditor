# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 254 files · ~218,953 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .dita 24, (none) 5, .ditaval 4)

## Summary
- 2592 nodes · 6943 edges · 150 communities (116 shown, 34 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 328 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd6e9956`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- converter.ts
- normalizePosixPath
- index.tsx
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
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- dita-core/src/index.ts
- scripts
- VisualEditor.tsx
- editor-store.ts
- WorkspaceManager
- web/src/i18n/locale.ts
- deploy-site.yml
- createServer
- ai-store.ts
- serializer.ts
- dita-rules.ts
- decorations.ts
- locales.ts
- workspace-fs.ts
- CheckinDialog.tsx
- dita-runtime.ts
- DITAEditor
- semantic-engine.ts
- 快速开始
- DocsLayout.astro
- slimdom
- devDependencies
- Getting started
- ai-service.ts
- ref_react
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- HttpError
- LockService
- i18n/index.ts
- App.tsx
- dependencies
- strict-validator.ts
- lock-service.ts
- table-commands.ts
- 3.2 四项关键技术机制
- GitManager
- semantic-engine.ts
- selection-info.ts
- block-transforms.ts
- createMapTemplate
- checkXmlWellFormed
- inline-selection.ts
- zh/architecture.md
- phase6-ai-api.test.ts
- RawAttrs
- identity-api.ts
- translate
- ref_vitest
- api/src/index.ts
- SearchModal.astro
- docker-entrypoint.sh
- en/architecture.md
- web/package.json
- dita-log-parser.ts
- devDependencies
- dita-completion.ts
- en/features.md
- UiLocale
- zh/features.md
- ai-prompt.ts
- astro.config.ts
- en/ai-setup.md
- semantic-indexer.ts
- zh/ai-setup.md
- compilerOptions
- fragment-locator.ts
- e2e-ai-live.mts
- ai-fragment.test.ts
- publish-service.ts
- ai-config-and-model.test.ts
- phase5-publish.test.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- MiniRoundTripDemo.tsx
- ref_vitest
- en/getting-started.md
- IdentityService
- AGENTS.md
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- PublishService
- zh/introduction.md
- zh/local-development.md
- PublishQueue
- xml-bridge.ts
- dita-core/src/i18n/locale.ts
- scripts
- playground-presets.ts
- XmlAttributeEntry
- asset-routes.ts
- vite.config.ts
- @codemirror/view@^6.43.15
- README.md
- prosemirror-commands@^1.7.2
- prosemirror-dropcursor@^1.8.4
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- 4. Non-Negotiable Engineering Invariants
- @tailwindcss/vite@^4.3.5
- @codemirror/lang-xml@^6.1.0
- react@^19.0.0
- sync-hf-space.sh
- @codemirror/lang-xml@^6.1.0
- @codemirror/lint@^6.9.8
- @codemirror/merge@^6.12.3
- @codemirror/search@^6.7.2
- @codemirror/state@^6.7.6
- @lezer/highlight@^1.2.5
- prosemirror-commands@^1.7.2
- prosemirror-history@^1.5.2
- prosemirror-model@^1.25.13
- react-dom@^19.0.0
- react-dnd@^16.0.1
- zustand
- @codemirror/language@^6.13.1
- @codemirror/search@^6.7.2
- @codemirror/state@^6.7.6
- @codemirror/view@^6.43.15
- prosemirror-dropcursor@^1.8.4
- prosemirror-inputrules@^1.7.0
- prosemirror-keymap@^1.2.3
- prosemirror-state@^1.4.4
- react-dom@^19.0.0
- react-resizable-panels
- tailwindcss@^4.3.5

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 89 edges
2. `App()` - 51 edges
3. `t()` - 50 edges
4. `apiT()` - 49 edges
5. `translate()` - 47 edges
6. `WorkspaceManager` - 46 edges
7. `requestJson()` - 46 edges
8. `createServer()` - 43 edges
9. `lucide-react` - 43 edges
10. `getCurrentLocale()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `Website and GitHub Pages online demo (Phase 7)` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts
- `官网与 GitHub Pages 在线体验（Phase 7）` --references--> `main()`  [INFERRED]
  README.md → apps/api/scripts/e2e-ai-live.mts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (150 total, 34 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.13
Nodes (31): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+23 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (33): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch(), fetchBranches(), fetchFileAtRevision() (+25 more)

### Community 2 - "converter.ts"
Cohesion: 0.12
Nodes (30): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+22 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.18
Nodes (9): collectFileSetFromTree(), computeMemoryDiagnostics(), useEditorStore, basenamePosix(), classifyDitaFileKind(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref (+1 more)

### Community 4 - "index.tsx"
Cohesion: 0.10
Nodes (24): DEFAULT_DIR_FOR_TYPE, NewTopicMountContext, TOPIC_OPTIONS, SOURCE_KEYS, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, MODE_LABEL_KEYS (+16 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (37): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/openai@^1.8.4 (+29 more)

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
Cohesion: 0.33
Nodes (5): allowBuilds, better-sqlite3, esbuild, sharp, packages

### Community 17 - "table-commands.ts"
Cohesion: 0.08
Nodes (13): CalsColspecNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaRefInlineNodeView, NOTE_TYPE_LABELS (+5 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.20
Nodes (29): extractTitleSafe(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle() (+21 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (17): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+9 more)

### Community 21 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/language@^6.13.1, @dita/core@workspace:*, @lezer/highlight@^1.2.1, prosemirror-gapcursor@^1.4.1, prosemirror-history@^1.5.2 (+13 more)

### Community 22 - "dita-core/src/index.ts"
Cohesion: 0.10
Nodes (32): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, OPTIONS (+24 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "VisualEditor.tsx"
Cohesion: 0.11
Nodes (32): computeBlockGaps(), findBlockHandleTarget(), planBlockMove(), convertDitaBlockAtPos(), createDitaElementSkeleton(), deleteDitaNodeAtPos(), duplicateDitaBlockAtPos(), EMPTY_ATTRS (+24 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.08
Nodes (51): EditorTabBarProps, FileExplorerPanelProps, NewMapDialogProps, NewTopicDialogProps, ProblemsPanelProps, PublishDialogProps, WorkspaceDialogProps, buildSnapshotFromMemoryFiles() (+43 more)

### Community 26 - "WorkspaceManager"
Cohesion: 0.17
Nodes (8): registerWorkspaceFileRoutes(), resolveSafeWorkspacePathFor(), isWithinRoot(), resolveSafeWorkspacePath(), WorkspaceConflictError, WorkspaceManager, WorkspaceNotFoundError, WorkspacePathError

### Community 27 - "web/src/i18n/locale.ts"
Cohesion: 0.19
Nodes (14): DEFAULT_UI_LOCALE, detectBrowserLocale(), LOCALE_STORAGE_KEY, LocaleListener, localeListeners, LocaleState, notifyLocaleChange(), persist() (+6 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 29 - "createServer"
Cohesion: 0.21
Nodes (5): createServer(), registerSemanticIndexerRoutes(), collectAllFilePaths(), summarizeDitaval(), WorkspaceSemanticIndexer

### Community 30 - "ai-store.ts"
Cohesion: 0.06
Nodes (66): PromptStrings, abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame (+58 more)

### Community 31 - "serializer.ts"
Cohesion: 0.11
Nodes (31): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+23 more)

### Community 32 - "dita-rules.ts"
Cohesion: 0.11
Nodes (17): COMMON_ATTRIBUTES, ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, DITA_CATEGORY_LABELS, DITA_CONTENT_MODEL, DITA_CORE_INLINE_TAGS, DitaElementCategory (+9 more)

### Community 33 - "decorations.ts"
Cohesion: 0.15
Nodes (20): sanitizeCssColor(), BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createConrefWidgetDom(), createDitaDecorationsPlugin() (+12 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (26): 4.6.1 Static Site Invariants (`apps/site`, Phase 7), anchor(), columns, dict, home, Props, year, dict (+18 more)

### Community 35 - "workspace-fs.ts"
Cohesion: 0.11
Nodes (19): countMapTreeNodes(), FileContentResult, findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, sanitizeWorkspaceDirName(), WORKSPACE_SCAFFOLD_DIRS (+11 more)

### Community 36 - "CheckinDialog.tsx"
Cohesion: 0.09
Nodes (24): AiDiffDialog(), CheckinCandidate, CheckinDialogProps, revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel() (+16 more)

### Community 37 - "dita-runtime.ts"
Cohesion: 0.19
Nodes (18): buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DitaRunOptions, DitaRunResult (+10 more)

### Community 38 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 39 - "semantic-engine.ts"
Cohesion: 0.13
Nodes (24): MINI_DEMO_XML, PLAYGROUND_PRESETS, extractProfilingValuesFromDocument(), areConrefTagsCompatible(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild() (+16 more)

### Community 40 - "快速开始"
Cohesion: 0.14
Nodes (14): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 官网与 GitHub Pages 在线体验（Phase 7）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用） (+6 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.08
Nodes (20): bySlug, dict, groups, Props, paths, Props, collections, docs (+12 more)

### Community 42 - "slimdom"
Cohesion: 0.15
Nodes (15): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+7 more)

### Community 43 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, vitest@^3.1.0, @types/react, @types/react-dom (+3 more)

### Community 44 - "Getting started"
Cohesion: 0.14
Nodes (14): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+6 more)

### Community 45 - "ai-service.ts"
Cohesion: 0.09
Nodes (29): buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), createExplanationStreamFilter(), ExplanationStreamFilter, parseAiOutput() (+21 more)

### Community 46 - "ref_react"
Cohesion: 0.12
Nodes (16): LeftSidebarProps, TABS, TopicInspectorProps, AttributesPanelProps, EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbar(), TAG_ICONS (+8 more)

### Community 47 - "Changelog"
Cohesion: 0.11
Nodes (19): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.2.0] — 2026-11-22, Added, Added, Added (+11 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.11
Nodes (15): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+7 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "HttpError"
Cohesion: 0.07
Nodes (65): firstHeaderValue(), RequestLike, resolveRequestLocale(), apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh (+57 more)

### Community 51 - "LockService"
Cohesion: 0.31
Nodes (3): IdentityUser, LockService, Phase4Scope

### Community 52 - "i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.11
Nodes (54): useAiStore, buildVisualAiTarget(), AiAssistantPanel(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), App(), CheckinDialog() (+46 more)

### Community 54 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/lint@^6.9.8, lucide-react@^1.76.0, prosemirror-gapcursor@^1.4.1, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0, react@^19.0.0 (+9 more)

### Community 55 - "strict-validator.ts"
Cohesion: 0.17
Nodes (16): CreateServerOptions, fallbackDitaDiagnostic(), DitaRuntimeInfo, DitaRuntimeOptions, StrictValidationRouteOptions, ensureInside(), resolveDitavalTarget(), resolveValidationTarget() (+8 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.07
Nodes (36): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, FileLockRow, fileLocks (+28 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.24
Nodes (22): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+14 more)

### Community 58 - "3.2 四项关键技术机制"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 59 - "GitManager"
Cohesion: 0.14
Nodes (14): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+6 more)

### Community 60 - "semantic-engine.ts"
Cohesion: 0.11
Nodes (22): KeyspacePanelProps, VisualSemanticContext, CreateDitaNodeViewsOptions, ConditionGroup, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule (+14 more)

### Community 61 - "selection-info.ts"
Cohesion: 0.17
Nodes (22): getBlockConvertOptions(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot(), isInlineTagAllowedAtSelection(), makeBreadcrumbItem() (+14 more)

### Community 62 - "block-transforms.ts"
Cohesion: 0.11
Nodes (22): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), INLINE_HOST_TAGS (+14 more)

### Community 63 - "createMapTemplate"
Cohesion: 0.11
Nodes (19): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions (+11 more)

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.10
Nodes (39): 4.7 AI Assistance Boundaries (Phase 6), close(), AI 辅助, buildState(), element(), [1.0.0] — 2026-11-22, Added, Changed (+31 more)

### Community 65 - "inline-selection.ts"
Cohesion: 0.18
Nodes (11): buildBubbleItems(), CODE_TEXTBLOCK_TYPES, collectActiveInlineTags(), emptyBubble(), findSharedInlineTextblock(), getInlineBubbleInfo(), INLINE_BUBBLE_QUICK_TAGS, isCodeTextblock() (+3 more)

### Community 66 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.06
Nodes (40): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey(), toIso() (+32 more)

### Community 68 - "RawAttrs"
Cohesion: 0.27
Nodes (8): VisualEditorHandle, baseAttrs(), ditaSchema, makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes, RawAttrs

### Community 69 - "identity-api.ts"
Cohesion: 0.21
Nodes (14): changeLabelKey(), GitPanel(), GitPanelProps, shortDate(), IdentitySwitcherProps, WorkbenchHeaderProps, CURRENT_USER_STORAGE_KEY, IdentityResponse (+6 more)

### Community 70 - "translate"
Cohesion: 0.13
Nodes (15): defaultInstruction(), targetLabel(), createDitaXmlLinter(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement (+7 more)

### Community 71 - "ref_vitest"
Cohesion: 0.16
Nodes (26): ATTR_BADGE_COLORS, ProfilingAttrEditor(), createDitaXmlCompletionSource(), AttributesPanel(), GROUP_SUBTITLES, GROUP_TITLE_KEYS, InsertElementMenu(), findTreeNodeByPath() (+18 more)

### Community 72 - "api/src/index.ts"
Cohesion: 0.21
Nodes (8): AiChatModel, AiModelFactory, createLangChainModelFactory(), defaultWebDistDir(), isInside(), MIME_TYPES, registerWebStaticRoutes(), DITA_CORE_VERSION

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 76 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/merge@^6.12.3, @dita/core@workspace:*, react-dnd-html5-backend@^16.0.1, @codemirror/commands, @codemirror/merge, @dita/core, license (+5 more)

### Community 77 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "dita-completion.ts"
Cohesion: 0.23
Nodes (7): ditaXmlCompletionSource, findEnclosingXmlTag(), PROFILING_ATTR_SET, completeAtEnd(), noopCallbacks, DITA_PROFILING_ATTRS, DITA_ELEMENT_SPECS

### Community 80 - "en/features.md"
Cohesion: 0.15
Nodes (12): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps (+4 more)

### Community 81 - "UiLocale"
Cohesion: 0.18
Nodes (11): DitaDecorationMeta, DitaDecorationPluginState, interpolate(), TagDisplayMode, Slice 8.1：同构 i18n 底座与 `@dita/core` 双语化（第 1–2 天）, ResolvedOptions, AiExtractOptions, formatMessage() (+3 more)

### Community 82 - "zh/features.md"
Cohesion: 0.17
Nodes (11): Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+3 more)

### Community 83 - "ai-prompt.ts"
Cohesion: 0.12
Nodes (25): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+17 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.18
Nodes (7): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, astro, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "semantic-indexer.ts"
Cohesion: 0.12
Nodes (20): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, ConrefReusePanelProps, InsertKeyrefDialogProps, ProfilingAttrEditorProps, XrefImageDialogProps, SourceSemanticCompletionContext (+12 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "fragment-locator.ts"
Cohesion: 0.24
Nodes (17): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+9 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.19
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 91 - "ai-fragment.test.ts"
Cohesion: 0.22
Nodes (9): 4.1 文件清单与核心函数, AiFragmentExtraction, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport, extract() (+1 more)

### Community 92 - "publish-service.ts"
Cohesion: 0.13
Nodes (20): publishJobs, DitaDiagnostic, EXCLUDED_SNAPSHOT_ENTRIES, findFirstPdf(), isInside(), parseDiagnostics(), PublishFormat, PublishJobPatch (+12 more)

### Community 93 - "ai-config-and-model.test.ts"
Cohesion: 0.18
Nodes (8): @langchain/core@^1.4.2, AiConfigTestResult, ADMIN, createApp(), createFixture(), tempDirs, WRITER, @langchain/core

### Community 94 - "phase5-publish.test.ts"
Cohesion: 0.20
Nodes (8): resetDitaRuntimeCache(), ADMIN, createApp(), PLUGIN_DIR, SAMPLE_ROOT, tempDirs, VIEWER, WRITER

### Community 95 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.06
Nodes (32): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract, 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API (+24 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.17
Nodes (16): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, compactDiff(), computeLineDiff(), DiffLine, DiffLineType (+8 more)

### Community 97 - "ref_vitest"
Cohesion: 0.08
Nodes (17): ADMIN, SAMPLE_ROOT, tempDirs, VIEWER, WRITER_A, WRITER_B, SAMPLE_ROOT, DEMO_SOURCE_DIR (+9 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "IdentityService"
Cohesion: 0.24
Nodes (6): WorkspaceRouteSecurity, GitRouteOptions, IdentityService, toIdentityUser(), LockRouteOptions, PublishRouteOptions

### Community 100 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`), 7. Implementation Roadmap Status

### Community 101 - "en/introduction.md"
Cohesion: 0.20
Nodes (9): Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy, What is in the box (+1 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.20
Nodes (9): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 端口与数据卷, 第一次使用 (+1 more)

### Community 104 - "界面预览"
Cohesion: 0.25
Nodes (8): Phase 5：DITA-OT 严格校验与异步 HTML5 / 中文 PDF 发布, Phase 6：AI 辅助写作、语义标签优化与错误修复, 三栏工作台与 Keys 键空间, 三栏工作台与 Phase 4 版本协作面板, 单一信息源语义引擎（Keyref / Conref / DITAVAL 条件过滤）, 可视化与 XML 源码双栏对比模式, 本地 Git 版本、Check-out 独占锁与可视化 Diff, 界面预览

### Community 105 - "PublishService"
Cohesion: 0.19
Nodes (7): PublishJobRow, ApiLocale, AiContextInput, AiStreamContext, DetectRuntimeOptions, CreatePublishJobInput, PublishService

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "PublishQueue"
Cohesion: 0.11
Nodes (11): PublishQueue, PublishQueueOptions, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`) (+3 more)

### Community 109 - "xml-bridge.ts"
Cohesion: 0.33
Nodes (9): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc(), findElementPathAtOffset() (+1 more)

### Community 110 - "dita-core/src/i18n/locale.ts"
Cohesion: 0.24
Nodes (7): DEFAULT_UI_LOCALE, FormatMessageParams, SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey, coreMessagesEn, coreMessagesZh

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.14
Nodes (7): Capability, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString, DocSlug

### Community 113 - "XmlAttributeEntry"
Cohesion: 0.25
Nodes (6): CompositeMapTreeResult, createDitavalTemplate(), DitaMapTreeNode, InsertMapNodeOptions, ParsedDitaMap, XmlAttributeEntry

### Community 114 - "asset-routes.ts"
Cohesion: 0.33
Nodes (4): ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename()

### Community 117 - "README.md"
Cohesion: 0.31
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.25
Nodes (8): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, hasMultipleTgroups()

### Community 124 - "react@^19.0.0"
Cohesion: 0.33
Nodes (4): react@^19.0.0, tailwindcss@^4.3.5, react, tailwindcss

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 853 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `normalizePosixPath`, `dita-map.ts`, `dita-core/src/index.ts`, `editor-store.ts`, `WorkspaceManager`, `ai-store.ts`, `workspace-fs.ts`, `semantic-engine.ts`, `slimdom`, `Changelog`, `semantic-engine.ts`, `createMapTemplate`, `zh/architecture.md`, `translate`, `en/architecture.md`, `en/features.md`, `zh/features.md`, `e2e-ai-live.mts`, `ai-fragment.test.ts`, `PublishQueue`, `xml-bridge.ts`, `4. Non-Negotiable Engineering Invariants`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1253968253968254 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `dita-core/src/index.ts` to `PublishDialog.tsx`, `CheckinDialog.tsx`, `identity-api.ts`, `index.tsx`, `ref_vitest`, `web/package.json`, `ref_react`, `App.tsx`, `dependencies`, `semantic-indexer.ts`, `VisualEditor.tsx`, `ai-store.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._