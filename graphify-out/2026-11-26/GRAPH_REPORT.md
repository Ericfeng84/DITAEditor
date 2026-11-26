# Graph Report - DITAEditor  (2026-11-26)

## Corpus Check
- 442 files · ~419,342 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 70 file(s) not represented in the graph (top: .dita 26, .css 25, (none) 6)

## Summary
- 4679 nodes · 13148 edges · 186 communities (168 shown, 18 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 717 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `066a7694`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ai-service.ts
- git-store.ts
- IdentityUser
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
- editor-store/index.ts
- env
- dita-map.ts
- ConrefReusePanel.tsx
- dependencies
- git/routes.ts
- scripts
- api/src/index.ts
- BaseLayout.astro
- theme-runtime.js
- outline-model.ts
- deploy-site.yml
- electron-builder.yml
- converter.ts
- workspace-fs.ts
- with
- SourceEditor.tsx
- locales.ts
- ref_vitest
- translate
- ref_prosemirror_state
- WorkspaceSemanticIndexer
- 4. 核心元素写作细则
- git/routes.ts
- key-management-integration.test.tsx
- AppShell.tsx
- devDependencies
- DITA Concept（概念）主题编写规范
- serializer.ts
- index.tsx
- Changelog
- VisualEditor.tsx
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- DITA Reference（参考）主题编写规范
- manual-registry-service.ts
- publish-service.ts
- fragment-splice.ts
- web/package.json
- assignments-api.ts
- ai-types.ts
- editor-handle.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- theme-enhancer.ts
- httpError
- ref_react
- editor-store/types.ts
- HttpError
- html-themes.ts
- en/architecture.md
- dita-structure.ts
- 快速开始
- DraftService
- zh/architecture.md
- Getting started
- 前端 DITA 1.3 结构化写作合规实施说明
- SearchModal.astro
- docker-entrypoint.sh
- ditaval.ts
- GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）
- Phase 10 规划与实施蓝图：手册编辑工作台与 Topic 编辑任务委派
- devDependencies
- lucide-react
- en/features.md
- DocumentOutlinePanel.tsx
- zh/features.md
- HomePage.astro
- phase13-overlay-versioning.test.ts
- en/ai-setup.md
- phase10-workbench-assignments-plan.md
- zh/ai-setup.md
- compilerOptions
- semantic-engine.ts
- publish/routes.ts
- use-visual-editor-view.ts
- TopicAuthoringGuide.tsx
- en
- dita-completion.ts
- fragment-locator.ts
- MiniRoundTripDemo.tsx
- phase13-ui-components.test.tsx
- en/getting-started.md
- AttributesPanel.tsx
- Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）
- en/introduction.md
- en/local-development.md
- zh/getting-started.md
- DitaSemanticIndex
- publish-api.ts
- zh/introduction.md
- zh/local-development.md
- overlay-workspace.ts
- Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板
- git-restore-revert.test.ts
- scripts
- Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建
- publish-profiles.ts
- 4. Non-Negotiable Engineering Invariants
- checkin-validation.test.ts
- publish-store.ts
- README.md
- vite.config.ts
- workbench-store.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- 3.1 后端 Git 与覆盖层安全（`@dita/api`）
- git-restore-revert.test.tsx
- helpers.ts
- map-tree-utils.ts
- sync-hf-space.sh
- DesktopDownload.astro
- site/src/i18n/index.ts
- Domain Docs
- prosemirror-model@^1.25.13
- Issue tracker: Local Markdown
- html-theme-model.ts
- decorations-and-inserter.test.ts
- ai-prompt.ts
- phase13-ui-components.test.tsx
- xml-bridge.ts
- topicGuideTree.ts
- dita-rules.ts
- HTML5 publish themes
- e2e-ai-live.mts
- cloudbuild.yaml
- ai-workbench.test.ts
- desktop/package.json
- workspace-api.ts
- DocsLayout.astro
- GET
- react@^19.0.0
- use-outline-drag.ts
- map-edit-lock-guard.test.ts
- @codemirror/search@^6.7.2
- checkoutFile
- @codemirror/autocomplete@^6.20.4
- 3. ① 规则数据层
- playground-presets.ts
- MapNodeInspector.tsx
- api/src/index.ts
- astro.config.ts
- env
- @codemirror/commands@^6.11.1
- build-desktop
- with
- @dita/core@workspace:*
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- theme-preview.ts
- tag
- ThemePreviewModal.tsx
- desktop/tsconfig.json
- @lezer/highlight@^1.2.1
- release-desktop.yml
- PublishDialog.tsx
- HtmlThemeId
- steps
- ai-output-parser.ts
- attach-to-release
- .commit
- phase13-web-stores-and-ui.test.tsx
- @codemirror/lang-xml@^6.1.0
- prosemirror-history@^1.5.2
- prosemirror-state@^1.4.4
- deploy-cloudrun.sh
- triage-labels.md
- UiLocale
- commitWithModifyAndDelete
- git
- @tailwindcss/vite@^4.3.5

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 147 edges
2. `httpError()` - 84 edges
3. `App()` - 83 edges
4. `requestJson()` - 77 edges
5. `createServer()` - 75 edges
6. `GitManager` - 72 edges
7. `DraftService` - 71 edges
8. `lucide-react` - 66 edges
9. `translate()` - 65 edges
10. `getPmNodeTagName()` - 64 edges

## Surprising Connections (you probably didn't know these)
- `核心设计取舍` --references--> `main()`  [INFERRED]
  docs/deploy-gcp-cloudrun.md → apps/api/scripts/e2e-ai-live.mts
- `二、一键启用步骤（约 2 分钟）` --references--> `main()`  [INFERRED]
  docs/deploy-github-pages.md → apps/api/scripts/e2e-ai-live.mts
- `6. 验收与回归测试矩阵` --references--> `main()`  [INFERRED]
  docs/phase13-versioning-overlay-plan.md → apps/api/scripts/e2e-ai-live.mts
- `Option 4: Low-cost cloud trial (GCP Cloud Run + subpath reverse proxy + auto-deploy on push)` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts
- `Website, docs site and offline workbench` --references--> `main()`  [INFERRED]
  README.en.md → apps/api/scripts/e2e-ai-live.mts

## Import Cycles
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/map-tree.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/tabs.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (186 total, 18 thin omitted)

### Community 0 - "ai-service.ts"
Cohesion: 0.03
Nodes (100): AiSettingsRow, apiT(), CreateServerOptions, AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine() (+92 more)

### Community 1 - "git-store.ts"
Cohesion: 0.07
Nodes (61): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinOptions, CheckinResponse, commitExternalChanges(), createGitBranch(), createGitTag() (+53 more)

### Community 2 - "IdentityUser"
Cohesion: 0.15
Nodes (10): FileLockRow, MergeInput, IdentityUser, autoReclaimEnabled(), buildDraftPatch(), isExpired(), LockService, lockTtlMs() (+2 more)

### Community 3 - "App.tsx"
Cohesion: 0.06
Nodes (77): App(), AppProps, DelegateTopicButton(), EditorTabBar(), TAB_TYPE_BADGE, AssignmentBadge, BADGE_TONE, FileExplorerPanel() (+69 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.06
Nodes (27): ApplyAiProposalDeps, TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enAssignments, enCollab, enCommon, enEditor (+19 more)

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

### Community 17 - "editor-store/index.ts"
Cohesion: 0.11
Nodes (43): countMapTreeNodes(), t(), createInMemoryDemoWorkspace(), createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), fetchFileContent(), renameWorkspaceEntry() (+35 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-map.ts"
Cohesion: 0.14
Nodes (47): createMapTreeSlice(), extractElementAttrs(), applyElementAttrsPreservingOrder(), collapseFormattingWhitespace(), computeElementPath(), countCommentsAndPis(), deleteMapNode(), DITA_KEY_NAME_PATTERN (+39 more)

### Community 20 - "ConrefReusePanel.tsx"
Cohesion: 0.19
Nodes (16): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, ConrefDragGhost (+8 more)

### Community 21 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/state@^6.7.6, @codemirror/view@^6.43.15, prosemirror-commands@^1.7.2, prosemirror-dropcursor@^1.8.4 (+15 more)

### Community 22 - "git/routes.ts"
Cohesion: 0.04
Nodes (77): DitaDatabase, DitaDatabaseHandle, migrateManuals(), migratePublishJobs(), openDatabase(), aiSettings, AiUsageLogRow, aiUsageLogs (+69 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "api/src/index.ts"
Cohesion: 0.05
Nodes (60): firstHeaderValue(), RequestLike, resolveRequestLocale(), AssignmentScope, AssignmentStatus, AssignmentStatusFilter, AssignmentRouteOptions, createAssignmentSchema (+52 more)

### Community 25 - "BaseLayout.astro"
Cohesion: 0.13
Nodes (14): dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh, canonical (+6 more)

### Community 26 - "theme-runtime.js"
Cohesion: 0.07
Nodes (80): absolutePath(), activateOnpage(), addSkipLink(), applyMode(), assembleLayout(), boot(), buildOnpage(), buildPager() (+72 more)

### Community 27 - "outline-model.ts"
Cohesion: 0.07
Nodes (40): collectElementEntries(), countEntriesBefore(), evaluateOutlineDrop(), gapPosForElementIndex(), introducedSequenceViolation(), isOutlineContainer(), mapIssueCodeToReason(), OutlineElementEntry (+32 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "converter.ts"
Cohesion: 0.08
Nodes (44): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, parseCalsColSpecs(), parseCalsTgroup(), parseSectionRows() (+36 more)

### Community 31 - "workspace-fs.ts"
Cohesion: 0.06
Nodes (38): buildTemplateContent(), fileExistsInOverlay(), findRenamedAwayDraft(), findUserDraft(), normalizeOverlayPath(), readBinaryAssetWithOverlay(), readFileWithOverlay(), createFileSchema (+30 more)

### Community 32 - "with"
Cohesion: 0.05
Nodes (43): concurrency, cancel-in-progress, group, runs-on, steps, env, DEEPSEEK_API_KEY, GCP_AR_REPO (+35 more)

### Community 33 - "SourceEditor.tsx"
Cohesion: 0.09
Nodes (23): TaskModelSwitch(), TaskModelSwitchProps, BuildDocumentOutlineOptions, SourceEditor(), sourceEditorTheme, buildConrefDragSnippet(), CONREF_DRAG_MIME, escapeXmlAttrValue() (+15 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "ref_vitest"
Cohesion: 0.05
Nodes (64): createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModel(), getTaskContentModelSetting(), resolveTaskModelForXml(), setDetectedTaskContentModel() (+56 more)

### Community 36 - "translate"
Cohesion: 0.10
Nodes (36): defaultInstruction(), targetLabel(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement, XmlLikeNode (+28 more)

### Community 37 - "ref_prosemirror_state"
Cohesion: 0.11
Nodes (35): insertBlockDitaElement(), insertBlockDitaElementAtPos(), insertMissingTopicBody(), resolveLegalBlockInsertion(), resolveSequenceAnchor(), TOPIC_BODY_WRAPPER, createDitaElementSkeleton(), exitCodeblockToParagraph() (+27 more)

### Community 38 - "WorkspaceSemanticIndexer"
Cohesion: 0.17
Nodes (5): collectAllFilePaths(), realpathSyncOrNull(), summarizeDitaval(), WorkspaceSemanticIndexer, 4.1 `ManualContextResolver`（请求级上下文解析器）

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "git/routes.ts"
Cohesion: 0.09
Nodes (26): apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh, CATALOGUES, HttpErrorI18n, changeLabel() (+18 more)

### Community 41 - "key-management-integration.test.tsx"
Cohesion: 0.11
Nodes (25): LeftSidebarProps, BindingKind, buildKeydefPreviewXml(), buildNewKeyOptions(), escapeXmlAttr(), inferFormatToken(), KIND_TABS, NewKeyDialog() (+17 more)

### Community 42 - "AppShell.tsx"
Cohesion: 0.10
Nodes (27): AppShell(), EditorState, rootEl, AppRoute, BASE, currentRoute, EditorRoute, emit() (+19 more)

### Community 43 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, jsdom@^31.0.1, @testing-library/dom@^10.4.2, @testing-library/react@^16.3.3, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vite@^6.2.0 (+9 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "serializer.ts"
Cohesion: 0.11
Nodes (30): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+22 more)

### Community 46 - "index.tsx"
Cohesion: 0.11
Nodes (28): arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody(), dateTimeFormatter(), dateTimeFormatters, formatDateTime() (+20 more)

### Community 47 - "Changelog"
Cohesion: 0.08
Nodes (24): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.0.0] — 2026-11-22, [1.2.0] — 2026-11-22, [1.3.0] — 2026-11-24, [1.4.0] — 2026-11-25, Added (+16 more)

### Community 48 - "VisualEditor.tsx"
Cohesion: 0.10
Nodes (55): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, blockIndexInContainer(), BlockMovePlan, buildBlockHandleTarget(), buildConvertedBlock() (+47 more)

### Community 49 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "manual-registry-service.ts"
Cohesion: 0.09
Nodes (22): ManualRow, WorkspaceScaffold, repositoryIdFor(), manualIdForRoot(), BUILTIN_SCOPE_DIRS, countManualFiles(), DEFAULT_PROTECTED_BRANCHES, gitDirectoryFor() (+14 more)

### Community 52 - "publish-service.ts"
Cohesion: 0.04
Nodes (78): PublishJobRow, DITA_FILE, DitaDiagnostic, DitaPathRoot, extractMessage(), fallbackDitaDiagnostic(), LOCATION_PATTERNS, LocationMatch (+70 more)

### Community 53 - "fragment-splice.ts"
Cohesion: 0.08
Nodes (39): 1. `@dita/core` — `src/ai/`, 3. REST contract, Phase 6 AI Assistance — Implementation Contract, 4.1 文件清单与核心函数, 4.2 三种靶向定位与无损回拼策略, extractTargetFragment(), DITA_TOPIC_ROOTS, doctypeSignature() (+31 more)

### Community 54 - "web/package.json"
Cohesion: 0.05
Nodes (61): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+53 more)

### Community 55 - "assignments-api.ts"
Cohesion: 0.14
Nodes (15): zustand@^5.1.0, AssignmentListQuery, AssignmentPerson, AssignmentScope, AssignmentStatusFilter, AssignmentUpdateInput, cancelAssignment(), createAssignment() (+7 more)

### Community 56 - "ai-types.ts"
Cohesion: 0.06
Nodes (63): close(), abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame (+55 more)

### Community 57 - "editor-handle.ts"
Cohesion: 0.15
Nodes (29): updateNodeRawAttr(), MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandle, VisualEditorHandleDeps, DitaNoteNodeView, mergeCalsCellDown() (+21 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.11
Nodes (13): GitManager, parseCommits(), parseStatus(), resolveKey(), textLooksBinary(), validateBranchName(), validateRevisionRef(), validateTagName() (+5 more)

### Community 60 - "theme-enhancer.ts"
Cohesion: 0.15
Nodes (27): appendBodyClasses(), buildSearchEntry(), collapseWhitespace(), collectHtmlFiles(), copySharedAsset(), copyWorkspaceAsset(), decodeEntities(), depthOf() (+19 more)

### Community 61 - "httpError"
Cohesion: 0.16
Nodes (7): TopicAssignmentRow, AssignmentService, parseStatus(), todayIso(), httpError(), normalizeRevision(), Slice 10.2：Topic 编辑任务后端服务与生命周期钩子

### Community 62 - "ref_react"
Cohesion: 0.08
Nodes (31): react-arborist@^4.0.1, PROFILING_BADGE_CLASSES, profilingBadgeClasses(), XrefImageDialogProps, sanitizeCssColor(), EditorToolbarProps, InlineBubbleAnchor, TAG_ICONS (+23 more)

### Community 63 - "editor-store/types.ts"
Cohesion: 0.12
Nodes (30): EditorTabBarProps, FileExplorerPanelProps, NewMapDialogProps, NewTopicDialogProps, PublishDialogProps, WorkspaceDialogProps, VisualEditorProps, MapBufferState (+22 more)

### Community 64 - "HttpError"
Cohesion: 0.29
Nodes (3): isInside(), MergeService, normalizeRelativePath()

### Community 65 - "html-themes.ts"
Cohesion: 0.08
Nodes (31): ACCENT_DARK_TEXT, ACCENT_LIGHT_TEXT, accentScale(), contrastRatio(), DEFAULT_HTML_FEATURES, findRepoRoot(), HTML_THEME_IDS, HTML_THEME_LABELS (+23 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "dita-structure.ts"
Cohesion: 0.06
Nodes (37): 5.1 `@dita/core` 单元测试, COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey, coreMessagesEn (+29 more)

### Community 68 - "快速开始"
Cohesion: 0.12
Nodes (17): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 官网、文档站与离线工作台, 实施路线图, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版） (+9 more)

### Community 69 - "DraftService"
Cohesion: 0.13
Nodes (7): WorkingDraftRow, AssetRouteOptions, computeContentHash(), DraftService, extensionOf(), isBinaryDraft(), normalizeExtension()

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "Getting started"
Cohesion: 0.12
Nodes (17): Architecture and technology stack, Backend environment variables (`@dita/api`), DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT (+9 more)

### Community 72 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.10
Nodes (19): 4.4 OASIS CALS Table Fidelity, 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 4. ② 命令层：只放出合法操作, 4.2 插入位置：自动归位到 DTD 槽位, 4.3 新元素天生合法：骨架构造, 4.5 键盘行为按内容模型设计 (+11 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "ditaval.ts"
Cohesion: 0.13
Nodes (21): ProfilingAttrEditor(), ProfilingAttrEditorProps, ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle (+13 more)

### Community 76 - "GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）"
Cohesion: 0.12
Nodes (17): 1. 创建隔离的试用项目并启用 API, 1. 在 GCP 创建最小权限部署账号与 Workload Identity Federation, 2. 一键构建并部署到 Cloud Run, 2. 在 GitHub 仓库配置 Actions Variables, 3. 配置 Artifact Registry 自动清理策略（必做省钱项）, GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）, 一、总体架构与低成本设计原理, 三、首次部署步骤（GCP Cloud Run） (+9 more)

### Community 77 - "Phase 10 规划与实施蓝图：手册编辑工作台与 Topic 编辑任务委派"
Cohesion: 0.11
Nodes (18): 10. 风险与防呆清单, 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、范围与设计树共识, 2. 领域模型与系统交互流, 3.1 `manuals` 表, 3.2 `topic_assignments` 表, 3.3 现有工作区平滑迁移策略（首次启动自动导入）, 3. SQLite 数据模型与迁移设计 (+10 more)

### Community 78 - "devDependencies"
Cohesion: 0.14
Nodes (18): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+10 more)

### Community 79 - "lucide-react"
Cohesion: 0.13
Nodes (30): DelegateTopicButtonProps, IdentitySwitcher(), IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, TopicAssignmentBannerProps, WorkbenchHeaderProps, editorPath() (+22 more)

### Community 80 - "en/features.md"
Cohesion: 0.14
Nodes (13): AI assistance, Collaboration and versioning, Conref, DITAVAL projection, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs, Manual workbench and topic assignment (+5 more)

### Community 81 - "DocumentOutlinePanel.tsx"
Cohesion: 0.17
Nodes (18): CategoryIcon(), collectExpandableIds(), DocumentOutlinePanel(), DocumentOutlinePanelProps, flattenVisibleRows(), OutlineRow, OutlineDropEvaluation, filterOutlineTree() (+10 more)

### Community 82 - "zh/features.md"
Cohesion: 0.14
Nodes (13): AI 辅助, Conref, DITAVAL 投影, Map 与 Bookmap, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑 (+5 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.16
Nodes (12): dict, jsonLd, layerRows, Props, screenshotUrl(), showcaseImages, pickText(), digest() (+4 more)

### Community 84 - "phase13-overlay-versioning.test.ts"
Cohesion: 0.08
Nodes (19): ADMIN, App, branches(), CapturedPrompt, Fixture, flattenFilePaths(), freshProbes(), git() (+11 more)

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "phase10-workbench-assignments-plan.md"
Cohesion: 0.09
Nodes (16): Consequences, Considered Options, Model each Manual as an independent workspace and Git repository, Consequences, Considered Options, Scope backend workspace and semantic index per request by Manual ID and branch, Consequences, Considered Options (+8 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "semantic-engine.ts"
Cohesion: 0.06
Nodes (51): makeOverlay(), StructureIssue, DEFAULT_TASK_CONTENT_MODEL, TaskModelDoctypeRef, PmStructureIssue, areConrefTagsCompatible(), cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT (+43 more)

### Community 90 - "publish/routes.ts"
Cohesion: 0.15
Nodes (22): HtmlThemeFeatures, htmlThemeIdSchema, isValidAccent(), PublishSourceMode, createJobSchema, disposition(), isFileOnDisk(), isInside() (+14 more)

### Community 91 - "use-visual-editor-view.ts"
Cohesion: 0.06
Nodes (28): BlockHandleTarget, insertReuseElementAtPos(), hydrateEmptyContainerAtPos(), createDitaDecorationsPlugin(), BlockGapOpenMenuPayload, InlineBubbleInfo, CalsColspecNodeView, createCommentChevronTag() (+20 more)

### Community 92 - "TopicAuthoringGuide.tsx"
Cohesion: 0.15
Nodes (21): GROUP_LABEL_KEYS, GuideTreeNode(), GuideTreeNodeProps, readInitialExpanded(), TagFacts(), TagFactsProps, TopicAuthoringGuideProps, TopicAuthoringGuideSpec (+13 more)

### Community 93 - "en"
Cohesion: 0.20
Nodes (13): Bilingual UI, 中英双语界面, en(), zh(), 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界, 3.1 端到端语言流转链路, 3.2 四项关键技术机制 (+5 more)

### Community 94 - "dita-completion.ts"
Cohesion: 0.17
Nodes (22): createDitaXmlCompletionSource(), ditaXmlCompletionSource, findEnclosingXmlContext(), findEnclosingXmlTag(), PROFILING_ATTR_SET, stripNonTagXml(), AttributesPanel(), InsertElementMenu() (+14 more)

### Community 95 - "fragment-locator.ts"
Cohesion: 0.20
Nodes (20): 1) 增强 `widenAiFixTarget()`（`packages/dita-core/src/ai/fragment-locator.ts`）, AiFixWindowOptions, buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_FIX_WINDOW_MAX_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS (+12 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "phase13-ui-components.test.tsx"
Cohesion: 0.10
Nodes (22): changeLabelKey(), draftOpKey(), draftOpTone, GitPanel(), GitPanelProps, shortDate(), LockStatusBarProps, stateStyles (+14 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "AttributesPanel.tsx"
Cohesion: 0.14
Nodes (27): WorkspaceDitavalSummary, BaselineRefreshInfo, BranchIndexState, OverlayCacheEntry, SemanticContextResponse, SemanticOverlayOptions, ConrefReusePanelProps, InsertKeyrefDialogProps (+19 more)

### Community 100 - "Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）"
Cohesion: 0.15
Nodes (13): ① `working_drafts`（新增）, 2.1 与既有模块/ADR 的关键协同规则, ② `publish_jobs`（幂等 `ALTER TABLE` 增量迁移）, 2. 四大核心操作的对象边界, 3.1 SQLite 数据模型, 3.3 锁规则收口与签入原子闭环, 3.4 桌面端 / 外部编辑器改盘兼容, ③ `version_audit_logs`（新增） (+5 more)

### Community 101 - "en/introduction.md"
Cohesion: 0.18
Nodes (10): Bilingual by default, Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy (+2 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "DitaSemanticIndex"
Cohesion: 0.14
Nodes (12): 3.2 `User Overlay` 读写与语义索引叠加, basenamePosix(), computeRelativeDitaHref(), dirnamePosix(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref, resolveDitaHref() (+4 more)

### Community 105 - "publish-api.ts"
Cohesion: 0.14
Nodes (24): getActiveScope(), API_BASE, apiUrl(), cancelPublishJob(), createPublishJob(), fetchHtmlThemes(), fetchPublishJob(), fetchPublishJobs() (+16 more)

### Community 106 - "zh/introduction.md"
Cohesion: 0.18
Nodes (10): 下一步, 为谁而写, 单一信息源, 双语是一等公民, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么 (+2 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "overlay-workspace.ts"
Cohesion: 0.15
Nodes (21): collectFileNodes(), countMapTreeNodes(), DITAVAL_TEMPLATE, ditavalSummaryFor(), insertFileNode(), insertFileNodeAt(), mapSummaryFor(), OverlayAsset (+13 more)

### Community 109 - "Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板"
Cohesion: 0.10
Nodes (19): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 HTML5 样式模板设计矩阵, 3.1 为什么将主题资产存放在 `dita-ot-plugins/html5-themes/`？, 3.2 `Html5ThemeEnhancer` 关键实现细节, 3. 总体架构与发布增强流水线, 4.1 SQLite 数据表：`manual_publish_profiles`, 4.2 TypeScript 类型契约 (+11 more)

### Community 110 - "git-restore-revert.test.ts"
Cohesion: 0.09
Nodes (14): ADMIN, App, ContentBody, createApp(), createFixture(), DiffBody, Fixture, GitStatusBody (+6 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建"
Cohesion: 0.16
Nodes (14): restoreFile(), 1.1 `revertCommit` 传入空路径列表，前端永远不重载已打开文件, 1.2 `POST /api/git/revert-commit` 未检查文件锁与个人草稿，导致草稿遮蔽回退结果, 1.3 `restoreFile` 对与 `HEAD` 一致的版本创建 0 差异幽灵草稿，且 Diff 统计失真, 1.4 `GitPanel` 反馈不可见且错误条位于滚出视口顶部, 1. 根因分析, 2. 已确认的核心策略决策, 4.1 后端集成测试（新建 `apps/api/test/git-restore-revert.test.ts`） (+6 more)

### Community 113 - "publish-profiles.ts"
Cohesion: 0.16
Nodes (14): manualPublishProfiles, cleanPath(), cleanText(), DEFAULT_HTML_THEME_ID, isRecord(), resolveThemeOptions(), asRecord(), defaultProfile() (+6 more)

### Community 114 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.14
Nodes (13): 1. Project Overview, 2. Repository Layout, 3. Build, Typecheck & Test Commands, 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`) (+5 more)

### Community 115 - "checkin-validation.test.ts"
Cohesion: 0.09
Nodes (9): ADMIN, App, createApp(), Fixture, git(), head(), SAMPLE_ROOT, tempDirs (+1 more)

### Community 116 - "publish-store.ts"
Cohesion: 0.26
Nodes (13): HtmlThemeSelectorProps, CreatePublishJobInput, HtmlThemeDescriptor, HtmlThemeId, HtmlThemeOptions, ManualPublishProfile, PublishJob, PublishRuntimeInfo (+5 more)

### Community 117 - "README.md"
Cohesion: 0.22
Nodes (7): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 119 - "workbench-store.ts"
Cohesion: 0.11
Nodes (28): ManualAssignmentsPanelProps, Assignment, AssignmentCreateInput, AssignmentStatus, AssignmentSummary, createManual(), fetchManuals(), Manual (+20 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "3.1 后端 Git 与覆盖层安全（`@dita/api`）"
Cohesion: 0.18
Nodes (11): 3.1 后端 Git 与覆盖层安全（`@dita/api`）, 3.2 前端 API 客户端与状态管理（`@dita/web`）, 3.3 前端交互与双语文案（`@dita/web`）, 3. 详细改动设计, 修改 `apps/api/src/i18n/messages.ts`, 修改 `apps/api/src/modules/git/git-manager.ts`, 修改 `apps/api/src/modules/git/routes.ts`, 修改 `apps/web/src/components/GitPanel.tsx` (+3 more)

### Community 122 - "git-restore-revert.test.tsx"
Cohesion: 0.13
Nodes (12): FileReply, HEAD_COMMIT, installFetchHub(), makeCommit(), makeHub(), makeIdentity(), makeSnapshot(), makeStatus() (+4 more)

### Community 123 - "helpers.ts"
Cohesion: 0.17
Nodes (14): CalsTableNodeView, countCalsTgroups(), findDirectElementIndexInPmParent(), findDirectPmChildByTag(), findNthDirectElementChild(), findPmPosByDitaId(), findPmPosByElementPath(), getPmDocTitle() (+6 more)

### Community 124 - "map-tree-utils.ts"
Cohesion: 0.13
Nodes (21): buildScaleDitaProject(), buildCompositeMapTree(), BuildCompositeMapTreeOptions, CompositeMapTreeResult, isSameOrDescendantPath(), MapTargetResolution, MapTargetStatus, planMapNodeMove() (+13 more)

### Community 126 - "DesktopDownload.astro"
Cohesion: 0.18
Nodes (8): platforms, Props, Props, Props, Props, QuickStartTabs(), SiteDictionary, DESKTOP

### Community 127 - "site/src/i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 128 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 130 - "Issue tracker: Local Markdown"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: Local Markdown, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 131 - "html-theme-model.ts"
Cohesion: 0.15
Nodes (21): applyThemeSelection(), clampText(), collectThemeAssetPaths(), defaultThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizeAccentColor(), normalizeThemeDraft() (+13 more)

### Community 132 - "decorations-and-inserter.test.ts"
Cohesion: 0.11
Nodes (11): ancestorChains(), childTags(), ditaTagOf(), FakeDomElement, FakeDomEvent, findNodes(), noopCallbacks, ParsedGapKey (+3 more)

### Community 133 - "ai-prompt.ts"
Cohesion: 0.15
Nodes (23): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+15 more)

### Community 134 - "phase13-ui-components.test.tsx"
Cohesion: 0.10
Nodes (29): resetAiStore(), applyCheckinAiFix(), BLOCKING_ERROR_SOURCES, CheckinCandidate, CheckinDialog(), CheckinDialogProps, CheckinIssue, collectCheckinIssues() (+21 more)

### Community 135 - "xml-bridge.ts"
Cohesion: 0.27
Nodes (7): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncVisualToSource(), VisualToSourceResult, LockLike, ResolveAiApplyModeInput

### Community 136 - "topicGuideTree.ts"
Cohesion: 0.13
Nodes (22): buildChildChips(), buildNode(), buildTopicGuideTree(), EXPANDED_CONTAINERS, getTagDescription(), GROUP_ORDER, groupForCategory(), resolveExpandedAnchor() (+14 more)

### Community 137 - "dita-rules.ts"
Cohesion: 0.12
Nodes (16): ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS, DITA_CORE_INLINE_TAGS, ELEMENT_DESCRIPTIONS_ZH, ELEMENT_SPEC_LIST (+8 more)

### Community 138 - "HTML5 publish themes"
Cohesion: 0.25
Nodes (7): Adding a theme, Design tokens, Feature flags, File contract, HTML5 publish themes, Implementation notes, Runtime behaviour

### Community 139 - "e2e-ai-live.mts"
Cohesion: 0.16
Nodes (16): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+8 more)

### Community 140 - "cloudbuild.yaml"
Cohesion: 0.18
Nodes (10): images, options, logging, steps, args, name, substitutions, _DITA_BASE_PATH (+2 more)

### Community 141 - "ai-workbench.test.ts"
Cohesion: 0.06
Nodes (60): 4.7 AI Assistance (`Phase 6`), hasAiProposalChanges(), isAiProposalStale(), isSameXmlBuffer(), normalizeBuffer(), AiApplyOutcome, AI_FIX_MALFORMED_CONTEXT_LINES, AI_FIX_WINDOW_MAX_LINES (+52 more)

### Community 142 - "desktop/package.json"
Cohesion: 0.07
Nodes (34): dependencies, @dita/api@workspace:*, description, devDependencies, electron@^35.2.0, electron-builder@^26.18.1, esbuild@^0.25.0, @types/node@^22.13.0 (+26 more)

### Community 143 - "workspace-api.ts"
Cohesion: 0.16
Nodes (24): buildSnapshotFromMemoryFiles(), ApiHttpError, createWorkspaceProject(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics(), fetchWorkspaces() (+16 more)

### Community 144 - "DocsLayout.astro"
Cohesion: 0.09
Nodes (18): bySlug, dict, groups, Props, paths, Props, Locale, dict (+10 more)

### Community 145 - "GET"
Cohesion: 0.22
Nodes (11): 4.10 Versioning: Clean Baseline + Personal Draft Overlay (`Phase 13`), slugifyBranch(), worktreeLeafName(), GET(), Fixed, 1.1 目标架构：Git 干净基线 + 个人草稿叠加层, 1.2 三层视图定义, 1.3 五条工程不变量 (+3 more)

### Community 147 - "use-outline-drag.ts"
Cohesion: 0.23
Nodes (13): OutlineDropBlockReason, OutlineDropPlacement, DragUiState, findRow(), IDLE_STATE, OutlineDragGhost, OutlineDropIndicator, readPos() (+5 more)

### Community 148 - "map-edit-lock-guard.test.ts"
Cohesion: 0.32
Nodes (7): installServer(), makeBuffer(), makeLock(), OTHER_WRITER, seedWorkspace(), ServerOptions, WRITER

### Community 150 - "checkoutFile"
Cohesion: 0.50
Nodes (5): checkoutFile(), 3.1 完整交互流程图, 3.2 角色与锁状态行为矩阵, 3.3 异常与边缘恢复策略, 3. 正确场景设计与状态流转

### Community 151 - "@codemirror/autocomplete@^6.20.4"
Cohesion: 0.33
Nodes (4): @codemirror/autocomplete@^6.20.4, prosemirror-view@^1.43.0, @codemirror/autocomplete, prosemirror-view

### Community 152 - "3. ① 规则数据层"
Cohesion: 0.22
Nodes (9): entry(), 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次, 3.3 槽位语义, 3.4 Strict Task 与 General Task, 3.5 刻意的"宽容"（保无损）, 3.6 编辑策略例外（不是 DTD 规则） (+1 more)

### Community 153 - "playground-presets.ts"
Cohesion: 0.11
Nodes (12): CAPABILITIES, Capability, FeatureIcon, QUICK_START_TABS, QuickStartTab, PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture (+4 more)

### Community 155 - "MapNodeInspector.tsx"
Cohesion: 0.33
Nodes (5): findTreeNodeByPath(), GROUP_SUBTITLES, GROUP_TITLE_KEYS, DitaAttributeGroup, DitaAttributeSpec

### Community 156 - "api/src/index.ts"
Cohesion: 0.03
Nodes (79): createServer(), resetDitaRuntimeCache(), defaultWebDistDir(), isInside(), MIME_TYPES, registerWebStaticRoutes(), ADMIN, bootstrap() (+71 more)

### Community 157 - "astro.config.ts"
Cohesion: 0.14
Nodes (9): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, collections, docs, astro, @astrojs/react (+1 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 160 - "build-desktop"
Cohesion: 0.20
Nodes (10): name, runs-on, strategy, os, script, target, build-desktop, include (+2 more)

### Community 161 - "with"
Cohesion: 0.20
Nodes (10): with, cache, files, if-no-files-found, merge-multiple, name, node-version, path (+2 more)

### Community 163 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.07
Nodes (27): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+19 more)

### Community 164 - "theme-preview.ts"
Cohesion: 0.32
Nodes (11): getHtmlTheme(), isHtmlThemeId(), buildBrandVarsCss(), escapeHtmlText(), headerMarkup(), HtmlThemePreviewError, readOptional(), renderHtmlThemePreview() (+3 more)

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 166 - "ThemePreviewModal.tsx"
Cohesion: 0.29
Nodes (7): ThemeDraft, DEVICE_WIDTH, PreviewDevice, PreviewStatus, ThemePreviewModalProps, HtmlThemeDefaultMode, HtmlThemeFeatures

### Community 167 - "desktop/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ../../tsconfig.base.json

### Community 169 - "release-desktop.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 170 - "PublishDialog.tsx"
Cohesion: 0.17
Nodes (17): themeOptionsFromDraft(), JobLogViewer(), JobLogViewerProps, formatBytes(), formatDuration(), formatTime(), PublishDialog(), PublishTrace (+9 more)

### Community 171 - "HtmlThemeId"
Cohesion: 0.27
Nodes (11): ApiLocale, DetectRuntimeOptions, HtmlThemeId, HtmlThemeOptions, ManualPublishProfile, CreatePublishJobInput, PublishJobView, EnhanceHtml5Options (+3 more)

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "ai-output-parser.ts"
Cohesion: 0.11
Nodes (23): BASIC_XML_ENTITIES, createExplanationStreamFilter(), decodeBasicXmlEntities(), ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags(), 1.1 签入链路完全缺少 XML 与 DITA 结构门禁 (+15 more)

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - ".commit"
Cohesion: 0.50
Nodes (3): 4. 分阶段实施切片, Stage 2（P1）：基线发布、Tag、乐观锁、路径解耦与审计（2 天）, Stage 3（P2）：无污染分支合并、安全回滚与生命周期清理（3–4 天）

### Community 176 - "phase13-web-stores-and-ui.test.tsx"
Cohesion: 0.18
Nodes (8): ADMIN, ALL_USERS, makeCommit(), makeIdentity(), resetStores(), USER_A, USER_B, VIEWER

### Community 185 - "UiLocale"
Cohesion: 0.08
Nodes (25): DitaStructurePluginMeta, DitaStructurePluginState, interpolate(), Slice 8.1：同构 i18n 底座与 `@dita/core` 双语化（第 1–2 天）, ResolvedOptions, formatMessage(), UiLocale, 10. 手册工作台与 Topic 委派（Phase 10） (+17 more)

### Community 187 - "commitWithModifyAndDelete"
Cohesion: 0.60
Nodes (5): baselinePath(), commitWithModifyAndDelete(), readBaseline(), withTitleMarker(), writeBaseline()

### Community 188 - "git"
Cohesion: 0.40
Nodes (5): commitOnDisk(), git(), hasRevertHead(), headRevision(), porcelain()

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1545 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lucide-react` connect `lucide-react` to `App.tsx`, `html-theme-model.ts`, `phase13-ui-components.test.tsx`, `ai-workbench.test.ts`, `ConrefReusePanel.tsx`, `MapNodeInspector.tsx`, `SourceEditor.tsx`, `ThemePreviewModal.tsx`, `key-management-integration.test.tsx`, `PublishDialog.tsx`, `index.tsx`, `VisualEditor.tsx`, `web/package.json`, `ai-types.ts`, `ref_react`, `ditaval.ts`, `DocumentOutlinePanel.tsx`, `TopicAuthoringGuide.tsx`, `phase13-ui-components.test.tsx`, `AttributesPanel.tsx`, `workbench-store.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `httpError()` (e.g. with `Added` and `5. REST API 契约设计`) actually correct?**
  _`httpError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ai-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03062465450525152 - nodes in this community are weakly interconnected._
- **Why does `en()` connect `en` to `en/architecture.md`, `dita-structure.ts`, `translate`, `en/introduction.md`, `zh/architecture.md`, `App.tsx`, `Getting started`, `快速开始`, `zh/introduction.md`, `ai-output-parser.ts`, `Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板`, `Changelog`, `Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档`, `workbench-store.ts`, `git-restore-revert.test.tsx`, `dita-completion.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `createServer()` (e.g. with `.completeOnCheckin()` and `.markInProgressForCheckout()`) actually correct?**
  _`createServer()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06971153846153846 - nodes in this community are weakly interconnected._