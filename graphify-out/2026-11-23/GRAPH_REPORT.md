# Graph Report - DITAEditor  (2026-11-23)

## Corpus Check
- 277 files · ~246,100 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 50 file(s) not represented in the graph (top: .dita 30, (none) 5, .ditaval 4)

## Summary
- 2838 nodes · 7679 edges · 153 communities (117 shown, 36 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 360 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aeabee11`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PublishDialog.tsx
- git-store.ts
- converter.ts
- UiLocale
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
- getRawAttr
- env
- dita-map.ts
- BaseLayout.astro
- dependencies
- MapTreeNodeRenderer.tsx
- scripts
- commands.ts
- xpath.ts
- ai-types.ts
- 3.2 四项关键技术机制
- deploy-site.yml
- AiAssistantPanel.tsx
- 3. ① 规则数据层
- serializer.ts
- SourceEditor.tsx
- structure-options.ts
- locales.ts
- ai-service.ts
- translate
- publish-service.ts
- prosemirror/schema.ts
- 4. 核心元素写作细则
- 快速开始
- DocsLayout.astro
- normalizePosixPath
- devDependencies
- DITA Concept（概念）主题编写规范
- workspace-fs.ts
- createServer
- Changelog
- HomePage.astro
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- DITA Reference（参考）主题编写规范
- httpError
- i18n/index.ts
- App.tsx
- dependencies
- ai-types.ts
- lock-service.ts
- table-commands.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- ditaval.ts
- index.tsx
- decorations.ts
- main.tsx
- fragment-splice.ts
- VisualEditor.tsx
- en/architecture.md
- DiffViewer
- helpers.ts
- cals-table.ts
- dita-rules.ts
- AttributesPanel.tsx
- dita-structure.ts
- SearchModal.astro
- docker-entrypoint.sh
- 前端 DITA 1.3 结构化写作合规实施说明
- Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）
- ai-prompt.ts
- devDependencies
- astro
- en/features.md
- dita-core/src/index.ts
- zh/features.md
- modules/ai/types.ts
- astro.config.ts
- en/ai-setup.md
- dita-elements.ts
- zh/ai-setup.md
- compilerOptions
- semantic-engine.ts
- e2e-ai-live.mts
- lucide-react
- 4. Non-Negotiable Engineering Invariants
- DitaPrologNodeView
- editor-store.ts
- fragment-locator.ts
- MiniRoundTripDemo.tsx
- api/src/index.ts
- en/getting-started.md
- @codemirror/commands@^6.11.1
- site/package.json
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- 界面预览
- Screenshots
- zh/introduction.md
- zh/local-development.md
- DITAEditor
- @codemirror/language@^6.13.1
- @lezer/highlight@^1.2.1
- scripts
- playground-presets.ts
- @codemirror/state@^6.7.6
- @dita/core@workspace:*
- prosemirror-gapcursor@^1.4.1
- prosemirror-state@^1.4.4
- README.md
- prosemirror-view@^1.43.0
- Added
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- react@^19.0.0
- tailwindcss@^4.3.5
- compare.ts
- sync-hf-space.sh
- @codemirror/language@^6.13.1
- PublishService
- @codemirror/state@^6.7.6
- @codemirror/view@^6.43.15
- @dita/core@workspace:*
- AGENTS.md
- Phase 6 AI Assistance — Implementation Contract
- prosemirror-dropcursor@^1.8.4
- prosemirror-gapcursor@^1.4.1
- @codemirror/lang-xml@^6.1.0
- @lezer/highlight@^1.2.5
- prosemirror-inputrules@^1.7.0
- prosemirror-state@^1.4.4
- prosemirror-view@^1.43.0
- react@^19.0.0
- prosemirror-commands@^1.7.2
- react-dom@^19.0.0
- react-resizable-panels
- tailwindcss@^4.3.5
- map-tree-utils.ts
- src/ai/types.ts
- prosemirror-history@^1.5.2
- buildDitaConstraintSummary
- react-dnd@^16.0.1
- DitaRefInlineNodeView
- @tailwindcss/vite@^4.3.5

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 94 edges
2. `App()` - 56 edges
3. `t()` - 53 edges
4. `apiT()` - 49 edges
5. `translate()` - 48 edges
6. `WorkspaceManager` - 46 edges
7. `requestJson()` - 46 edges
8. `lucide-react` - 44 edges
9. `getCurrentLocale()` - 44 edges
10. `parseXml()` - 44 edges

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

## Communities (153 total, 36 thin omitted)

### Community 0 - "PublishDialog.tsx"
Cohesion: 0.13
Nodes (30): JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), STATUS_META, stemOf() (+22 more)

### Community 1 - "git-store.ts"
Cohesion: 0.07
Nodes (47): CheckinCandidate, CheckinDialogProps, changeLabelKey(), GitPanel(), GitPanelProps, shortDate(), LockStatusBarProps, stateStyles (+39 more)

### Community 2 - "converter.ts"
Cohesion: 0.20
Nodes (17): appendPmNodeToDom(), applyRawAttrs(), convertBlockContainerChildren(), convertInlineChildren(), convertInlineNode(), elementContainsBlockChild(), INLINE_PREFERRED_PARENTS, isBlockChildElement() (+9 more)

### Community 3 - "UiLocale"
Cohesion: 0.13
Nodes (13): ResolvedOptions, COMMON_ATTRIBUTES, AiExtractOptions, DEFAULT_UI_LOCALE, FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES, UiLocale (+5 more)

### Community 4 - "index.tsx"
Cohesion: 0.12
Nodes (19): isTopicGuideType(), readInitialExpanded(), TOPIC_AUTHORING_GUIDES, TopicAuthoringGuide(), TopicAuthoringGuideProps, TopicAuthoringGuideSpec, TopicGuideType, TopicStructureToken (+11 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "API Package Manifest"
Cohesion: 0.07
Nodes (38): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2 (+30 more)

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

### Community 17 - "getRawAttr"
Cohesion: 0.10
Nodes (11): CalsColspecNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, NOTE_TYPE_LABELS, NOTE_TYPES (+3 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.12
Nodes (41): buildScaleDitaProject(), tempDirs, computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult (+33 more)

### Community 20 - "BaseLayout.astro"
Cohesion: 0.12
Nodes (17): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+9 more)

### Community 21 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, @codemirror/search@^6.7.2, @codemirror/view@^6.43.15, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4 (+11 more)

### Community 22 - "MapTreeNodeRenderer.tsx"
Cohesion: 0.25
Nodes (8): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, sanitizeCssColor(), XmlLikeElement, XmlLikeNode, createMapTreeNodeRenderer(), NodeKindIcon(), TAG_PILL_STYLES

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "commands.ts"
Cohesion: 0.09
Nodes (36): createDitaElementSkeleton(), EMPTY_ATTRS, exitCodeblockToParagraph(), handleDitaBackspace(), handleDitaEnter(), hydrateEmptyContainerAtPos(), insertBlockDitaElement(), insertBlockDitaElementAtPos() (+28 more)

### Community 25 - "xpath.ts"
Cohesion: 0.18
Nodes (12): ConrefUsage, evaluateXPathToFirstNode(), evaluateXPathToNodes(), evaluateXPathToStrings(), findConrefUsages(), findElementByDitaId(), findKeyrefUsages(), FontoXPathApi (+4 more)

### Community 26 - "ai-types.ts"
Cohesion: 0.16
Nodes (23): AiStreamHandlers, fetchAiConfig(), fetchAiUsage(), ParsedSseFrame, saveAiConfig(), testAiConfig(), AiChatMessage, AiPanelState (+15 more)

### Community 27 - "3.2 四项关键技术机制"
Cohesion: 0.24
Nodes (10): DitaDecorationMeta, DitaDecorationPluginState, TagDisplayMode, 3.2 四项关键技术机制, DitaAttributeSpec, createTopicTemplate(), CreateTopicTemplateOptions, DitaSampleDocument (+2 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (39): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+31 more)

### Community 29 - "AiAssistantPanel.tsx"
Cohesion: 0.22
Nodes (13): resetAiStore(), AI_SELECTED_TEXT_LIMIT, AI_TARGET_SCOPE_LABELS, AiTargetScope, buildLineWindowAiTarget(), buildSourceAiTarget(), buildVisualAiTarget(), normalizeSelectedText() (+5 more)

### Community 30 - "3. ① 规则数据层"
Cohesion: 0.13
Nodes (15): entry(), 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次, 3.3 槽位语义, 3.4 Strict Task 与 General Task, 3.5 刻意的"宽容"（保无损）, 3.6 编辑策略例外（不是 DTD 规则） (+7 more)

### Community 31 - "serializer.ts"
Cohesion: 0.26
Nodes (15): isBlockElementName(), isInlineElementName(), escapeXmlAttr(), escapeXmlText(), formatDoctype(), hasBlockChildren(), hasNonWhitespaceTextOrInline(), hasSignificantTextOrCdata() (+7 more)

### Community 32 - "SourceEditor.tsx"
Cohesion: 0.14
Nodes (19): FileContentResult, WorkspaceDitavalSummary, WorkspaceFileNode, BranchIndexState, collectAllFilePaths(), SemanticContextResponse, ProfilingAttrEditorProps, TaskModelSwitchProps (+11 more)

### Community 33 - "structure-options.ts"
Cohesion: 0.09
Nodes (29): getTaskContentModel(), getTaskContentModelSetting(), resolveTaskModelForXml(), setDetectedTaskContentModel(), setTaskContentModelSetting(), shouldShowTaskModelSwitch(), DITA_STRUCTURE_KEY, DitaStructurePluginMeta (+21 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "ai-service.ts"
Cohesion: 0.09
Nodes (39): apiT(), AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), AiModelFactory (+31 more)

### Community 36 - "translate"
Cohesion: 0.11
Nodes (26): abortError(), dispatchFrame(), parseAiSseFrame(), streamAiRequest(), defaultInstruction(), targetLabel(), createDitaXmlLinter(), lintDocument() (+18 more)

### Community 37 - "publish-service.ts"
Cohesion: 0.06
Nodes (65): publishJobs, ApiLocale, CreateServerOptions, AiStreamContext, DITA_FILE, DitaDiagnostic, DitaPathRoot, extractMessage() (+57 more)

### Community 38 - "prosemirror/schema.ts"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "快速开始"
Cohesion: 0.15
Nodes (13): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 实施路线图（Roadmap）, 开发、构建与测试, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：仅编辑 / 语义写作（不安装 DITA-OT） (+5 more)

### Community 41 - "DocsLayout.astro"
Cohesion: 0.08
Nodes (20): bySlug, dict, groups, Props, paths, Props, Capability, DocSlug (+12 more)

### Community 42 - "normalizePosixPath"
Cohesion: 0.19
Nodes (9): collectFileSetFromTree(), computeMemoryDiagnostics(), syncMemorySemanticIndex(), updateMemoryIndexFile(), useEditorStore, classifyDitaFileKind(), normalizePosixPath(), DitaSemanticIndex (+1 more)

### Community 43 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vitest@^3.1.0, @types/react (+10 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "workspace-fs.ts"
Cohesion: 0.06
Nodes (38): ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, registerAssetRoutes(), sanitizeAssetFilename(), createFileSchema, createWorkspaceSchema, forgetWorkspaceSchema, importWorkspaceSchema (+30 more)

### Community 46 - "createServer"
Cohesion: 0.23
Nodes (3): registerSemanticIndexerRoutes(), summarizeDitaval(), WorkspaceSemanticIndexer

### Community 47 - "Changelog"
Cohesion: 0.12
Nodes (16): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, Added, Added, Added, Changed (+8 more)

### Community 48 - "HomePage.astro"
Cohesion: 0.11
Nodes (15): Props, dict, jsonLd, layerRows, Props, showcaseImages, Props, Props (+7 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "httpError"
Cohesion: 0.07
Nodes (53): firstHeaderValue(), RequestLike, resolveRequestLocale(), apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh (+45 more)

### Community 52 - "i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 53 - "App.tsx"
Cohesion: 0.12
Nodes (49): useAiStore, AiAssistantPanel(), AiSettingsDialog(), AiSettingsDialogProps, formatNumber(), App(), CheckinDialog(), EditorTabBar() (+41 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2, lucide-react@^1.76.0, prosemirror-keymap@^1.2.3, prosemirror-model@^1.25.13, react-arborist@^4.0.1 (+10 more)

### Community 55 - "ai-types.ts"
Cohesion: 0.12
Nodes (26): PromptStrings, AiPanelIntent, AiApiKeySource, AiDeltaEvent, AiDiagnosticContext, AiFixContext, AiHistoryTurn, AiSseEvent (+18 more)

### Community 56 - "lock-service.ts"
Cohesion: 0.08
Nodes (36): DitaDatabase, DitaDatabaseHandle, migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, FileLockRow, fileLocks (+28 more)

### Community 57 - "table-commands.ts"
Cohesion: 0.25
Nodes (21): addTableColumn(), addTableRow(), buildCalsSectionGrid(), CalsGridCell, CalsSectionGrid, createEmptyCalsEntry(), createEmptySimpleCell(), deleteTableColumn() (+13 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.11
Nodes (17): httpError(), changeLabel(), GitBranchInfo, GitCommitEntry, GitFileChange, GitFileDiff, GitManager, GitManagerOptions (+9 more)

### Community 60 - "ditaval.ts"
Cohesion: 0.16
Nodes (17): ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions() (+9 more)

### Community 61 - "index.tsx"
Cohesion: 0.11
Nodes (26): arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody(), dateTimeFormatter(), dateTimeFormatters, formatDateTime() (+18 more)

### Community 62 - "decorations.ts"
Cohesion: 0.11
Nodes (23): ditaXmlCompletionSource, findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET, stripNonTagXml(), BlockGapOpenMenuPayload, collectDitaDecorations(), CONTAINER_QUICK_BLOCK_TAGS (+15 more)

### Community 64 - "fragment-splice.ts"
Cohesion: 0.15
Nodes (23): AI 辅助, 1. `@dita/core` — `src/ai/`, 4.2 三种靶向定位与无损回拼策略, DITA_TOPIC_ROOTS, doctypeSignature(), failedVerification(), failure(), firstElementTagName() (+15 more)

### Community 65 - "VisualEditor.tsx"
Cohesion: 0.08
Nodes (59): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, blockIndexInContainer(), blockIndexInParent(), BlockMovePlan (+51 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.07
Nodes (26): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+18 more)

### Community 67 - "DiffViewer"
Cohesion: 0.17
Nodes (13): 4.7 AI Assistance (`Phase 6`), AiDiffDialog(), DiffDialog(), DiffDialogProps, revisionLabel(), diffTheme, DiffViewer(), DiffViewerProps (+5 more)

### Community 68 - "helpers.ts"
Cohesion: 0.13
Nodes (20): InsertKeyrefDialogProps, XrefImageDialogProps, VisualEditorHandle, UploadAssetResult, countCalsTgroups(), findDirectElementIndexInPmParent(), findDirectPmChildByTag(), findNthDirectElementChild() (+12 more)

### Community 69 - "cals-table.ts"
Cohesion: 0.23
Nodes (11): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+3 more)

### Community 70 - "dita-rules.ts"
Cohesion: 0.11
Nodes (17): ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS, DitaAttributeGroup, DitaElementCategory, ELEMENT_DESCRIPTIONS_ZH (+9 more)

### Community 71 - "AttributesPanel.tsx"
Cohesion: 0.11
Nodes (33): ConrefReusePanelProps, SOURCE_KEYS, ATTR_BADGE_COLORS, ProfilingAttrEditor(), TABS, TopicInspectorProps, createDitaXmlCompletionSource(), AttributesPanel() (+25 more)

### Community 72 - "dita-structure.ts"
Cohesion: 0.06
Nodes (56): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), describeStructureIssue(), StructureIssueLike, buildStructureDecorations(), findBoldPos(), buildState(), buildTaskState(), cursorIntoTag() (+48 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.18
Nodes (10): 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 5.2 源码模式：CodeMirror Linter, 5. ③ 诊断层：看得见，但不挡路, 5.3 跨文件：语义索引与 Problems 面板, 5.4 文案单一来源, 5.5 为什么不用 `filterTransaction` (+2 more)

### Community 76 - "Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）"
Cohesion: 0.22
Nodes (8): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3. 全栈 i18n 架构设计, 4. OASIS DITA 1.3 官方英文术语规范表, 5. 目录结构规划, 7. 验收标准（Definition of Done）, Phase 8 规划与实施蓝图：全栈英文版界面与双语国际化（i18n）

### Community 77 - "ai-prompt.ts"
Cohesion: 0.20
Nodes (18): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+10 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "astro"
Cohesion: 0.40
Nodes (4): astro@^5.18.2, collections, docs, astro

### Community 80 - "en/features.md"
Cohesion: 0.15
Nodes (12): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Maps and bookmaps (+4 more)

### Community 81 - "dita-core/src/index.ts"
Cohesion: 0.16
Nodes (14): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, DEFAULT_DIR_FOR_TYPE (+6 more)

### Community 82 - "zh/features.md"
Cohesion: 0.17
Nodes (11): Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+3 more)

### Community 83 - "modules/ai/types.ts"
Cohesion: 0.05
Nodes (46): AiUsageLogRow, aiUsageLogs, addTokens(), AiUsageRecordInput, AiUsageStatus, AiUsageSummaryOptions, emptyTokens(), toDayBucketKey() (+38 more)

### Community 84 - "astro.config.ts"
Cohesion: 0.15
Nodes (5): site, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, @astrojs/react, @astrojs/sitemap

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "dita-elements.ts"
Cohesion: 0.20
Nodes (9): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+1 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "semantic-engine.ts"
Cohesion: 0.09
Nodes (44): KeyspacePanelProps, extractProfilingValuesFromDocument(), coreT(), DITA_TOPIC_ROOT_TAGS, areConrefTagsCompatible(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText() (+36 more)

### Community 90 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (15): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+7 more)

### Community 91 - "lucide-react"
Cohesion: 0.26
Nodes (10): IdentitySwitcherProps, LeftSidebarProps, LocaleSwitcher(), OPTIONS, WorkbenchHeaderProps, IdentityResponse, IdentityUser, EditorViewMode (+2 more)

### Community 92 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.17
Nodes (11): 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`), 4. Non-Negotiable Engineering Invariants, 4.6 行内元素与表格的额外保真规则 (+3 more)

