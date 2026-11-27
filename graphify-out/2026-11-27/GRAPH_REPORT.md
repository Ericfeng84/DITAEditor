# Graph Report - DITAEditor  (2026-11-27)

## Corpus Check
- 518 files · ~526,909 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 70 file(s) not represented in the graph (top: .dita 26, .css 25, (none) 6)

## Summary
- 5787 nodes · 16734 edges · 213 communities (204 shown, 9 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 877 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `85a6be86`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ai-service.ts
- git-store.ts
- createTopicTemplate
- AttributesPanel.tsx
- messages/en.ts
- Core Package Manifest
- api/package.json
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
- dita-core/src/i18n/locale.ts
- env
- dita-core/src/index.ts
- parser-settings-service.ts
- site/package.json
- lock-service.ts
- scripts
- writer-agent.ts
- BaseLayout.astro
- theme-runtime.js
- fop-font-config.ts
- deploy-site.yml
- electron-builder.yml
- manual-registry-service.ts
- workspace-fs.ts
- with
- useI18n
- locales.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- UiLocale
- getPmNodeRawAttrs
- WorkspaceSemanticIndexer
- 4. 核心元素写作细则
- ai-store.ts
- apiUrl
- dita-plan-builder.ts
- devDependencies
- DITA Concept（概念）主题编写规范
- publish-service.ts
- planner-agent.ts
- phase13-ui-components.test.tsx
- VisualEditor.tsx
- topic-authoring-guide.test.ts
- DITA Reference（参考）主题编写规范
- httpError
- converter.ts
- fragment-splice.ts
- web/package.json
- WorkbenchHubPage.tsx
- ai-workbench.test.ts
- use-visual-editor-view.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- theme-enhancer.ts
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- index.tsx
- zh-CN.ts
- MergeService
- phase13-ui-components.test.tsx
- en/architecture.md
- serializer.ts
- fragment-locator.ts
- DraftService
- zh/architecture.md
- Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板
- workspace-api.ts
- SearchModal.astro
- docker-entrypoint.sh
- Design principles
- GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）
- checkin-validate.ts
- devDependencies
- Getting started
- ref_react
- VisualEditor.tsx
- environment
- HomePage.astro
- phase13-overlay-versioning.test.ts
- en/ai-setup.md
- Language
- zh/ai-setup.md
- compilerOptions
- Changelog
- api/src/index.ts
- materializeNewManual
- main.ts
- publish-api.ts
- modules/ai/types.ts
- 设计原则
- MiniRoundTripDemo.tsx
- ai-fragment.test.ts
- en/getting-started.md
- playground-presets.ts
- normalizePosixPath
- key-management-integration.test.tsx
- en/local-development.md
- zh/getting-started.md
- lucide-react
- GET
- migration.ts
- zh/local-development.md
- IngestService
- 版本管理与并发协作模型（现状说明）
- git-restore-revert.test.ts
- scripts
- Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建
- paths.ts
- 4. Non-Negotiable Engineering Invariants
- parseXml
- PublishDialog.tsx
- settings-and-migration.test.ts
- validator-repair-agent.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- ingest-agent.test.ts
- ref_vitest
- dita-core/src/index.ts
- html-theme-model.ts
- sync-hf-space.sh
- ingest-service.ts
- site/src/i18n/index.ts
- Domain Docs
- semantic-engine.ts
- Issue tracker: Local Markdown
- editor-store/types.ts
- 3.1 后端 Git 与覆盖层安全（`@dita/api`）
- Phase 14 规划与实施蓝图：文档智能导入与 AI Agent 撰写校验闭环（Docling + MarkItDown → Markdown → DITA）
- 前端 DITA 1.3 结构化写作合规实施说明
- ingest-routes.test.ts
- DocumentOutlinePanel.tsx
- scripts
- ingest-api.ts
- e2e-ai-live.mts
- cloudbuild.yaml
- outline-model.ts
- TopicAuthoringGuide.tsx
- publish/routes.ts
- DocsIndex.astro
- AppShell.tsx
- 核心能力
- HTML5 publish themes
- preload.ts
- commitWithModifyAndDelete
- ensure-electron.mjs
- DITAEditor 文档导航
- App.tsx
- git
- desktop/package.json
- ref_node_path
- astro.config.ts
- env
- build.mjs
- build-desktop
- with
- slimdom
- warehouse.ts
- ai-prompt.ts
- tag
- en
- desktop/tsconfig.json
- Model each Manual as an independent workspace and Git repository
- release-desktop.yml
- Scope backend workspace and semantic index per request by Manual ID and branch
- environment-service.ts
- steps
- ai-output-parser.ts
- attach-to-release
- phase13-web-stores-and-ui.test.tsx
- en/features.md
- git-restore-revert.test.tsx
- Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks
- Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay
- parser.ts
- deploy-cloudrun.sh
- ditaval.ts
- html-themes.ts
- checkXmlWellFormed
- DITAEditor
- conref-reuse-panel-ui.test.tsx
- Core capabilities
- topicGuideTree.ts
- dependencies
- phase12-publish-themes.test.ts
- AGENTS.md
- 核心能力
- triage-labels.md
- api/test/phase12-html-themes.test.ts
- ConrefReusePanel.tsx
- dita-log-parser.ts
- scanWorkspaceWithOverlay
- phase5-publish.test.ts
- theme-preview.ts
- PublishQueue
- resolveThemeOptions
- stage.mjs
- getNodeSourceRange
- DITAEditor — Web DITA 1.3 Workbench (Live Demo)
- GitHub Pages 免费部署指南（官网 + 离线三栏工作台）
- ThemePreviewModal.tsx
- parseDitaMap
- zip-store.ts
- scripts
- checkoutFile
- com.ditaeditor.pdf-cjk
- @langchain/core

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 184 edges
2. `httpError()` - 102 edges
3. `App()` - 91 edges
4. `requestJson()` - 91 edges
5. `createServer()` - 85 edges
6. `lucide-react` - 81 edges
7. `GitManager` - 77 edges
8. `DraftService` - 76 edges
9. `checkXmlWellFormed()` - 73 edges
10. `IdentityUser` - 70 edges

## Surprising Connections (you probably didn't know these)
- `1.2 `POST /api/git/revert-commit` 未检查文件锁与个人草稿，导致草稿遮蔽回退结果` --references--> `readFileWithOverlay()`  [INFERRED]
  docs/plans/phase13-restore-revert-fix.md → apps/api/src/modules/files/overlay-workspace.ts
- `4.9 HTML5 Publish Themes (`Phase 12`)` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  AGENTS.md → apps/api/src/modules/files/workspace-fs.ts
- `8. 主要工程风险与应对策略` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  docs/plans/phase12-html-themes.md → apps/api/src/modules/files/workspace-fs.ts
- `修改 `apps/api/src/modules/git/routes.ts`` --references--> `buildDraftDiff()`  [INFERRED]
  docs/plans/phase13-restore-revert-fix.md → apps/api/src/modules/git/routes.ts
- `4.11 Document Ingest & Tool-Using DITA-OT Repair Agent (`Phase 14`)` --references--> `postProcessGeneratedTopicXml()`  [INFERRED]
  AGENTS.md → apps/api/src/modules/ingest/agent/writer-agent.ts

## Import Cycles
- 2-file cycle: `packages/dita-core/src/model/dita-attr-docs.ts -> packages/dita-core/src/model/dita-rules.ts -> packages/dita-core/src/model/dita-attr-docs.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/files.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/map-tree.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/tabs.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (213 total, 9 thin omitted)

### Community 0 - "ai-service.ts"
Cohesion: 0.10
Nodes (24): AiContextInput, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice(), AiChatModel, AiServiceLogger (+16 more)

### Community 1 - "git-store.ts"
Cohesion: 0.07
Nodes (61): DiffDialogProps, cancelCheckout(), checkinFiles(), CheckinOptions, commitExternalChanges(), createGitBranch(), createGitTag(), deleteGitBranch() (+53 more)

### Community 2 - "createTopicTemplate"
Cohesion: 0.15
Nodes (17): buildScaleDitaProject(), tempDirs, interpolate(), 3.2 四项关键技术机制, formatMessage(), createMapTemplate(), CreateMapTemplateOptions, escapeText() (+9 more)

### Community 3 - "AttributesPanel.tsx"
Cohesion: 0.07
Nodes (60): AttributeField(), AttributeFieldControlContext, AttributeFieldProps, AttributeFilterBar(), AttributeFilterBarProps, AttributeGroupSection(), AttributeGroupSectionProps, attributeMatchesQuery() (+52 more)

### Community 4 - "messages/en.ts"
Cohesion: 0.14
Nodes (10): enAi, enAssignments, enCollab, enCommon, enDesktop, enEditor, enGuide, enIngest (+2 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "api/package.json"
Cohesion: 0.13
Nodes (19): devDependencies, tsx@^4.19.3, @types/better-sqlite3@^9.6.0, @types/node@^22.13.0, typescript@^5.8.0, vitest@^3.1.0, exports, @types/better-sqlite3 (+11 more)

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

### Community 17 - "dita-core/src/i18n/locale.ts"
Cohesion: 0.16
Nodes (10): COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey, coreMessagesEn (+2 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-core/src/index.ts"
Cohesion: 0.10
Nodes (37): insertMissingTopicBody(), TOPIC_BODY_WRAPPER, createDitaElementSkeleton(), exitCodeblockToParagraph(), handleDitaEnter(), insertInlineImage(), toggleInlineDitaElement(), handleDitaBackspace() (+29 more)

### Community 20 - "parser-settings-service.ts"
Cohesion: 0.04
Nodes (104): ingestParserSettings, IngestParserSettingsRow, HttpError, requireMerge(), CreateIngestJobInput, IngestJobOptions, assertDoclingMode(), assertEngineChoice() (+96 more)

### Community 21 - "site/package.json"
Cohesion: 0.05
Nodes (52): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+44 more)

### Community 22 - "lock-service.ts"
Cohesion: 0.03
Nodes (80): DitaDatabase, DitaDatabaseHandle, migrateManuals(), migratePublishJobs(), openDatabase(), aiSettings, AiSettingsRow, AiUsageLogRow (+72 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "writer-agent.ts"
Cohesion: 0.14
Nodes (26): DraftTopicResult, buildWriterUserPrompt(), coerceRootElement(), describeAssetMapping(), describeError(), draftTopicsConcurrently(), draftTopicWithAgent(), extractTopicXml() (+18 more)

### Community 25 - "BaseLayout.astro"
Cohesion: 0.10
Nodes (18): bySlug, dict, groups, Props, dict, Props, getDictionary(), LOCALE_HTML_LANG (+10 more)

### Community 26 - "theme-runtime.js"
Cohesion: 0.07
Nodes (80): absolutePath(), activateOnpage(), addSkipLink(), applyMode(), assembleLayout(), boot(), buildOnpage(), buildPager() (+72 more)

### Community 27 - "fop-font-config.ts"
Cohesion: 0.06
Nodes (59): bestRecord(), decodeName(), decodeUtf16Be(), decodeUtf32Be(), extractFontFace(), FontByteReader, fontExtensionForVersion(), FontFaceInfo (+51 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "manual-registry-service.ts"
Cohesion: 0.07
Nodes (28): ManualRow, topicAssignments, WorkspaceScaffold, repositoryIdFor(), DEFAULT_MAX_CACHED_SESSIONS, IDLE_SESSION_TTL_MS, ManualContextResolverOptions, manualIdForRoot() (+20 more)

### Community 31 - "workspace-fs.ts"
Cohesion: 0.05
Nodes (56): ALLOWED_IMAGE_EXTENSIONS, AssetRouteOptions, MIME_TYPES, sanitizeAssetFilename(), buildTemplateContent(), DITAVAL_TEMPLATE, fileExistsInOverlay(), findRenamedAwayDraft() (+48 more)

### Community 32 - "with"
Cohesion: 0.05
Nodes (43): concurrency, cancel-in-progress, group, runs-on, steps, env, DEEPSEEK_API_KEY, GCP_AR_REPO (+35 more)

### Community 33 - "useI18n"
Cohesion: 0.05
Nodes (93): AiSettingsDialog(), AiSettingsDialogProps, AiSettingsTab, formatNumber(), DEFAULT_DIR_FOR_TYPE, NewTopicDialog(), NewTopicMountContext, TOPIC_OPTIONS (+85 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.07
Nodes (27): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+19 more)

### Community 36 - "UiLocale"
Cohesion: 0.06
Nodes (46): FilterGroupedAttributesOptions, BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), sanitizeCssColor(), XmlLikeElement, XmlLikeNode (+38 more)

### Community 37 - "getPmNodeRawAttrs"
Cohesion: 0.25
Nodes (21): mergeCalsCellDown(), mergeCalsCellRight(), mergeCellContents(), splitCalsCell(), addTableColumn(), deleteTableColumn(), buildCalsSectionGrid(), CalsGridCell (+13 more)

### Community 38 - "WorkspaceSemanticIndexer"
Cohesion: 0.18
Nodes (4): realpathSyncOrNull(), summarizeDitaval(), WorkspaceSemanticIndexer, 4.1 `ManualContextResolver`（请求级上下文解析器）

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "ai-store.ts"
Cohesion: 0.08
Nodes (49): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+41 more)

### Community 41 - "apiUrl"
Cohesion: 0.25
Nodes (8): getActiveScope(), API_BASE, apiUrl(), htmlThemePreviewUrl(), parseEventFrame(), streamPublishJobEvents(), uploadWorkspaceImage(), withAssetScope()

### Community 42 - "dita-plan-builder.ts"
Cohesion: 0.09
Nodes (48): normalizePlanForExistingManual(), 3.1 `@dita/core/src/ingest/`（严格同构，零 `node:*` 导入）, buildFallbackOutlinePlan(), buildKeysMapXml(), buildMapXmlFromPlan(), createPlannedElement(), DEFAULT_FOLDER_BY_TYPE, detectTopicType() (+40 more)

### Community 43 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, jsdom@^31.0.1, @testing-library/dom@^10.4.2, @testing-library/react@^16.3.3, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0 (+7 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "publish-service.ts"
Cohesion: 0.05
Nodes (69): 4.12 PDF Font Embedding (FOP 2.9 + Noto CJK), PublishJobRow, publishJobs, ApiLocale, apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn (+61 more)

### Community 46 - "planner-agent.ts"
Cohesion: 0.07
Nodes (43): buildPlannerSystemPrompt(), buildPlannerUserPrompt(), coercePlan(), coerceTopic(), defaultCreateKeysMap(), describeError(), enforceTargetMode(), extractJsonCandidate() (+35 more)

### Community 47 - "phase13-ui-components.test.tsx"
Cohesion: 0.05
Nodes (44): changeLabelKey(), draftOpKey(), draftOpTone, GitPanel(), GitPanelProps, shortDate(), LockStatusBarProps, stateStyles (+36 more)

### Community 48 - "VisualEditor.tsx"
Cohesion: 0.08
Nodes (73): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, blockIndexInContainer(), blockIndexInParent(), BlockMovePlan, buildBlockHandleTarget() (+65 more)

### Community 49 - "topic-authoring-guide.test.ts"
Cohesion: 0.25
Nodes (6): TOPIC_AUTHORING_GUIDES, TopicGuideType, en, zhCN, enKeys, zhKeys

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "httpError"
Cohesion: 0.07
Nodes (29): TopicAssignmentRow, ACTIVE_STATUSES, ALL_STATUSES, AssignmentListQuery, AssignmentPerson, AssignmentScope, AssignmentService, AssignmentStatus (+21 more)

### Community 52 - "converter.ts"
Cohesion: 0.13
Nodes (29): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+21 more)

### Community 53 - "fragment-splice.ts"
Cohesion: 0.14
Nodes (27): buildWriterSystemPrompt(), AI 辅助, element(), Added, 1. `@dita/core` — `src/ai/`, 3. REST contract, Phase 6 AI Assistance — Implementation Contract, 4.2 三种靶向定位与无损回拼策略 (+19 more)

### Community 54 - "web/package.json"
Cohesion: 0.04
Nodes (64): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+56 more)

### Community 55 - "WorkbenchHubPage.tsx"
Cohesion: 0.06
Nodes (54): ManualAssignmentsPanelProps, Assignment, AssignmentCreateInput, AssignmentListQuery, AssignmentPerson, AssignmentScope, AssignmentStatus, AssignmentStatusFilter (+46 more)

### Community 56 - "ai-workbench.test.ts"
Cohesion: 0.06
Nodes (65): 4.7 AI Assistance (`Phase 6`), hasAiProposalChanges(), isAiProposalStale(), isSameXmlBuffer(), normalizeBuffer(), useAiStore, AI_FIX_MALFORMED_CONTEXT_LINES, AI_FIX_WINDOW_MAX_LINES (+57 more)

### Community 57 - "use-visual-editor-view.ts"
Cohesion: 0.08
Nodes (30): ConrefDragGhost, ConrefRowDragApi, ConrefRowDragOptions, editorAt(), useConrefRowDrag(), SourceEditor(), BlockConvertOption, BlockHandleTarget (+22 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.09
Nodes (20): 2. 完整用户工作流与入口矩阵, 3. 分层架构与关键不变量, 内容复用工作流：复用仓库、片段创建与全入口交互设计, 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构 (+12 more)

### Community 59 - "GitManager"
Cohesion: 0.07
Nodes (30): FileLockRow, httpError(), changeLabel(), GitBranchInfo, GitFileChange, GitFileDiff, GitManager, GitManagerOptions (+22 more)

### Community 60 - "theme-enhancer.ts"
Cohesion: 0.15
Nodes (28): appendBodyClasses(), buildSearchEntry(), collapseWhitespace(), collectHtmlFiles(), copySharedAsset(), copyWorkspaceAsset(), decodeEntities(), depthOf() (+20 more)

### Community 61 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 62 - "index.tsx"
Cohesion: 0.09
Nodes (32): JobLogViewer(), JobLogViewerProps, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody(), MODE_LABEL_KEYS (+24 more)

### Community 63 - "zh-CN.ts"
Cohesion: 0.14
Nodes (10): zhCNAi, zhCNAssignments, zhCNCollab, zhCNCommon, zhCNDesktop, zhCNEditor, zhCNGuide, zhCNIngest (+2 more)

### Community 64 - "MergeService"
Cohesion: 0.16
Nodes (10): isInside(), MergeConflictContent, MergeConflictPreview, MergeInput, MergePreview, MergeResult, MergeService, normalizeRelativePath() (+2 more)

### Community 65 - "phase13-ui-components.test.tsx"
Cohesion: 0.12
Nodes (20): applyCheckinAiFix(), BLOCKING_ERROR_SOURCES, CheckinCandidate, CheckinDialogProps, CheckinIssue, collectCheckinIssues(), countCheckinIssues(), CROSS_FILE_SOURCES (+12 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "serializer.ts"
Cohesion: 0.14
Nodes (25): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS, DitaElementKind (+17 more)

### Community 68 - "fragment-locator.ts"
Cohesion: 0.18
Nodes (23): 1) 增强 `widenAiFixTarget()`（`packages/dita-core/src/ai/fragment-locator.ts`）, AiFixWindowOptions, buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_FIX_WINDOW_MAX_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS (+15 more)

### Community 69 - "DraftService"
Cohesion: 0.08
Nodes (20): WorkingDraftRow, buildDraftDiff(), computeContentHash(), DraftService, DraftView, extensionOf(), hashBuffer(), isBinaryDraft() (+12 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板"
Cohesion: 0.10
Nodes (20): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 HTML5 样式模板设计矩阵, 3.1 为什么将主题资产存放在 `dita-ot-plugins/html5-themes/`？, 3.2 `Html5ThemeEnhancer` 关键实现细节, 3. 总体架构与发布增强流水线, 4.1 SQLite 数据表：`manual_publish_profiles`, 4.2 TypeScript 类型契约 (+12 more)

### Community 72 - "workspace-api.ts"
Cohesion: 0.13
Nodes (28): countMapTreeNodes(), buildSnapshotFromMemoryFiles(), ApiHttpError, createWorkspaceProject(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics() (+20 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "Design principles"
Cohesion: 0.18
Nodes (10): Bilingual by default, Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy (+2 more)

### Community 76 - "GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）"
Cohesion: 0.12
Nodes (17): 1. 创建隔离的试用项目并启用 API, 1. 在 GCP 创建最小权限部署账号与 Workload Identity Federation, 2. 一键构建并部署到 Cloud Run, 2. 在 GitHub 仓库配置 Actions Variables, 3. 配置 Artifact Registry 自动清理策略（必做省钱项）, GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）, 一、总体架构与低成本设计原理, 三、首次部署步骤（GCP Cloud Run） (+9 more)

### Community 77 - "checkin-validate.ts"
Cohesion: 0.17
Nodes (13): 5.1 `@dita/core` 单元测试, CheckinBatchValidation, locateDitavalError(), validateCheckinBatch(), validateDitaFileForCheckin(), BROKEN_MAP, DUPLICATE_CMD_TASK, GENERAL_TASK_WITH_SECTION (+5 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "Getting started"
Cohesion: 0.22
Nodes (9): Backend environment variables (`@dita/api`), Getting started, Host DITA-OT setup, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT, Option 3: Desktop app (macOS Apple Silicon & Windows x64, lightweight), Option 4: Low-cost cloud trial (GCP Cloud Run + subpath reverse proxy + auto-deploy on push), Option 5: Editing and semantic authoring only (no DITA-OT) (+1 more)

### Community 80 - "ref_react"
Cohesion: 0.06
Nodes (54): InsertKeyrefDialog(), KeyspacePanel(), samePath(), LeftSidebarProps, BindingKind, buildKeydefPreviewXml(), buildNewKeyOptions(), escapeXmlAttr() (+46 more)

### Community 81 - "VisualEditor.tsx"
Cohesion: 0.05
Nodes (26): CalsColspecNodeView, CalsTableNodeView, createCommentChevronTag(), createDitaNodeViews(), DitaCodeblockNodeView, DitaImageNodeView, DitaNoteNodeView, DitaPrologNodeView (+18 more)

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
Cohesion: 0.11
Nodes (19): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.6.0] — 2026-11-27, Added, Added, Added (+11 more)

### Community 90 - "api/src/index.ts"
Cohesion: 0.04
Nodes (87): firstHeaderValue(), RequestLike, resolveRequestLocale(), createServer(), CreateServerOptions, AiModelFactory, createLangChainModelFactory(), AiService (+79 more)

### Community 91 - "materializeNewManual"
Cohesion: 0.22
Nodes (15): defaultAssetPlacements(), materializeIntoExistingManual(), materializeNewManual(), normalizePosix(), readAssetBytes(), resolveExistingManualAssetPlacements(), resolveFreePathForExistingManual(), resultAssets() (+7 more)

### Community 92 - "main.ts"
Cohesion: 0.14
Nodes (25): activeSettings, ApiServer, applyRuntimeOptions(), buildApplicationMenu(), buildStatus(), changeDataDir(), computeDesktopPaths(), defaultDataDir() (+17 more)

### Community 93 - "publish-api.ts"
Cohesion: 0.16
Nodes (28): HtmlThemeSelectorProps, cancelPublishJob(), createPublishJob(), CreatePublishJobInput, fetchHtmlThemes(), fetchPublishJob(), fetchPublishJobs(), fetchPublishLog() (+20 more)

### Community 94 - "modules/ai/types.ts"
Cohesion: 0.11
Nodes (22): AiConfigTestInput, aiConfigTestSchema, aiConfigUpdateSchema, aiDiagnosticSchema, AiDonePayload, aiHistoryTurnSchema, AiProposal, AiProposalVerification (+14 more)

### Community 95 - "设计原则"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "ai-fragment.test.ts"
Cohesion: 0.13
Nodes (15): 4.1 文件清单与核心函数, AiExtractOptions, AiFragmentExtraction, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport (+7 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "playground-presets.ts"
Cohesion: 0.15
Nodes (6): PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 100 - "normalizePosixPath"
Cohesion: 0.17
Nodes (7): buildSemanticIndex(), 3.2 `User Overlay` 读写与语义索引叠加, normalizePosixPath(), DitaSemanticIndex, SemanticOverlayOperation, BASE_FILES, createBaseIndex()

### Community 101 - "key-management-integration.test.tsx"
Cohesion: 0.07
Nodes (43): RawAttributesSectionProps, PROFILING_BADGE_CLASSES, profilingBadgeClasses(), buildCompositeMapTree(), collectWorkspaceDirectoryPaths(), collectWorkspaceFilesByKind(), CompositeMapTreeNode, CompositeMapTreeResult (+35 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "lucide-react"
Cohesion: 0.18
Nodes (19): DelegateTopicButtonProps, EditorTabBarProps, TAB_TYPE_BADGE, IdentitySwitcher(), IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, TopicAssignmentBannerProps (+11 more)

### Community 105 - "GET"
Cohesion: 0.08
Nodes (26): 4.10 Versioning: Clean Baseline + Personal Draft Overlay (`Phase 13`), GET(), [1.4.0] — 2026-11-25, Changed, Fixed, 1.1 四层对象模型, 1.2 三层读视图定义, 1.3 五条工程不变量 (+18 more)

### Community 106 - "migration.ts"
Cohesion: 0.19
Nodes (16): buildPrefixPairs(), checkpointDatabase(), DB_PATH_COLUMNS, migrateDesktopDataDir(), MigrateDesktopDataDirOptions, MigrateDesktopDataDirResult, PrefixPair, pruneCopiedWorktrees() (+8 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "IngestService"
Cohesion: 0.16
Nodes (8): IngestJobRow, IngestService, isAbortError(), isTerminal(), normalizeIngestOptions(), parseJson(), toIso(), IngestJobStatus

### Community 109 - "版本管理与并发协作模型（现状说明）"
Cohesion: 0.17
Nodes (12): 2.1 仓库身份与初始化, 2.2 分支与 worktree 管理, 2. 仓库身份、分支与请求隔离, 3.1 SQLite 核心表结构, 3. 个人草稿叠加层与文件生命周期, 4. 四大核心操作的数据视图边界, 5.1 无污染分支合并, 5.2 安全回滚、Tag 与审计 API (+4 more)

### Community 110 - "git-restore-revert.test.ts"
Cohesion: 0.09
Nodes (14): ADMIN, App, ContentBody, createApp(), createFixture(), DiffBody, Fixture, GitStatusBody (+6 more)

### Community 111 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 112 - "Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建"
Cohesion: 0.16
Nodes (14): restoreFile(), 1.1 `revertCommit` 传入空路径列表，前端永远不重载已打开文件, 1.2 `POST /api/git/revert-commit` 未检查文件锁与个人草稿，导致草稿遮蔽回退结果, 1.3 `restoreFile` 对与 `HEAD` 一致的版本创建 0 差异幽灵草稿，且 Diff 统计失真, 1.4 `GitPanel` 反馈不可见且错误条位于滚出视口顶部, 1. 根因分析, 2. 已确认的核心策略决策, 4.1 后端集成测试（新建 `apps/api/test/git-restore-revert.test.ts`） (+6 more)

### Community 113 - "paths.ts"
Cohesion: 0.21
Nodes (15): augmentDesktopPath(), checkDirectoryWritable(), DESKTOP_DATA_SUB_ITEMS, DesktopPathInput, DesktopRuntimePaths, EXISTING_DATA_MARKERS, inspectDataDirCandidate(), isStrictlyInside() (+7 more)

### Community 114 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.18
Nodes (11): 4.11 Document Ingest & Tool-Using DITA-OT Repair Agent (`Phase 14`), 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.4 OASIS CALS Table Fidelity, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`), 4.9 HTML5 Publish Themes (`Phase 12`) (+3 more)

