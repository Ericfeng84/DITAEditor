# Graph Report - DITAEditor  (2026-11-22)

## Corpus Check
- 254 files · ~218,628 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .dita 24, (none) 5, .ditaval 4)

## Summary
- 2591 nodes · 6937 edges · 139 communities (105 shown, 34 thin omitted)
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
- semantic-indexer.ts
- scripts
- commands.ts
- editor-store.ts
- workspace-fs.ts
- web/src/i18n/locale.ts
- deploy-site.yml
- selection-info.ts
- ai-store.ts
- serializer.ts
- dita-rules.ts
- decorations.ts
- locales.ts
- ai-usage-service.ts
- translate
- modules/ai/types.ts
- DITAEditor
- semantic-engine.ts
- 快速开始
- DocsLayout.astro
- VisualEditor.tsx
- devDependencies
- Getting started
- ai-service.ts
- ref_react
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- HttpError
- 核心特性（已实现：Phase 0–3）
- i18n/index.ts
- App.tsx
- dependencies
- Core features (Phase 0–6 implemented)
- lock-service.ts
- table-commands.ts
- 3.2 四项关键技术机制
- GitManager
- ditaval.ts
- dita-core/src/index.ts
- block-transforms.ts
- createMapTemplate
- checkXmlWellFormed
- dita-core/src/index.ts
- zh/architecture.md
- phase6-ai-api.test.ts
- RawAttrs
- lucide-react
- CalsTableNodeView
- ref_vitest
- @dita/core@workspace:*
- SearchModal.astro
- docker-entrypoint.sh
- en/architecture.md
- @codemirror/commands@^6.11.1
- prosemirror-keymap@^1.2.3
- devDependencies
- prosemirror-view@^1.43.0
- en/features.md
- @codemirror/merge@^6.12.3
- zh/features.md
- ai-prompt.ts
- astro.config.ts
- en/ai-setup.md
- semantic-indexer.ts
- zh/ai-setup.md
- compilerOptions
- UiLocale
- e2e-ai-live.mts
- @dita/core@workspace:*
- publish-service.ts
- prosemirror-gapcursor@^1.4.1
- prosemirror-model@^1.25.13
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- MiniRoundTripDemo.tsx
- api/src/index.ts
- en/getting-started.md
- prosemirror-view@^1.43.0
- AGENTS.md
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- PublishService
- zh/introduction.md
- zh/local-development.md
- PublishQueue
- DocsIndex.astro
- AiAssistantPanel.tsx
- scripts
- playground-presets.ts
- react@^19.0.0
- react-dnd-html5-backend@^16.0.1
- README.md
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- 4. Non-Negotiable Engineering Invariants
- tailwindcss@^4.3.5
- sync-hf-space.sh
- @codemirror/lang-xml@^6.1.0
- @codemirror/lint@^6.9.8
- @codemirror/merge@^6.12.3
- @codemirror/commands@^6.11.1
- @codemirror/state@^6.7.6
- prosemirror-model@^1.25.13
- react-dom@^19.0.0
- @codemirror/autocomplete@^6.20.4
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
- `7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)` --references--> `PublishQueue`  [INFERRED]
  README.en.md → apps/api/src/modules/publish/publish-queue.ts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts
