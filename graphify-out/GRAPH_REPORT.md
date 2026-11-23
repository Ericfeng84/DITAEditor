# Graph Report - DITAEditor  (2026-11-23)

## Corpus Check
- 263 files · ~227,641 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .dita 24, (none) 5, .ditaval 4)

## Summary
- 2662 nodes · 7210 edges · 144 communities (110 shown, 34 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 343 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `967206d6`
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
- ref_react
- scripts
- VisualEditor.tsx
- editor-store.ts
- ai-types.ts
- web/src/i18n/locale.ts
- deploy-site.yml
- createServer
- PublishService
- serializer.ts
- dita-rules.ts
- decorations.ts
- locales.ts
- ParsedDitaval
- lock-helpers.ts
- publish-service.ts
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- semantic-engine.ts
- 快速开始
- DocsLayout.astro
- xpath.ts
- devDependencies
- XmlParseError
- map-tree-utils.ts
- createMapTemplate
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- workspace-fs.ts
- httpError
- i18n/index.ts
- App.tsx
- dependencies
- classifyDitaFileKind
- lock-service.ts
- table-commands.ts
- 3.2 四项关键技术机制
- GitManager
- ditaval.ts
- helpers.ts
- dita-core/src/index.ts
- UiLocale
- checkXmlWellFormed
- VisualEditor.tsx
- zh/architecture.md
- phase6-ai-api.test.ts
- zip-store.ts
- lucide-react
- translate
- AttributesPanel.tsx
- dita-core/src/index.ts
- SearchModal.astro
- docker-entrypoint.sh
- en/architecture.md
- web/package.json
- structure-diagnostics.test.ts
- devDependencies
- PublishQueue
- en/features.md
- semantic-engine.ts
- zh/features.md
- ai-prompt.ts
- astro.config.ts
- en/ai-setup.md
- semantic-indexer.ts
- zh/ai-setup.md
- compilerOptions
- fragment-locator.ts
- e2e-ai-live.mts
- DocsIndex.astro
- 4. Non-Negotiable Engineering Invariants
- ref_react
- MiniRoundTripDemo.tsx
- createServer
- en/getting-started.md
- xml-bridge.ts
- AGENTS.md
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- Screenshots
- zh/introduction.md
- zh/local-development.md
- DITAEditor
- FileExplorerPanel.tsx
- scripts
- playground-presets.ts
- @codemirror/lint@^6.9.8
- vite.config.ts
- @codemirror/merge@^6.12.3
- README.md
- @codemirror/state@^6.7.6
- @codemirror/view@^6.43.15
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- prosemirror-commands@^1.7.2
- @tailwindcss/vite@^4.3.5
- @codemirror/lang-xml@^6.1.0
- react@^19.0.0
- sync-hf-space.sh
- @codemirror/lang-xml@^6.1.0
- prosemirror-dropcursor@^1.8.4
- react-dom@^19.0.0
- @codemirror/search@^6.7.2
- @lezer/highlight@^1.2.5
- prosemirror-commands@^1.7.2
- prosemirror-history@^1.5.2
- prosemirror-model@^1.25.13
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
1. `useI18n()` - 92 edges
2. `App()` - 52 edges
3. `t()` - 52 edges
4. `apiT()` - 49 edges
5. `translate()` - 47 edges
6. `WorkspaceManager` - 46 edges
7. `requestJson()` - 46 edges
8. `lucide-react` - 44 edges
9. `getCurrentLocale()` - 44 edges
10. `createServer()` - 43 edges

## Surprising Connections (you probably didn't know these)
- `Added` --references--> `main()`  [INFERRED]
  CHANGELOG.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `2.3 关键工程约束与避坑设计` --references--> `withBase()`  [INFERRED]
  docs/phase7-site-plan.md → apps/site/src/i18n/locales.ts
- `4. 单一信息源语义引擎（Keys / Conref / DITAVAL）` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.md → apps/web/src/components/ProfilingAttrEditor.tsx
- `4. Single-sourcing semantic engine (Keys / Conref / DITAVAL)` --references--> `ProfilingAttrEditor()`  [INFERRED]
  README.en.md → apps/web/src/components/ProfilingAttrEditor.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (144 total, 34 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.13
Nodes (30): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+22 more)

### Community 1 - "git-store.ts"
Cohesion: 0.11
Nodes (35): CheckinCandidate, CheckinDialogProps, DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinResponse, checkoutFile(), createGitBranch() (+27 more)

### Community 2 - "converter.ts"
Cohesion: 0.11
Nodes (33): 4.4 OASIS CALS Table Fidelity, CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), hasMultipleTgroups() (+25 more)