### Community 115 - "parseXml"
Cohesion: 0.16
Nodes (40): isSameOrDescendantPath(), planMapNodeMove(), subtreeReferencesMap(), createMapTreeSlice(), 3.1 `@dita/core` 同构内核, applyElementAttrsPreservingOrder(), collapseFormattingWhitespace(), computeElementPath() (+32 more)

### Community 116 - "PublishDialog.tsx"
Cohesion: 0.21
Nodes (14): themeOptionsFromDraft(), formatBytes(), formatDuration(), formatTime(), PublishDialog(), PublishTrace, publishTrace(), SOURCE_MODE_OPTIONS (+6 more)

### Community 118 - "settings-and-migration.test.ts"
Cohesion: 0.21
Nodes (13): DESKTOP_SETTINGS_FILENAME, DesktopSettings, desktopSettingsFileExists(), DesktopSettingsPatch, desktopSettingsPath(), loadDesktopSettings(), OPTIONAL_PATH_KEYS, readPathSetting() (+5 more)

### Community 119 - "validator-repair-agent.ts"
Cohesion: 0.07
Nodes (49): assertInsideStaging(), buildFingerprint(), buildSystemPrompt(), buildUserPrompt(), defineTool(), describeError(), DitaOtRepairAgentInput, DitaOtRepairAgentResult (+41 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "ingest-agent.test.ts"
Cohesion: 0.08
Nodes (15): IngestAgentAbortedError, layer1(), MARKDOWN, minimalStrictResult(), posix(), Role, roleOf(), ScriptedModel (+7 more)

### Community 122 - "ref_vitest"
Cohesion: 0.05
Nodes (39): DEFAULT_SNIPPET_TAG, DITA_ELEMENT_ID_PATTERN, SNIPPET_TAGS, validateSnippetId(), ditaXmlCompletionSource, extractActiveTableInfo(), findBoldPos(), makeSnapshot() (+31 more)

### Community 123 - "dita-core/src/index.ts"
Cohesion: 0.05
Nodes (79): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), TaskModelSwitch(), TaskModelSwitchProps, BuildDocumentOutlineOptions, createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike (+71 more)