### Community 94 - "editor-store.ts"
Cohesion: 0.07
Nodes (56): EditorTabBarProps, FileExplorerPanelProps, FileIcon(), filterTreeNodes(), NewMapDialogProps, NewTopicDialogProps, ProblemsPanelProps, PublishDialogProps (+48 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.24
Nodes (16): buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS, deriveRootTagName(), elementChildren(), extractElementTarget() (+8 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "api/src/index.ts"
Cohesion: 0.05
Nodes (41): createServer(), AiChatModel, createLangChainModelFactory(), AiConfigTestResult, resetDitaRuntimeCache(), registerIdentityRoutes(), defaultWebDistDir(), isInside() (+33 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.20
Nodes (9): First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands, Troubleshooting (+1 more)

### Community 99 - "@codemirror/commands@^6.11.1"
Cohesion: 0.33
Nodes (4): @codemirror/commands@^6.11.1, @codemirror/lint@^6.9.8, @codemirror/commands, @codemirror/lint

### Community 100 - "site/package.json"
Cohesion: 0.12
Nodes (15): @codemirror/lang-xml@^6.1.0, @codemirror/merge@^6.12.3, prosemirror-history@^1.5.2, prosemirror-model@^1.25.13, react-dom@^19.0.0, @codemirror/lang-xml, @codemirror/merge, prosemirror-history (+7 more)

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

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "playground-presets.ts"
Cohesion: 0.15
Nodes (6): PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 117 - "README.md"
Cohesion: 0.31
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 119 - "Added"
Cohesion: 0.33
Nodes (7): close(), element(), [1.0.0] — 2026-11-22, Added, Changed, Fixed, Phase 6 概要

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.14
Nodes (12): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐） (+4 more)

### Community 121 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.07
Nodes (30): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+22 more)

### Community 124 - "compare.ts"
Cohesion: 0.48
Nodes (6): isWhitespacePreservingElement(), compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry

### Community 127 - "PublishService"
Cohesion: 0.07
Nodes (13): PublishJobRow, WorkspaceRouteSecurity, IdentityService, toIdentityUser(), PublishQueue, PublishQueueOptions, findFirstPdf(), isInside() (+5 more)

### Community 131 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`)

### Community 132 - "Phase 6 AI Assistance — Implementation Contract"
Cohesion: 0.33
Nodes (4): errorMessage(), 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract

### Community 145 - "map-tree-utils.ts"
Cohesion: 0.11
Nodes (32): VisualSemanticContext, CreateDitaNodeViewsOptions, VisualEditorProps, buildCompositeMapTree(), BuildCompositeMapTreeOptions, CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath() (+24 more)

### Community 146 - "src/ai/types.ts"
Cohesion: 0.47
Nodes (5): 4.1 文件清单与核心函数, AiFragmentExtraction, AiSpliceErrorCode, AiSpliceResult, AiVerificationReport

### Community 148 - "buildDitaConstraintSummary"
Cohesion: 0.11
Nodes (18): buildDitaConstraintSummary(), 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 可视化 Map / Bookmap 树与多文件工作台, 4. 单一信息源语义引擎（Keys / Conref / DITAVAL）, 5. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 6. 本地 Git 版本管理与 Check-out 独占锁（Phase 4）, 8. AI 辅助写作、语义标签优化与错误修复（Phase 6） (+10 more)

## Knowledge Gaps
- **11 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `OASIS CALS Table Adapter` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 956 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `fragment-splice.ts` to `en/architecture.md`, `dita-structure.ts`, `normalizePosixPath`, `前端 DITA 1.3 结构化写作合规实施说明`, `workspace-fs.ts`, `Changelog`, `en/features.md`, `map-tree-utils.ts`, `zh/features.md`, `dita-map.ts`, `buildDitaConstraintSummary`, `xpath.ts`, `semantic-engine.ts`, `e2e-ai-live.mts`, `4. Non-Negotiable Engineering Invariants`, `AiAssistantPanel.tsx`, `editor-store.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `Added` and `2. 现有代码库中文文案全量盘点（基线扫描）`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PublishDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13277310924369748 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `PublishDialog.tsx`, `git-store.ts`, `SourceEditor.tsx`, `DiffViewer`, `index.tsx`, `VisualEditor.tsx`, `AttributesPanel.tsx`, `devDependencies`, `dita-core/src/index.ts`, `map-tree-utils.ts`, `App.tsx`, `dependencies`, `ai-types.ts`, `MapTreeNodeRenderer.tsx`, `index.tsx`, `editor-store.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `Added` and `Slice 8.2：前端 i18n 引擎、顶栏切换与布局骨架（第 3–4 天）`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._