### Community 3 - "normalizePosixPath"
Cohesion: 0.21
Nodes (6): computeMemoryDiagnostics(), basenamePosix(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref, DitaSemanticIndex

### Community 4 - "index.tsx"
Cohesion: 0.10
Nodes (24): DEFAULT_DIR_FOR_TYPE, NewTopicMountContext, TOPIC_OPTIONS, SOURCE_KEYS, isTopicGuideType(), readInitialExpanded(), TOPIC_AUTHORING_GUIDES, TopicAuthoringGuide() (+16 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.10
Nodes (23): @dita/core@workspace:*, devDependencies, tsx@^4.19.3, @types/better-sqlite3@^9.6.0, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, @dita/core (+15 more)

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
Cohesion: 0.09
Nodes (14): CalsColspecNodeView, createCommentChevronTag(), createDitaNodeViews(), CreateDitaNodeViewsOptions, DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaRefInlineNodeView (+6 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.21
Nodes (28): extractTitleSafe(), applyElementAttrsPreservingOrder(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DitaMapKind, DitaMapReferenceInfo, extractDitaDocumentTitle() (+20 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (16): dict, Props, LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical, dict (+8 more)

### Community 21 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/language@^6.13.1, @dita/core@workspace:*, @lezer/highlight@^1.2.1, prosemirror-gapcursor@^1.4.1, prosemirror-history@^1.5.2 (+13 more)

### Community 22 - "ref_react"
Cohesion: 0.10
Nodes (21): LeftSidebarProps, sanitizeCssColor(), EditorToolbarProps, InlineBubbleAnchor, InlineBubbleToolbarProps, TAG_ICONS, EditorSelectionSnapshot, useInstantTitles() (+13 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "VisualEditor.tsx"
Cohesion: 0.12
Nodes (30): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElementAtPos(), insertInlineImage() (+22 more)

### Community 25 - "editor-store.ts"
Cohesion: 0.10
Nodes (34): NewMapDialogProps, ProblemsPanelProps, fetchFileAtRevision(), LockLike, createWorkspaceDir(), createWorkspaceFile(), createWorkspaceProject(), deleteWorkspaceEntry() (+26 more)

### Community 26 - "ai-types.ts"
Cohesion: 0.06
Nodes (69): PromptStrings, abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame (+61 more)

### Community 27 - "web/src/i18n/locale.ts"
Cohesion: 0.12
Nodes (26): dateTimeFormatter(), dateTimeFormatters, formatDateTime(), formatDuration(), formatRelativeTime(), interpolate(), relativeFormatter(), relativeFormatters (+18 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 29 - "createServer"
Cohesion: 0.16
Nodes (11): createServer(), WorkspaceDitavalSummary, WorkspaceFileNode, registerSemanticIndexerRoutes(), resolveConrefSchema, resolveDocumentSchema, BranchIndexState, collectAllFilePaths() (+3 more)

### Community 30 - "PublishService"
Cohesion: 0.15
Nodes (7): PublishJobRow, findFirstPdf(), isInside(), parseDiagnostics(), PublishService, sanitizeFileStem(), toIso()

### Community 31 - "serializer.ts"
Cohesion: 0.28
Nodes (15): isBlockElementName(), isInlineElementName(), isWhitespacePreservingElement(), escapeXmlAttr(), escapeXmlText(), formatDoctype(), hasBlockChildren(), hasNonWhitespaceTextOrInline() (+7 more)

### Community 32 - "dita-rules.ts"
Cohesion: 0.07
Nodes (28): DitaStructurePluginState, ResolvedOptions, COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, SUPPORTED_UI_LOCALES, UiLocale, CATALOGUES (+20 more)

### Community 33 - "decorations.ts"
Cohesion: 0.15
Nodes (18): BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS, createBlockGapInserterDom(), createChevronCapSvg(), createConrefWidgetDom(), createDitavalFlagPillDom(), createOxygenTagDom() (+10 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (27): 4.6.1 Static Site Invariants (`apps/site`, Phase 7), anchor(), columns, dict, home, Props, year, dict (+19 more)

### Community 35 - "ParsedDitaval"
Cohesion: 0.15
Nodes (20): FileExplorerPanelProps, PublishDialogProps, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialogProps, VisualSemanticContext, BuildCompositeMapTreeOptions (+12 more)

### Community 36 - "lock-helpers.ts"
Cohesion: 0.20
Nodes (11): LockStatusBarProps, stateStyles, IdentityRole, describeLock(), FileEditability, ResolveEditabilityInput, resolveFileEditability(), parseEventFrame() (+3 more)

### Community 37 - "publish-service.ts"
Cohesion: 0.06
Nodes (67): ApiLocale, apiCatalogue(), apiMessagesEn, apiMessagesZh, apiT(), CATALOGUES, CreateServerOptions, AiContextInput (+59 more)

### Community 38 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 39 - "semantic-engine.ts"
Cohesion: 0.17
Nodes (15): KeyspacePanelProps, BfsFrame, buildKeyspace(), expandScopePrefixes(), extractInlineKeyText(), findDirectChild(), getNormalizedText(), isSubmapReference() (+7 more)

### Community 40 - "快速开始"
Cohesion: 0.15
Nodes (13): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT） (+5 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.11
Nodes (16): collections, docs, Capability, DocSlug, Locale, dict, groups, index (+8 more)

### Community 42 - "xpath.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 43 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, vitest@^3.1.0, @types/react, @types/react-dom (+3 more)

### Community 44 - "XmlParseError"
Cohesion: 0.18
Nodes (13): FileContentResult, EditorTabBarProps, IdentitySwitcherProps, NewTopicDialogProps, WorkbenchHeaderProps, IdentityResponse, IdentityUser, FileContentResult (+5 more)

### Community 45 - "map-tree-utils.ts"
Cohesion: 0.24
Nodes (12): buildCompositeMapTree(), CompositeMapTreeResult, isSameOrDescendantPath(), planMapNodeMove(), PlannedMapMoveResult, subtreeReferencesMap(), DitaMapTreeNode, InsertMapNodeOptions (+4 more)

### Community 46 - "createMapTemplate"
Cohesion: 0.31
Nodes (6): buildScaleDitaProject(), tempDirs, createMapTemplate(), CreateMapTemplateOptions, escapeText(), sanitizeId()

### Community 47 - "Changelog"
Cohesion: 0.12
Nodes (16): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, Added, Added, Added, Changed (+8 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.11
Nodes (15): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+7 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "workspace-fs.ts"
Cohesion: 0.06
Nodes (37): createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema, mkdirSchema, openWorkspaceSchema, registerWorkspaceFileRoutes(), renameSchema (+29 more)

### Community 51 - "httpError"
Cohesion: 0.09
Nodes (42): firstHeaderValue(), RequestLike, resolveRequestLocale(), ApiMessageKey, ApiMessageParams, requireAdmin(), httpError(), HttpErrorI18n (+34 more)

### Community 52 - "i18n/index.ts"
Cohesion: 0.25
Nodes (10): en, DICTIONARIES, getDictionary(), isLocale(), DEFAULT_LOCALE, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.11
Nodes (51): useAiStore, AiAssistantPanel(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), App(), CheckinDialog(), ConrefReusePanel() (+43 more)

### Community 54 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/lint@^6.9.8, lucide-react@^1.76.0, prosemirror-gapcursor@^1.4.1, prosemirror-model@^1.25.13, prosemirror-view@^1.43.0, react@^19.0.0 (+9 more)

### Community 55 - "classifyDitaFileKind"
Cohesion: 0.33
Nodes (6): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), InMemoryDemoWorkspace, collectFileSetFromTree(), useEditorStore, classifyDitaFileKind()

### Community 56 - "lock-service.ts"
Cohesion: 0.05
Nodes (52): drizzle-orm@^0.45.4, DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, AiUsageLogRow (+44 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.23
Nodes (23): updateNodeRawAttr(), addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell() (+15 more)

### Community 58 - "3.2 四项关键技术机制"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 59 - "GitManager"
Cohesion: 0.13
Nodes (9): FileLockRow, GitManager, IdentityUser, LockService, Phase4Scope, DitaDecorationMeta, DitaDecorationPluginState, TagDisplayMode (+1 more)

### Community 60 - "ditaval.ts"
Cohesion: 0.16
Nodes (17): ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions() (+9 more)

### Community 61 - "helpers.ts"
Cohesion: 0.27
Nodes (10): PM_NODE_TO_DITA_TAG, countCalsTgroups(), findDirectElementIndexInPmParent(), findNthDirectElementChild(), findPmPosByElementPath(), isDitaElementPmNode(), pmHasMultipleTgroups(), resolvePmElementPath() (+2 more)

### Community 62 - "dita-core/src/index.ts"
Cohesion: 0.07
Nodes (25): VisualEditorHandle, findBoldPos(), buildState(), loadDoc(), collectFiles(), SKIPPED_FILES, SRC_DIR, makeState() (+17 more)

### Community 63 - "UiLocale"
Cohesion: 0.11
Nodes (19): createTopicTemplate(), CreateTopicTemplateOptions, DitaSampleDocument, escapeText(), sanitizeId(), 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台 (+11 more)

### Community 64 - "checkXmlWellFormed"
Cohesion: 0.08
Nodes (45): 4.7 AI Assistance Boundaries (Phase 6), close(), AI assistance, AI 辅助, element(), [1.0.0] — 2026-11-22, Added, Changed (+37 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.09
Nodes (34): acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, BlockMovePlan, buildConvertedBlock(), computeBlockGaps(), findBlockHandleTarget() (+26 more)

### Community 66 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 67 - "phase6-ai-api.test.ts"
Cohesion: 0.04
Nodes (80): buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), AiModelFactory, createExplanationStreamFilter(), ExplanationStreamFilter (+72 more)

### Community 68 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 69 - "lucide-react"
Cohesion: 0.15
Nodes (16): changeLabelKey(), GitPanel(), GitPanelProps, shortDate(), IdentitySwitcher(), LocaleSwitcher(), OPTIONS, CURRENT_USER_STORAGE_KEY (+8 more)

### Community 70 - "translate"
Cohesion: 0.14
Nodes (15): defaultInstruction(), targetLabel(), createDitaXmlLinter(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement (+7 more)

### Community 71 - "AttributesPanel.tsx"
Cohesion: 0.13
Nodes (32): ATTR_BADGE_COLORS, ProfilingAttrEditor(), TABS, TopicInspectorProps, createDitaXmlCompletionSource(), findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET (+24 more)

### Community 72 - "dita-core/src/index.ts"
Cohesion: 0.07
Nodes (45): 4.8 DITA 1.3 Ordered Content Models (Phase 9), 7. Implementation Roadmap Status, insertBlockDitaElement(), resolveSequenceAnchor(), ActiveTableInfo, buildInsertContextGroups(), extractActiveTableInfo(), findLegalAncestorDepthForBlock() (+37 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 76 - "web/package.json"
Cohesion: 0.14
Nodes (13): @codemirror/commands@^6.11.1, @codemirror/merge@^6.12.3, @dita/core@workspace:*, react-dnd-html5-backend@^16.0.1, @codemirror/commands, @codemirror/merge, @dita/core, license (+5 more)

### Community 77 - "structure-diagnostics.test.ts"
Cohesion: 0.16
Nodes (12): ditaXmlCompletionSource, describeStructureIssue(), StructureIssueLike, buildStructureDecorations(), createDitaStructurePlugin(), DITA_STRUCTURE_KEY, completeAtEnd(), cursorIntoTag() (+4 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "PublishQueue"
Cohesion: 0.20
Nodes (4): PublishQueue, PublishQueueOptions, 7. DITA-OT 4.x 权威校验与异步发布（Phase 5）, 7. Authoritative DITA-OT 4.x validation and asynchronous publishing (Phase 5)

### Community 80 - "en/features.md"
Cohesion: 0.17
Nodes (11): Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps, OASIS CALS tables (+3 more)

### Community 81 - "semantic-engine.ts"
Cohesion: 0.10
Nodes (35): extractProfilingValuesFromDocument(), DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+27 more)

### Community 82 - "zh/features.md"
Cohesion: 0.17
Nodes (11): Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+3 more)

### Community 83 - "ai-prompt.ts"
Cohesion: 0.19
Nodes (19): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+11 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.18
Nodes (7): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, astro, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "semantic-indexer.ts"
Cohesion: 0.13
Nodes (21): SemanticContextResponse, buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanelProps, MODES (+13 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "fragment-locator.ts"
Cohesion: 0.24
Nodes (15): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+7 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (15): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+7 more)

### Community 91 - "DocsIndex.astro"
Cohesion: 0.20
Nodes (6): bySlug, dict, groups, Props, paths, Props

### Community 92 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.33
Nodes (6): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Golden Regression Tests, 4. Non-Negotiable Engineering Invariants

### Community 95 - "ref_react"
Cohesion: 0.09
Nodes (27): AiDiffDialog(), DiffDialog(), revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel(), InspectorTab (+19 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "createServer"
Cohesion: 0.04
Nodes (54): dependencies, better-sqlite3@^13.2.0, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2, @langchain/openai@^1.8.4, simple-git@^4.1.0 (+46 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "xml-bridge.ts"
Cohesion: 0.36
Nodes (7): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc()

### Community 100 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`)

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

### Community 105 - "Screenshots"
Cohesion: 0.25
Nodes (8): Local Git versioning, check-out locks, and visual diffs, Phase 5: DITA-OT strict validation and asynchronous HTML5 / Chinese PDF publishing, Phase 6: AI-assisted authoring, semantic tag optimization, and error repair, Screenshots, Single-sourcing semantic engine (Keyref / Conref / DITAVAL), Three-pane workbench and the Keys panel, Three-pane workbench with the Phase 4 version panel, Visual and XML source side-by-side mode

### Community 106 - "zh/introduction.md"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "DITAEditor"
Cohesion: 0.15
Nodes (13): Architecture and technology stack, Backend environment variables (`@dita/api`), Develop, build, and test, DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup) (+5 more)

### Community 110 - "FileExplorerPanel.tsx"
Cohesion: 0.83
Nodes (3): FileExplorerPanel(), FileIcon(), filterTreeNodes()

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

### Community 124 - "react@^19.0.0"
Cohesion: 0.33
Nodes (4): react@^19.0.0, tailwindcss@^4.3.5, react, tailwindcss

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 871 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `normalizePosixPath`, `dita-map.ts`, `editor-store.ts`, `ai-types.ts`, `xpath.ts`, `map-tree-utils.ts`, `Changelog`, `workspace-fs.ts`, `classifyDitaFileKind`, `ditaval.ts`, `UiLocale`, `zh/architecture.md`, `translate`, `en/architecture.md`, `en/features.md`, `semantic-engine.ts`, `zh/features.md`, `e2e-ai-live.mts`, `4. Non-Negotiable Engineering Invariants`, `xml-bridge.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13277310924369748 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `PublishDialog.tsx`, `git-store.ts`, `VisualEditor.tsx`, `ParsedDitaval`, `lock-helpers.ts`, `index.tsx`, `AttributesPanel.tsx`, `web/package.json`, `FileExplorerPanel.tsx`, `App.tsx`, `dependencies`, `semantic-indexer.ts`, `ref_react`, `ai-types.ts`, `ref_react`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10661268556005399 - nodes in this community are weakly interconnected._