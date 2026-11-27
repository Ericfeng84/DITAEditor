# Graph Report - DITAEditor  (2026-11-28)

## Corpus Check
- 548 files · ~570,159 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 80 file(s) not represented in the graph (top: .dita 30, .css 25, (none) 6)

## Summary
- 6189 nodes · 17812 edges · 213 communities (206 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 978 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ce82d001`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ingest-service.ts
- requestJson
- ai-service.ts
- AttributesPanel.tsx
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
- PublishDialog.tsx
- env
- dita-core/src/index.ts
- parser-settings-service.ts
- site/package.json
- lock-service.ts
- scripts
- AppShell.tsx
- BaseLayout.astro
- theme-runtime.js
- fop-font-config.ts
- deploy-site.yml
- electron-builder.yml
- assignment-service.ts
- manual-registry-service.ts
- with
- useI18n
- locales.ts
- Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理
- UiLocale
- getPmNodeRawAttrs
- WorkspaceSemanticIndexer
- 4. 核心元素写作细则
- translate
- pdf-theme-model.ts
- dita-plan-builder.ts
- devDependencies
- DITA Concept（概念）主题编写规范
- WorkbenchHubPage.tsx
- ingest-api.ts
- workspace-fs.ts
- VisualEditor.tsx
- key-management-integration.test.tsx
- DITA Reference（参考）主题编写规范
- lucide-react
- converter.ts
- fragment-locator.ts
- web/package.json
- phase13-overlay-versioning.test.ts
- html-themes.ts
- SourceEditor.tsx
- DITA 通用 Topic（基本主题）编写规范
- GitManager
- xmlToPmDoc
- Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档
- editor-store/types.ts
- ai-prompt.ts
- HttpError
- AiDiffDialog
- en/architecture.md
- dita-rules.ts
- fragment-splice.ts
- DraftService
- zh/architecture.md
- Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板
- outline-model.ts
- SearchModal.astro
- docker-entrypoint.sh
- warehouse.ts
- GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）
- publish/routes.ts
- devDependencies
- workspace-api.ts
- en/dita-spec.md
- getTagLabel
- environment
- HomePage.astro
- publish-profiles.ts
- en/ai-setup.md
- Language
- zh/ai-setup.md
- compilerOptions
- Changelog
- warehouse.ts
- ingest-parsers.test.ts
- main.ts
- publish-api.ts
- ai-store.ts
- 设计原则
- MiniRoundTripDemo.tsx
- ingest-routes.test.ts
- en/getting-started.md
- playground-presets.ts
- HTML5 publish themes
- AiAssistantPanel.tsx
- en/local-development.md
- zh/getting-started.md
- publish-service.ts
- Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）
- migration.ts
- zh/local-development.md
- IngestService
- DocsIndex.astro
- git-restore-revert.test.ts
- scripts
- Phase 13 补充修复方案：还原此版本（Restore）与撤销该提交（Revert）前端无响应根因与测试构建
- paths.ts
- TopicAuthoringGuide.tsx
- parseXml
- planner-agent.ts
- docs/README.md
- settings-and-migration.test.ts
- validator-repair-agent.ts
- Hugging Face Spaces 部署指南（Docker 单容器方案）
- createTopicTemplate
- IngestUploadStep.tsx
- parser.ts
- html-theme-model.ts
- sync-hf-space.sh
- api/src/index.ts
- site/src/i18n/index.ts
- Domain Docs
- DocumentIngestDialog.tsx
- Issue tracker: Local Markdown
- web/src/ingest/types.ts
- 3.1 后端 Git 与覆盖层安全（`@dita/api`）
- Phase 14 规划与实施蓝图：文档智能导入与 AI Agent 撰写校验闭环（Docling + MarkItDown → Markdown → DITA）
- dita-core/src/i18n/locale.ts
- checkin-validation-ui.test.tsx
- ParserSettingsTab.tsx
- scripts
- InsertElementMenu.tsx
- e2e-ai-live.mts
- cloudbuild.yaml
- lock-helpers.ts
- map-tree-utils.ts
- publish/routes.ts
- DocsLayout.astro
- help-sections.ts
- ConrefReusePanel.tsx
- GitHub Pages 免费部署指南（官网 + 离线三栏工作台）
- preload.ts
- index.tsx
- ensure-electron.mjs
- DITAEditor 文档导航
- ref_react
- IngestPlanReviewStep.tsx
- vite-env.d.ts
- desktop/package.json
- getRawAttr
- astro.config.ts
- env
- map-edit-lock-guard.test.ts
- build-desktop
- with
- en/authoring-guide.md
- zh/authoring-guide.md
- ai-output-parser.ts
- tag
- en
- desktop/tsconfig.json
- Model each Manual as an independent workspace and Git repository
- release-desktop.yml
- Scope backend workspace and semantic index per request by Manual ID and branch
- phase13-web-stores-and-ui.test.tsx
- steps
- ref_vitest
- attach-to-release
- en/features.md
- DITAEditor
- DITAEditor
- Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks
- Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay
- com.ditaeditor.pdf-cjk
- deploy-cloudrun.sh
- XmlAttributeEntry
- theme-enhancer.ts
- ingest-service.ts
- semantic-engine.ts
- dita-runtime.ts
- PublishDialog.tsx
- topicGuideTree.ts
- checkXmlWellFormed
- rules-and-templates.test.ts
- git-restore-revert.test.tsx
- UnsavedChangesDialog.tsx
- Design principles
- ditaval.ts
- 4. Non-Negotiable Engineering Invariants
- Core capabilities
- Phase 15 规划与实施蓝图：PDF 发布样式主题与多套专业印刷排版模板
- zh/dita-spec.md
- 核心能力
- ai-fragment.test.ts
- App.tsx
- ai-workbench.test.ts
- DITAEditor 内置演示手册
- commitWithModifyAndDelete
- git
- xml-bridge.ts
- checkXmlWellFormed
- zh/features.md
- QuickStartTabs.tsx
- ref_node_fs
- 核心能力
- Getting started

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 196 edges
2. `httpError()` - 105 edges
3. `App()` - 92 edges
4. `requestJson()` - 91 edges
5. `createServer()` - 88 edges
6. `lucide-react` - 87 edges
7. `checkXmlWellFormed()` - 81 edges
8. `GitManager` - 77 edges
9. `DraftService` - 76 edges
10. `IdentityUser` - 70 edges

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
- 2-file cycle: `packages/dita-core/src/model/dita-attr-docs.ts -> packages/dita-core/src/model/dita-rules.ts -> packages/dita-core/src/model/dita-attr-docs.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/files.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/map-tree.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`
- 3-file cycle: `apps/web/src/store/editor-store/index.ts -> apps/web/src/store/editor-store/slices/tabs.ts -> apps/web/src/store/git-store.ts -> apps/web/src/store/editor-store/index.ts`

## Hyperedges (group relationships)
- **Phase 0 Lossless XML Core** — docs_architecture_and_plan_dita_core_shared_kernel, docs_architecture_and_plan_lossless_xml_roundtrip, docs_architecture_and_plan_passthrough_nodes, docs_architecture_and_plan_cals_table_adapter, docs_architecture_and_plan_dual_mode_state_machine [EXTRACTED 1.00]

## Communities (213 total, 7 thin omitted)

### Community 0 - "ingest-service.ts"
Cohesion: 0.08
Nodes (14): layer1(), MARKDOWN, minimalStrictResult(), posix(), Role, roleOf(), ScriptedModel, scriptedModel() (+6 more)

### Community 1 - "requestJson"
Cohesion: 0.06
Nodes (66): DiffDialogProps, checkResolutionXml(), MergeDialog(), MergeDialogProps, XmlCheck, cancelCheckout(), checkinFiles(), CheckinOptions (+58 more)

### Community 2 - "ai-service.ts"
Cohesion: 0.03
Nodes (109): aiSettings, AiSettingsRow, aiUsageLogs, apiCatalogue(), apiMessagesEn, apiMessagesZh, apiT(), CATALOGUES (+101 more)

### Community 3 - "AttributesPanel.tsx"
Cohesion: 0.09
Nodes (52): AttributeField(), AttributeFieldControlContext, AttributeFieldProps, AttributeFilterBar(), AttributeFilterBarProps, AttributeGroupSection(), AttributeGroupSectionProps, attributeMatchesQuery() (+44 more)

### Community 4 - "zh-CN.ts"
Cohesion: 0.06
Nodes (28): TOPIC_AUTHORING_GUIDES, TopicGuideType, enAi, enAssignments, enCollab, enCommon, enDesktop, enEditor (+20 more)

### Community 5 - "Core Package Manifest"
Cohesion: 0.09
Nodes (27): dependencies, fontoxpath@^3.30.0, prosemirror-model@^1.25.0, slimdom@^4.0.2, slimdom-sax-parser@^1.5.3, devDependencies, typescript@^5.8.0, vitest@^3.1.0 (+19 more)

### Community 6 - "api/package.json"
Cohesion: 0.06
Nodes (40): dependencies, better-sqlite3@^13.2.0, @dita/core@workspace:*, fastify@^5.2.0, @fastify/cors@^11.4.3, @fastify/multipart@^9.4.0, @langchain/core@^1.4.2, @langchain/openai@^1.8.4 (+32 more)

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

### Community 17 - "PublishDialog.tsx"
Cohesion: 0.14
Nodes (11): PDF_PAGE_RATIO, COMPACT, EDITORIAL, HTML_TECH, HTML_VANILLA, htmlSelectorProps(), makeDescriptor(), pdfSelectorProps() (+3 more)

### Community 18 - "env"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME, HAS_HF_TOKEN, HF_SPACE_REPO, HF_TOKEN (+25 more)

### Community 19 - "dita-core/src/index.ts"
Cohesion: 0.10
Nodes (27): insertInlineImage(), toggleInlineDitaElement(), EMPTY_ATTRS, makeNode(), textNode(), buildReuseSkeletonAttrs(), DROPPED_ON_REUSE, REUSE_EXCLUDED_BLOCK_TAGS (+19 more)

### Community 20 - "parser-settings-service.ts"
Cohesion: 0.07
Nodes (45): IngestParserSettingsRow, DitaRuntimeInfo, DitaRuntimeOptions, HttpError, requireMerge(), assertDoclingMode(), assertEngineChoice(), assertTableMode() (+37 more)

### Community 21 - "site/package.json"
Cohesion: 0.05
Nodes (52): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+44 more)

### Community 22 - "lock-service.ts"
Cohesion: 0.05
Nodes (52): drizzle-orm@^0.45.4, DitaDatabase, DitaDatabaseHandle, migrateManualPublishProfiles(), migrateManuals(), migratePublishJobs(), openDatabase(), AiUsageLogRow (+44 more)

### Community 23 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 24 - "AppShell.tsx"
Cohesion: 0.10
Nodes (26): AppShell(), EditorState, rootEl, AppRoute, BASE, currentRoute, EditorRoute, emit() (+18 more)

### Community 25 - "BaseLayout.astro"
Cohesion: 0.08
Nodes (23): 4.10 Versioning: Clean Baseline + Personal Draft Overlay (`Phase 13`), platforms, Props, dict, Props, getDictionary(), LOCALE_HTML_LANG, LOCALE_OG_LOCALE (+15 more)

### Community 26 - "theme-runtime.js"
Cohesion: 0.07
Nodes (80): absolutePath(), activateOnpage(), addSkipLink(), applyMode(), assembleLayout(), boot(), buildOnpage(), buildPager() (+72 more)

### Community 27 - "fop-font-config.ts"
Cohesion: 0.05
Nodes (67): 4.12 PDF Font Embedding (FOP 2.9 + Noto CJK), defaultNotoFontDir(), resolveNotoFontDir(), bestRecord(), decodeName(), decodeUtf16Be(), decodeUtf32Be(), extractFontFace() (+59 more)

### Community 28 - "deploy-site.yml"
Cohesion: 0.05
Nodes (40): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+32 more)

### Community 29 - "electron-builder.yml"
Cohesion: 0.05
Nodes (40): appId, asar, asarUnpack, copyright, directories, app, buildResources, output (+32 more)

### Community 30 - "assignment-service.ts"
Cohesion: 0.07
Nodes (32): fileLocks, TopicAssignmentRow, topicAssignments, ACTIVE_STATUSES, ALL_STATUSES, AssignmentListQuery, AssignmentPerson, AssignmentScope (+24 more)

### Community 31 - "manual-registry-service.ts"
Cohesion: 0.05
Nodes (32): ManualRow, WorkspaceScaffold, repositoryIdFor(), DEFAULT_MAX_CACHED_SESSIONS, firstHeader(), firstQuery(), IDLE_SESSION_TTL_MS, ManualContextResolver (+24 more)

### Community 32 - "with"
Cohesion: 0.05
Nodes (43): concurrency, cancel-in-progress, group, runs-on, steps, env, DEEPSEEK_API_KEY, GCP_AR_REPO (+35 more)

### Community 33 - "useI18n"
Cohesion: 0.05
Nodes (59): SOURCE_KEYS, TopicAuthoringGuideSpec, TABS, arrayBufferToBase64(), RELEVANT_EXTENSIONS, SCAFFOLD_OPTIONS, WorkspaceDialog(), WorkspaceRowBody() (+51 more)

### Community 34 - "locales.ts"
Cohesion: 0.15
Nodes (25): anchor(), columns, dict, home, Props, year, dict, isDocs (+17 more)

### Community 35 - "Phase 6 实施文档：DeepSeek AI 辅助文档编写、标签优化与错误处理"
Cohesion: 0.09
Nodes (22): 1.1 已确认设计边界（Non-Negotiables & Non-Goals）, 1) 全局共享系统底稿（`BASE_DITA_SYSTEM_PROMPT`）, 1. 目标与边界, 1) 配置与审计 REST API, 2) 核心流式端点：`POST /api/ai/stream`, 2. 端到端架构与数据流, 2) 能力 1：`authoring`（辅助文档编写）任务提示词, 3.1 Drizzle 表结构（`apps/api/src/db/schema.ts`） (+14 more)

### Community 36 - "UiLocale"
Cohesion: 0.07
Nodes (39): FilterGroupedAttributesOptions, sanitizeCssColor(), collectDitaDecorations(), createConrefWidgetDom(), createBlockGapInserterDom(), createDitaDecorationsPlugin(), createChevronCapSvg(), createDitavalFlagPillDom() (+31 more)

### Community 37 - "getPmNodeRawAttrs"
Cohesion: 0.16
Nodes (27): exitCodeblockToParagraph(), handleDitaBackspace(), buildDitaKeymapPlugins(), DitaKeymapCallbacks, mergeCalsCellDown(), mergeCalsCellRight(), mergeCellContents(), splitCalsCell() (+19 more)

### Community 38 - "WorkspaceSemanticIndexer"
Cohesion: 0.09
Nodes (21): realpathSyncOrNull(), summarizeDitaval(), WorkspaceSemanticIndexer, 1.1 四层对象模型, 1.2 三层读视图定义, 1.3 五条工程不变量, 1. 核心对象模型与三层视图, 2.1 仓库身份与初始化 (+13 more)

### Community 39 - "4. 核心元素写作细则"
Cohesion: 0.08
Nodes (23): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 前置条件（`<prereq>`）— 可选 (+15 more)

### Community 40 - "translate"
Cohesion: 0.12
Nodes (18): defaultInstruction(), targetLabel(), BLOCK_TAG_ELEMENT_MAP, INLINE_TAG_ELEMENT_MAP, renderConrefPreviewDom(), renderDomNode(), XmlLikeElement, XmlLikeNode (+10 more)

### Community 41 - "pdf-theme-model.ts"
Cohesion: 0.11
Nodes (36): applyPdfThemeSelection(), clampText(), collectPdfLogoPaths(), defaultPdfThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizePdfAccentColor(), normalizePdfThemeDraft() (+28 more)

### Community 42 - "dita-plan-builder.ts"
Cohesion: 0.09
Nodes (50): buildGeneratedFiles(), defaultAssetPlacements(), materializeIntoExistingManual(), materializeNewManual(), normalizePlanForExistingManual(), normalizePosix(), readAssetBytes(), resolveExistingManualAssetPlacements() (+42 more)

### Community 43 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, jsdom@^31.0.1, @testing-library/dom@^10.4.2, @testing-library/react@^16.3.3, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0 (+7 more)

### Community 44 - "DITA Concept（概念）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文容器（`<conbody>`）与分段（`<section>`） (+9 more)

### Community 45 - "WorkbenchHubPage.tsx"
Cohesion: 0.05
Nodes (77): AiSettingsDialog(), AiSettingsDialogProps, AiSettingsTab, formatNumber(), ManualAssignmentsPanelProps, DesktopPluginBanner(), TOOL_LABELS, DesktopSettingsDialog() (+69 more)

### Community 46 - "ingest-api.ts"
Cohesion: 0.11
Nodes (22): applyScopeHeaders(), API_BASE, apiUrl(), getCurrentUserId(), abortError(), appendField(), createIngestJob(), dispatchIngestEvent() (+14 more)

### Community 47 - "workspace-fs.ts"
Cohesion: 0.05
Nodes (54): collectFileNodes(), countMapTreeNodes(), DITAVAL_TEMPLATE, ditavalSummaryFor(), fileExistsInOverlay(), findRenamedAwayDraft(), findUserDraft(), insertFileNode() (+46 more)

### Community 48 - "VisualEditor.tsx"
Cohesion: 0.07
Nodes (76): resolveTaskModelForDocument(), acceptsBlockContent(), BLOCK_CONTAINER_TAGS, BlockConvertMode, blockIndexInContainer(), BlockMovePlan, buildBlockHandleTarget(), buildConvertedBlock() (+68 more)

### Community 49 - "key-management-integration.test.tsx"
Cohesion: 0.08
Nodes (38): InsertKeyrefDialog(), KeyspacePanel(), samePath(), LeftSidebarProps, BindingKind, buildKeydefPreviewXml(), buildNewKeyOptions(), escapeXmlAttr() (+30 more)

### Community 50 - "DITA Reference（参考）主题编写规范"
Cohesion: 0.11
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 语法定义块（`<refsyn>`） (+9 more)

### Community 51 - "lucide-react"
Cohesion: 0.07
Nodes (54): EditorTabBar(), TAB_TYPE_BADGE, IdentitySwitcher(), IdentitySwitcherProps, LocaleSwitcher(), OPTIONS, ReadOnlyBanner(), SaveControls() (+46 more)

### Community 52 - "converter.ts"
Cohesion: 0.12
Nodes (30): CalsCursor, CalsCellSpan, CalsColSpec, CalsRowModel, CalsTgroupModel, extractElementAttrs(), parseCalsColSpecs(), parseCalsTgroup() (+22 more)

### Community 53 - "fragment-locator.ts"
Cohesion: 0.18
Nodes (22): 1) 增强 `widenAiFixTarget()`（`packages/dita-core/src/ai/fragment-locator.ts`）, AiFixWindowOptions, buildContextWindow(), buildLineIndex(), DEFAULT_AI_CONTEXT_LINES, DEFAULT_AI_FIX_WINDOW_MAX_LINES, DEFAULT_AI_MAX_CONTEXT_CHARS, DEFAULT_AI_MAX_TARGET_CHARS (+14 more)

### Community 54 - "web/package.json"
Cohesion: 0.04
Nodes (64): dependencies, @codemirror/autocomplete@^6.20.4, @codemirror/commands@^6.11.1, @codemirror/lang-xml@^6.1.0, @codemirror/language@^6.13.1, @codemirror/lint@^6.9.8, @codemirror/merge@^6.12.3, @codemirror/search@^6.7.2 (+56 more)

### Community 55 - "phase13-overlay-versioning.test.ts"
Cohesion: 0.08
Nodes (19): ADMIN, App, branches(), CapturedPrompt, Fixture, flattenFilePaths(), freshProbes(), git() (+11 more)

### Community 56 - "html-themes.ts"
Cohesion: 0.07
Nodes (46): ACCENT_DARK_TEXT, ACCENT_LIGHT_TEXT, accentScale(), cleanPath(), cleanText(), contrastRatio(), findRepoRoot(), getHtmlTheme() (+38 more)

### Community 57 - "SourceEditor.tsx"
Cohesion: 0.10
Nodes (17): ditaXmlCompletionSource, sourceEditorTheme, createDitaXmlLinter(), lintDocument(), describeStructureIssue(), StructureIssueLike, getTaskContentModelSetting(), buildConrefDragSnippet() (+9 more)

### Community 58 - "DITA 通用 Topic（基本主题）编写规范"
Cohesion: 0.12
Nodes (17): 1.1 适用范围, 1.2 核心编写原则, 1. 概述与基本原则, 2. 文件命名与 ID 规范, 3. 标准标签层级结构, 4.1 标题（`<title>`）— 必填, 4.2 简述（`<shortdesc>`）— 强烈推荐, 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`） (+9 more)

### Community 59 - "GitManager"
Cohesion: 0.09
Nodes (24): httpError(), changeLabel(), GitBranchInfo, GitFileChange, GitFileDiff, GitManager, GitManagerOptions, GitStatusSummary (+16 more)

### Community 60 - "xmlToPmDoc"
Cohesion: 0.07
Nodes (30): DEFAULT_SNIPPET_TAG, DITA_ELEMENT_ID_PATTERN, findBoldPos(), makeSnapshot(), buildState(), buildTaskState(), makeKeywordSnapshot(), createState() (+22 more)

### Community 61 - "Phase 7 规划与实施蓝图：项目官网、交互式 DITA 沙箱与快速上手文档"
Cohesion: 0.09
Nodes (21): 1.1 已确认设计决策（Non-Negotiables & Non-Goals）, 1. 目标、定位与决策边界, 2.1 技术栈选型, 2.2 系统依赖与边界图, 2.3 关键工程约束与避坑设计, 2. 技术选型与架构设计, 3.1 色彩与对比规范, 3.2 排版与版式规范 (+13 more)

### Community 62 - "editor-store/types.ts"
Cohesion: 0.10
Nodes (30): FileContentResult, EditorTabBarProps, FileExplorerPanelProps, NewTopicDialogProps, PublishDialogProps, WorkspaceDialogProps, MapBufferState, RootMapSwitcherProps (+22 more)

### Community 63 - "ai-prompt.ts"
Cohesion: 0.18
Nodes (19): AiProjectContext, AiPromptInput, buildAiMessages(), buildDiagnosticsBlock(), buildHistoryMessages(), buildHumanPrompt(), buildSystemPrompt(), buildTaskGuide() (+11 more)

### Community 64 - "HttpError"
Cohesion: 0.12
Nodes (14): parseDetails(), toView(), VersionAuditService, isInside(), MergeConflictContent, MergeConflictPreview, MergeInput, MergePreview (+6 more)

### Community 65 - "AiDiffDialog"
Cohesion: 0.09
Nodes (26): 4.7 AI Assistance (`Phase 6`), AiProposal, AiDiffDialog(), AiDiffDialogProps, diffTheme, DiffViewer(), DiffViewerProps, displayRevisionLabel() (+18 more)

### Community 66 - "en/architecture.md"
Cohesion: 0.14
Nodes (13): Concurrency model, `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, Editor data flow, Further reading, Package boundaries (+5 more)

### Community 67 - "dita-rules.ts"
Cohesion: 0.09
Nodes (21): localizedTagLabel(), labelOf(), 3.1 成员表：父子能不能放, ATTRIBUTE_DESCRIPTIONS_ZH, ATTRIBUTE_LABELS_ZH, BODY_BLOCKS, CONBODY_BLOCKS, DITA_CATEGORY_LABELS (+13 more)

### Community 68 - "fragment-splice.ts"
Cohesion: 0.13
Nodes (27): AI assistance, AI 辅助, errorMessage(), element(), 1. `@dita/core` — `src/ai/`, 2. DB (`apps/api/src/db`), 3. REST contract, Phase 6 AI Assistance — Implementation Contract (+19 more)

### Community 69 - "DraftService"
Cohesion: 0.09
Nodes (10): FileLockRow, WorkingDraftRow, IdentityUser, computeContentHash(), DraftService, extensionOf(), isBinaryDraft(), normalizeExtension() (+2 more)

### Community 70 - "zh/architecture.md"
Cohesion: 0.14
Nodes (13): `@dita/api`, `@dita/core`, `@dita/site`, `@dita/web`, 全局视图, 包边界, 发布链路, 存储 (+5 more)

### Community 71 - "Phase 12 规划与实施蓝图：HTML5 发布样式主题与多套专业文档模板"
Cohesion: 0.10
Nodes (20): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 HTML5 样式模板设计矩阵, 3.1 为什么将主题资产存放在 `dita-ot-plugins/html5-themes/`？, 3.2 `Html5ThemeEnhancer` 关键实现细节, 3. 总体架构与发布增强流水线, 4.1 SQLite 数据表：`manual_publish_profiles`, 4.2 TypeScript 类型契约 (+12 more)

### Community 72 - "outline-model.ts"
Cohesion: 0.06
Nodes (62): CategoryIcon(), collectExpandableIds(), DocumentOutlinePanel(), DocumentOutlinePanelProps, flattenVisibleRows(), OutlineRow, OutlineDropBlockReason, OutlineDropEvaluation (+54 more)

### Community 73 - "SearchModal.astro"
Cohesion: 0.15
Nodes (12): dict, hits, input, loadPagefind(), overlay, PagefindHit, PagefindModule, Props (+4 more)

### Community 75 - "warehouse.ts"
Cohesion: 0.11
Nodes (29): suggestSnippetId(), Implementation notes, AppendReusableFragmentOptions, AppendReusableFragmentResult, appendReusableFragmentToTopicXml(), applyFragmentIdentity(), asciiIdTokens(), BODY_WRAPPER_BY_ROOT (+21 more)

### Community 76 - "GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）"
Cohesion: 0.12
Nodes (17): 1. 创建隔离的试用项目并启用 API, 1. 在 GCP 创建最小权限部署账号与 Workload Identity Federation, 2. 一键构建并部署到 Cloud Run, 2. 在 GitHub 仓库配置 Actions Variables, 3. 配置 Artifact Registry 自动清理策略（必做省钱项）, GCP Cloud Run 低成本试用部署指南（子路径反代 + Push 自动部署）, 一、总体架构与低成本设计原理, 三、首次部署步骤（GCP Cloud Run） (+9 more)

### Community 77 - "publish/routes.ts"
Cohesion: 0.11
Nodes (29): htmlThemeIdSchema, PDF_MARGINS, PDF_PAGE_SIZES, PdfFontFamily, pdfThemeOptionsSchema, asRecord(), mergePdfThemeOptions(), mergeThemeOptions() (+21 more)

### Community 78 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @astrojs/check@^0.9.12, pagefind@^1.6.0, @types/react@^19.0.0, @types/react-dom@^19.0.0, typescript@^5.8.0, vitest@^3.1.0, @types/react (+5 more)

### Community 79 - "workspace-api.ts"
Cohesion: 0.17
Nodes (25): buildSnapshotFromMemoryFiles(), createInMemoryDemoWorkspace(), createWorkspaceProject(), fetchFileContent(), fetchParsedDitaval(), fetchSemanticContext(), fetchWorkspace(), fetchWorkspaceDiagnostics() (+17 more)

### Community 80 - "en/dita-spec.md"
Cohesion: 0.10
Nodes (19): flag(), Authoritative references, Common block elements, Common inline elements, DITAVAL conditional processing, Frequent mistakes, Maps, topicref and keys, Ordered content models (+11 more)

### Community 81 - "getTagLabel"
Cohesion: 0.18
Nodes (10): 3.1 入口, 3.2 交互与无障碍, 3.4 外链与离线降级, 一、问题与目标, 三、应用内帮助中心, 二、已确认的八个决策, 五、验收, 六、明确不做 (+2 more)

### Community 82 - "environment"
Cohesion: 0.06
Nodes (34): INSTALL_MARKITDOWN, args, context, dockerfile, build, container_name, depends_on, environment (+26 more)

### Community 83 - "HomePage.astro"
Cohesion: 0.16
Nodes (12): dict, jsonLd, layerRows, Props, screenshotUrl(), showcaseImages, pickText(), digest() (+4 more)

### Community 84 - "publish-profiles.ts"
Cohesion: 0.12
Nodes (25): manualPublishProfiles, DitaDiagnostic, DEFAULT_HTML_THEME_ID, HtmlThemeId, HtmlThemeOptions, isHtmlThemeId(), PdfCustomizationInput, PdfThemePreviewInput (+17 more)

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
Nodes (25): [0.5.0] — 2026-11-21, [0.6.0] — 2026-11-21, [0.7.0] — 2026-11-22, [1.1.0] — 2026-11-22, [1.3.0] — 2026-11-24, [1.4.0] — 2026-11-25, [1.6.0] — 2026-11-27, Added (+17 more)

### Community 90 - "warehouse.ts"
Cohesion: 0.11
Nodes (31): DITA_BLOCK_TAGS, DITA_INLINE_TAGS, DITA_MAP_CONTAINER_NODE_TAGS, DITA_MAP_ROOT_TAGS, DITA_MAP_TREE_NODE_TAGS, DITA_STRUCTURAL_ELEMENT_CONTAINERS, DITA_TOPIC_ROOT_TAGS, DITA_WHITESPACE_PRESERVE_TAGS (+23 more)

### Community 91 - "ingest-parsers.test.ts"
Cohesion: 0.05
Nodes (78): toParserAvailability(), ASSET_SCHEME, assetIdFor(), copyReferencedImages(), CopyReferencedImagesOptions, CopyReferencedImagesResult, findProducedMarkdown(), highestAssetIndex() (+70 more)

### Community 92 - "main.ts"
Cohesion: 0.14
Nodes (25): activeSettings, ApiServer, applyRuntimeOptions(), buildApplicationMenu(), buildStatus(), changeDataDir(), computeDesktopPaths(), defaultDataDir() (+17 more)

### Community 93 - "publish-api.ts"
Cohesion: 0.10
Nodes (40): HtmlThemeSelectorProps, PdfThemeSelectorProps, cancelPublishJob(), createPublishJob(), CreatePublishJobInput, fetchHtmlThemes(), fetchPdfThemes(), fetchPublishJob() (+32 more)

### Community 94 - "ai-store.ts"
Cohesion: 0.10
Nodes (39): abortError(), AiStreamHandlers, dispatchFrame(), fetchAiConfig(), fetchAiUsage(), parseAiSseFrame(), ParsedSseFrame, saveAiConfig() (+31 more)

### Community 95 - "设计原则"
Cohesion: 0.20
Nodes (9): 下一步, 为谁而写, 单一信息源, 并发靠锁，不靠 CRDT, 明确的边界, 标准 XML 优先, 盒子里有什么, 结构化，但不笨重 (+1 more)

### Community 96 - "MiniRoundTripDemo.tsx"
Cohesion: 0.17
Nodes (16): MiniRoundTripDemo(), OutputTab, SAMPLE_TARGETS, SampleKey, compactDiff(), computeLineDiff(), DiffLine, DiffLineType (+8 more)

### Community 97 - "ingest-routes.test.ts"
Cohesion: 0.08
Nodes (15): ADMIN, App, createApp(), Fixture, multipart(), ONE_TOPIC_MARKDOWN, Role, SAMPLE_ROOT (+7 more)

### Community 98 - "en/getting-started.md"
Cohesion: 0.18
Nodes (10): Desktop app (macOS / Windows, no Docker), First run, Import your own project, Key environment variables, Next steps, Ports and volumes, Requirements, Start with two commands (+2 more)

### Community 99 - "playground-presets.ts"
Cohesion: 0.15
Nodes (7): MINI_DEMO_XML, PLAYGROUND_PRESETS, PlaygroundDitavalProfile, PlaygroundKeyspaceFixture, PlaygroundPreset, PlaygroundPresetId, LocalizedString

### Community 100 - "HTML5 publish themes"
Cohesion: 0.40
Nodes (4): Adding a theme, Feature flags, HTML5 publish themes, Runtime behaviour

### Community 101 - "AiAssistantPanel.tsx"
Cohesion: 0.15
Nodes (20): AiPanelIntent, AI_FIX_MALFORMED_CONTEXT_LINES, AI_FIX_WINDOW_MAX_LINES, AI_TARGET_SCOPE_LABELS, AiTargetScope, resolveScopeTarget(), STRUCTURE_DIAGNOSTIC_SOURCES, AiDiagnosticContext (+12 more)

### Community 102 - "en/local-development.md"
Cohesion: 0.20
Nodes (9): Before committing, Database and identities, Debugging notes, Environment variables, Install and run, Next steps, Quality gates, Repository tour (+1 more)

### Community 103 - "zh/getting-started.md"
Cohesion: 0.18
Nodes (10): 一条命令启动, 下一步, 关键环境变量, 前置条件, 导入自己的项目, 常见问题, 桌面版（macOS / Windows，免 Docker）, 端口与数据卷 (+2 more)

### Community 104 - "publish-service.ts"
Cohesion: 0.06
Nodes (31): PublishJobRow, PublishQueue, PublishQueueOptions, EXCLUDED_SNAPSHOT_ENTRIES, findFirstPdf(), isInside(), normalizeSourceMode(), parseDiagnostics() (+23 more)

### Community 105 - "Phase 13 规划与实施蓝图：Git 干净基线 + 个人草稿叠加层（版本管理重构与合并闭环）"
Cohesion: 0.14
Nodes (14): ① `working_drafts`（新增）, ② `publish_jobs`（幂等 `ALTER TABLE` 增量迁移）, 3.1 SQLite 数据模型, 3.3 锁规则收口与签入原子闭环, 3.4 桌面端 / 外部编辑器改盘兼容, ③ `version_audit_logs`（新增）, 3. 核心底层机制设计, ④ `manuals`（增量迁移，Stage 3 保护分支配置） (+6 more)

### Community 106 - "migration.ts"
Cohesion: 0.19
Nodes (16): buildPrefixPairs(), checkpointDatabase(), DB_PATH_COLUMNS, migrateDesktopDataDir(), MigrateDesktopDataDirOptions, MigrateDesktopDataDirResult, PrefixPair, pruneCopiedWorktrees() (+8 more)

### Community 107 - "zh/local-development.md"
Cohesion: 0.20
Nodes (9): 下一步, 前置条件, 安装与启动, 提交前检查, 数据库与身份, 环境变量, 目录速览, 调试建议 (+1 more)

### Community 108 - "IngestService"
Cohesion: 0.15
Nodes (9): IngestJobRow, IngestService, isTerminal(), normalizeIngestOptions(), parseJson(), planTopicNodes(), collectExistingPaths(), ManualSession (+1 more)

### Community 109 - "DocsIndex.astro"
Cohesion: 0.11
Nodes (11): astro@^5.18.2, bySlug, dict, groups, Props, collections, docs, Locale (+3 more)

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
Cohesion: 0.23
Nodes (14): augmentDesktopPath(), checkDirectoryWritable(), DESKTOP_DATA_SUB_ITEMS, DesktopPathInput, DesktopRuntimePaths, EXISTING_DATA_MARKERS, inspectDataDirCandidate(), isStrictlyInside() (+6 more)

### Community 114 - "TopicAuthoringGuide.tsx"
Cohesion: 0.14
Nodes (18): DEFAULT_DIR_FOR_TYPE, NewTopicDialog(), NewTopicMountContext, TOPIC_OPTIONS, GROUP_LABEL_KEYS, GuideTreeNode(), isTopicGuideType(), readInitialExpanded() (+10 more)

### Community 115 - "parseXml"
Cohesion: 0.12
Nodes (47): tempDirs, topicrefPath(), 3.1 `@dita/core` 同构内核, applyElementAttrsPreservingOrder(), collapseFormattingWhitespace(), computeElementPath(), countCommentsAndPis(), deleteMapNode() (+39 more)

### Community 116 - "planner-agent.ts"
Cohesion: 0.10
Nodes (37): buildPlannerSystemPrompt(), buildPlannerUserPrompt(), coercePlan(), coerceTopic(), defaultCreateKeysMap(), describeError(), enforceTargetMode(), extractJsonCandidate() (+29 more)

### Community 118 - "settings-and-migration.test.ts"
Cohesion: 0.21
Nodes (13): DESKTOP_SETTINGS_FILENAME, DesktopSettings, desktopSettingsFileExists(), DesktopSettingsPatch, desktopSettingsPath(), loadDesktopSettings(), OPTIONAL_PATH_KEYS, readPathSetting() (+5 more)

### Community 119 - "validator-repair-agent.ts"
Cohesion: 0.06
Nodes (69): assertInsideStaging(), buildFingerprint(), buildSystemPrompt(), buildUserPrompt(), defineTool(), describeError(), DitaOtRepairAgentResult, groupByFile() (+61 more)

### Community 120 - "Hugging Face Spaces 部署指南（Docker 单容器方案）"
Cohesion: 0.22
Nodes (9): Hugging Face Spaces 部署指南（Docker 单容器方案）, 已内置的 Hugging Face 兼容适配, 常见问题排查, 持久化存储与休眠行为说明, 方式 A：通过 GitHub Actions 一键自动同步（推荐）, 方式 B：本地命令行一键推送, 第一步：在 Hugging Face 创建空白 Docker Space, 第三步：环境变量与安全建议（必读） (+1 more)

### Community 121 - "createTopicTemplate"
Cohesion: 0.15
Nodes (18): buildTemplateContent(), buildScaleDitaProject(), interpolate(), dropState(), formatMessage(), createMapTemplate(), CreateMapTemplateOptions, escapeText() (+10 more)

### Community 122 - "IngestUploadStep.tsx"
Cohesion: 0.18
Nodes (17): DocumentIngestDialogProps, ENGINE_OPTIONS, IngestUploadStep(), IngestUploadStepProps, ReadinessBadge(), ReadinessRow(), ReadinessState, TOPIC_TYPES (+9 more)

### Community 123 - "parser.ts"
Cohesion: 0.19
Nodes (13): baseAttrs(), makeBlockContainerSpec(), makeInlineNodeSpec(), makeTextBlockSpec(), nodes, lineColumnToOffset(), parseSaxesError(), PositionTrackedSlimdomNode (+5 more)

### Community 124 - "html-theme-model.ts"
Cohesion: 0.12
Nodes (27): applyThemeSelection(), clampText(), collectThemeAssetPaths(), defaultThemeDraft(), FEATURE_KEYS, LOGO_EXTENSIONS, normalizeAccentColor(), normalizeThemeDraft() (+19 more)

### Community 126 - "api/src/index.ts"
Cohesion: 0.04
Nodes (105): UserRow, firstHeaderValue(), RequestLike, resolveRequestLocale(), ApiMessageKey, ApiMessageParams, createServer(), createLangChainModelFactory() (+97 more)

### Community 127 - "site/src/i18n/index.ts"
Cohesion: 0.24
Nodes (10): en, DICTIONARIES, isLocale(), DEFAULT_LOCALE, LOCALES, zh, docsRoot, here (+2 more)

### Community 128 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 129 - "DocumentIngestDialog.tsx"
Cohesion: 0.25
Nodes (14): DocumentIngestDialog(), messageOf(), IngestResultStep(), IngestResultStepProps, LayerStatus(), baseName(), approveIngestJob(), cancelIngestJob() (+6 more)

### Community 130 - "Issue tracker: Local Markdown"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: Local Markdown, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 131 - "web/src/ingest/types.ts"
Cohesion: 0.16
Nodes (16): IngestProgressStep(), IngestProgressStepProps, LOG_TONE, TOPIC_TONE, TopicIcon(), TopicStatus, INGEST_PROGRESS_STAGES, INGEST_STEPS (+8 more)

### Community 132 - "3.1 后端 Git 与覆盖层安全（`@dita/api`）"
Cohesion: 0.18
Nodes (11): 3.1 后端 Git 与覆盖层安全（`@dita/api`）, 3.2 前端 API 客户端与状态管理（`@dita/web`）, 3.3 前端交互与双语文案（`@dita/web`）, 3. 详细改动设计, 修改 `apps/api/src/i18n/messages.ts`, 修改 `apps/api/src/modules/git/git-manager.ts`, 修改 `apps/api/src/modules/git/routes.ts`, 修改 `apps/web/src/components/GitPanel.tsx` (+3 more)

### Community 133 - "Phase 14 规划与实施蓝图：文档智能导入与 AI Agent 撰写校验闭环（Docling + MarkItDown → Markdown → DITA）"
Cohesion: 0.22
Nodes (9): 1. 目标与已确认架构决策, 2. 系统架构与路由策略, 4. 分阶段实施切片与验收矩阵, 5.1 一键启动（推荐：DITAEditor + Docling sidecar）, 5.2 精简单容器（不启用 MarkItDown）, 5.3 验收命令, 5. 部署形态与本地验证, Docling vs MarkItDown 智能路由矩阵 (+1 more)

### Community 134 - "dita-core/src/i18n/locale.ts"
Cohesion: 0.16
Nodes (10): COMMON_ATTRIBUTES, DEFAULT_UI_LOCALE, FormatMessageParams, isEnglishLocale(), SUPPORTED_UI_LOCALES, CATALOGUES, CoreMessageKey, coreMessagesEn (+2 more)

### Community 135 - "checkin-validation-ui.test.tsx"
Cohesion: 0.20
Nodes (9): useAiStore, AiAssistantPanel(), historyFromMessages(), toDiagnosticContext(), PROPOSAL, renderCheckin(), renderPanel(), WRITER (+1 more)

### Community 136 - "ParserSettingsTab.tsx"
Cohesion: 0.26
Nodes (11): DOCLING_MODES, ENGINE_OPTIONS, messageOf(), ParserSettingsTab(), RuntimeRow(), formatExtensions(), fetchIngestConfig(), IngestDoclingMode (+3 more)

### Community 137 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, dist, dist:mac, dist:win, postinstall, stage (+2 more)

### Community 138 - "InsertElementMenu.tsx"
Cohesion: 0.25
Nodes (10): InsertElementMenu(), Added, 1. 背景与设计目标, 2.1 四种常用操作路径, 2. 完整用户工作流与入口矩阵, 4. 测试覆盖, 内容复用工作流：复用仓库、片段创建与全入口交互设计, getElementDescription() (+2 more)

### Community 139 - "e2e-ai-live.mts"
Cohesion: 0.21
Nodes (13): apiRoot, check(), failures, here, log(), main(), PORT, readSse() (+5 more)

### Community 140 - "cloudbuild.yaml"
Cohesion: 0.18
Nodes (10): images, options, logging, steps, args, name, substitutions, _DITA_BASE_PATH (+2 more)

### Community 141 - "lock-helpers.ts"
Cohesion: 0.13
Nodes (20): InlineLockMenuProps, LockStatusBarProps, stateStyles, ReadOnlyBannerProps, toneStyles, InspectorTab, FileLock, IdentityRole (+12 more)

### Community 142 - "map-tree-utils.ts"
Cohesion: 0.08
Nodes (49): profilingBadgeClasses(), JobLogViewer(), JobLogViewerProps, DitavalTopicSummary, VisualEditorProps, VisualEditorSubHeaderProps, useI18n(), buildCompositeMapTree() (+41 more)

### Community 143 - "publish/routes.ts"
Cohesion: 0.04
Nodes (82): 4.13 PDF Publish Themes (`Phase 15`), assertWellFormed(), fileUri(), FONT_MAPPINGS_RELATIVE, LogoResolution, PdfCustomizationResult, preparePdfCustomizationDir(), renderCatalog() (+74 more)

### Community 144 - "DocsLayout.astro"
Cohesion: 0.15
Nodes (11): paths, Props, dict, groups, index, jsonLd, links, path (+3 more)

### Community 145 - "help-sections.ts"
Cohesion: 0.05
Nodes (52): close(), BLOCK_ELEMENTS, blockTexts(), buildElementRows(), buildHelpSections(), buildLinkItems(), buildOrderedContainerRows(), buildQuickstartSteps() (+44 more)

### Community 146 - "ConrefReusePanel.tsx"
Cohesion: 0.12
Nodes (25): buildReuseAttrValue(), ConrefAttrName, filterReusableElements(), KeyBoundTopic, listKeyBoundTopics(), ConrefReusePanel(), MODES, ConrefDragGhost (+17 more)

### Community 147 - "GitHub Pages 免费部署指南（官网 + 离线三栏工作台）"
Cohesion: 0.21
Nodes (7): DITAEditor — Web DITA 1.3 Workbench (Live Demo), Public Demo Notes / 公共演示说明, What You Can Try Here / 可体验的核心能力, GitHub Pages 免费部署指南（官网 + 离线三栏工作台）, 一、部署后的访问路径与能力边界, 三、技术细节（自动适配）, 二、一键启用步骤（约 2 分钟）

### Community 148 - "preload.ts"
Cohesion: 0.29
Nodes (7): DesktopDirInspection, bridge, ChangeDataDirInput, DataDirSwitchMode, DesktopPreferencesPatch, DesktopRuntimeStatus, DitaDesktopBridge

### Community 149 - "index.tsx"
Cohesion: 0.14
Nodes (22): dateTimeFormatter(), dateTimeFormatters, formatDateTime(), formatRelativeTime(), relativeFormatter(), relativeFormatters, applyDocumentLocale(), DEFAULT_UI_LOCALE (+14 more)

### Community 150 - "ensure-electron.mjs"
Cohesion: 0.26
Nodes (11): DESKTOP_ROOT, __dirname, extractWithExtractZip(), extractWithNativeUnzip(), getArch(), getPlatformPath(), isHealthy(), log() (+3 more)

### Community 151 - "DITAEditor 文档导航"
Cohesion: 0.33
Nodes (6): DITAEditor 文档导航, 一、现行架构与设计（活文档 · 唯一真相源）, 三、部署与运维指南, 二、架构决策记录（ADR）, 五、历史阶段规划与专项方案归档（只读参考）, 四、DITA 1.3 编写参考与工程资产

### Community 152 - "ref_react"
Cohesion: 0.09
Nodes (23): NewMapDialog(), XrefImageDialog(), XrefImageDialogProps, SourceEditor(), BlockConvertOption, BlockHandle(), BlockHandleProps, MODE_LABEL_KEYS (+15 more)

### Community 153 - "IngestPlanReviewStep.tsx"
Cohesion: 0.25
Nodes (10): countTopics(), EDITABLE_TYPES, FlatNode, flatten(), IngestPlanReviewStep(), patchTopic(), pruneTopics(), TOPIC_TYPES (+2 more)

### Community 155 - "desktop/package.json"
Cohesion: 0.10
Nodes (27): dependencies, better-sqlite3@^13.2.0, @dita/api@workspace:*, description, devDependencies, electron@^35.2.0, electron-builder@^26.18.1, esbuild@^0.25.0 (+19 more)

### Community 156 - "getRawAttr"
Cohesion: 0.04
Nodes (37): BlockHandleTarget, hydrateEmptyContainerAtPos(), BlockGapOpenMenuPayload, InlineBubbleInfo, InlineBubbleToolbarProps, InsertElementChoice, InsertElementMenuProps, CalsColspecNodeView (+29 more)

### Community 157 - "astro.config.ts"
Cohesion: 0.12
Nodes (9): site, @astrojs/react@^4.4.2, @astrojs/sitemap@^3.7.6, vite@^6.2.0, @vitejs/plugin-react@^4.3.4, @astrojs/react, @astrojs/sitemap, vite (+1 more)

### Community 158 - "env"
Cohesion: 0.20
Nodes (10): DESKTOP_VERSION, RAW_APPLE_APP_SPECIFIC_PASSWORD, RAW_APPLE_ID, RAW_APPLE_TEAM_ID, RAW_CSC_KEY_PASSWORD, RAW_CSC_LINK, RAW_WIN_CSC_KEY_PASSWORD, RAW_WIN_CSC_LINK (+2 more)

### Community 159 - "map-edit-lock-guard.test.ts"
Cohesion: 0.32
Nodes (7): installServer(), makeBuffer(), makeLock(), OTHER_WRITER, seedWorkspace(), ServerOptions, WRITER

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

### Community 164 - "ai-output-parser.ts"
Cohesion: 0.08
Nodes (29): BASIC_XML_ENTITIES, createExplanationStreamFilter(), decodeBasicXmlEntities(), ExplanationStreamFilter, parseAiOutput(), ParsedAiOutput, stripExplanationTags(), issue() (+21 more)

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

### Community 171 - "phase13-web-stores-and-ui.test.tsx"
Cohesion: 0.16
Nodes (9): CURRENT_USER_STORAGE_KEY, ADMIN, ALL_USERS, makeCommit(), makeIdentity(), resetStores(), USER_A, USER_B (+1 more)

### Community 172 - "steps"
Cohesion: 0.38
Nodes (7): steps, steps, id, name, run, shell, uses

### Community 173 - "ref_vitest"
Cohesion: 0.04
Nodes (90): TaskModelSwitchProps, collectElementEntries(), countEntriesBefore(), evaluateOutlineDrop(), gapPosForElementIndex(), introducedSequenceViolation(), isOutlineContainer(), mapIssueCodeToReason() (+82 more)

### Community 174 - "attach-to-release"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, attach-to-release

### Community 175 - "en/features.md"
Cohesion: 0.14
Nodes (13): Collaboration and versioning, Conref, DITA maps, DITAVAL projection, Document outline and structural reordering, Dual-mode editing, Keyspace, Lossless round-trip and minimal diffs (+5 more)

### Community 176 - "DITAEditor"
Cohesion: 0.25
Nodes (8): DITAEditor, REST API 速览, 仓库目录结构, 官网、文档站与离线工作台, 界面预览, 目录, 系统架构与技术栈, 许可证

### Community 177 - "DITAEditor"
Cohesion: 0.25
Nodes (8): Architecture and technology stack, DITAEditor, License, Repository layout, REST API overview, Screenshots, Table of contents, Website, docs site and offline workbench

### Community 178 - "Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks

### Community 179 - "Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay

### Community 180 - "com.ditaeditor.pdf-cjk"
Cohesion: 0.40
Nodes (4): com.ditaeditor.pdf-cjk, Environment, Runtime prerequisites, The fallback table

### Community 182 - "XmlAttributeEntry"
Cohesion: 0.33
Nodes (7): RawAttributesSectionProps, CompositeMapTreeResult, 4.1 `@dita/core` 无损 Key XML 读写原语, DitaMapTreeNode, InsertMapNodeOptions, ParsedDitaMap, XmlAttributeEntry

### Community 183 - "theme-enhancer.ts"
Cohesion: 0.13
Nodes (30): DEFAULT_HTML_FEATURES, HtmlThemeFeatures, appendBodyClasses(), buildSearchEntry(), collapseWhitespace(), collectHtmlFiles(), copySharedAsset(), copyWorkspaceAsset() (+22 more)

### Community 184 - "ingest-service.ts"
Cohesion: 0.05
Nodes (67): ApiLocale, WorkspaceFileNode, DitaOtRepairAgentInput, RawPlanShape, ConcurrentDraftOptions, DraftAndVerifyInput, DraftTopicInput, DraftTopicResult (+59 more)

### Community 185 - "semantic-engine.ts"
Cohesion: 0.05
Nodes (71): SemanticContextResponse, buildSemanticIndex(), ConrefReusePanelProps, InsertKeyrefDialogProps, KeyspacePanelProps, TopicInspectorProps, SourceSemanticCompletionContext, SourceEditorProps (+63 more)

### Community 186 - "dita-runtime.ts"
Cohesion: 0.06
Nodes (50): DITA_FILE, DitaPathRoot, extractMessage(), fallbackDitaDiagnostic(), LOCATION_PATTERNS, LocationMatch, matchLocation(), normalizeDitaPath() (+42 more)

### Community 187 - "PublishDialog.tsx"
Cohesion: 0.14
Nodes (23): pdfThemeOptionsFromDraft(), PdfThemePreviewModal(), PdfThemePreviewModalProps, PreviewStatus, PreviewZoom, formatBytes(), formatDuration(), formatTime() (+15 more)

### Community 188 - "topicGuideTree.ts"
Cohesion: 0.13
Nodes (26): GuideTreeNodeProps, TagFacts(), TagFactsProps, buildChildChips(), buildNode(), buildTopicGuideTree(), EXPANDED_CONTAINERS, getAllowedChildren() (+18 more)

### Community 189 - "checkXmlWellFormed"
Cohesion: 0.11
Nodes (21): Adding a theme, Constraints, Import chain, Package layout, PDF theme assets (Phase 15), Tokens, What cannot be overridden, 5.1 `@dita/core` 单元测试 (+13 more)

### Community 190 - "rules-and-templates.test.ts"
Cohesion: 0.12
Nodes (15): DITA_ATTR_EXAMPLE_EN, DITA_ATTR_EXAMPLE_ZH, DITA_ATTR_USAGE_EN, DITA_ATTR_USAGE_ZH, DITA_ATTR_VALUE_LABELS, DITA_ATTRIBUTE_GROUP_META, DITA_ATTRIBUTE_GROUP_ORDER, DitaAttributeGroupMeta (+7 more)

### Community 191 - "git-restore-revert.test.tsx"
Cohesion: 0.13
Nodes (12): FileReply, HEAD_COMMIT, installFetchHub(), makeCommit(), makeHub(), makeIdentity(), makeSnapshot(), makeStatus() (+4 more)

### Community 192 - "UnsavedChangesDialog.tsx"
Cohesion: 0.33
Nodes (5): UnsavedChangesDialog(), UnsavedChangesDialogProps, 6.1 零依赖路由与页面壳层（`apps/web/src/router/`）, 6.4 数据新鲜度同步, 6. 前端架构、路由与交互设计

### Community 193 - "Design principles"
Cohesion: 0.20
Nodes (9): Design principles, Explicit boundaries, Locks, not CRDT, Next steps, Single sourcing, Standard XML first, Structured, not heavy, What is in the box (+1 more)

### Community 194 - "ditaval.ts"
Cohesion: 0.13
Nodes (20): PROFILING_BADGE_CLASSES, ProfilingAttrEditor(), ProfilingAttrEditorProps, ConditionGroup, createDitavalTemplate(), DITA_PROFILING_ATTRS, DitavalAction, DitavalFlagEndpoint (+12 more)

### Community 195 - "4. Non-Negotiable Engineering Invariants"
Cohesion: 0.11
Nodes (18): 1. Project Overview, 2. Repository Layout, 3.1 Desktop (`@dita/desktop`) runtime gotchas, 3. Build, Typecheck & Test Commands, 4.11 Document Ingest & Tool-Using DITA-OT Repair Agent (`Phase 14`), 4.1 Lossless XML Round-Trip & Minimal Git Diff, 4.2 ProseMirror Schema Rules (`@dita/core`), 4.3 Source ↔ Visual Transition Safety (+10 more)

### Community 196 - "Core capabilities"
Cohesion: 0.22
Nodes (9): 11. Manual workbench and topic assignment (Phase 10), 12. Document ingest and tool-using DITA-OT repair agent (Phase 14), 1. 100% lossless XML round-trip kernel (`@dita/core`), 2. Dual-mode topic editor (visual / split / XML source), 3. Document outline view and structural reordering (v1.5.0), 4. Visual DITA Map tree and multi-file workbench, 6. Local workspace, incremental semantic index, and asset backend (`@dita/api`), 7. Clean baseline, personal draft overlay and local Git (Phase 4 / Phase 13) (+1 more)

### Community 200 - "Phase 15 规划与实施蓝图：PDF 发布样式主题与多套专业印刷排版模板"
Cohesion: 0.14
Nodes (13): 1.1 已确认设计决策（Design Tree 共识清单）, 1. 目标、痛点与设计树共识, 2. 首批内置 PDF 排版模板设计矩阵, 3.1 为什么用 `--customization.dir` + XML Catalog，而不是安装插件？, 3.2 导入链的两个承重点, 3.4 PDF2 结构钩子覆写清单（`shared/xsl-base.xsl`）, 3. 总体架构与发布定制流水线, 4.1 SQLite 数据表 (+5 more)

### Community 201 - "zh/dita-spec.md"
Cohesion: 0.13
Nodes (18): Common attributes, 常用属性, 10. 相关测试, 1. 设计目标与三条硬约束, 2. 总体链路, 3. ① 规则数据层, 3.3 槽位语义, 3.4 Strict Task 与 General Task (+10 more)

### Community 202 - "核心能力"
Cohesion: 0.22
Nodes (9): 后端环境变量（`@dita/api`）, 快速开始, 方式一：Docker 单容器（推荐，开箱即用）, 方式三：桌面客户端（macOS Apple Silicon & Windows x64，轻量版）, 方式二：本地源码 + 本机 DITA-OT, 方式五：仅编辑 / 语义写作（不安装 DITA-OT）, 方式四：云端低成本试用部署（GCP Cloud Run + 子路径反代 + Push 自动部署）, 本机 DITA-OT 配置 (+1 more)

### Community 205 - "ai-fragment.test.ts"
Cohesion: 0.13
Nodes (15): 4.1 文件清单与核心函数, AiExtractOptions, AiFragmentExtraction, AiSpliceErrorCode, AiSpliceFailure, AiSpliceResult, AiSpliceSuccess, AiVerificationReport (+7 more)

### Community 206 - "App.tsx"
Cohesion: 0.04
Nodes (83): App(), AppProps, applyCheckinAiFix(), BLOCKING_ERROR_SOURCES, CheckinCandidate, CheckinDialog(), CheckinDialogProps, CheckinIssue (+75 more)

### Community 208 - "ai-workbench.test.ts"
Cohesion: 0.12
Nodes (28): hasAiProposalChanges(), isAiProposalStale(), isSameXmlBuffer(), normalizeBuffer(), resetAiStore(), AI_SELECTED_TEXT_LIMIT, buildDiagnosticFixTarget(), buildLineWindowAiTarget() (+20 more)

### Community 209 - "DITAEditor 内置演示手册"
Cohesion: 0.29
Nodes (6): DITAEditor 内置演示手册, 修改约定, 关于这个目录的 Git 仓库, 内容地图, 如何使用, 这份手册演示了什么

### Community 211 - "commitWithModifyAndDelete"
Cohesion: 0.60
Nodes (5): baselinePath(), commitWithModifyAndDelete(), readBaseline(), withTitleMarker(), writeBaseline()

### Community 213 - "git"
Cohesion: 0.40
Nodes (5): commitOnDisk(), git(), hasRevertHead(), headRevision(), porcelain()

### Community 216 - "xml-bridge.ts"
Cohesion: 0.36
Nodes (7): computeXmlLineDiffStats(), formatDitaXml(), SourceToVisualResult, syncSourceToVisual(), syncVisualToSource(), VisualToSourceResult, slimdomToPmDoc()

### Community 217 - "checkXmlWellFormed"
Cohesion: 0.10
Nodes (44): t(), createWorkspaceDir(), createWorkspaceFile(), deleteWorkspaceEntry(), renameWorkspaceEntry(), saveFileContent(), useEditorStore, createInitialEditorState() (+36 more)

### Community 223 - "zh/features.md"
Cohesion: 0.14
Nodes (13): Conref, DITA Map, DITAVAL 投影, OASIS CALS 表格, 协作与版本, 单一信息源, 双模编辑, 发布与严格校验 (+5 more)

### Community 225 - "QuickStartTabs.tsx"
Cohesion: 0.16
Nodes (11): Props, Props, Props, QuickStartTabs(), CAPABILITIES, Capability, FeatureIcon, QUICK_START_TABS (+3 more)

### Community 226 - "ref_node_fs"
Cohesion: 0.02
Nodes (62): ADMIN, App, createApp(), Fixture, git(), head(), SAMPLE_ROOT, tempDirs (+54 more)

### Community 228 - "核心能力"
Cohesion: 0.22
Nodes (9): 11. 手册工作台与 Topic 委派（Phase 10）, 12. 文档智能导入与工具化 DITA-OT 修复 Agent（Phase 14）, 1. 100% 无损 XML 往返内核（`@dita/core`）, 2. 双模式 Topic 编辑器（可视化 / 双栏对比 / XML 源码）, 3. 文档大纲视图与结构重排（v1.5.0）, 4. 可视化 DITA Map 树与多文件工作台, 6. 本地工作区、增量语义索引与资产后端（`@dita/api`）, 7. 干净基线 + 个人草稿叠加层与本地 Git（Phase 4 / Phase 13） (+1 more)

### Community 229 - "Getting started"
Cohesion: 0.22
Nodes (9): Backend environment variables (`@dita/api`), Getting started, Host DITA-OT setup, Option 1: Single-container Docker (recommended, zero setup), Option 2: Local source with host DITA-OT, Option 3: Desktop app (macOS Apple Silicon & Windows x64, lightweight), Option 4: Low-cost cloud trial (GCP Cloud Run + subpath reverse proxy + auto-deploy on push), Option 5: Editing and semantic authoring only (no DITA-OT) (+1 more)

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2008 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkXmlWellFormed()` connect `checkXmlWellFormed` to `requestJson`, `e2e-ai-live.mts`, `map-tree-utils.ts`, `publish/routes.ts`, `fop-font-config.ts`, `en/authoring-guide.md`, `zh/authoring-guide.md`, `ai-output-parser.ts`, `ref_vitest`, `workspace-fs.ts`, `en/features.md`, `semantic-engine.ts`, `HttpError`, `en/architecture.md`, `4. Non-Negotiable Engineering Invariants`, `fragment-splice.ts`, `Core capabilities`, `zh/architecture.md`, `zh/dita-spec.md`, `ai-fragment.test.ts`, `App.tsx`, `workspace-api.ts`, `ai-workbench.test.ts`, `xml-bridge.ts`, `checkXmlWellFormed`, `Changelog`, `zh/features.md`, `playground-presets.ts`, `核心能力`, `AiAssistantPanel.tsx`, `publish-service.ts`, `parseXml`, `validator-repair-agent.ts`, `parser.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `httpError()` (e.g. with `Added` and `5. REST API 契约设计`) actually correct?**
  _`httpError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0003`, `ADR-0002`, `../../tsconfig.base.json` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ingest-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.082010582010582 - nodes in this community are weakly interconnected._
- **Why does `3.5 防漂移规则` connect `help-sections.ts` to `getTagLabel`, `theme-runtime.js`, `fragment-splice.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `requestJson` be split into smaller, more focused modules?**
  _Cohesion score 0.0624048706240487 - nodes in this community are weakly interconnected._
- **Why does `astro` connect `DocsIndex.astro` to `BaseLayout.astro`, `site/package.json`, `astro.config.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._