### Community 124 - "html-theme-model.ts"
Cohesion: 0.14
Nodes (23): FileExplorerPanelProps, applyThemeSelection(), clampText(), collectThemeAssetPaths(), defaultThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizeAccentColor() (+15 more)

### Community 126 - "ingest-service.ts"
Cohesion: 0.06
Nodes (56): ingestJobs, ConcurrentDraftOptions, DraftAndVerifyInput, DraftTopicInput, GeneratedTopicArtifact, IngestAgentContext, PrepareStagingDir, SharedDraftOptions (+48 more)

### Community 127 - "site/src/i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 128 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 129 - "semantic-engine.ts"
Cohesion: 0.09
Nodes (35): DITA_PROFILING_ATTRS, cloneNodeIntoSlimdom(), CONREF_SPECIALIZATION_PARENT, escapeXmlText(), findDirectChild(), findTopicIdForElement(), getNormalizedText(), indexTopicElements() (+27 more)

### Community 130 - "Issue tracker: Local Markdown"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: Local Markdown, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 131 - "editor-store/types.ts"
Cohesion: 0.07
Nodes (48): WorkspaceDitavalSummary, BaselineRefreshInfo, BranchIndexState, collectAllFilePaths(), OverlayCacheEntry, SemanticContextResponse, SemanticOverlayOptions, ConrefReusePanelProps (+40 more)

