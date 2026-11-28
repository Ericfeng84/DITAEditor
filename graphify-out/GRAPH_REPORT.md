# Graph Report - DITAEditor  (2026-11-28)

## Corpus Check
- 622 files · ~720,906 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 82 file(s) not represented in the graph (top: .dita 31, .css 26, (none) 6)

## Summary
- 7570 nodes · 22304 edges · 240 communities (228 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 1237 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b437ea66`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- translation-api.ts
- git-store.ts
- dita-rules.ts
- useI18n
- zh-CN.ts
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
- IdentityUser
- env
- TranslationQueueService
- parser-settings-service.ts
- site/package.json
- lock-service.ts
- scripts
- TranslationCenterPage.tsx
- BaseLayout.astro
- theme-runtime.js
- fop-font-config.ts
- deploy-site.yml
- electron-builder.yml
- phase13-overlay-versioning.test.ts
- ref_node_fs
- with
- desktop-settings-ui.test.tsx
- locales.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- UiLocale
- workspace-api.ts
- semantic-engine.ts
- 4. 核心元素写作细则
- sync-service.ts
- pdf-theme-model.ts
- materializer.ts
- devDependencies
- DITA Concept（概念）主题编写规范
- validator-repair-agent.ts
- glossary-service.ts
- workspace-fs.ts
- VisualEditor.tsx
- translation-queue-ai.test.ts
- DITA Reference（参考）主题编写规范
- ManualRegistryService
- WorkspaceSemanticIndexer
- TranslationQueueTab.tsx
- web/package.json
- ingest-routes.test.ts
- 3. ① 规则数据层
- segment-extractor.ts
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- ai-translator.ts
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- segment-xml-utils.ts
- overlay-workspace.ts
- publish/routes.ts
- translation/index.ts
- en/architecture.md
- materializer.ts
- fragment-splice.ts
- LockService
- zh/architecture.md
- Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板
- TopicAuthoringGuide.tsx
- SearchModal.astro
- docker-entrypoint.sh
- httpError
- GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）
- workbench-ux-optimization.test.tsx
- devDependencies
- DraftService
- ai-reviewer.ts
- 4. Non-Negotiable Engineering Invariants
- environment
- HomePage.astro
- e2e-ai-live.mts
- en/ai-setup.md
- translation-links-sync.test.ts
- zh/ai-setup.md
- compilerOptions
- Changelog
- converter.ts
- ApiLocale
- main.ts
- publish-api.ts
- map-tree-utils.ts
- WorkbenchHubPage.tsx
- MiniRoundTripDemo.tsx
- glossary-codec.ts
- en/getting-started.md
- playground-presets.ts
- PublishService
- SideBySideView.tsx
- en/local-development.md
- zh/getting-started.md
- MessageKey
- ref_prosemirror_model
- migration.ts
- zh/local-development.md
- IngestService
- DocsIndex.astro
- git-restore-revert.test.ts
- scripts
- Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建
- paths.ts
- phase16-translation-ui.test.tsx
- parseXml
- translation/routes.ts
- docs/README.md
- DesktopDownload.astro
- MergeService
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- ReviewHeader.tsx
- translation-review-overlay.test.ts
- parsers/assets.ts
- html-theme-model.ts
- sync-hf-space.sh
- api/src/index.ts
- site/src/i18n/index.ts
- Domain Docs
- requestJson
- Issue tracker: Local Markdown
- translation-review-and-strict.test.ts
- 3.1 后端 Git 与覆盖层安全（`@dita/api`）
- settings-and-migration.test.ts
- ref_vitest
- ingest-service.ts
- helpers.ts
- outline-model.ts
- getPmNodeRawAttrs
- docling-parser.ts
- cloudbuild.yaml
- TranslationFilesTab.tsx
- parser-router.ts
- ingest-agent.test.ts
- 签入前置校验门禁与 AI 修复「检出—草稿—提交」闭环方案与测试案例
- help-sections.ts
- ensure-electron.mjs
- 版本管理与并发协作模型（现状说明）
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- RichInlineSegmentEditor.tsx
- AddTargetLanguageDialog.tsx
- DITAEditor 文档导航
- planner-agent.ts
- translation-qa.ts
- vite-env.d.ts
- desktop/package.json
- getRawAttr
- astro.config.ts
- env
- BilingualReviewPage.tsx
- build-desktop
- with
- en/authoring-guide.md
- zh/authoring-guide.md
- checkin-validation.test.ts
- tag
- en
- desktop/tsconfig.json
- Model each Manual as an independent workspace and Git repository
- release-desktop.yml
- Scope backend workspace and semantic index per request by Manual ID and branch
- ingest-parsers.test.ts
- steps
- Design principles
- attach-to-release
- 帮助中心与 DITA 规范文档
- environment-service.ts
- zh/dita-spec.md
- 4.3 翻译中心左侧血缘树、任意节点派生、解绑预警与术语库绑定（`apps/web`）
- Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay
- ThemePreviewModal.tsx
- deploy-cloudrun.sh
- en/translation.md
- api/src/index.ts
- ditaval.ts
- Phase 16 补充方案：翻译双 AI 独立审查、QA 自动修复与整批 DITA-OT 严格校验
- zh/translation.md
- 前端 DITA 1.3 结构化写作合规实施说明
- en/dita-spec.md
- index.tsx
- Phase 15 规划与实施蓝图：PDF 发布样式主题与多套专业印刷排版模板
- preload.ts
- dita-ot-validator.ts
- commitWithModifyAndDelete
- en/features.md
- AGENTS.md
- bilingual-review-redesign.test.tsx
- ingest-api.ts
- zh/features.md
- UiLocale
- NewKeyDialog.tsx
- semantic-indexer.ts
- DITAEditor
- git
- scripts
- 4. ② 命令层：只放出合法操作
- IngestAgentCallbacks
- GitHub Pages 免费部署指南（官网 + 离线三栏工作台）
- App.tsx
- DITAEditor 内置演示手册
- checkin-validation-ui.test.tsx
- Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）
- useVisualEditorView
- PDF theme assets (Phase 15)
- 设计原则
- 3. 核心模块与接口契约
- Phase 14 规划与实施蓝图：文档智能导入与 AI Agent 撰写校验闭环（Docling + MarkItDown → Markdown → DITA）
- scripts
- checkoutFile
- com.ditaeditor.pdf-cjk
- 内容复用工作流：复用仓库、片段创建与全入口交互设计
- apiUrl
- 3. SQLite 数据模型与迁移设计
- boot
- git
- replyAll
- Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks
- Model multi-language manuals as paired independent manuals linked in SQLite
- DITAEditor — Web DITA 1.3 Workbench (Live Demo)
- Getting started
- Phase 16 补充方案：双语审校界面（Bilingual Review Workbench）UI 全面重构
- PublishDialog.tsx
- awaitJob
- createSourceManual
- isReviewPrompt
- IngestOutlinePlan
- scriptedStrict
- strictResult
- warehouse.ts
- topic

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 223 edges
2. `httpError()` - 153 edges
3. `requestJson()` - 127 edges
4. `IdentityUser` - 118 edges
5. `createServer()` - 111 edges
6. `lucide-react` - 103 edges
7. `App()` - 99 edges
8. `checkXmlWellFormed()` - 94 edges
9. `GitManager` - 93 edges
10. `DraftService` - 85 edges

## Surprising Connections (you probably didn't know these)
- `Fixed` --references--> `resolveDitaSpawn()`  [INFERRED]
  CHANGELOG.md → apps/api/src/modules/dita-ot/dita-runtime.ts
- `1.2 `POST /api/git/revert-commit` 未检查文件锁与个人草稿，导致草稿遮蔽回退结果` --references--> `readFileWithOverlay()`  [INFERRED]
  docs/plans/phase13-restore-revert-fix.md → apps/api/src/modules/files/overlay-workspace.ts
- `4.9 HTML5 Publish Themes (`Phase 12`)` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  AGENTS.md → apps/api/src/modules/files/workspace-fs.ts
- `8. 主要工程风险与应对策略` --references--> `resolveSafeWorkspacePath()`  [INFERRED]
  docs/plans/phase12-html-themes.md → apps/api/src/modules/files/workspace-fs.ts
- `修改 `apps/api/src/modules/git/routes.ts`` --references--> `buildDraftDiff()`  [INFERRED]
  docs/plans/phase13-restore-revert-fix.md → apps/api/src/modules/git/routes.ts

## Import Cycles
- 2-file cycle: `apps/api/src/modules/translation/link-service.ts -> apps/api/src/modules/translation/sync-service.ts -> apps/api/src/modules/translation/link-service.ts`
- 2-file cycle: `apps/api/src/modules/translation/ai-reviewer.ts -> apps/api/src/modules/translation/ai-translator.ts -> apps/api/src/modules/translation/ai-reviewer.ts`
- 2-file cycle: `packages/dita-core/src/model/dita-attr-docs.ts -> packages/dita-core/src/model/dita-rules.ts -> packages/dita-core/src/model/dita-attr-docs.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/files.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/map-tree.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/tabs.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (240 total, 12 thin omitted)

### Community 0 - "translation-api.ts"
Cohesion: 0.07
Nodes (65): ApplyTranslationDraftResult, BatchApplyDraftInput, BatchApplyDraftResult, BatchApplyDraftSkip, BatchCheckinInput, BatchCheckinResult, CreateGlossaryInput, CreateGlossaryTermInput (+57 more)

### Community 1 - "git-store.ts"
Cohesion: 0.05
Nodes (66): DiffDialogProps, checkResolutionXml(), MergeDialog(), MergeDialogProps, XmlCheck, cancelCheckout(), checkinFiles(), CheckinOptions (+58 more)

### Community 2 - "dita-rules.ts"
Cohesion: 0.07
Nodes (28): BuildDocumentOutlineOptions, DITA_STRUCTURE_KEY, DitaStructurePluginMeta, DitaStructurePluginState, isTextOnlyContent(), keepsStructure(), ReplaceStepLike, ATTRIBUTE_DESCRIPTIONS_ZH (+20 more)

### Community 3 - "useI18n"
Cohesion: 0.04
Nodes (123): AttributeField(), AttributeFieldControlContext, AttributeFieldProps, AttributeFilterBar(), AttributeFilterBarProps, AttributeGroupSection(), AttributeGroupSectionProps, attributeMatchesQuery() (+115 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.05
Nodes (30): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enAssignments, enCollab, enCommon, enDesktop, enEditor (+22 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (26): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+18 more)

### Community 6 - "api/package.json"
Cohesion: 0.07
Nodes (37): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, drizzle-orm@^0.45.4, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2 (+29 more)

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

### Community 17 - "IdentityUser"
Cohesion: 0.05
Nodes (67): TranslationLinkRow, MergePreview, LockView, RepairDocumentForDitaOtInput, RepairSegmentsInput, ValidatedTranslationItem, COMPLETED_ITEM_STATUSES, itemView() (+59 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "TranslationQueueService"
Cohesion: 0.16
Nodes (10): TranslationItemRow, TranslationJobRow, clampRepairRounds(), describeError(), isAbortLike(), parseLinkOptions(), resolveConcurrency(), TranslationQueueService (+2 more)

### Community 20 - "parser-settings-service.ts"
Cohesion: 0.12
Nodes (27): ingestParserSettings, IngestParserSettingsRow, maskApiKey(), assertDoclingMode(), assertEngineChoice(), assertTableMode(), clampInt(), extractVersionFromBody() (+19 more)

### Community 21 - "site/package.json"
Cohesion: 0.05
Nodes (52): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+44 more)

### Community 22 - "lock-service.ts"
Cohesion: 0.03
Nodes (88): migrateAiSettings(), migrateManualPublishProfiles(), migrateManuals(), migratePublishJobs(), migrateTranslationItems(), migrateTranslationJobs(), openDatabase(), fileLocks (+80 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "TranslationCenterPage.tsx"
Cohesion: 0.06
Nodes (62): AppShell(), EditorState, IdentitySwitcher(), LocaleSwitcher(), OPTIONS, SessionSettingsMenu(), AppRoute, BASE (+54 more)

### Community 25 - "BaseLayout.astro"
Cohesion: 0.10
Nodes (18): 4.10 Versioning: Clean Baseline + Personal Draft Overlay (`Phase 13`), dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE, alternateEn, alternateZh (+10 more)

### Community 26 - "theme-runtime.js"
Cohesion: 0.07
Nodes (80): absolutePath(), activateOnpage(), addSkipLink(), applyMode(), assembleLayout(), boot(), buildOnpage(), buildPager() (+72 more)

### Community 27 - "fop-font-config.ts"
Cohesion: 0.04
Nodes (95): 4.12 PDF Font Embedding (FOP 2.9 + Noto CJK), buildRuntimeEnv(), defaultDitaHomes(), defaultNotoFontDir(), defaultPluginDir(), detectDitaRuntime(), DetectionCacheEntry, DitaRunOptions (+87 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "phase13-overlay-versioning.test.ts"
Cohesion: 0.08
Nodes (19): ADMIN, App, branches(), CapturedPrompt, Fixture, flattenFilePaths(), freshProbes(), git() (+11 more)

### Community 31 - "ref_node_fs"
Cohesion: 0.02
Nodes (96): resetDitaRuntimeCache(), PDF_THEME_IDS, crc32(), CRC_TABLE, createZipFromDirectory(), dosDateTime(), listFiles(), writeBuffer() (+88 more)

### Community 32 - "with"
Cohesion: 0.05
Nodes (43): concurrency, cancel-in-progress, group, runs-on, steps, env, DEEPSEEK_API_KEY, GCP_AR_REPO (+35 more)

### Community 33 - "desktop-settings-ui.test.tsx"
Cohesion: 0.07
Nodes (54): DesktopPluginBanner(), TOOL_LABELS, CommandList(), CopyCommand(), DesktopPluginGuideTab(), DesktopPluginGuideTabProps, GuideCard(), GuideOs (+46 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.14
Nodes (14): 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3) 能力 2：`optimize_tags`（优化标签：语义精细化 + 结构重构 + Keyref 推荐）, 4) 能力 3：`fix_error`（错误处理：XML 良构 / 项目语义 / DITA-OT 严格校验）, 5.2 API 与 SSE 接口契约, 5.3 模型输出协议与自动纠错重试闭环 (+6 more)

### Community 36 - "UiLocale"
Cohesion: 0.07
Nodes (32): collectDitaDecorations(), createBlockGapInserterDom(), createChevronCapSvg(), createDitavalFlagPillDom(), createOxygenTagDom(), createProfilingBadgeDom(), formatAttrsForTag(), CONTAINER_QUICK_BLOCK_TAGS (+24 more)

### Community 37 - "workspace-api.ts"
Cohesion: 0.08
Nodes (68): setTaskContentModelSetting(), t(), buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceDir(), createWorkspaceFile(), createWorkspaceProject(), deleteWorkspaceEntry() (+60 more)

### Community 38 - "semantic-engine.ts"
Cohesion: 0.06
Nodes (52): makeOverlay(), 5.2 源码模式：CodeMirror Linter, 3.2 `User Overlay` 读写与语义索引叠加, extractProfilingValuesFromDocument(), coreT(), IMAGE_EXTENSIONS, normalizePosixPath(), ResolvedDitaHref (+44 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "sync-service.ts"
Cohesion: 0.11
Nodes (25): TranslationFileStateRow, readLinkRow(), ACTIVE_ITEM_STATUSES, assertSafePath(), classifyTranslationFileKind(), ComputedFileState, fileStatusForItemStatus(), IGNORED_SEGMENTS (+17 more)

### Community 41 - "pdf-theme-model.ts"
Cohesion: 0.10
Nodes (33): clampText(), FEATURE_KEYS, LOGO_EXTENSIONS, oneOf(), PDF_FONT_FAMILIES, PDF_FONT_SIZES, PDF_MARGINS, PDF_PAGE_RATIO (+25 more)

### Community 42 - "materializer.ts"
Cohesion: 0.10
Nodes (43): outlineSectionsForPrompt(), 3.1 `@dita/core/src/ingest/`（严格同构，零 `node:*` 导入）, buildFallbackOutlinePlan(), buildKeysMapXml(), buildMapXmlFromPlan(), createPlannedElement(), DEFAULT_FOLDER_BY_TYPE, detectTopicType() (+35 more)

### Community 43 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom@^31.0.1, @testing-library/dom@^10.4.2, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "validator-repair-agent.ts"
Cohesion: 0.05
Nodes (76): assertInsideStaging(), buildFingerprint(), buildSystemPrompt(), buildUserPrompt(), defineTool(), describeError(), DitaOtRepairAgentInput, DitaOtRepairAgentResult (+68 more)

### Community 46 - "glossary-service.ts"
Cohesion: 0.09
Nodes (33): glossaries, GlossaryRow, GlossaryTermRow, glossaryTerms, GlossaryTranslationRow, glossaryTranslations, httpError(), normalizeRevision() (+25 more)

### Community 47 - "workspace-fs.ts"
Cohesion: 0.06
Nodes (42): ALLOWED_IMAGE_EXTENSIONS, MIME_TYPES, sanitizeAssetFilename(), buildTemplateContent(), fileExistsInOverlay(), findRenamedAwayDraft(), findUserDraft(), normalizeOverlayPath() (+34 more)

### Community 48 - "VisualEditor.tsx"
Cohesion: 0.07
Nodes (75): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, BlockConvertOption, blockIndexInContainer(), blockIndexInParent(), BlockMovePlan (+67 more)

### Community 49 - "translation-queue-ai.test.ts"
Cohesion: 0.07
Nodes (30): ADMIN, App, AppOptions, awaitJob(), boot(), cleanup, commitAll(), createApp() (+22 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "ManualRegistryService"
Cohesion: 0.05
Nodes (40): DitaDatabase, ManualRow, translationFileStates, translationItems, translationJobs, translationLinks, AssignmentServiceOptions, WorkspaceRouteSecurity (+32 more)

### Community 52 - "WorkspaceSemanticIndexer"
Cohesion: 0.18
Nodes (4): realpathSyncOrNull(), summarizeDitaval(), WorkspaceSemanticIndexer, 4.1 `ManualContextResolver`（请求级上下文解析器）

### Community 53 - "TranslationQueueTab.tsx"
Cohesion: 0.08
Nodes (32): TranslationDitaOtStatus, TranslationItemView, TranslationJobStatus, TranslationLinkView, buildTranslationLineage(), BuildTranslationLineageInput, compareLinks(), compareNodes() (+24 more)

### Community 54 - "web/package.json"
Cohesion: 0.05
Nodes (62): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+54 more)

### Community 55 - "ingest-routes.test.ts"
Cohesion: 0.08
Nodes (15): ADMIN, App, createApp(), Fixture, multipart(), ONE_TOPIC_MARKDOWN, Role, SAMPLE_ROOT (+7 more)

### Community 56 - "3. ① 规则数据层"
Cohesion: 0.20
Nodes (12): Common attributes, 常用属性, 3.1 成员表：父子能不能放, 3. ① 规则数据层, 3.2 顺序表：必须排第几、能出现几次, 3.3 槽位语义, 3.4 Strict Task 与 General Task, 3.5 刻意的"宽容"（保无损） (+4 more)

### Community 57 - "segment-extractor.ts"
Cohesion: 0.15
Nodes (28): isInlineElementName(), isWhitespacePreservingElement(), canonicalSegmentPayload(), elementChildren(), escapeXmlText(), ExtractionState, extractPlainText(), ExtractPlainTextOptions (+20 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.12
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.06
Nodes (38): changeLabel(), GitBranchInfo, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary, GitTagInfo (+30 more)

### Community 60 - "ai-translator.ts"
Cohesion: 0.09
Nodes (45): AiTranslationReviewer, addUsage(), AiTranslationOrchestrator, attributeEchoPattern(), buildBatches(), buildBatchPrompt(), buildDitaOtRepairPrompt(), buildMessages() (+37 more)

### Community 61 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 62 - "segment-xml-utils.ts"
Cohesion: 0.13
Nodes (30): escapeRegExp(), renderChildren(), renderElement(), renderNode(), renderText(), SEMANTIC_TAGS, tagBadge(), attributeValue() (+22 more)

### Community 63 - "overlay-workspace.ts"
Cohesion: 0.12
Nodes (26): collectFileNodes(), countMapTreeNodes(), DITAVAL_TEMPLATE, ditavalSummaryFor(), insertFileNode(), insertFileNodeAt(), mapSummaryFor(), OverlayAsset (+18 more)

### Community 64 - "publish/routes.ts"
Cohesion: 0.02
Nodes (197): 4.13 PDF Publish Themes (`Phase 15`), resolvePhase4Scope(), ACCENT_DARK_TEXT, ACCENT_LIGHT_TEXT, accentScale(), cleanPath(), cleanText(), contrastRatio() (+189 more)

### Community 65 - "translation/index.ts"
Cohesion: 0.09
Nodes (50): TranslationFileStateFilter, 3.1 共享同构翻译内核（`packages/dita-core/src/translation/`，零 `node:*` 导入）, AlignmentResult, alignSegments(), AlignSegmentsOptions, asEntries(), assembleTranslatedXml(), AssembleTranslatedXmlInput (+42 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.13
Nodes (14): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+6 more)

### Community 67 - "materializer.ts"
Cohesion: 0.23
Nodes (19): GeneratedTopicArtifact, defaultAssetPlacements(), MaterializationArtifactsInput, MaterializeExistingManualInput, materializeIntoExistingManual(), materializeNewManual(), MaterializeNewManualInput, normalizePlanForExistingManual() (+11 more)

### Community 68 - "fragment-splice.ts"
Cohesion: 0.04
Nodes (78): 4.7 AI Assistance (`Phase 6`), close(), AI assistance, AI 辅助, element(), [1.0.0] — 2026-11-22, Added, Changed (+70 more)

### Community 69 - "LockService"
Cohesion: 0.21
Nodes (4): FileLockRow, IdentityUser, LockService, 1) 签入后端硬门禁（`apps/api/src/modules/locks/lock-service.ts`、`locks/routes.ts`、`git/routes.ts`）

### Community 70 - "zh/architecture.md"
Cohesion: 0.13
Nodes (14): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+6 more)

### Community 71 - "Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板"
Cohesion: 0.11
Nodes (19): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 HTML5 样式模板设计矩阵, 3.1 为什么将主题资产存放在 `dita-ot-plugins/html5-themes/`？, 3.2 `Html5ThemeEnhancer` 关键实现细节, 3. 总体架构与发布增强流水线, 4.1 SQLite 数据表：`manual_publish_profiles`, 4.2 TypeScript 类型契约 (+11 more)

### Community 72 - "TopicAuthoringGuide.tsx"
Cohesion: 0.11
Nodes (37): buildElementRows(), buildTopicTypeRows(), GROUP_LABEL_KEYS, GuideTreeNode(), GuideTreeNodeProps, readInitialExpanded(), TagFacts(), TagFactsProps (+29 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "httpError"
Cohesion: 0.15
Nodes (6): TopicAssignmentRow, AssignmentService, parseStatus(), todayIso(), toIdentityUser(), Slice 10.2：Topic 编辑任务后端服务与生命周期钩子

### Community 76 - "GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）"
Cohesion: 0.12
Nodes (17): 1. 创建隔离的试用项目并启用 API, 1. 在 GCP 创建最小权限部署账号与 Workload Identity Federation, 2. 一键构建并部署到 Cloud Run, 2. 在 GitHub 仓库配置 Actions Variables, 3. 配置 Artifact Registry 自动清理策略（必做省钱项）, GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）, 一、总体架构与低成本设计原理, 三、首次部署步骤（GCP Cloud Run） (+9 more)

### Community 77 - "workbench-ux-optimization.test.tsx"
Cohesion: 0.07
Nodes (33): DelegateTopicButtonProps, IdentitySwitcherProps, SessionSettingsMenuProps, TopicAssignmentBannerProps, WorkbenchHeaderProps, BreadcrumbBarProps, BreadcrumbItem, CURRENT_USER_STORAGE_KEY (+25 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "DraftService"
Cohesion: 0.08
Nodes (22): WorkingDraftRow, workingDrafts, AssetRouteOptions, computeContentHash(), DraftService, DraftServiceOptions, DraftView, extensionOf() (+14 more)

### Community 80 - "ai-reviewer.ts"
Cohesion: 0.12
Nodes (23): aiReviewCategorySchema, aiReviewIssueSchema, AiReviewReply, aiReviewReplySchema, buildReviewBatches(), buildReviewHumanPrompt(), buildReviewSystemPrompt(), describeQaIssue() (+15 more)

### Community 81 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.25
Nodes (8): 4.11 Document Ingest & Tool-Using DITA-OT Repair Agent (`Phase 14`), 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety, 4.5 Isomorphic `@dita/core` & Runtime Gotchas, 4.6 Static Site (`@dita/site`), 4.9 HTML5 Publish Themes (`Phase 12`), 4. Non-Negotiable Engineering Invariants

### Community 82 - "environment"
Cohesion: 0.06
Nodes (34): INSTALL_MARKITDOWN, args, context, dockerfile, build, container_name, depends_on, environment (+26 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.16
Nodes (12): dict, jsonLd, layerRows, Props, screenshotUrl(), showcaseImages, pickText(), digest() (+4 more)

### Community 84 - "e2e-ai-live.mts"
Cohesion: 0.21
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 85 - "en/ai-setup.md"
Cohesion: 0.18
Nodes (10): Acceptance script, Configure a model, Cost and privacy, Endpoints and roles, How a request flows, Next steps, SSE and disconnects, Three target scopes (+2 more)

### Community 86 - "translation-links-sync.test.ts"
Cohesion: 0.07
Nodes (22): addLink(), ADMIN, App, boot(), cleanup, commitAll(), createApp(), createLink() (+14 more)

### Community 87 - "zh/ai-setup.md"
Cohesion: 0.18
Nodes (10): SSE 与断连, 三种目标范围, 下一步, 为什么必须 Diff 审阅, 成本与隐私, 接口与角色, 校验与重试, 请求如何流动 (+2 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, jsx, noEmit, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 89 - "Changelog"
Cohesion: 0.06
Nodes (31): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.3.0] — 2026-11-24, [1.4.0] — 2026-11-25, [1.5.0] — 2026-11-26, [1.6.0] — 2026-11-27 (+23 more)

### Community 90 - "converter.ts"
Cohesion: 0.05
Nodes (69): RawAttributesSectionProps, CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs() (+61 more)

### Community 91 - "ApiLocale"
Cohesion: 0.17
Nodes (12): copyWorkspaceTree(), describeError(), itemReport(), normalizePath(), safeRelativePath(), toIso(), TranslationDitaOtValidator, ValidateTranslationJobBatchResult (+4 more)

### Community 92 - "main.ts"
Cohesion: 0.14
Nodes (26): activeSettings, ApiServer, applyRuntimeOptions(), buildApplicationMenu(), buildStatus(), changeDataDir(), computeDesktopPaths(), defaultDataDir() (+18 more)

### Community 93 - "publish-api.ts"
Cohesion: 0.13
Nodes (35): HtmlThemeSelectorProps, PdfThemeSelectorProps, cancelPublishJob(), createPublishJob(), CreatePublishJobInput, fetchHtmlThemes(), fetchPdfThemes(), fetchPublishJob() (+27 more)

### Community 94 - "map-tree-utils.ts"
Cohesion: 0.07
Nodes (54): PROFILING_BADGE_CLASSES, profilingBadgeClasses(), PublishDialogProps, WorkspaceDialogProps, sanitizeCssColor(), buildCompositeMapTree(), BuildCompositeMapTreeOptions, CompositeMapTreeNode (+46 more)

### Community 95 - "WorkbenchHubPage.tsx"
Cohesion: 0.05
Nodes (72): ManualAssignmentsPanelProps, Assignment, AssignmentCreateInput, AssignmentListQuery, AssignmentPerson, AssignmentScope, AssignmentStatus, AssignmentStatusFilter (+64 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.16
Nodes (17): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, MINI_DEMO_XML, compactDiff(), computeLineDiff(), DiffLine (+9 more)

### Community 97 - "glossary-codec.ts"
Cohesion: 0.11
Nodes (34): RFC-4180, booleanCell(), coerceRow(), CsvColumn, descendantsByTag(), descripValue(), elementChildren(), elementText() (+26 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "playground-presets.ts"
Cohesion: 0.12
Nodes (11): CAPABILITIES, Capability, FeatureIcon, QuickStartTab, PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset (+3 more)

### Community 100 - "PublishService"
Cohesion: 0.08
Nodes (14): PublishJobRow, PublishQueue, PublishQueueOptions, findFirstPdf(), isInside(), normalizeSourceMode(), parseDiagnostics(), parseDirtyFiles() (+6 more)

### Community 101 - "SideBySideView.tsx"
Cohesion: 0.14
Nodes (28): TranslationSegmentReviewView, BlockRole, BlockTypography, CODE_TAGS, PROSE_CLASS, resolveBlockRole(), resolveBlockTypography(), ROLE_CLASS (+20 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "MessageKey"
Cohesion: 0.04
Nodes (121): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+113 more)

### Community 105 - "ref_prosemirror_model"
Cohesion: 0.08
Nodes (42): BlockHandleTarget, insertMissingTopicBody(), TOPIC_BODY_WRAPPER, createDitaElementSkeleton(), exitCodeblockToParagraph(), handleDitaEnter(), insertInlineImage(), toggleInlineDitaElement() (+34 more)

### Community 106 - "migration.ts"
Cohesion: 0.19
Nodes (16): buildPrefixPairs(), checkpointDatabase(), DB_PATH_COLUMNS, migrateDesktopDataDir(), MigrateDesktopDataDirOptions, MigrateDesktopDataDirResult, PrefixPair, pruneCopiedWorktrees() (+8 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "IngestService"
Cohesion: 0.14
Nodes (10): IngestJobRow, IngestService, isAbortError(), isTerminal(), normalizeIngestOptions(), parseJson(), planTopicNodes(), toIso() (+2 more)

### Community 109 - "DocsIndex.astro"
Cohesion: 0.08
Nodes (20): bySlug, dict, groups, Props, paths, Props, collections, docs (+12 more)

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

### Community 114 - "phase16-translation-ui.test.tsx"
Cohesion: 0.08
Nodes (38): @testing-library/react@^16.3.3, activateSegment(), ACTIVE_ITEM, arabicLink(), baseHandler(), chrome(), emptyStream(), FetchCall (+30 more)

### Community 115 - "parseXml"
Cohesion: 0.13
Nodes (49): createMapTreeSlice(), inferKeyFormat(), topicrefPath(), 3.1 `@dita/core` 同构内核, 4.1 `@dita/core` 无损 Key XML 读写原语, applyElementAttrsPreservingOrder(), collapseFormattingWhitespace(), computeElementPath() (+41 more)

### Community 116 - "translation/routes.ts"
Cohesion: 0.07
Nodes (28): assignReviewerSchema, batchApplyDraftSchema, batchCheckinSchema, createGlossarySchema, createJobSchema, createLinkSchema, createTermSchema, FILE_KINDS (+20 more)

### Community 118 - "DesktopDownload.astro"
Cohesion: 0.16
Nodes (9): platforms, Props, Props, Props, Props, QuickStartTabs(), QUICK_START_TABS, SiteDictionary (+1 more)

### Community 119 - "MergeService"
Cohesion: 0.18
Nodes (9): isInside(), MergeConflictContent, MergeConflictPreview, MergeInput, MergeResult, MergeService, MergeServiceOptions, normalizeRelativePath() (+1 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "ReviewHeader.tsx"
Cohesion: 0.12
Nodes (29): RefineTranslationSegmentResult, TranslationAiReviewCategory, TranslationAiReviewReport, TranslationDitaOtItemReport, TranslationGlossaryHitView, TranslationItemStatus, TranslationLockInfo, TranslationQaReport (+21 more)

### Community 122 - "translation-review-overlay.test.ts"
Cohesion: 0.08
Nodes (30): ADMIN, App, applyDraft(), boot(), cleanup, commitAll(), createApp(), createLink() (+22 more)

### Community 123 - "parsers/assets.ts"
Cohesion: 0.15
Nodes (20): ASSET_SCHEME, assetIdFor(), copyReferencedImages(), CopyReferencedImagesOptions, CopyReferencedImagesResult, findProducedMarkdown(), highestAssetIndex(), IMAGE_EXTENSIONS (+12 more)

### Community 124 - "html-theme-model.ts"
Cohesion: 0.12
Nodes (28): applyThemeSelection(), clampText(), collectThemeAssetPaths(), defaultThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizeAccentColor(), normalizeThemeDraft() (+20 more)

### Community 126 - "api/src/index.ts"
Cohesion: 0.04
Nodes (108): firstHeaderValue(), RequestLike, resolveRequestLocale(), apiCatalogue(), ApiMessageKey, ApiMessageParams, apiMessagesEn, apiMessagesZh (+100 more)

### Community 127 - "site/src/i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 128 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 129 - "requestJson"
Cohesion: 0.13
Nodes (44): fetchPublishLog(), applyTranslationToDraft(), assignTranslationItemReviewer(), batchApplyTranslationDrafts(), batchCheckinTranslationLink(), cancelTranslationJob(), createGlossary(), createGlossaryTerm() (+36 more)

### Community 130 - "Issue tracker: Local Markdown"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: Local Markdown, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 131 - "translation-review-and-strict.test.ts"
Cohesion: 0.06
Nodes (19): ADMIN, AiConfigResponse, App, AppOptions, AVAILABLE_FALSE, cleanup, Fixture, JobItem (+11 more)

### Community 132 - "3.1 后端 Git 与覆盖层安全（`@dita/api`）"
Cohesion: 0.18
Nodes (11): 3.1 后端 Git 与覆盖层安全（`@dita/api`）, 3.2 前端 API 客户端与状态管理（`@dita/web`）, 3.3 前端交互与双语文案（`@dita/web`）, 3. 详细改动设计, 修改 `apps/api/src/i18n/messages.ts`, 修改 `apps/api/src/modules/git/git-manager.ts`, 修改 `apps/api/src/modules/git/routes.ts`, 修改 `apps/web/src/components/GitPanel.tsx` (+3 more)

### Community 133 - "settings-and-migration.test.ts"
Cohesion: 0.20
Nodes (12): DESKTOP_SETTINGS_FILENAME, DesktopSettings, desktopSettingsFileExists(), DesktopSettingsPatch, desktopSettingsPath(), loadDesktopSettings(), OPTIONAL_PATH_KEYS, readPathSetting() (+4 more)

### Community 134 - "ref_vitest"
Cohesion: 0.03
Nodes (92): 4.8 DITA 1.3 Ordered Content Models (`Phase 9`), DEFAULT_SNIPPET_TAG, DITA_ELEMENT_ID_PATTERN, SNIPPET_TAGS, validateSnippetId(), buildNode(), resolveExpandedAnchor(), slotSignature() (+84 more)

### Community 135 - "ingest-service.ts"
Cohesion: 0.05
Nodes (57): aiSettings, AiSettingsRow, ApiLocale, CreateServerOptions, AiChatModel, AiModelFactory, AiService, AiServiceDeps (+49 more)

### Community 136 - "helpers.ts"
Cohesion: 0.12
Nodes (19): countCalsTgroups(), findDirectElementIndexInPmParent(), findDirectPmChildByTag(), findNthDirectElementChild(), findPmPosByDitaId(), findPmPosByElementPath(), getPmDocTitle(), isDitaElementPmNode() (+11 more)

### Community 137 - "outline-model.ts"
Cohesion: 0.05
Nodes (75): CategoryIcon(), collectExpandableIds(), DocumentOutlinePanel(), DocumentOutlinePanelProps, flattenVisibleRows(), OutlineRow, collectElementEntries(), countEntriesBefore() (+67 more)

### Community 138 - "getPmNodeRawAttrs"
Cohesion: 0.15
Nodes (34): buildReuseSkeletonAttrs(), insertReuseReferenceAtPos(), replaceBlockWithReuseAtPos(), ReuseAttrName, MessageKey, TABLE_ACTIONS, TableAction, VisualEditorHandle (+26 more)

### Community 139 - "docling-parser.ts"
Cohesion: 0.19
Nodes (21): readTextFile(), createAbortError(), createCommandRunner(), isAvailable(), run(), killTree(), quoteForCmd(), splitCommandLine() (+13 more)

### Community 140 - "cloudbuild.yaml"
Cohesion: 0.18
Nodes (10): images, options, logging, steps, args, name, substitutions, _DITA_BASE_PATH (+2 more)

### Community 141 - "TranslationFilesTab.tsx"
Cohesion: 0.05
Nodes (72): TranslationFileKind, TranslationFileStatus, assetCapabilities(), BatchCapabilities, classifyWorkspaceScope(), computeScopeCounts(), computeStageCounts(), deriveRecommendedScenario() (+64 more)

### Community 142 - "parser-router.ts"
Cohesion: 0.15
Nodes (22): dedupe(), defaultAvailability(), doclingOrder(), parseDirect(), parseDocumentToMarkdown(), ParserEngineId, resolveParserEnginePlan(), ALL_INGEST_EXTENSIONS (+14 more)

### Community 143 - "ingest-agent.test.ts"
Cohesion: 0.07
Nodes (16): aiUsageLogs, IngestAgentAbortedError, layer1(), MARKDOWN, minimalStrictResult(), posix(), Role, roleOf() (+8 more)

### Community 144 - "签入前置校验门禁与 AI 修复「检出—草稿—提交」闭环方案与测试案例"
Cohesion: 0.17
Nodes (12): 1.1 签入链路完全缺少 XML 与 DITA 结构门禁, 1.3 `widenAiFixTarget` 对单行子元素未扩窗到父容器，导致去重/结构修复必然「无实际改动」, 1. 根因分析, 2. 已确认的核心产品策略与架构不变量, 3) 服务端双语文案（`apps/api/src/i18n/messages.ts`）, 3) 顺带修复语义索引对 `generalTask.dtd` 的任务模型感知, 4.1 `@dita/core`, 4.2 `@dita/api` (+4 more)

### Community 145 - "help-sections.ts"
Cohesion: 0.05
Nodes (49): BLOCK_ELEMENTS, blockTexts(), buildAttributeRows(), buildHelpSections(), buildLinkItems(), buildOrderedContainerRows(), buildQuickstartSteps(), COMMON_ATTRIBUTES (+41 more)

### Community 146 - "ensure-electron.mjs"
Cohesion: 0.26
Nodes (11): DESKTOP_ROOT, __dirname, extractWithExtractZip(), extractWithNativeUnzip(), getArch(), getPlatformPath(), isHealthy(), log() (+3 more)

### Community 147 - "版本管理与并发协作模型（现状说明）"
Cohesion: 0.15
Nodes (13): 1.1 四层对象模型, 1.2 三层读视图定义, 1.3 五条工程不变量, 1. 核心对象模型与三层视图, 2.1 仓库身份与初始化, 2.2 分支与 worktree 管理, 2. 仓库身份、分支与请求隔离, 3.1 SQLite 核心表结构 (+5 more)

### Community 148 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.15
Nodes (13): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1. 目标与边界, 2. 端到端架构与数据流, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`）, 3.2 配置优先级与密钥安全, 3. 数据库与配置设计（SQLite + Drizzle）, 4. `@dita/core` 共享内核扩展设计, 7. 分切片实施计划（Vertical Slices） (+5 more)

### Community 149 - "RichInlineSegmentEditor.tsx"
Cohesion: 0.23
Nodes (7): EditorMode, InlineRefChipView, inlineSliceFromXml(), innerXmlFromDoc(), __reviewEditorInternals, RichInlineSegmentEditor(), appendInlineSnippet()

### Community 150 - "AddTargetLanguageDialog.tsx"
Cohesion: 0.38
Nodes (9): fetchManuals(), AddTargetLanguageDialog(), AddTargetLanguageDialogProps, languageLabel(), pickAvailableTargetLang(), PREFERRED_LANGUAGES, suggestTargetLang(), TARGET_LANGUAGES (+1 more)

### Community 151 - "DITAEditor 文档导航"
Cohesion: 0.33
Nodes (6): DITAEditor 文档导航, 一、现行架构与设计（活文档 · 唯一真相源）, 三、部署与运维指南, 二、架构决策记录（ADR）, 五、阶段规划与专项方案归档, 四、DITA 1.3 编写参考与工程资产

### Community 152 - "planner-agent.ts"
Cohesion: 0.16
Nodes (22): buildPlannerSystemPrompt(), buildPlannerUserPrompt(), coercePlan(), coerceTopic(), defaultCreateKeysMap(), describeError(), enforceTargetMode(), extractJsonCandidate() (+14 more)

### Community 153 - "translation-qa.ts"
Cohesion: 0.13
Nodes (24): CandidateHit, dedupeKey(), GlossaryScope, isAsciiWordChar(), isBoundaryChar(), isLatinBounded(), matchGlossaryTerms(), mergeGlossaryEntries() (+16 more)

### Community 155 - "desktop/package.json"
Cohesion: 0.10
Nodes (27): dependencies, better-sqlite3@^13.2.0, @dita/api@workspace:*, description, devDependencies, electron@^35.2.0, electron-builder@^26.18.1, esbuild@^0.25.0 (+19 more)

### Community 156 - "getRawAttr"
Cohesion: 0.04
Nodes (48): defaultInstruction(), targetLabel(), createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModelSetting(), BLOCK_TAG_ELEMENT_MAP (+40 more)

### Community 157 - "astro.config.ts"
Cohesion: 0.11
Nodes (11): site, astro@^5.18.2, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, astro, @astrojs/react (+3 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 159 - "BilingualReviewPage.tsx"
Cohesion: 0.24
Nodes (14): BilingualReviewPage(), BilingualReviewPageProps, issueKey(), readStoredInspector(), readStoredViewMode(), __reviewInternals, safeRead(), safeWrite() (+6 more)

### Community 160 - "build-desktop"
Cohesion: 0.20
Nodes (10): name, runs-on, strategy, os, script, target, build-desktop, include (+2 more)

### Community 161 - "with"
Cohesion: 0.20
Nodes (10): with, cache, files, if-no-files-found, merge-multiple, name, node-version, path (+2 more)

### Community 162 - "en/authoring-guide.md"
Cohesion: 0.12
Nodes (15): Check-in, merge and history, Check-out and read-only topics, Collaboration and versioning model, Conditional filtering (DITAVAL), Cross references, keys and maps, Elements and tables, Frequently asked, Outline and navigation (+7 more)

### Community 163 - "zh/authoring-guide.md"
Cohesion: 0.12
Nodes (15): 一条完整链路, 三种编辑模式, 交叉引用、key 与 Map, 元素与表格, 协作与版本模型, 发布, 复用：conref 与 conkeyref, 大纲与导航 (+7 more)

### Community 164 - "checkin-validation.test.ts"
Cohesion: 0.09
Nodes (9): ADMIN, App, createApp(), Fixture, git(), head(), SAMPLE_ROOT, tempDirs (+1 more)

### Community 165 - "tag"
Cohesion: 0.22
Nodes (9): tag, on, release, workflow_dispatch, types, description, required, type (+1 more)

### Community 166 - "en"
Cohesion: 0.15
Nodes (17): Bilingual UI, Bilingual by default, 中英双语界面, 双语是一等公民, en(), zh(), [1.2.0] — 2026-11-22, Changed (+9 more)

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

### Community 171 - "ingest-parsers.test.ts"
Cohesion: 0.12
Nodes (16): DitaDatabaseHandle, toParserAvailability(), CommandResult, ADMIN, baseConfig(), createServeFetch(), ENV_KEYS, fakeCliRunner() (+8 more)

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "Design principles"
Cohesion: 0.18
Nodes (10): Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy, Translation is not a sidecar (+2 more)

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "帮助中心与 DITA 规范文档"
Cohesion: 0.18
Nodes (10): 3.1 入口, 3.2 交互与无障碍, 3.4 外链与离线降级, 一、问题与目标, 三、应用内帮助中心, 二、已确认的八个决策, 五、验收, 六、明确不做 (+2 more)

### Community 176 - "environment-service.ts"
Cohesion: 0.13
Nodes (21): ParserRuntimeDetection, RuntimeDetectionOptions, CommandRunner, IngestRouteDeps, BinaryProbeResult, CommandVersionProbe, describeProbeFailure(), detectRuntimeEnvironment() (+13 more)

### Community 177 - "zh/dita-spec.md"
Cohesion: 0.20
Nodes (9): DITAVAL 条件处理, Map、topicref 与 key, 四种主题类型, 复用与特化, 常用内联元素, 常用块级元素, 常见误区, 有序内容模型 (+1 more)

### Community 178 - "4.3 翻译中心左侧血缘树、任意节点派生、解绑预警与术语库绑定（`apps/web`）"
Cohesion: 0.08
Nodes (24): 1.1 底层模型天然一致（0 数据库迁移）, 1.2 当前卡点（6 处单层 1-hop 假设）, 1. 背景与现状诊断, 2. 已确认核心设计决策（Design Tree 共识清单）, 3.1 API 行为演进说明, 3. 总体架构与数据流, 4.1 后端：家族图遍历、唯一性守卫与签入级联（`apps/api`）, 4.2 前端纯逻辑内核：血缘树构建与 Hub/顶栏全树遍历（`apps/web`） (+16 more)

### Community 179 - "Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay

### Community 180 - "ThemePreviewModal.tsx"
Cohesion: 0.19
Nodes (11): JobLogViewer(), JobLogViewerProps, DEVICE_WIDTH, PreviewDevice, PreviewStatus, ThemePreviewModal(), getActiveScope(), htmlThemePreviewUrl() (+3 more)

### Community 182 - "en/translation.md"
Cohesion: 0.22
Nodes (8): Bilingual review, Check-in and publish, Explicit boundaries, Glossaries, Language families and pairing, Scan, then translate only what changed, The AI translation queue, Try it now

### Community 183 - "api/src/index.ts"
Cohesion: 0.03
Nodes (97): AiUsageLogRow, AiContextInput, AiProjectContext, buildAiContext(), EMPTY_AI_CONTEXT, keyDefinitionLine(), topicIndexLine(), truncateWithNotice() (+89 more)

### Community 184 - "ditaval.ts"
Cohesion: 0.08
Nodes (31): 5.1 `@dita/core` 单元测试, ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint, DitavalFlagStyle, DitavalPropRule (+23 more)

### Community 185 - "Phase 16 补充方案：翻译双 AI 独立审查、QA 自动修复与整批 DITA-OT 严格校验"
Cohesion: 0.18
Nodes (11): 1. 背景与目标, 2. 已确认的核心架构决策, 3.1 端到端数据流, 3.2 条目状态机演进, 3. 系统总体架构与状态机, 4.4 前端工作台、AI 设置与双语审校 UI（`apps/web/src/`）, 4. 模块改造与接口设计, 5.1 自动化测试 (+3 more)

### Community 186 - "zh/translation.md"
Cohesion: 0.22
Nodes (8): AI 翻译队列, 从扫描到翻译：只处理真正变化的段落, 双语审校, 明确的边界, 术语库, 现在就想试, 签入与发布, 语言家族与配对关系

### Community 187 - "前端 DITA 1.3 结构化写作合规实施说明"
Cohesion: 0.22
Nodes (9): 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 5. ③ 诊断层：看得见，但不挡路, 5.3 跨文件：语义索引与 Problems 面板, 5.4 文案单一来源, 5.5 为什么不用 `filterTransaction`, 6. ④ 闸门 (+1 more)

### Community 188 - "en/dita-spec.md"
Cohesion: 0.20
Nodes (9): Authoritative references, Common block elements, Common inline elements, DITAVAL conditional processing, Frequent mistakes, Maps, topicref and keys, Ordered content models, Reuse and specialization (+1 more)

### Community 189 - "index.tsx"
Cohesion: 0.03
Nodes (86): zustand@^5.1.0, changeLabelKey(), draftOpKey(), draftOpTone, GitPanel(), GitPanelProps, shortDate(), InlineLockMenu() (+78 more)

### Community 190 - "Phase 15 规划与实施蓝图：PDF 发布样式主题与多套专业印刷排版模板"
Cohesion: 0.12
Nodes (16): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 PDF 排版模板设计矩阵, 3.1 为什么用 `--customization.dir` + XML Catalog，而不是安装插件？, 3.2 导入链的两个承重点, 3.4 PDF2 结构钩子覆写清单（`shared/xsl-base.xsl`）, 3. 总体架构与发布定制流水线, 4.1 SQLite 数据表 (+8 more)

### Community 191 - "preload.ts"
Cohesion: 0.29
Nodes (7): DesktopDirInspection, bridge, ChangeDataDirInput, DataDirSwitchMode, DesktopPreferencesPatch, DesktopRuntimeStatus, DitaDesktopBridge

### Community 192 - "dita-ot-validator.ts"
Cohesion: 0.10
Nodes (29): DITA_FILE, DitaDiagnostic, DitaPathRoot, extractMessage(), fallbackDitaDiagnostic(), LOCATION_PATTERNS, LocationMatch, matchLocation() (+21 more)

### Community 193 - "commitWithModifyAndDelete"
Cohesion: 0.60
Nodes (5): baselinePath(), commitWithModifyAndDelete(), readBaseline(), withTitleMarker(), writeBaseline()

### Community 194 - "en/features.md"
Cohesion: 0.13
Nodes (14): Collaboration and versioning, Conref, DITA maps, DITAVAL projection, Document outline and structural reordering, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs (+6 more)

### Community 195 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Repository Layout, 3.1 Desktop (`@dita/desktop`) runtime gotchas, 3. Build, Typecheck & Test Commands, 5. TypeScript & Code Style, 6. Knowledge Graph Workflow (`graphify`)

### Community 196 - "bilingual-review-redesign.test.tsx"
Cohesion: 0.13
Nodes (20): findTagEnd(), isSelfClosingElement(), splitOuterElement(), chainedHandler(), chrome(), EMPTY_COUNTS, FetchCall, FetchHandler (+12 more)

### Community 197 - "ingest-api.ts"
Cohesion: 0.05
Nodes (84): DocumentIngestDialog(), DocumentIngestDialogProps, messageOf(), countTopics(), EDITABLE_TYPES, FlatNode, flatten(), IngestPlanReviewStep() (+76 more)

### Community 198 - "zh/features.md"
Cohesion: 0.13
Nodes (14): Conref, DITA Map, DITAVAL 投影, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+6 more)

### Community 199 - "UiLocale"
Cohesion: 0.06
Nodes (39): buildScaleDitaProject(), FilterGroupedAttributesOptions, BuildContext, interpolate(), Slice 8.1：同构 i18n 底座与 `@dita/core` 双语化（第 1–2 天）, ResolvedOptions, formatMessage(), UiLocale (+31 more)

### Community 200 - "NewKeyDialog.tsx"
Cohesion: 0.11
Nodes (21): LeftSidebarProps, BindingKind, buildKeydefPreviewXml(), buildNewKeyOptions(), escapeXmlAttr(), inferFormatToken(), KIND_TABS, NewKeyDialogContext (+13 more)

### Community 201 - "semantic-indexer.ts"
Cohesion: 0.07
Nodes (37): WorkspaceDitavalSummary, BaselineRefreshInfo, BranchIndexState, collectAllFilePaths(), OverlayCacheEntry, SemanticContextResponse, SemanticOverlayOptions, buildReuseAttrValue() (+29 more)

### Community 202 - "DITAEditor"
Cohesion: 0.12
Nodes (16): DITAEditor, 仓库目录结构, 后端环境变量（`@dita/api`）, 官网、文档站与离线工作台, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版）, 方式二：本地源码 + 本机 DITA-OT (+8 more)

### Community 203 - "git"
Cohesion: 0.40
Nodes (5): commitOnDisk(), git(), hasRevertHead(), headRevision(), porcelain()

### Community 204 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, dist, dist:mac, dist:win, postinstall, stage (+2 more)

### Community 205 - "4. ② 命令层：只放出合法操作"
Cohesion: 0.29
Nodes (7): 4.4 OASIS CALS Table Fidelity, 4. ② 命令层：只放出合法操作, 4.2 插入位置：自动归位到 DTD 槽位, 4.3 新元素天生合法：骨架构造, 4.5 键盘行为按内容模型设计, 4.6 行内元素与表格的额外保真规则, hasMultipleTgroups()

### Community 206 - "IngestAgentCallbacks"
Cohesion: 0.29
Nodes (3): IngestAgentCallbacks, IngestStreamHandlers, IngestTopicProgress

### Community 207 - "GitHub Pages 免费部署指南（官网 + 离线三栏工作台）"
Cohesion: 0.50
Nodes (4): GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 208 - "App.tsx"
Cohesion: 0.04
Nodes (101): App(), AppProps, CreateReusableSnippetDialog(), CreateReusableSnippetDialogProps, DEFAULT_WAREHOUSE_PATH, isWarehousePath(), resolveWarehouseTargetValue(), ReuseSnippetExtractAction (+93 more)

### Community 209 - "DITAEditor 内置演示手册"
Cohesion: 0.29
Nodes (6): DITAEditor 内置演示手册, 修改约定, 关于这个目录的 Git 仓库, 内容地图, 如何使用, 这份手册演示了什么

### Community 210 - "checkin-validation-ui.test.tsx"
Cohesion: 0.06
Nodes (38): resetAiStore(), applyCheckinAiFix(), BLOCKING_ERROR_SOURCES, CheckinCandidate, CheckinDialog(), CheckinDialogProps, CheckinIssue, CheckinIssueSources (+30 more)

### Community 211 - "Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）"
Cohesion: 0.25
Nodes (8): ① `working_drafts`（新增）, ② `publish_jobs`（幂等 `ALTER TABLE` 增量迁移）, 3.1 SQLite 数据模型, 3.3 锁规则收口与签入原子闭环, 3.4 桌面端 / 外部编辑器改盘兼容, ③ `version_audit_logs`（新增）, 3. 核心底层机制设计, ④ `manuals`（增量迁移，Stage 3 保护分支配置）

### Community 212 - "useVisualEditorView"
Cohesion: 0.14
Nodes (19): ConrefDragGhost, ConrefRowDragApi, ConrefRowDragOptions, editorAt(), useConrefRowDrag(), SourceEditor(), buildConrefDragSnippet(), CONREF_DRAG_MIME (+11 more)

### Community 213 - "PDF theme assets (Phase 15)"
Cohesion: 0.25
Nodes (7): Adding a theme, Constraints, Import chain, Package layout, PDF theme assets (Phase 15), Tokens, What cannot be overridden

### Community 214 - "设计原则"
Cohesion: 0.18
Nodes (10): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+2 more)

### Community 215 - "3. 核心模块与接口契约"
Cohesion: 0.22
Nodes (9): 1.2 已落地的 3 项默认策略, 1. 目标、定位与核心架构共识, 2.1 分层全景图, 2.2 三方增量翻译算法流（`S0 × S1 × T0 → T1`）, 2.3 翻译队列与 Phase 13 签入闭环状态机, 2. 系统总体架构, 4. 分阶段垂直切片与验收矩阵, Phase 16 规划与实施蓝图：多语言翻译、增量同步、术语库与 AI 协同工作台 (+1 more)

### Community 216 - "Phase 14 规划与实施蓝图：文档智能导入与 AI Agent 撰写校验闭环（Docling + MarkItDown → Markdown → DITA）"
Cohesion: 0.18
Nodes (11): 1. 目标与已确认架构决策, 2. 系统架构与路由策略, 3.2 SQLite 数据模型（`apps/api/src/db/{schema,client}.ts`）, 3. 核心模块与接口契约, 4. 分阶段实施切片与验收矩阵, 5.1 一键启动（推荐：DITAEditor + Docling sidecar）, 5.2 精简单容器（不启用 MarkItDown）, 5.3 验收命令 (+3 more)

### Community 217 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 218 - "checkoutFile"
Cohesion: 0.50
Nodes (5): checkoutFile(), 3.1 完整交互流程图, 3.2 角色与锁状态行为矩阵, 3.3 异常与边缘恢复策略, 3. 正确场景设计与状态流转

### Community 219 - "com.ditaeditor.pdf-cjk"
Cohesion: 0.40
Nodes (4): com.ditaeditor.pdf-cjk, Environment, Runtime prerequisites, The fallback table

### Community 220 - "内容复用工作流：复用仓库、片段创建与全入口交互设计"
Cohesion: 0.40
Nodes (3): 2. 完整用户工作流与入口矩阵, 3. 分层架构与关键不变量, 内容复用工作流：复用仓库、片段创建与全入口交互设计

### Community 221 - "apiUrl"
Cohesion: 0.21
Nodes (9): applyScopeHeaders(), API_BASE, apiUrl(), getCurrentUserId(), exportGlossary(), parseTranslationStreamFrame(), streamHeaders(), subscribeTranslationJobStream() (+1 more)

### Community 222 - "3. SQLite 数据模型与迁移设计"
Cohesion: 0.50
Nodes (4): 3.1 `manuals` 表, 3.2 `topic_assignments` 表, 3.3 现有工作区平滑迁移策略（首次启动自动导入）, 3. SQLite 数据模型与迁移设计

### Community 223 - "boot"
Cohesion: 0.67
Nodes (3): boot(), createApp(), makeFixture()

### Community 224 - "git"
Cohesion: 0.67
Nodes (3): commitAll(), git(), porcelain()

### Community 225 - "replyAll"
Cohesion: 0.67
Nodes (3): currentSource(), replyAll(), segmentIds()

### Community 226 - "Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks

### Community 227 - "Model multi-language manuals as paired independent manuals linked in SQLite"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Model multi-language manuals as paired independent manuals linked in SQLite

### Community 228 - "DITAEditor — Web DITA 1.3 Workbench (Live Demo)"
Cohesion: 0.50
Nodes (3): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力

### Community 229 - "Getting started"
Cohesion: 0.12
Nodes (16): Architecture and technology stack, Backend environment variables (`@dita/api`), DITAEditor, Getting started, Host DITA-OT setup, License, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT (+8 more)

### Community 230 - "Phase 16 补充方案：双语审校界面（Bilingual Review Workbench）UI 全面重构"
Cohesion: 0.25
Nodes (8): 1. 背景与痛点分析, 2. 核心设计目标（已对齐）, 3. 架构与模块拆分, 4.1 后端 API (`@dita/api`), 4.2 前端接口、词典与样式 (`@dita/web`), 4. 分层改动明细, 5. 验证计划, Phase 16 补充方案：双语审校界面（Bilingual Review Workbench）UI 全面重构

### Community 231 - "PublishDialog.tsx"
Cohesion: 0.10
Nodes (35): HtmlThemeSelector(), applyPdfThemeSelection(), collectPdfLogoPaths(), defaultPdfThemeDraft(), normalizePdfAccentColor(), normalizePdfThemeDraft(), pdfThemeDraftFromProfile(), pdfThemeOptionsFromDraft() (+27 more)

### Community 235 - "IngestOutlinePlan"
Cohesion: 0.13
Nodes (28): RawPlanShape, DraftAndVerifyInput, DraftTopicInput, PlanOutlineInput, PostProcessTopicOptions, TopicAssetMapping, ValidateBatchInput, IngestJobOptions (+20 more)

### Community 239 - "warehouse.ts"
Cohesion: 0.10
Nodes (30): Adding a theme, Design tokens, Feature flags, File contract, HTML5 publish themes, Implementation notes, Runtime behaviour, AppendReusableFragmentOptions (+22 more)

### Community 247 - "topic"
Cohesion: 0.13
Nodes (15): createBareManual(), createSourceManual(), keysMap(), rootMap(), topic(), 4.1 生命周期与 5 步状态流水线, 4.2 顶部场景引导卡优先级（`deriveRecommendedScenario`）, 4.3 三大视角分栏与合法动作矩阵 (+7 more)

## Knowledge Gaps
- **15 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2382 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `workspace-api.ts` to `git-store.ts`, `ref_vitest`, `签入前置校验门禁与 AI 修复「检出—草稿—提交」闭环方案与测试案例`, `IdentityUser`, `translation-qa.ts`, `fop-font-config.ts`, `en/authoring-guide.md`, `zh/authoring-guide.md`, `semantic-engine.ts`, `validator-repair-agent.ts`, `workspace-fs.ts`, `ditaval.ts`, `前端 DITA 1.3 结构化写作合规实施说明`, `ai-translator.ts`, `overlay-workspace.ts`, `publish/routes.ts`, `translation/index.ts`, `en/architecture.md`, `en/features.md`, `fragment-splice.ts`, `zh/architecture.md`, `zh/features.md`, `App.tsx`, `4. Non-Negotiable Engineering Invariants`, `e2e-ai-live.mts`, `PDF theme assets (Phase 15)`, `Changelog`, `converter.ts`, `topic`, `map-tree-utils.ts`, `glossary-codec.ts`, `MessageKey`, `parseXml`, `MergeService`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `httpError()` (e.g. with `Added` and `5. REST API 契约设计`) actually correct?**
  _`httpError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `translation-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06672519754170325 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `useI18n` to `translation-api.ts`, `git-store.ts`, `outline-model.ts`, `TranslationFilesTab.tsx`, `help-sections.ts`, `AddTargetLanguageDialog.tsx`, `TranslationCenterPage.tsx`, `BilingualReviewPage.tsx`, `desktop-settings-ui.test.tsx`, `pdf-theme-model.ts`, `VisualEditor.tsx`, `ThemePreviewModal.tsx`, `TranslationQueueTab.tsx`, `web/package.json`, `index.tsx`, `ingest-api.ts`, `NewKeyDialog.tsx`, `semantic-indexer.ts`, `TopicAuthoringGuide.tsx`, `workbench-ux-optimization.test.tsx`, `App.tsx`, `checkin-validation-ui.test.tsx`, `map-tree-utils.ts`, `WorkbenchHubPage.tsx`, `SideBySideView.tsx`, `PublishDialog.tsx`, `MessageKey`, `ReviewHeader.tsx`, `html-theme-model.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `git-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05311871227364185 - nodes in this community are weakly interconnected._
- **Why does `useI18n()` connect `useI18n` to `translation-api.ts`, `git-store.ts`, `outline-model.ts`, `TranslationFilesTab.tsx`, `help-sections.ts`, `AddTargetLanguageDialog.tsx`, `TranslationCenterPage.tsx`, `getRawAttr`, `BilingualReviewPage.tsx`, `desktop-settings-ui.test.tsx`, `pdf-theme-model.ts`, `VisualEditor.tsx`, `ThemePreviewModal.tsx`, `TranslationQueueTab.tsx`, `index.tsx`, `ingest-api.ts`, `NewKeyDialog.tsx`, `semantic-indexer.ts`, `TopicAuthoringGuide.tsx`, `workbench-ux-optimization.test.tsx`, `App.tsx`, `checkin-validation-ui.test.tsx`, `useVisualEditorView`, `map-tree-utils.ts`, `WorkbenchHubPage.tsx`, `PublishDialog.tsx`, `MessageKey`, `html-theme-model.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._