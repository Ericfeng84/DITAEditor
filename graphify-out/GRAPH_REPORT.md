# Graph Report - DITAEditor  (2026-11-27)

## Corpus Check
- 486 files · ~488,289 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 70 file(s) not represented in the graph (top: .dita 26, .css 25, (none) 6)

## Summary
- 5449 nodes · 15646 edges · 185 communities (177 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 836 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `39ed9a5e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- phase6-ai-api.test.ts
- git-store.ts
- AssignmentService
- App.tsx
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
- internals.ts
- env
- ref_prosemirror_state
- parser-settings-service.ts
- site/package.json
- lock-service.ts
- scripts
- ingest-service.ts
- BaseLayout.astro
- theme-runtime.js
- fop-font-config.ts
- deploy-site.yml
- electron-builder.yml
- prosemirror/schema.ts
- WorkspaceManager
- with
- writer-agent.ts
- locales.ts
- theme-enhancer.ts
- translate
- getPmNodeRawAttrs
- .getRootDir
- 4. 核心元素写作细则
- dita-core/src/index.ts
- selectors.ts
- IdentityUser
- devDependencies
- DITA Concept（概念）主题编写规范
- getRawAttr
- dita-plan-builder.ts
- serializer.ts
- VisualEditor.tsx
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- DITA Reference（参考）主题编写规范
- manual-registry-service.ts
- editor-store/types.ts
- checkXmlWellFormed
- web/package.json
- WorkbenchHubPage.tsx
- ai-workbench.test.ts
- main.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- html-themes.ts
- overlay-workspace.ts
- index.tsx
- semantic-engine.ts
- MergeService
- checkin-validation-ui.test.tsx
- en/architecture.md
- markdown-outline.ts
- 快速开始
- DraftService
- zh/architecture.md
- Getting started
- dita-ot-repair-agent.ts
- SearchModal.astro
- docker-entrypoint.sh
- git/routes.ts
- GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）
- DitaSemanticIndex
- devDependencies
- identity-api.ts
- publish-service.ts
- getCurrentLocale
- environment
- HomePage.astro
- phase13-overlay-versioning.test.ts
- en/ai-setup.md
- Language
- zh/ai-setup.md
- compilerOptions
- Changelog
- git/routes.ts
- SourceEditor.tsx
- ingest/routes.ts
- planner-agent.ts
- semantic-indexer.ts
- ai-service.ts
- MiniRoundTripDemo.tsx
- conref-drag.test.ts
- en/getting-started.md
- playground-presets.ts
- Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）
- map-tree-utils.ts
- en/local-development.md
- zh/getting-started.md
- docling-parser.ts
- publish-api.ts
- PublishDialog.tsx
- zh/local-development.md
- IngestService
- Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板
- git-restore-revert.test.ts
- scripts
- Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建
- parser-router.ts
- 4. Non-Negotiable Engineering Invariants
- parseXml
- api/test/phase12-html-themes.test.ts
- README.md
- 版本管理模型（As-Is 现状说明）
- validator-repair-agent.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- 3.1 后端 Git 与覆盖层安全（`@dita/api`）
- paths.ts
- IngestEngineChoice
- workspace-api.ts
- sync-hf-space.sh
- ingest-parsers.test.ts
- site/src/i18n/index.ts
- Domain Docs
- files.ts
- Issue tracker: Local Markdown
- createServer
- extractDataUriImages
- 3. SQLite 数据模型与迁移设计
- dita-rules.ts
- workspace-fs.ts
- outline-model.ts
- HTML5 publish themes
- e2e-ai-live.mts
- cloudbuild.yaml
- ingest-agent.test.ts
- DocsIndex.astro
- publish-profiles.ts
- ensure-electron.mjs
- Design principles
- IngestOutlinePlan
- desktop/package.json
- ingest-routes.test.ts
- astro.config.ts
- env
- build-desktop
- with
- IngestProgressStep.tsx
- zh/features.md
- tag
- en
- desktop/tsconfig.json
- key-management-integration.test.tsx
- release-desktop.yml
- git-restore-revert.test.tsx
- parsers/assets.ts
- steps
- ai-output-parser.ts
- attach-to-release
- scripts
- en/features.md
- 5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）
- deploy-cloudrun.sh
- triage-labels.md
- createTopicTemplate
- electron
- GET
- topicGuideTree.ts
- theme-preview.ts
- PublishQueue
- ingest-api.ts
- Core capabilities
- dependencies
- 3. 核心模块与接口契约
- DITAEditor — Web DITA 1.3 Workbench (Live Demo)
- commitWithModifyAndDelete
- git
- GitHub Pages 免费部署指南（官网 + 离线三栏工作台）
- 5. 验证计划

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 162 edges
2. `httpError()` - 102 edges
3. `requestJson()` - 89 edges
4. `App()` - 84 edges
5. `createServer()` - 83 edges
6. `GitManager` - 77 edges
7. `DraftService` - 76 edges
8. `checkXmlWellFormed()` - 73 edges
9. `lucide-react` - 72 edges
10. `IdentityUser` - 70 edges

## Surprising Connections (you probably didn't know these)
- `Fixed` --references--> `resolveDitaSpawn()`  [INFERRED]
  CHANGELOG.md → apps/api/src/modules/dita-ot/dita-runtime.ts
- `1.2 `POST /api/git/revert-commit` 未检查文件锁与个人草稿，导致草稿遮蔽回退结果` --references--> `readFileWithOverlay()`  [INFERRED]
  docs/phase13-restore-revert-fix-plan.md → apps/api/src/modules/files/overlay-workspace.ts
- `4.9 HTML5 Publish Themes (`Phase 12`)` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  AGENTS.md → apps/api/src/modules/files/workspace-fs.ts
- `8. 主要工程风险与应对策略` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  docs/phase12-html-themes-plan.md → apps/api/src/modules/files/workspace-fs.ts
- `修改 `apps/api/src/modules/git/routes.ts`` --references--> `buildDraftDiff()`  [INFERRED]
  docs/phase13-restore-revert-fix-plan.md → apps/api/src/modules/git/routes.ts

## Import Cycles
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/map-tree.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/tabs.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (185 total, 8 thin omitted)

### Community 0 - "phase6-ai-api.test.ts"
Cohesion: 0.03
Nodes (70): aiSettings, AiSettingsRow, aiUsageLogs, AiChatModel, createLangChainModelFactory(), AI_SETTINGS_ID, AiEnvDefaults, maskApiKey() (+62 more)

### Community 1 - "git-store.ts"
Cohesion: 0.06
Nodes (69): checkResolutionXml(), MergeDialog(), MergeDialogProps, XmlCheck, cancelCheckout(), checkinFiles(), CheckinOptions, CheckinResponse (+61 more)

### Community 2 - "AssignmentService"
Cohesion: 0.15
Nodes (11): TopicAssignmentRow, AssignmentService, parseStatus(), todayIso(), httpError(), normalizeRevision(), 5.1 手册管理接口（`apps/api/src/modules/manuals/routes.ts`）, 5.2 Topic 编辑任务接口（`apps/api/src/modules/assignments/routes.ts`） (+3 more)

### Community 3 - "App.tsx"
Cohesion: 0.05
Nodes (97): useAiStore, AiAssistantPanel(), AiSettingsDialog(), App(), AppProps, DelegateTopicButton(), DiffDialog(), EditorTabBar() (+89 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.06
Nodes (24): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enAssignments, enCollab, enCommon, enEditor, en (+16 more)

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

### Community 17 - "internals.ts"
Cohesion: 0.15
Nodes (29): setTaskContentModelSetting(), t(), createInMemoryDemoWorkspace(), createInitialEditorState(), readOutlineDensity(), readOutlineOpen(), cancelAllPendingRefreshes(), cancelOverlayRefresh() (+21 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "ref_prosemirror_state"
Cohesion: 0.11
Nodes (32): InsertKeyrefDialogProps, insertMissingTopicBody(), TOPIC_BODY_WRAPPER, createDitaElementSkeleton(), exitCodeblockToParagraph(), handleDitaEnter(), insertInlineImage(), toggleInlineDitaElement() (+24 more)

### Community 20 - "parser-settings-service.ts"
Cohesion: 0.12
Nodes (23): ingestParserSettings, IngestParserSettingsRow, assertDoclingMode(), assertEngineChoice(), assertTableMode(), clampInt(), extractVersionFromBody(), INGEST_PARSER_SETTINGS_ID (+15 more)

### Community 21 - "site/package.json"
Cohesion: 0.05
Nodes (52): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+44 more)

### Community 22 - "lock-service.ts"
Cohesion: 0.03
Nodes (89): DitaDatabase, migrateManuals(), migratePublishJobs(), openDatabase(), AiUsageLogRow, fileLocks, ingestJobs, LockBackupRow (+81 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "ingest-service.ts"
Cohesion: 0.08
Nodes (48): CreateServerOptions, AiModelFactory, AiService, AiServiceDeps, AiServiceLogger, AiSettingsService, AiUsageService, AiRouteDeps (+40 more)

### Community 25 - "BaseLayout.astro"
Cohesion: 0.10
Nodes (18): bySlug, dict, groups, Props, dict, Props, getDictionary(), LOCALE_HTML_LANG (+10 more)

### Community 26 - "theme-runtime.js"
Cohesion: 0.07
Nodes (80): absolutePath(), activateOnpage(), addSkipLink(), applyMode(), assembleLayout(), boot(), buildOnpage(), buildPager() (+72 more)

### Community 27 - "fop-font-config.ts"
Cohesion: 0.05
Nodes (69): 4.12 PDF Font Embedding (FOP 2.9 + Noto CJK), bestRecord(), decodeName(), decodeUtf16Be(), decodeUtf32Be(), extractFontFace(), FontByteReader, fontExtensionForVersion() (+61 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "prosemirror/schema.ts"
Cohesion: 0.43
Nodes (5): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes

### Community 31 - "WorkspaceManager"
Cohesion: 0.12
Nodes (10): normalizeOverlayPath(), registerWorkspaceFileRoutes(), resolveSafeWorkspacePathFor(), isWithinRoot(), resolveSafeWorkspacePath(), sanitizeWorkspaceDirName(), WorkspaceConflictError, WorkspaceManager (+2 more)

### Community 32 - "with"
Cohesion: 0.05
Nodes (43): concurrency, cancel-in-progress, group, runs-on, steps, env, DEEPSEEK_API_KEY, GCP_AR_REPO (+35 more)

### Community 33 - "writer-agent.ts"
Cohesion: 0.13
Nodes (29): DraftTopicResult, buildWriterSystemPrompt(), buildWriterUserPrompt(), coerceRootElement(), describeAssetMapping(), describeError(), draftTopicsConcurrently(), draftTopicWithAgent() (+21 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "theme-enhancer.ts"
Cohesion: 0.15
Nodes (27): appendBodyClasses(), buildSearchEntry(), collapseWhitespace(), collectHtmlFiles(), copySharedAsset(), copyWorkspaceAsset(), decodeEntities(), depthOf() (+19 more)

### Community 36 - "translate"
Cohesion: 0.07
Nodes (43): BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode, collectDitaDecorations() (+35 more)

### Community 37 - "getPmNodeRawAttrs"
Cohesion: 0.12
Nodes (36): DitaNoteNodeView, mergeCalsCellDown(), mergeCalsCellRight(), mergeCellContents(), splitCalsCell(), addTableColumn(), deleteTableColumn(), buildCalsSectionGrid() (+28 more)

### Community 38 - ".getRootDir"
Cohesion: 0.18
Nodes (5): collectAllFilePaths(), realpathSyncOrNull(), summarizeDitaval(), WorkspaceSemanticIndexer, 4.1 `ManualContextResolver`（请求级上下文解析器）

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "dita-core/src/index.ts"
Cohesion: 0.04
Nodes (73): buildStructureDecorations(), findBoldPos(), buildState(), buildTaskState(), makeKeywordSnapshot(), cursorIntoTag(), makeState(), noopCallbacks (+65 more)

### Community 41 - "selectors.ts"
Cohesion: 0.12
Nodes (21): LockStatusBarProps, stateStyles, ReadOnlyBannerProps, toneStyles, FileLock, IdentityRole, CanManageMapKeysInput, FileEditability (+13 more)

### Community 42 - "IdentityUser"
Cohesion: 0.15
Nodes (10): FileLockRow, buildDraftDiff(), IdentityUser, LockService, 3.1 检出（加锁，不建分支、不切分支）, 3.2 写入鉴权矩阵, 3.3 保存（写盘，不提交）, 3.4 检入（提交 + 释放锁，**唯一产生 commit 的入口**） (+2 more)

### Community 43 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, jsdom@^31.0.1, @testing-library/dom@^10.4.2, @testing-library/react@^16.3.3, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0 (+7 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "getRawAttr"
Cohesion: 0.16
Nodes (19): ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions() (+11 more)

### Community 46 - "dita-plan-builder.ts"
Cohesion: 0.13
Nodes (30): normalizePlanForExistingManual(), buildFallbackOutlinePlan(), buildKeysMapXml(), buildMapXmlFromPlan(), createPlannedElement(), DEFAULT_FOLDER_BY_TYPE, detectTopicType(), ensureExtension() (+22 more)

### Community 47 - "serializer.ts"
Cohesion: 0.06
Nodes (59): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+51 more)

### Community 48 - "VisualEditor.tsx"
Cohesion: 0.08
Nodes (68): buildDocumentOutline(), buildOutlineNode(), resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockHandleTarget, blockIndexInContainer() (+60 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "manual-registry-service.ts"
Cohesion: 0.09
Nodes (22): ManualRow, ApiLocale, WorkspaceScaffold, repositoryIdFor(), manualIdForRoot(), BUILTIN_SCOPE_DIRS, countManualFiles(), DEFAULT_PROTECTED_BRANCHES (+14 more)

### Community 52 - "editor-store/types.ts"
Cohesion: 0.08
Nodes (37): RawPlannedTopic, RawPlanShape, PlanOutlineInput, IngestJobOptions, ReplanOptions, AssignmentBadge, BADGE_TONE, FileExplorerPanelProps (+29 more)

### Community 53 - "checkXmlWellFormed"
Cohesion: 0.04
Nodes (89): errorMessage(), 1) 增强 `widenAiFixTarget()`（`packages/dita-core/src/ai/fragment-locator.ts`）, 5.1 `@dita/core` 单元测试, 5.2 源码模式：CodeMirror Linter, 1. `@dita/core` — `src/ai/`, 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract (+81 more)

### Community 54 - "web/package.json"
Cohesion: 0.05
Nodes (62): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+54 more)

### Community 55 - "WorkbenchHubPage.tsx"
Cohesion: 0.04
Nodes (91): zustand@^5.1.0, AppShell(), EditorState, ManualAssignmentsPanelProps, STATUS_TONE, AppRoute, BASE, currentRoute (+83 more)

### Community 56 - "ai-workbench.test.ts"
Cohesion: 0.04
Nodes (101): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+93 more)

### Community 57 - "main.ts"
Cohesion: 0.22
Nodes (4): ApiServer, __dirname, hasSingleInstanceLock, REPO_ROOT

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.10
Nodes (15): GitManager, parseCommits(), parseStatus(), resolveKey(), textLooksBinary(), validateBranchName(), validateRevisionRef(), validateTagName() (+7 more)

### Community 60 - "html-themes.ts"
Cohesion: 0.10
Nodes (25): ACCENT_DARK_TEXT, ACCENT_LIGHT_TEXT, accentScale(), contrastRatio(), DEFAULT_HTML_FEATURES, findRepoRoot(), HtmlThemeAccentScale, HtmlThemeCatalogEntry (+17 more)

### Community 61 - "overlay-workspace.ts"
Cohesion: 0.14
Nodes (25): collectFileNodes(), countMapTreeNodes(), DITAVAL_TEMPLATE, ditavalSummaryFor(), fileExistsInOverlay(), findRenamedAwayDraft(), findUserDraft(), insertFileNode() (+17 more)

### Community 62 - "index.tsx"
Cohesion: 0.07
Nodes (38): JobLogViewerProps, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceRowBody(), XrefImageDialogProps, MODE_LABEL_KEYS, EditorToolbarProps (+30 more)

### Community 63 - "semantic-engine.ts"
Cohesion: 0.08
Nodes (47): makeOverlay(), coreT(), resolveDitaHref(), DITA_TOPIC_ROOT_TAGS, formatStructureIssue(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText() (+39 more)

### Community 65 - "checkin-validation-ui.test.tsx"
Cohesion: 0.05
Nodes (51): 4.7 AI Assistance (`Phase 6`), resetAiStore(), AiDiffDialog(), applyCheckinAiFix(), BLOCKING_ERROR_SOURCES, CheckinCandidate, CheckinDialog(), CheckinDialogProps (+43 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "markdown-outline.ts"
Cohesion: 0.14
Nodes (25): outlineSectionsForPrompt(), IngestJobView, IngestStreamHandlers, 3.1 `@dita/core/src/ingest/`（严格同构，零 `node:*` 导入）, buildLineIndex(), buildPlannerOutlineDigest(), collectImageAssetIds(), excerptForSection() (+17 more)

### Community 68 - "快速开始"
Cohesion: 0.12
Nodes (16): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 官网、文档站与离线工作台, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版）, 方式二：本地源码 + 本机 DITA-OT (+8 more)

### Community 69 - "DraftService"
Cohesion: 0.11
Nodes (9): WorkingDraftRow, AssetRouteOptions, SemanticOverlayOptions, computeContentHash(), DraftService, extensionOf(), isBinaryDraft(), normalizeExtension() (+1 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "Getting started"
Cohesion: 0.12
Nodes (16): Architecture and technology stack, Backend environment variables (`@dita/api`), DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT (+8 more)

### Community 72 - "dita-ot-repair-agent.ts"
Cohesion: 0.12
Nodes (19): assertInsideStaging(), buildFingerprint(), buildSystemPrompt(), buildUserPrompt(), defineTool(), describeError(), DitaOtRepairAgentInput, DitaOtRepairAgentResult (+11 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "git/routes.ts"
Cohesion: 0.10
Nodes (20): changeLabel(), GitBranchInfo, GitFileChange, GitFileDiff, GitManagerOptions, GitStatusSummary, GitTagInfo, GitWorktreeInfo (+12 more)

### Community 76 - "GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）"
Cohesion: 0.12
Nodes (17): 1. 创建隔离的试用项目并启用 API, 1. 在 GCP 创建最小权限部署账号与 Workload Identity Federation, 2. 一键构建并部署到 Cloud Run, 2. 在 GitHub 仓库配置 Actions Variables, 3. 配置 Artifact Registry 自动清理策略（必做省钱项）, GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）, 一、总体架构与低成本设计原理, 三、首次部署步骤（GCP Cloud Run） (+9 more)

### Community 77 - "DitaSemanticIndex"
Cohesion: 0.15
Nodes (10): buildSemanticIndex(), inferKeyFormat(), 3.2 `User Overlay` 读写与语义索引叠加, classifyDitaFileKind(), normalizePosixPath(), DitaSemanticIndex, findEnclosingTopicInfo(), SemanticOverlayOperation (+2 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "identity-api.ts"
Cohesion: 0.09
Nodes (30): DelegateTopicButtonProps, EditorTabBarProps, TAB_TYPE_BADGE, IdentitySwitcher(), IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, TopicAssignmentBannerProps (+22 more)

### Community 80 - "publish-service.ts"
Cohesion: 0.04
Nodes (87): PublishJobRow, apiCatalogue(), apiMessagesEn, apiMessagesZh, apiT(), CATALOGUES, DITA_FILE, DitaDiagnostic (+79 more)

### Community 81 - "getCurrentLocale"
Cohesion: 0.05
Nodes (32): defaultInstruction(), targetLabel(), hydrateEmptyContainerAtPos(), hasConrefDragPayload(), createDitaDecorationsPlugin(), BlockGapOpenMenuPayload, InlineBubbleInfo, CalsColspecNodeView (+24 more)

### Community 82 - "environment"
Cohesion: 0.06
Nodes (34): INSTALL_MARKITDOWN, args, context, dockerfile, build, container_name, depends_on, environment (+26 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.07
Nodes (26): platforms, Props, Props, dict, jsonLd, layerRows, Props, screenshotUrl() (+18 more)

### Community 84 - "phase13-overlay-versioning.test.ts"
Cohesion: 0.08
Nodes (19): ADMIN, App, branches(), CapturedPrompt, Fixture, flattenFilePaths(), freshProbes(), git() (+11 more)

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "Language"
Cohesion: 0.40
Nodes (4): Authoring & Content, DITAEditor, Language, Workbench & Collaboration

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "Changelog"
Cohesion: 0.08
Nodes (26): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.2.0] — 2026-11-22, [1.3.0] — 2026-11-24, [1.5.0] — 2026-11-26, Added (+18 more)

### Community 90 - "git/routes.ts"
Cohesion: 0.04
Nodes (89): firstHeaderValue(), RequestLike, resolveRequestLocale(), ApiMessageKey, ApiMessageParams, requireAdmin(), HttpErrorI18n, isHttpError() (+81 more)

### Community 91 - "SourceEditor.tsx"
Cohesion: 0.07
Nodes (39): TaskModelSwitch(), TaskModelSwitchProps, BuildDocumentOutlineOptions, sourceEditorTheme, createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike (+31 more)

### Community 92 - "ingest/routes.ts"
Cohesion: 0.11
Nodes (22): IngestStreamEvent, IngestTargetMode, approveSchema, configPatchSchema, engineSchema, extensionOf(), jobViewFor(), listSchema (+14 more)

### Community 93 - "planner-agent.ts"
Cohesion: 0.18
Nodes (20): buildPlannerSystemPrompt(), buildPlannerUserPrompt(), coercePlan(), coerceTopic(), defaultCreateKeysMap(), describeError(), enforceTargetMode(), extractJsonCandidate() (+12 more)

### Community 94 - "semantic-indexer.ts"
Cohesion: 0.07
Nodes (51): WorkspaceDitavalSummary, BaselineRefreshInfo, BranchIndexState, OverlayCacheEntry, SemanticContextResponse, buildReuseAttrValue(), ConrefAttrName, filterReusableElements() (+43 more)

### Community 95 - "ai-service.ts"
Cohesion: 0.07
Nodes (47): AiContextInput, AiProjectContext, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), AiPromptInput (+39 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "conref-drag.test.ts"
Cohesion: 0.18
Nodes (14): ConrefDragGhost, ConrefRowDragApi, ConrefRowDragOptions, editorAt(), useConrefRowDrag(), buildConrefDragSnippet(), CONREF_DRAG_MIME, ConrefDragPayload (+6 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "playground-presets.ts"
Cohesion: 0.15
Nodes (6): PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 100 - "Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）"
Cohesion: 0.15
Nodes (13): ① `working_drafts`（新增）, 2.1 与既有模块/ADR 的关键协同规则, ② `publish_jobs`（幂等 `ALTER TABLE` 增量迁移）, 2. 四大核心操作的对象边界, 3.1 SQLite 数据模型, 3.3 锁规则收口与签入原子闭环, 3.4 桌面端 / 外部编辑器改盘兼容, ③ `version_audit_logs`（新增） (+5 more)

### Community 101 - "map-tree-utils.ts"
Cohesion: 0.09
Nodes (39): profilingBadgeClasses(), buildCompositeMapTree(), BuildCompositeMapTreeOptions, CompositeMapTreeNode, CompositeMapTreeResult, isSameOrDescendantPath(), MapBufferState, MapTargetResolution (+31 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "docling-parser.ts"
Cohesion: 0.19
Nodes (22): materializeMarkdownAssets(), readTextFile(), saveDataUriImages(), createAbortError(), createCommandRunner(), isAvailable(), run(), killTree() (+14 more)

### Community 105 - "publish-api.ts"
Cohesion: 0.11
Nodes (37): getActiveScope(), API_BASE, apiUrl(), getCurrentUserId(), cancelPublishJob(), createPublishJob(), CreatePublishJobInput, fetchHtmlThemes() (+29 more)

### Community 106 - "PublishDialog.tsx"
Cohesion: 0.09
Nodes (45): applyThemeSelection(), clampText(), collectThemeAssetPaths(), defaultThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizeAccentColor(), normalizeThemeDraft() (+37 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "IngestService"
Cohesion: 0.15
Nodes (10): IngestJobRow, IngestService, isAbortError(), isTerminal(), normalizeIngestOptions(), parseJson(), planTopicNodes(), toIso() (+2 more)

### Community 109 - "Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板"
Cohesion: 0.11
Nodes (19): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 HTML5 样式模板设计矩阵, 3.1 为什么将主题资产存放在 `dita-ot-plugins/html5-themes/`？, 3.2 `Html5ThemeEnhancer` 关键实现细节, 3. 总体架构与发布增强流水线, 4.1 SQLite 数据表：`manual_publish_profiles`, 4.2 TypeScript 类型契约 (+11 more)

### Community 110 - "git-restore-revert.test.ts"
Cohesion: 0.09
Nodes (14): ADMIN, App, ContentBody, createApp(), createFixture(), DiffBody, Fixture, GitStatusBody (+6 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建"
Cohesion: 0.20
Nodes (11): restoreFile(), 1.1 `revertCommit` 传入空路径列表，前端永远不重载已打开文件, 1.2 `POST /api/git/revert-commit` 未检查文件锁与个人草稿，导致草稿遮蔽回退结果, 1.3 `restoreFile` 对与 `HEAD` 一致的版本创建 0 差异幽灵草稿，且 Diff 统计失真, 1.4 `GitPanel` 反馈不可见且错误条位于滚出视口顶部, 1. 根因分析, 2. 已确认的核心策略决策, 4.1 后端集成测试（新建 `apps/api/test/git-restore-revert.test.ts`） (+3 more)

### Community 113 - "parser-router.ts"
Cohesion: 0.15
Nodes (22): dedupe(), defaultAvailability(), doclingOrder(), parseDirect(), parseDocumentToMarkdown(), ParserEngineId, resolveParserEnginePlan(), runEngine() (+14 more)

### Community 114 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.11
Nodes (18): 1. Project Overview, 2. Repository Layout, 3.1 Desktop (`@dita/desktop`) runtime gotchas, 3. Build, Typecheck & Test Commands, 4.11 Document Ingest & Tool-Using DITA-OT Repair Agent (`Phase 14`), 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety (+10 more)

### Community 115 - "parseXml"
Cohesion: 0.14
Nodes (47): createMapTreeSlice(), extractElementAttrs(), applyElementAttrsPreservingOrder(), collapseFormattingWhitespace(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DITA_KEY_NAME_PATTERN (+39 more)

### Community 116 - "api/test/phase12-html-themes.test.ts"
Cohesion: 0.17
Nodes (8): HTML_THEME_IDS, HTML_THEME_LABELS, htmlThemeOptionsSchema, THEME_OPTION_LIMITS, HtmlThemeSearchEntry, OUTPUT_FILES, tempDirs, THEMES_DIR

### Community 117 - "README.md"
Cohesion: 0.11
Nodes (12): Consequences, Considered Options, Model each Manual as an independent workspace and Git repository, Consequences, Considered Options, Scope backend workspace and semantic index per request by Manual ID and branch, Consequences, Considered Options (+4 more)

### Community 118 - "版本管理模型（As-Is 现状说明）"
Cohesion: 0.17
Nodes (12): 0. 三层对象模型, 1. 仓库身份与初始化, 2.1 worktree 解析, 2.2 请求级隔离, 2. 分支 = 目录（整个并发模型的地基）, 4. 历史与差异（只读，不可回写）, 5. 发布（分支工作区的只读副本）, 6. 一致性保障 (+4 more)

### Community 119 - "validator-repair-agent.ts"
Cohesion: 0.12
Nodes (32): Layer1ValidationResult, RepairTopicInput, RepairTopicResult, StagingDirContext, throwIfAborted(), attachIssuesByPath(), buildGeneratedFiles(), collectAssetIssues() (+24 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "3.1 后端 Git 与覆盖层安全（`@dita/api`）"
Cohesion: 0.18
Nodes (11): 3.1 后端 Git 与覆盖层安全（`@dita/api`）, 3.2 前端 API 客户端与状态管理（`@dita/web`）, 3.3 前端交互与双语文案（`@dita/web`）, 3. 详细改动设计, 修改 `apps/api/src/i18n/messages.ts`, 修改 `apps/api/src/modules/git/git-manager.ts`, 修改 `apps/api/src/modules/git/routes.ts`, 修改 `apps/web/src/components/GitPanel.tsx` (+3 more)

### Community 122 - "paths.ts"
Cohesion: 0.33
Nodes (7): startEmbeddedServer(), DesktopPathInput, DesktopRuntimePaths, ensureInitialWorkspace(), normalizeDesktopVersion(), resolveDesktopPaths(), tempDirs

### Community 123 - "IngestEngineChoice"
Cohesion: 0.36
Nodes (8): CreateIngestJobInput, IngestEnvDefaults, IngestParserConfigInput, IngestParserPublicConfig, ParseDocumentInput, ResolvedParserConfig, IngestJobOptions, IngestEngineChoice

### Community 124 - "workspace-api.ts"
Cohesion: 0.16
Nodes (23): buildSnapshotFromMemoryFiles(), ApiHttpError, createWorkspaceProject(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics() (+15 more)

### Community 126 - "ingest-parsers.test.ts"
Cohesion: 0.12
Nodes (16): DitaDatabaseHandle, toParserAvailability(), CommandResult, ADMIN, baseConfig(), createServeFetch(), ENV_KEYS, fakeCliRunner() (+8 more)

### Community 127 - "site/src/i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 128 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 129 - "files.ts"
Cohesion: 0.43
Nodes (7): createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), renameWorkspaceEntry(), saveFileContent(), StoreRuntime, createFilesSlice()

### Community 130 - "Issue tracker: Local Markdown"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: Local Markdown, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 131 - "createServer"
Cohesion: 0.02
Nodes (76): createServer(), resetDitaRuntimeCache(), isInside(), MergeConflictContent, MergeConflictPreview, MergeInput, MergePreview, MergeResult (+68 more)

### Community 132 - "extractDataUriImages"
Cohesion: 0.40
Nodes (5): decodedByteLength(), extractDataUriImages(), formatAssetId(), nextAssetIndex(), normalizeBase64()

### Community 133 - "3. SQLite 数据模型与迁移设计"
Cohesion: 0.50
Nodes (4): 3.1 `manuals` 表, 3.2 `topic_assignments` 表, 3.3 现有工作区平滑迁移策略（首次启动自动导入）, 3. SQLite 数据模型与迁移设计

### Community 134 - "dita-rules.ts"
Cohesion: 0.07
Nodes (37): createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET, stripNonTagXml(), BlockConvertOption, BlockHandleProps (+29 more)

### Community 135 - "workspace-fs.ts"
Cohesion: 0.15
Nodes (14): countMapTreeNodes(), findRepoRootFromModule(), getDefaultImportsRootDir(), getDefaultWorkspaceDir(), IGNORED_ENTRIES, WORKSPACE_SCAFFOLD_DIRS, WorkspaceCreateKind, WorkspaceDiagnostic (+6 more)

### Community 136 - "outline-model.ts"
Cohesion: 0.05
Nodes (68): CategoryIcon(), collectExpandableIds(), DocumentOutlinePanel(), DocumentOutlinePanelProps, flattenVisibleRows(), OutlineRow, collectElementEntries(), countEntriesBefore() (+60 more)

### Community 138 - "HTML5 publish themes"
Cohesion: 0.15
Nodes (12): close(), [1.0.0] — 2026-11-22, Changed, Fixed, Phase 6 概要, Adding a theme, Design tokens, Feature flags (+4 more)

### Community 139 - "e2e-ai-live.mts"
Cohesion: 0.21
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 140 - "cloudbuild.yaml"
Cohesion: 0.18
Nodes (10): images, options, logging, steps, args, name, substitutions, _DITA_BASE_PATH (+2 more)

### Community 141 - "ingest-agent.test.ts"
Cohesion: 0.09
Nodes (13): layer1(), MARKDOWN, minimalStrictResult(), posix(), Role, roleOf(), scriptedModel(), ScriptedModelOptions (+5 more)

### Community 144 - "DocsIndex.astro"
Cohesion: 0.10
Nodes (18): astro@^5.18.2, collections, docs, Capability, DocSlug, Locale, dict, groups (+10 more)

### Community 147 - "publish-profiles.ts"
Cohesion: 0.16
Nodes (12): cleanPath(), cleanText(), isHtmlThemeId(), isRecord(), isValidAccent(), resolveThemeOptions(), defaultProfile(), normalizeStoredOptions() (+4 more)

### Community 150 - "ensure-electron.mjs"
Cohesion: 0.26
Nodes (11): DESKTOP_ROOT, __dirname, extractWithExtractZip(), extractWithNativeUnzip(), getArch(), getPlatformPath(), isHealthy(), log() (+3 more)

### Community 151 - "Design principles"
Cohesion: 0.18
Nodes (10): Bilingual by default, Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy (+2 more)

### Community 152 - "IngestOutlinePlan"
Cohesion: 0.12
Nodes (25): DraftAndVerifyInput, DraftTopicInput, PlanOutlineResult, PostProcessTopicOptions, TopicAssetMapping, ValidateBatchInput, ValidateLayer1Input, IngestMarkdownView (+17 more)

### Community 155 - "desktop/package.json"
Cohesion: 0.13
Nodes (18): description, devDependencies, electron-builder@^26.18.1, esbuild@^0.25.0, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, @types/node (+10 more)

### Community 156 - "ingest-routes.test.ts"
Cohesion: 0.08
Nodes (15): ADMIN, App, createApp(), Fixture, multipart(), ONE_TOPIC_MARKDOWN, Role, SAMPLE_ROOT (+7 more)

### Community 157 - "astro.config.ts"
Cohesion: 0.12
Nodes (9): site, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, @astrojs/react, @astrojs/sitemap, vite (+1 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 160 - "build-desktop"
Cohesion: 0.20
Nodes (10): name, runs-on, strategy, os, script, target, build-desktop, include (+2 more)

### Community 161 - "with"
Cohesion: 0.20
Nodes (10): with, cache, files, if-no-files-found, merge-multiple, name, node-version, path (+2 more)

### Community 162 - "IngestProgressStep.tsx"
Cohesion: 0.20
Nodes (12): IngestProgressStep(), IngestProgressStepProps, LOG_TONE, TOPIC_TONE, TopicIcon(), TopicStatus, INGEST_PROGRESS_STAGES, progressStageIndex() (+4 more)

### Community 164 - "zh/features.md"
Cohesion: 0.13
Nodes (14): AI 辅助, Conref, DITA Map, DITAVAL 投影, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+6 more)

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 166 - "en"
Cohesion: 0.09
Nodes (23): Bilingual UI, 中英双语界面, 下一步, 为谁而写, 单一信息源, 双语是一等公民, 并发靠锁，不靠 CRDT, 明确的边界 (+15 more)

### Community 167 - "desktop/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ../../tsconfig.base.json

### Community 168 - "key-management-integration.test.tsx"
Cohesion: 0.09
Nodes (41): InsertKeyrefDialog(), LeftSidebarProps, BindingKind, buildKeydefPreviewXml(), buildNewKeyOptions(), escapeXmlAttr(), inferFormatToken(), KIND_TABS (+33 more)

### Community 169 - "release-desktop.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 170 - "git-restore-revert.test.tsx"
Cohesion: 0.06
Nodes (27): changeLabelKey(), draftOpKey(), draftOpTone, GitPanel(), GitPanelProps, shortDate(), rootEl, useEditorStore (+19 more)

### Community 171 - "parsers/assets.ts"
Cohesion: 0.21
Nodes (13): ASSET_SCHEME, assetIdFor(), copyReferencedImages(), CopyReferencedImagesOptions, CopyReferencedImagesResult, findProducedMarkdown(), highestAssetIndex(), IMAGE_EXTENSIONS (+5 more)

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "ai-output-parser.ts"
Cohesion: 0.11
Nodes (23): BASIC_XML_ENTITIES, createExplanationStreamFilter(), decodeBasicXmlEntities(), ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags(), 1.1 签入链路完全缺少 XML 与 DITA 结构门禁 (+15 more)

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, dist, dist:mac, dist:win, postinstall, stage (+2 more)

### Community 176 - "en/features.md"
Cohesion: 0.13
Nodes (14): AI assistance, Collaboration and versioning, Conref, DITA maps, DITAVAL projection, Document outline and structural reordering, Dual-mode editing, Keyspace (+6 more)

### Community 179 - "5.5 核心提示词工程设计（LangChain `ChatPromptTemplate`）"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 183 - "createTopicTemplate"
Cohesion: 0.15
Nodes (17): buildTemplateContent(), buildScaleDitaProject(), interpolate(), dropState(), Slice 8.1：同构 i18n 底座与 `@dita/core` 双语化（第 1–2 天）, formatMessage(), createMapTemplate(), CreateMapTemplateOptions (+9 more)

### Community 184 - "electron"
Cohesion: 0.40
Nodes (4): electron@^35.2.0, bridge, DitaDesktopBridge, electron

### Community 186 - "GET"
Cohesion: 0.18
Nodes (13): 4.10 Versioning: Clean Baseline + Personal Draft Overlay (`Phase 13`), slugifyBranch(), worktreeLeafName(), GET(), [1.4.0] — 2026-11-25, Changed, Fixed, 1.1 目标架构：Git 干净基线 + 个人草稿叠加层 (+5 more)

### Community 188 - "topicGuideTree.ts"
Cohesion: 0.13
Nodes (27): GuideTreeNodeProps, TagFacts(), TagFactsProps, buildChildChips(), buildNode(), buildTopicGuideTree(), EXPANDED_CONTAINERS, getAllowedChildren() (+19 more)

### Community 192 - "theme-preview.ts"
Cohesion: 0.35
Nodes (10): getHtmlTheme(), buildBrandVarsCss(), escapeHtmlText(), headerMarkup(), HtmlThemePreviewError, readOptional(), renderHtmlThemePreview(), SAMPLE_SEARCH_ENTRIES (+2 more)

### Community 195 - "PublishQueue"
Cohesion: 0.11
Nodes (12): PublishQueue, PublishQueueOptions, 11. 手册工作台与 Topic 委派（Phase 10）, 12. 文档智能导入与工具化 DITA-OT 修复 Agent（Phase 14）, 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 文档大纲视图与结构重排（v1.5.0）, 4. 可视化 DITA Map 树与多文件工作台 (+4 more)

### Community 196 - "ingest-api.ts"
Cohesion: 0.07
Nodes (61): DocumentIngestDialog(), DocumentIngestDialogProps, messageOf(), IngestResultStep(), IngestResultStepProps, LayerStatus(), ENGINE_OPTIONS, IngestUploadStep() (+53 more)

### Community 197 - "Core capabilities"
Cohesion: 0.20
Nodes (10): 11. Manual workbench and topic assignment (Phase 10), 12. Document ingest and tool-using DITA-OT repair agent (Phase 14), 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Document outline view and structural reordering (v1.5.0), 4. Visual DITA Map tree and multi-file workbench, 6. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 7. Clean baseline, personal draft overlay and local Git (Phase 4 / Phase 13) (+2 more)

### Community 200 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, better-sqlite3@^13.2.0, @dita/api@workspace:*, better-sqlite3, @dita/api

### Community 202 - "3. 核心模块与接口契约"
Cohesion: 0.18
Nodes (11): 1. 目标与已确认架构决策, 2. 系统架构与路由策略, 3.2 SQLite 数据模型（`apps/api/src/db/{schema,client}.ts`）, 3. 核心模块与接口契约, 4. 分阶段实施切片与验收矩阵, 5.1 一键启动（推荐：DITAEditor + Docling sidecar）, 5.2 精简单容器（不启用 MarkItDown）, 5.3 验收命令 (+3 more)

### Community 208 - "DITAEditor — Web DITA 1.3 Workbench (Live Demo)"
Cohesion: 0.50
Nodes (3): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力

### Community 209 - "commitWithModifyAndDelete"
Cohesion: 0.60
Nodes (5): baselinePath(), commitWithModifyAndDelete(), readBaseline(), withTitleMarker(), writeBaseline()

### Community 210 - "git"
Cohesion: 0.40
Nodes (5): commitOnDisk(), git(), hasRevertHead(), headRevision(), porcelain()

### Community 211 - "GitHub Pages 免费部署指南（官网 + 离线三栏工作台）"
Cohesion: 0.50
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 213 - "5. 验证计划"
Cohesion: 0.67
Nodes (3): 5.1 自动化验证命令, 5.2 手工端到端验收, 5. 验证计划

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1745 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `git-store.ts`, `createServer`, `App.tsx`, `workspace-fs.ts`, `e2e-ai-live.mts`, `internals.ts`, `fop-font-config.ts`, `WorkspaceManager`, `zh/features.md`, `dita-core/src/index.ts`, `getRawAttr`, `ai-output-parser.ts`, `en/features.md`, `ai-workbench.test.ts`, `overlay-workspace.ts`, `semantic-engine.ts`, `MergeService`, `en/architecture.md`, `PublishQueue`, `Core capabilities`, `zh/architecture.md`, `dita-ot-repair-agent.ts`, `DitaSemanticIndex`, `publish-service.ts`, `Changelog`, `map-tree-utils.ts`, `4. Non-Negotiable Engineering Invariants`, `parseXml`, `validator-repair-agent.ts`, `workspace-api.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `httpError()` (e.g. with `Added` and `5. REST API 契约设计`) actually correct?**
  _`httpError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `phase6-ai-api.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03345255628024406 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `identity-api.ts` to `git-store.ts`, `App.tsx`, `dita-rules.ts`, `outline-model.ts`, `IngestOutlinePlan`, `IngestProgressStep.tsx`, `key-management-integration.test.tsx`, `selectors.ts`, `git-restore-revert.test.tsx`, `editor-store/types.ts`, `web/package.json`, `WorkbenchHubPage.tsx`, `ai-workbench.test.ts`, `index.tsx`, `checkin-validation-ui.test.tsx`, `ingest-api.ts`, `SourceEditor.tsx`, `semantic-indexer.ts`, `map-tree-utils.ts`, `PublishDialog.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `createServer()` (e.g. with `.completeOnCheckin()` and `.markInProgressForCheckout()`) actually correct?**
  _`createServer()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06330988522769344 - nodes in this community are weakly interconnected._