### Community 132 - "3.1 后端 Git 与覆盖层安全（`@dita/api`）"
Cohesion: 0.18
Nodes (11): 3.1 后端 Git 与覆盖层安全（`@dita/api`）, 3.2 前端 API 客户端与状态管理（`@dita/web`）, 3.3 前端交互与双语文案（`@dita/web`）, 3. 详细改动设计, 修改 `apps/api/src/i18n/messages.ts`, 修改 `apps/api/src/modules/git/git-manager.ts`, 修改 `apps/api/src/modules/git/routes.ts`, 修改 `apps/web/src/components/GitPanel.tsx` (+3 more)

### Community 133 - "Phase 14 规划与实施蓝图：文档智能导入与 AI Agent 撰写校验闭环（Docling + MarkItDown → Markdown → DITA）"
Cohesion: 0.22
Nodes (9): 1. 目标与已确认架构决策, 2. 系统架构与路由策略, 4. 分阶段实施切片与验收矩阵, 5.1 一键启动（推荐：DITAEditor + Docling sidecar）, 5.2 精简单容器（不启用 MarkItDown）, 5.3 验收命令, 5. 部署形态与本地验证, Docling vs MarkItDown 智能路由矩阵 (+1 more)

### Community 134 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.08
Nodes (28): entry(), 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次, 3.3 槽位语义 (+20 more)