- `Slice 6.5：全场景快捷入口联动与端到端回归` --references--> `AiDiffDialog()`  [INFERRED]
  docs/phase6-ai-implementation-plan.md → apps/web/src/ai/AiDiffDialog.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (139 total, 34 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.13
Nodes (31): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+23 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (33): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch(), fetchBranches(), fetchGitDiff() (+25 more)

### Community 2 - "converter.ts"
Cohesion: 0.08
Nodes (40): CalsCursor, CompositeMapTreeResult, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs() (+32 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.13
Nodes (10): registerSemanticIndexerRoutes(), collectAllFilePaths(), computeMemoryDiagnostics(), basenamePosix(), classifyDitaFileKind(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref (+2 more)

### Community 4 - "index.tsx"
Cohesion: 0.09
Nodes (29): DEFAULT_DIR_FOR_TYPE, NewTopicMountContext, TOPIC_OPTIONS, SOURCE_KEYS, TABS, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS (+21 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.06
Nodes (38): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+30 more)

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
Cohesion: 0.07
Nodes (15): updateNodeRawAttr(), CalsColspecNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView (+7 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.20
Nodes (29): extractTitleSafe(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle() (+21 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (16): dict, Props, LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical, dict (+8 more)

### Community 21 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/language@^6.13.1, @codemirror/view@^6.43.15, @lezer/highlight@^1.2.1, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4, prosemirror-gapcursor@^1.4.1 (+15 more)

### Community 22 - "semantic-indexer.ts"
Cohesion: 0.12
Nodes (25): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, sanitizeCssColor(), XmlLikeElement, XmlLikeNode, buildCompositeMapTree(), CompositeMapTreeNode, isSameOrDescendantPath() (+17 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.10
Nodes (28): createDitaElementSkeleton(), deleteDitaNodeAtPos(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), hydrateEmptyContainerAtPos(), insertInlineImage(), makeNode() (+20 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.06
Nodes (56): FileContentResult, WorkspaceFileNode, EditorTabBarProps, FileExplorerPanelProps, NewMapDialogProps, NewTopicDialogProps, ProblemsPanelProps, PublishDialogProps (+48 more)

### Community 26 - "workspace-fs.ts"
Cohesion: 0.06
Nodes (37): ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema (+29 more)

### Community 27 - "web/src/i18n/locale.ts"
Cohesion: 0.18
Nodes (15): DEFAULT_UI_LOCALE, detectBrowserLocale(), LOCALE_STORAGE_KEY, LocaleListener, localeListeners, LocaleState, notifyLocaleChange(), persist() (+7 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 29 - "selection-info.ts"
Cohesion: 0.26
Nodes (13): handleDitaEnter(), insertBlockDitaElement(), selectFirstEditablePos(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock(), getSelectionSnapshot() (+5 more)

### Community 30 - "ai-store.ts"
Cohesion: 0.08
Nodes (51): PromptStrings, abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame (+43 more)

### Community 31 - "serializer.ts"
Cohesion: 0.16
Nodes (23): isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry (+15 more)

### Community 32 - "dita-rules.ts"
Cohesion: 0.07
Nodes (30): buildDitaConstraintSummary(), COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey (+22 more)

### Community 33 - "decorations.ts"
Cohesion: 0.13
Nodes (24): insertBlockDitaElementAtPos(), renderConrefPreviewDom(), renderDomNode(), collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createConrefWidgetDom() (+16 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (27): 4.6.1 Static Site Invariants (`apps/site`, Phase 7), anchor(), columns, dict, home, Props, year, dict (+19 more)

### Community 35 - "ai-usage-service.ts"
Cohesion: 0.19
Nodes (13): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey() (+5 more)

### Community 36 - "translate"
Cohesion: 0.11
Nodes (22): changeLabelKey(), GitPanel(), GitPanelProps, shortDate(), LockStatusBarProps, stateStyles, SourceEditor(), sourceEditorTheme (+14 more)

### Community 37 - "modules/ai/types.ts"
Cohesion: 0.13
Nodes (19): AiConfigTestInput, aiConfigTestSchema, aiConfigUpdateSchema, aiDiagnosticSchema, aiHistoryTurnSchema, AiProposalVerification, aiStreamRequestSchema, aiSubActionSchema (+11 more)

### Community 38 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 39 - "semantic-engine.ts"
Cohesion: 0.09
Nodes (38): KeyspacePanelProps, extractProfilingValuesFromDocument(), coreT(), DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS (+30 more)

### Community 40 - "快速开始"
Cohesion: 0.15
Nodes (13): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT） (+5 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.11
Nodes (16): collections, docs, Capability, DocSlug, Locale, dict, groups, index (+8 more)

### Community 42 - "VisualEditor.tsx"
Cohesion: 0.15
Nodes (12): BlockConvertOption, BlockHandleTarget, BlockHandleProps, BlockGapOpenMenuPayload, InlineBubbleInfo, InlineBubbleToolbarProps, InsertElementChoice, InsertElementMenuProps (+4 more)

### Community 43 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+10 more)

### Community 44 - "Getting started"
Cohesion: 0.15
Nodes (13): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+5 more)

### Community 45 - "ai-service.ts"
Cohesion: 0.06
Nodes (54): ApiLocale, apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh, apiT(), CATALOGUES (+46 more)

### Community 46 - "ref_react"
Cohesion: 0.16
Nodes (10): LeftSidebarProps, EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbar(), TAG_ICONS, EditorSelectionSnapshot, useInstantTitles(), UseInstantTitlesOptions (+2 more)

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
Cohesion: 0.08
Nodes (46): firstHeaderValue(), RequestLike, resolveRequestLocale(), DitaRuntimeOptions, httpError(), isHttpError(), localizeErrorMessage(), handleWorkspaceError() (+38 more)

### Community 51 - "核心特性（已实现：Phase 0–3）"
Cohesion: 0.29
Nodes (7): 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 核心特性（已实现：Phase 0–8）

### Community 52 - "i18n/index.ts"
Cohesion: 0.25
Nodes (10): en, DICTIONARIES, getDictionary(), isLocale(), DEFAULT_LOCALE, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.10
Nodes (51): AiDiffDialog(), App(), CheckinCandidate, CheckinDialog(), CheckinDialogProps, DiffDialog(), revisionLabel(), diffTheme (+43 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/lang-xml@^6.1.0, @codemirror/lint@^6.9.8, @lezer/highlight@^1.2.5, lucide-react@^1.76.0, prosemirror-commands@^1.7.2, prosemirror-history@^1.5.2, react-arborist@^4.0.1 (+11 more)

### Community 55 - "Core features (Phase 0–6 implemented)"
Cohesion: 0.25
Nodes (8): 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Visual Map / Bookmap tree and multi-file workbench, 4. Single-sourcing semantic engine (Keys / Conref / DITAVAL), 5. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 6. Local Git version control and check-out exclusive locks (Phase 4), 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5), Core features (Phase 0–8 implemented)

### Community 56 - "lock-service.ts"
Cohesion: 0.06
Nodes (41): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, FileLockRow, fileLocks (+33 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.24
Nodes (22): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+14 more)

### Community 58 - "3.2 四项关键技术机制"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 59 - "GitManager"
Cohesion: 0.15
Nodes (13): changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+5 more)

### Community 60 - "ditaval.ts"
Cohesion: 0.16
Nodes (17): summarizeDitaval(), ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule (+9 more)

### Community 61 - "dita-core/src/index.ts"
Cohesion: 0.12
Nodes (26): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, getRawAttr(), pmDocToXml() (+18 more)

### Community 62 - "block-transforms.ts"
Cohesion: 0.12
Nodes (26): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockMovePlan, buildConvertedBlock(), computeBlockGaps(), findBlockHandleTarget(), getBlockConvertOptions() (+18 more)

### Community 63 - "createMapTemplate"
Cohesion: 0.19
Nodes (11): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId(), createTopicTemplate(), CreateTopicTemplateOptions (+3 more)

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.10
Nodes (37): 4.7 AI Assistance Boundaries (Phase 6), close(), AI 辅助, errorMessage(), element(), [1.0.0] — 2026-11-22, Added, Changed (+29 more)

### Community 65 - "dita-core/src/index.ts"
Cohesion: 0.26
Nodes (9): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, MapOverviewPaneProps (+1 more)

### Community 66 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.10
Nodes (14): AiDonePayload, AiMetaPayload, AiProposal, ADMIN, createApp(), Fixture, readUsage(), SAMPLE_ROOT (+6 more)

### Community 68 - "RawAttrs"
Cohesion: 0.20
Nodes (7): InsertKeyrefDialogProps, XrefImageDialogProps, VisualEditorHandle, UploadAssetResult, RawAttrs, __dirname, FIXTURES_DIR

### Community 69 - "lucide-react"
Cohesion: 0.28
Nodes (9): IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, WorkbenchHeaderProps, MountExistingDialogProps, IdentityResponse, IdentityUser, EditorViewMode (+1 more)

### Community 71 - "ref_vitest"
Cohesion: 0.11
Nodes (29): ATTR_BADGE_COLORS, ProfilingAttrEditor(), createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlTag(), PROFILING_ATTR_SET, AttributesPanel(), GROUP_SUBTITLES (+21 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 80 - "en/features.md"
Cohesion: 0.15
Nodes (12): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps (+4 more)

### Community 82 - "zh/features.md"
Cohesion: 0.17
Nodes (11): Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+3 more)

### Community 83 - "ai-prompt.ts"
Cohesion: 0.22
Nodes (17): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+9 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.13
Nodes (7): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, astro, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "semantic-indexer.ts"
Cohesion: 0.15
Nodes (28): WorkspaceDitavalSummary, BranchIndexState, SemanticContextResponse, ConrefReusePanelProps, ProfilingAttrEditorProps, TopicInspectorProps, SourceSemanticCompletionContext, SourceEditorProps (+20 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "UiLocale"
Cohesion: 0.11
Nodes (28): 4.1 文件清单与核心函数, buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren() (+20 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (15): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+7 more)

### Community 92 - "publish-service.ts"
Cohesion: 0.06
Nodes (61): DITA_FILE, DitaDiagnostic, DitaPathRoot, extractMessage(), fallbackDitaDiagnostic(), LOCATION_PATTERNS, LocationMatch, matchLocation() (+53 more)

### Community 95 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.07
Nodes (28): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+20 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "api/src/index.ts"
Cohesion: 0.05
Nodes (41): @langchain/core@^1.4.2, createServer(), CreateServerOptions, AiChatModel, AiModelFactory, createLangChainModelFactory(), AiConfigTestResult, resetDitaRuntimeCache() (+33 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

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
Cohesion: 0.24
Nodes (4): PublishJobRow, parseDiagnostics(), PublishService, toIso()

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "PublishQueue"
Cohesion: 0.18
Nodes (3): PublishQueue, PublishQueueOptions, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）

### Community 109 - "DocsIndex.astro"
Cohesion: 0.20
Nodes (6): bySlug, dict, groups, Props, paths, Props

### Community 110 - "AiAssistantPanel.tsx"
Cohesion: 0.10
Nodes (27): useAiStore, AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, AiTargetScope, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget(), normalizeSelectedText() (+19 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.15
Nodes (6): PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 117 - "README.md"
Cohesion: 0.31
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.25
Nodes (8): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants, hasMultipleTgroups()

### Community 129 - "@codemirror/commands@^6.11.1"
Cohesion: 0.33
Nodes (4): @codemirror/commands@^6.11.1, @codemirror/search@^6.7.2, @codemirror/commands, @codemirror/search

### Community 138 - "@codemirror/autocomplete@^6.20.4"
Cohesion: 0.33
Nodes (4): @codemirror/autocomplete@^6.20.4, @codemirror/language@^6.13.1, @codemirror/autocomplete, @codemirror/language

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 853 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `normalizePosixPath`, `Core Package Manifest`, `dita-map.ts`, `semantic-indexer.ts`, `editor-store.ts`, `workspace-fs.ts`, `translate`, `semantic-engine.ts`, `Changelog`, `核心特性（已实现：Phase 0–3）`, `Core features (Phase 0–6 implemented)`, `dita-core/src/index.ts`, `zh/architecture.md`, `en/architecture.md`, `en/features.md`, `zh/features.md`, `UiLocale`, `e2e-ai-live.mts`, `AiAssistantPanel.tsx`, `4. Non-Negotiable Engineering Invariants`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12857142857142856 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `PublishDialog.tsx`, `dita-core/src/index.ts`, `translate`, `index.tsx`, `ref_vitest`, `VisualEditor.tsx`, `devDependencies`, `AiAssistantPanel.tsx`, `ref_react`, `App.tsx`, `dependencies`, `semantic-indexer.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._