### Community 135 - "ingest-routes.test.ts"
Cohesion: 0.08
Nodes (15): ADMIN, App, createApp(), Fixture, multipart(), ONE_TOPIC_MARKDOWN, Role, SAMPLE_ROOT (+7 more)

### Community 136 - "DocumentOutlinePanel.tsx"
Cohesion: 0.12
Nodes (29): CategoryIcon(), collectExpandableIds(), DocumentOutlinePanel(), DocumentOutlinePanelProps, flattenVisibleRows(), OutlineRow, OutlineDropBlockReason, OutlineDropEvaluation (+21 more)

### Community 137 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, dist, dist:mac, dist:win, postinstall, stage (+2 more)

### Community 138 - "ingest-api.ts"
Cohesion: 0.05
Nodes (74): DocumentIngestDialog(), messageOf(), countTopics(), EDITABLE_TYPES, flatten(), IngestPlanReviewStep(), IngestPlanReviewStepProps, patchTopic() (+66 more)

### Community 139 - "e2e-ai-live.mts"
Cohesion: 0.21
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 140 - "cloudbuild.yaml"
Cohesion: 0.18
Nodes (10): images, options, logging, steps, args, name, substitutions, _DITA_BASE_PATH (+2 more)

### Community 141 - "outline-model.ts"
Cohesion: 0.05
Nodes (60): collectElementEntries(), countEntriesBefore(), evaluateOutlineDrop(), gapPosForElementIndex(), introducedSequenceViolation(), isOutlineContainer(), mapIssueCodeToReason(), OutlineElementEntry (+52 more)

### Community 142 - "TopicAuthoringGuide.tsx"
Cohesion: 0.16
Nodes (20): GROUP_LABEL_KEYS, GuideTreeNode(), GuideTreeNodeProps, isTopicGuideType(), readInitialExpanded(), TagFacts(), TagFactsProps, TopicAuthoringGuide() (+12 more)

### Community 143 - "publish/routes.ts"
Cohesion: 0.14
Nodes (23): HtmlThemeFeatures, resolveHtmlThemesDir(), asRecord(), mergeThemeOptions(), PublishSourceMode, createJobSchema, disposition(), isFileOnDisk() (+15 more)

### Community 144 - "DocsIndex.astro"
Cohesion: 0.11
Nodes (16): collections, docs, Capability, DocSlug, Locale, dict, groups, index (+8 more)

### Community 145 - "AppShell.tsx"
Cohesion: 0.11
Nodes (25): AppShell(), EditorState, rootEl, AppRoute, BASE, currentRoute, editorPath(), EditorRoute (+17 more)

### Community 146 - "核心能力"
Cohesion: 0.22
Nodes (9): 后端环境变量（`@dita/api`）, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版）, 方式二：本地源码 + 本机 DITA-OT, 方式五：仅编辑 / 语义写作（不安装 DITA-OT）, 方式四：云端低成本试用部署（GCP Cloud Run + 子路径反代 + Push 自动部署）, 本机 DITA-OT 配置 (+1 more)

### Community 147 - "HTML5 publish themes"
Cohesion: 0.17
Nodes (11): close(), [1.0.0] — 2026-11-22, Changed, Fixed, Phase 6 概要, Adding a theme, Design tokens, Feature flags (+3 more)

### Community 148 - "preload.ts"
Cohesion: 0.29
Nodes (7): DesktopDirInspection, bridge, ChangeDataDirInput, DataDirSwitchMode, DesktopPreferencesPatch, DesktopRuntimeStatus, DitaDesktopBridge

### Community 149 - "commitWithModifyAndDelete"
Cohesion: 0.60
Nodes (5): baselinePath(), commitWithModifyAndDelete(), readBaseline(), withTitleMarker(), writeBaseline()

### Community 150 - "ensure-electron.mjs"
Cohesion: 0.26
Nodes (11): DESKTOP_ROOT, __dirname, extractWithExtractZip(), extractWithNativeUnzip(), getArch(), getPlatformPath(), isHealthy(), log() (+3 more)

### Community 151 - "DITAEditor 文档导航"
Cohesion: 0.33
Nodes (6): DITAEditor 文档导航, 一、现行架构与设计（活文档 · 唯一真相源）, 三、部署与运维指南, 二、架构决策记录（ADR）, 五、历史阶段规划与专项方案归档（只读参考）, 四、DITA 1.3 编写参考与工程资产

### Community 152 - "App.tsx"
Cohesion: 0.04
Nodes (89): App(), AppProps, CheckinDialog(), CreateReusableSnippetDialog(), CreateReusableSnippetDialogProps, DEFAULT_WAREHOUSE_PATH, isWarehousePath(), resolveWarehouseTargetValue() (+81 more)

### Community 153 - "git"
Cohesion: 0.40
Nodes (5): commitOnDisk(), git(), hasRevertHead(), headRevision(), porcelain()

### Community 155 - "desktop/package.json"
Cohesion: 0.10
Nodes (27): dependencies, better-sqlite3@^13.2.0, @dita/api@workspace:*, description, devDependencies, electron@^35.2.0, electron-builder@^26.18.1, esbuild@^0.25.0 (+19 more)

### Community 156 - "ref_node_path"
Cohesion: 0.03
Nodes (46): AiConfigTestResult, ADMIN, createApp(), createFixture(), tempDirs, WRITER, ADMIN, App (+38 more)

### Community 157 - "astro.config.ts"
Cohesion: 0.11
Nodes (11): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, astro, @astrojs/react (+3 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 159 - "build.mjs"
Cohesion: 0.40
Nodes (4): DESKTOP_ROOT, __dirname, DIST_DIR, esmCreateRequireBanner

### Community 160 - "build-desktop"
Cohesion: 0.20
Nodes (10): name, runs-on, strategy, os, script, target, build-desktop, include (+2 more)

### Community 161 - "with"
Cohesion: 0.20
Nodes (10): with, cache, files, if-no-files-found, merge-multiple, name, node-version, path (+2 more)

### Community 162 - "slimdom"
Cohesion: 0.17
Nodes (12): compareElements(), compareParsedXmlDocuments(), normalizeChildren(), NormalizedChild, XmlDiffEntry, evaluateXPathToFirstNode(), evaluateXPathToStrings(), __dirname (+4 more)

### Community 163 - "warehouse.ts"
Cohesion: 0.14
Nodes (23): Implementation notes, AppendReusableFragmentOptions, AppendReusableFragmentResult, appendReusableFragmentToTopicXml(), applyFragmentIdentity(), BODY_WRAPPER_BY_ROOT, BODY_WRAPPER_TAGS, childElements() (+15 more)

### Community 164 - "ai-prompt.ts"
Cohesion: 0.17
Nodes (21): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+13 more)

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 166 - "en"
Cohesion: 0.19
Nodes (14): Bilingual UI, 中英双语界面, 双语是一等公民, en(), zh(), 3. 技术约束与不变量, 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、范围与决策边界 (+6 more)

### Community 167 - "desktop/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ../../tsconfig.base.json

### Community 168 - "Model each Manual as an independent workspace and Git repository"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Model each Manual as an independent workspace and Git repository

### Community 169 - "release-desktop.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 170 - "Scope backend workspace and semantic index per request by Manual ID and branch"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Scope backend workspace and semantic index per request by Manual ID and branch

### Community 171 - "environment-service.ts"
Cohesion: 0.16
Nodes (17): ParserRuntimeDetection, BinaryProbeResult, CommandVersionProbe, describeProbeFailure(), detectRuntimeEnvironment(), DetectRuntimeEnvironmentOptions, firstNonEmptyLine(), parseGitVersion() (+9 more)

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "ai-output-parser.ts"
Cohesion: 0.11
Nodes (23): BASIC_XML_ENTITIES, createExplanationStreamFilter(), decodeBasicXmlEntities(), ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags(), 1.1 签入链路完全缺少 XML 与 DITA 结构门禁 (+15 more)

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "phase13-web-stores-and-ui.test.tsx"
Cohesion: 0.18
Nodes (8): ADMIN, ALL_USERS, makeCommit(), makeIdentity(), resetStores(), USER_A, USER_B, VIEWER

### Community 176 - "en/features.md"
Cohesion: 0.07
Nodes (28): flag(), AI assistance, Collaboration and versioning, Conref, DITA maps, DITAVAL projection, Document outline and structural reordering, Dual-mode editing (+20 more)

### Community 177 - "git-restore-revert.test.tsx"
Cohesion: 0.13
Nodes (12): FileReply, HEAD_COMMIT, installFetchHub(), makeCommit(), makeHub(), makeIdentity(), makeSnapshot(), makeStatus() (+4 more)

### Community 178 - "Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks

### Community 179 - "Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay

### Community 180 - "parser.ts"
Cohesion: 0.18
Nodes (14): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes, lineColumnToOffset(), parseSaxesError(), ParseXmlOptions (+6 more)

### Community 182 - "ditaval.ts"
Cohesion: 0.17
Nodes (17): ConditionGroup, createDitavalTemplate(), DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule, evaluateElementConditions(), extractConditionGroups() (+9 more)

### Community 183 - "html-themes.ts"
Cohesion: 0.13
Nodes (19): ACCENT_DARK_TEXT, ACCENT_LIGHT_TEXT, accentScale(), contrastRatio(), findRepoRoot(), HtmlThemeAccentScale, HtmlThemeCatalogEntry, HtmlThemeDefaultMode (+11 more)

### Community 184 - "checkXmlWellFormed"
Cohesion: 0.11
Nodes (41): setTaskContentModelSetting(), t(), createInMemoryDemoWorkspace(), createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), fetchFileContent(), renameWorkspaceEntry() (+33 more)

### Community 185 - "DITAEditor"
Cohesion: 0.25
Nodes (7): quoteWinCmdArg(), resolveDitaSpawn(), [1.3.0] — 2026-11-24, Added, Fixed, Develop, build, and test, 开发、构建与测试

### Community 186 - "conref-reuse-panel-ui.test.tsx"
Cohesion: 0.18
Nodes (12): ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), keyspace(), NOOP_PROPS, renderPanel(), reusableNote() (+4 more)

### Community 187 - "Core capabilities"
Cohesion: 0.12
Nodes (17): 11. Manual workbench and topic assignment (Phase 10), 12. Document ingest and tool-using DITA-OT repair agent (Phase 14), 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Document outline view and structural reordering (v1.5.0), 4. Visual DITA Map tree and multi-file workbench, 6. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 7. Clean baseline, personal draft overlay and local Git (Phase 4 / Phase 13) (+9 more)

### Community 188 - "topicGuideTree.ts"
Cohesion: 0.14
Nodes (23): buildChildChips(), buildNode(), buildTopicGuideTree(), EXPANDED_CONTAINERS, getAllowedChildren(), getGuideElementRuleKey(), getRequiredAttributes(), GROUP_ORDER (+15 more)

### Community 189 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/openai@^1.8.4 (+8 more)

### Community 190 - "phase12-publish-themes.test.ts"
Cohesion: 0.12
Nodes (10): ADMIN, EN, Fixture, JobJson, SAMPLE_ROOT, tempDirs, TestApp, THEMES_DIR (+2 more)

### Community 191 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3.1 Desktop (`@dita/desktop`) runtime gotchas, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`)

### Community 192 - "核心能力"
Cohesion: 0.12
Nodes (16): 11. 手册工作台与 Topic 委派（Phase 10）, 12. 文档智能导入与工具化 DITA-OT 修复 Agent（Phase 14）, 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 文档大纲视图与结构重排（v1.5.0）, 4. 可视化 DITA Map 树与多文件工作台, 6. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 7. 干净基线 + 个人草稿叠加层与本地 Git（Phase 4 / Phase 13） (+8 more)

### Community 194 - "api/test/phase12-html-themes.test.ts"
Cohesion: 0.15
Nodes (11): getHtmlTheme(), HTML_THEME_IDS, htmlThemeOptionsSchema, listHtmlThemes(), THEME_OPTION_LIMITS, toDescriptor(), buildBrandVarsCss(), HtmlThemeSearchEntry (+3 more)

### Community 195 - "ConrefReusePanel.tsx"
Cohesion: 0.20
Nodes (13): buildReuseAttrValue(), ConrefReusePanel(), MODES, TABS, TopicInspector(), BlockHandle(), InsertElementMenu(), Added (+5 more)

### Community 196 - "dita-log-parser.ts"
Cohesion: 0.22
Nodes (13): DITA_FILE, DitaPathRoot, extractMessage(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath(), normalizeRoots() (+5 more)

### Community 197 - "scanWorkspaceWithOverlay"
Cohesion: 0.29
Nodes (8): collectFileNodes(), countMapTreeNodes(), ditavalSummaryFor(), mapSummaryFor(), recomputeStats(), removeFileNode(), scanWorkspaceWithOverlay(), toParseError()

### Community 198 - "phase5-publish.test.ts"
Cohesion: 0.17
Nodes (10): resetDitaRuntimeCache(), createApp(), createApp(), ADMIN, createApp(), PLUGIN_DIR, SAMPLE_ROOT, tempDirs (+2 more)

### Community 199 - "theme-preview.ts"
Cohesion: 0.27
Nodes (11): DEFAULT_HTML_FEATURES, HTML_THEME_LABELS, HtmlThemeLabels, escapeHtmlText(), headerMarkup(), HtmlThemePreviewError, readOptional(), renderHtmlThemePreview() (+3 more)

### Community 200 - "PublishQueue"
Cohesion: 0.18
Nodes (3): PublishQueue, PublishQueueOptions, 8. DITA-OT 4.x 权威校验与异步发布（Phase 5 / Phase 12）

### Community 201 - "resolveThemeOptions"
Cohesion: 0.22
Nodes (9): cleanPath(), cleanText(), isHtmlThemeId(), isRecord(), isValidAccent(), resolveThemeOptions(), defaultProfile(), normalizeStoredOptions() (+1 more)

### Community 202 - "stage.mjs"
Cohesion: 0.18
Nodes (9): apiPkg, DESKTOP_ROOT, desktopPkg, __dirname, REPO_ROOT, requiredPaths, STAGE_DIR, stagePkg (+1 more)

### Community 203 - "getNodeSourceRange"
Cohesion: 0.33
Nodes (9): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc(), findElementPathAtOffset() (+1 more)

### Community 204 - "DITAEditor — Web DITA 1.3 Workbench (Live Demo)"
Cohesion: 0.50
Nodes (3): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力

### Community 205 - "GitHub Pages 免费部署指南（官网 + 离线三栏工作台）"
Cohesion: 0.50
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 206 - "ThemePreviewModal.tsx"
Cohesion: 0.29
Nodes (7): ThemeDraft, DEVICE_WIDTH, PreviewDevice, PreviewStatus, ThemePreviewModalProps, HtmlThemeDefaultMode, HtmlThemeFeatures

### Community 207 - "parseDitaMap"
Cohesion: 0.39
Nodes (8): topicrefPath(), countCommentsAndPis(), extractElementPlainText(), extractMapNodeInlineText(), findDirectChildElement(), isSubmapElement(), parseDitaMap(), resolveMapNodeLabel()

### Community 208 - "zip-store.ts"
Cohesion: 0.48
Nodes (6): crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer()

### Community 209 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 210 - "checkoutFile"
Cohesion: 0.50
Nodes (5): checkoutFile(), 3.1 完整交互流程图, 3.2 角色与锁状态行为矩阵, 3.3 异常与边缘恢复策略, 3. 正确场景设计与状态流转

### Community 211 - "com.ditaeditor.pdf-cjk"
Cohesion: 0.40
Nodes (4): com.ditaeditor.pdf-cjk, Environment, Runtime prerequisites, The fallback table

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1845 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `semantic-engine.ts`, `前端 DITA 1.3 结构化写作合规实施说明`, `e2e-ai-live.mts`, `App.tsx`, `fop-font-config.ts`, `workspace-fs.ts`, `slimdom`, `publish-service.ts`, `ai-output-parser.ts`, `en/features.md`, `parser.ts`, `fragment-splice.ts`, `ditaval.ts`, `ai-workbench.test.ts`, `Core capabilities`, `MergeService`, `核心能力`, `en/architecture.md`, `scanWorkspaceWithOverlay`, `zh/architecture.md`, `workspace-api.ts`, `getNodeSourceRange`, `checkin-validate.ts`, `Changelog`, `ai-fragment.test.ts`, `normalizePosixPath`, `key-management-integration.test.tsx`, `4. Non-Negotiable Engineering Invariants`, `parseXml`, `validator-repair-agent.ts`, `dita-core/src/index.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `httpError()` (e.g. with `Added` and `5. REST API 契约设计`) actually correct?**
  _`httpError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ai-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._
- **Why does `WorkspaceManager` connect `workspace-fs.ts` to `ai-service.ts`, `editor-store/types.ts`, `ingest-service.ts`, `WorkspaceSemanticIndexer`, `workspace-api.ts`, `publish-service.ts`, `lock-service.ts`, `WorkbenchHubPage.tsx`, `api/src/index.ts`, `manual-registry-service.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07019230769230769 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `AttributesPanel.tsx`, `editor-store/types.ts`, `DocumentOutlinePanel.tsx`, `ingest-api.ts`, `TopicAuthoringGuide.tsx`, `App.tsx`, `useI18n`, `phase13-ui-components.test.tsx`, `web/package.json`, `ai-workbench.test.ts`, `use-visual-editor-view.ts`, `index.tsx`, `phase13-ui-components.test.tsx`, `ConrefReusePanel.tsx`, `ThemePreviewModal.tsx`, `ref_react`, `key-management-integration.test.tsx`, `PublishDialog.tsx`, `dita-core/src/index.ts`, `html-theme-model.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._