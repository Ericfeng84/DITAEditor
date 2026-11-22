# Changelog

DITAEditor 的重要变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.1.0] — 2026-11-22

Phase 7 交付：独立静态官网 `@dita/site`、零后端浏览器交互式 DITA 1.3 沙箱与中英双语文档站；工作台侧代码零改动，
单容器镜像不包含官网产物。全仓测试 231 项全绿（`@dita/core` 81 / `@dita/api` 28 / `@dita/web` 92 / `@dita/site` 30）。

### Added

- **`apps/site`（`@dita/site`）静态站**：Astro 5（`output: 'static'`）+ React 19 Islands + Tailwind CSS 4（`@theme`
  设计令牌 + 手写组件样式）+ Shiki + Pagefind；`astro.config.ts` 复用 `browserStreamStubPlugin()`，并保留
  `vendor-codemirror` / `vendor-prosemirror` / `vendor-xml-core` / `vendor-react` 手动分块。
- **双语首页（`/` · `/en/`）**：Hero、真实工作台多 Tab 展台（`client:visible`）、CCMS/Markdown 可验证事实对照表、
  首页「改一个字只变一行 XML」微沙箱、六大能力深度展台、深色架构全景（HTML/CSS，零图片依赖）、Docker / pnpm / AI
  三条快速启动路径与 CTA。
- **浏览器内交互式沙箱（`/playground` · `/en/playground`）**：真实 `@dita/core` 解析/序列化/ProseMirror 映射/CALS/
  Keyspace/DITAVAL；4 个场景预设；可视化 / 双栏 / XML 源码三态；良构错误拦截并阻止切回可视化；DITAVAL 三态投影与
  Flag 着色；`keyref` 空元素以键值 chip 内联显示解析结果；诊断卡（元素数、未知标签、往返幂等、行列）；
  行级 Diff 抽屉与 XML 一键复制。
- **中英双语文档站（`/docs/*` · `/en/docs/*`）**：Astro Content Collections 6×2 篇对称文档（简介、Docker 快速开始、
  本地开发与 DITA-OT 字体、功能导览、AI 接入与安全边界、架构参考），页内 TOC 滚动高亮、代码复制按钮、上一篇/下一篇、
  「在 GitHub 上编辑」、Pagefind 双语检索（`Cmd/Ctrl+K`，`lang` 过滤器隔离中英文结果）。
- **SEO 与部署**：`@astrojs/sitemap`（含 `hreflang` 语言对）、per-locale OG 封面（1200×630）、favicon / apple-touch-icon、
  `robots.txt`、`SoftwareApplication` 结构化数据、中英双语 404（静态托管下 `/en/*` 未知路径自动落到英文 404）；`.github/workflows/deploy-site.yml` 在 `main` 推送时发布到
  GitHub Pages（`SITE_URL` / `SITE_BASE` 支持子路径）。

### Changed

- 根 `package.json` 与各 workspace 包版本升至 `1.1.0`；README / README.en 增加「官网与浏览器沙箱」章节、目录树与版本徽章。
- `AGENTS.md` 增补 `apps/site` 目录、站点命令与「静态站不变量」（双语对称、路径辅助函数、首屏不加载编辑器 chunk、
  Tailwind CSS-first、沙箱不得 mock）；路线图补齐 Phase 7。
- `docs/architecture-and-plan.md` Phase 7 状态更新为已完成；`docs/phase7-site-plan.md` 增补交付结果与两处实现差异说明
  （自研零依赖行级 Diff 取代 MergeView、HTML/CSS 架构图取代 SVG）。
- `Dockerfile` 保持不变：构建阶段仍只 `--filter @dita/core --filter @dita/web --filter @dita/api`，官网单独托管。

## [1.0.0] — 2026-11-22

DITAEditor 的首个正式发布（1.0）：Phase 0–6 全部落地，测试 201 项全绿（`@dita/core` 81 / `@dita/web` 92 /
`@dita/api` 28），采用 **MIT** 许可证，README 补充 Phase 6 与工作台截图。

### Phase 6 概要

覆盖架构基线中的 **Phase 6**：在严格的 DITA 无损往返、最小 Git Diff 与 Check-out 独占锁边界内，引入
LangChain.js 驱动的 AI 辅助写作、语义标签优化与三类错误修复，零外部中间件、零前端模型依赖。

### Added

- **`@dita/core` 片段级 AI 引擎（`packages/dita-core/src/ai/`）**
  - `extractTargetFragment`：支持 `element`（ProseMirror/源码元素路径）、`line-window`（行列区间）与
    `full-document` 三种定位模式，返回替换区间、目标 XML、周边上下文与源码行列。
  - `spliceAndVerifyAiXml`：把候选片段按偏移拼回原文件，再校验 XML 良构、ProseMirror 可转换、
    `DOCTYPE`/XML 声明保留与结构变化；失败时返回 `candidate-malformed` / `patched-malformed` /
    `pm-incompatible` / `doctype-missing` / `xml-declaration-missing` / `structure-invalid` 等原因，
    供服务端自动重试。仅 `element` 模式要求候选本身单根，行窗口与整篇以拼装结果为准。
  - `normalizeCandidateXml`：容错剥离 Markdown 代码围栏、`<dita_patch>`/`<dita_document>` 包装与重复 XML 声明，
    保留原始缩进；`buildDitaConstraintSummary` 输出模型可读的 DITA 结构约束。
- **后端 AI 模块（`apps/api/src/modules/ai/` + LangChain.js）**
  - `ChatOpenAI` 工厂支持自定义 `baseURL`/模型/温度/超时，默认 DeepSeek `deepseek-flash`，
    `streamUsage` 提取 `usage_metadata`，`AbortSignal` 全链路取消。
  - `POST /api/ai/stream` SSE：`meta` / `delta` / `retry` / `proposal` / `error` / `done` 六类事件，
    15s 心跳，客户端断开（`req.raw` `aborted` 或响应提前 close）即中止模型流。
  - 任务类型 `ask` / `authoring` / `optimize_tags` / `fix_error`；XML 校验失败自动附带错误原因重试（默认 2 次）。
  - 上下文构建器按预算裁剪 Keyspace、路径索引、DITAVAL 条件值与诊断清单，返回 `contextBadges` 透明展示。
  - SQLite `ai_settings`（单例、Key 掩码、DB 优先于环境变量）与 `ai_usage_logs`（调用人/任务/文件/模型/状态/
    重试/token/耗时），`GET /api/ai/usage` 汇总按天/任务/用户/模型；仅 `Admin` 可写配置与查看全员用量。
- **前端 AI 工作台（`apps/web/src/ai/`）**
  - `AiAssistantPanel`（右侧检视区「AI」页签）：任务切换、目标徽标、上下文徽标、项目上下文开关、
    流式输出、重试提示、提案卡片与 Diff 确认；`AiSettingsDialog` 管理端点/模型/Key/参数/连通性测试与用量。
  - 入口整合：行内气泡栏「AI 改写 / 询问」、源码 XML 错误横幅「AI 修复」、问题面板与严格校验弹窗逐条修复，
    请求始终携带当前未保存缓冲区与精确 `AiTargetSpec`。
  - `resolveAiApplyMode` 落实锁规则（直接应用 / 检出并应用 / 仅预览）；可视化应用保持单个 ProseMirror
    transaction 以保留撤销历史，源码应用为单次替换。
- **验证与工具**
  - `apps/api/scripts/e2e-ai-live.mts`：真实端点端到端脚本（健康检查 → 连接测试 → ask → authoring 无损落盘 →
    源码修复 → 用量与权限），已对私有 OpenAI 兼容代理跑通（14.5s，全绿）。
  - 真实 socket 级 SSE 回归测试（`apps/api/test/phase6-ai-sse-socket.test.ts`），覆盖
    `req.raw` `close` 误判导致的空流回归。

### Changed

- `@dita/core` `findRootElementStartOffset` 导出，供片段定位器在 `slimdom-sax-parser` 根元素位置偏差时校正。
- `@dita/core` 版本常量与各包版本升至 `1.0.0`。
- 前端用量面板字段与 `GET /api/ai/usage` 实际载荷对齐（`calls` / `byDay[].day` / `byTask[].taskType` /
  `byUser[]` / `byModel[].model`），并在 `@dita/api` 增加载荷键名断言，防止再次出现前后端字段漂移导致的
  设置弹窗崩溃；AI 面板在手动打开页签或移动光标后发送时重新计算靶向，模型名在首次请求前即显示，
  Temperature 显示按两位小数归一，密钥清除提示更正为 `DEEPSEEK_API_KEY`。
- AI 面板新增「靶向范围」切换（`片段` / `整篇 Topic`）并默认整篇：一句话即可起草或重写完整 Topic
  （`full-document` 模式，系统保留 XML 声明与 DOCTYPE、拒绝改动根元素），气泡工具栏/诊断等显式选区入口
  自动切到片段；`apps/api/scripts/e2e-ai-live.mts` 增加整篇改写真实端点验收步骤。
- README / AGENTS.md / 架构基线补齐 Phase 6 能力、环境变量（`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`、
  `DEEPSEEK_API_KEY`、`AI_TIMEOUT_MS`、`AI_MAX_CONTEXT_CHARS`）与 `/api/ai/*` 接口说明。

- 交互打磨（设计反馈）：发布入口从顶栏移入左侧 Map 树面板（发布对象恒为当前 Root Map）；
  右侧检查器「AI」页签移到第一位，文档区右下角新增 AI 浮动按钮（未配置时带琥珀点）；
  顶栏移除「AI」与「属性」按钮（设置与用量保留在 AI 面板齿轮），折叠按钮改由面板自身提供，
  折叠后顶栏出现「展开」按钮，Map 节点检查器同样可折叠；源码模式下检查器不再自动隐藏，AI 页签可用；
  顶栏右侧顺序调整为「问题 → 身份切换 → 保存」。

### Fixed

- AI 「修改差异」对话框的「应用到编辑器」按钮点击无效：`DiffViewer` 的 `flex-1` 根节点位于普通块级容器中，
  CodeMirror `MergeView` 按内容高度撑开并覆盖对话框底部按钮区。现固定 `h-full min-h-0 flex-1 flex-col overflow-hidden`
  并给对话框主体加 `overflow-hidden`，附静态渲染断言回归测试。
- 折叠已打开的 AI 面板后浮动 AI 按钮随之隐藏、无法再次展开：浮动按钮改为判断「AI 面板是否真的可见」
  （`aiPanelOpen && showRightInspector && inspectorTab === 'ai'`）。
- `POST /api/ai/stream` 曾返回 200 空流：Fastify 的 `req.raw` 在请求体读取完毕即触发 `close`，
  被误判为客户端断开；改为监听 `aborted` 与响应 `close`（且 `writableEnded` 时忽略）。

## [0.7.0] — 2026-11-22

覆盖架构基线中的 **Phase 5**：由 `@dita/api` 直接调度 DITA-OT 4.x CLI，打通官方 DITA 1.3 严格校验、
HTML5 / 中文 PDF 异步发布、SSE 构建日志与单容器部署，零 Java 业务代码、零 Redis / PostgreSQL 依赖。

### Added

- **DITA-OT 4.x 运行时与严格校验（Phase 5）**
  - `apps/api/src/modules/dita-ot/`：`dita` CLI 探测（`--version`、版本缓存、`DITA_CMD` / `DITA_OT_HOME`）、
    子进程调度（进程组超时强杀、`AbortSignal` 取消、stdout/stderr 双流保留）与 DOTJ/DOTX、Xerces
    `file:line:col`、`file:` URL 日志解析，统一归一化为工作区相对 POSIX 路径。
  - `POST /api/validate/strict` + `GET /api/validate/runtime`：使用 `--validate=yes --processing-mode=strict`
    对选中 Topic/Map 或整个 Root Map 执行官方 DITA 1.3 DTD/RNG 校验；Root Map 上下文保证
    `keyref` / `conkeyref` / `conref` 正常解析，独立主题校验将缺少键上下文的 `DOTJ046E` 降级为警告。
  - 顶栏与问题面板新增「DITA-OT 严格校验」，签入对话框支持在提交前对选中文件预检；结果按错误/警告
    分类并支持点击跳转到源码行列。
- **零外部中间件异步发布流水线**
  - SQLite `publish_jobs` 表（含增量列迁移）持久化任务；进程内 `PublishQueue` 并发限流、排队/运行中取消、
    超时强杀、服务重启把中断任务标记失败并按保留天数清理历史产物。
  - 发布前复制当前分支工作区快照（排除 `.git` / `node_modules` / 构建目录）隔离构建，未签入的已保存修改
    同样进入构建；`build.log` 落盘，支持按偏移读取与 `/api/publish/jobs/:id/events` SSE 实时日志。
  - HTML5 构建成功后打包为 store-only ZIP（UTF-8 文件名），提供 `/preview/*` 在线预览与 ZIP 下载；
    PDF 自动查找产物并按标题命名下载，`artifact?inline=1` 支持内嵌预览。
  - REST：`/api/publish/runtime`、任务列表/创建/详情/取消、日志、SSE、预览与产物下载；只读角色可查看
    历史但创建/取消返回 403，取消仅限作者或管理员。
- **纯 XML Noto CJK 中文 PDF 插件**
  - `dita-ot-plugins/com.ditaeditor.pdf-cjk/`：`plugin.xml` + XML Catalog（`org.dita.pdf2.catalog.relative`）+
    DITA-OT 4 新版 `cfg/fo/font-mappings.xml` + `fop.xconf`，映射 Noto Sans / Serif / Mono CJK 的
    SC/JP/KR 字型与粗细；发布时通过 `--customization.dir` 优先加载仓库插件，避免 DITA-OT 4 Catalog
    顺序被默认 `font-mappings.xml` 覆盖。
  - 每次 PDF 构建按 `DITAEDITOR_NOTO_CJK_DIR` 生成 job 级 `fop.xconf` 并传入 `--args.fo.userconfig`；
    实测 PDF 嵌入 NotoSansCJKsc / NotoSerifCJKsc / NotoSansMonoCJKsc。
- **前端发布工作台**
  - 顶栏「发布」对话框：Root Map / HTML5-PDF 切换 / DITAVAL / 标题、运行时状态、发布历史、任务详情、
    构建日志流、HTML5 预览、PDF/ZIP 下载与取消；发布/签名后自动刷新历史。
  - `publish-api.ts` / `publish-store.ts` / `PublishDialog.tsx` / `JobLogViewer.tsx` /
    `StrictValidationDialog.tsx`，并接入 `WorkbenchHeader`、`ProblemsPanel`、`CheckinDialog` 与 `App`。
- **单容器部署与文档**
  - 单 `Dockerfile`：Node 22 构建 + 运行镜像内置 Temurin JRE 21、DITA-OT 4.2.1、Noto CJK 字体与插件；
    生产模式由 `@dita/api` 直接托管 `apps/web/dist`，`/data` 卷持久化工作区、SQLite、worktree 与发布产物。
  - `docker-entrypoint.sh` 首次启动播种示例项目；`.dockerignore` 精简构建上下文；README / README.en
    新增 Docker 单容器、本地源码 + 本机 DITA-OT、仅编辑三种安装方式，以及发布对话框、严格校验结果、
    中文 PDF 输出三张 Phase 5 界面截图与发布 API / 环境变量说明。
  - 新增 `apps/api/test/phase5-publish.test.ts`：假 `dita` 可执行文件端到端覆盖运行时探测、DOTJ/DOTX 与
    `file:` URL 归一化、严格校验成功/失败/只读放行、Root Map 上下文与 `DOTJ046E` 降级、HTML5 ZIP
    与预览、PDF 下载、慢任务取消、历史排序与 DITAVAL 工作区边界。全仓 **132/132** Vitest 测试通过。

### Changed

- 发布与严格校验统一使用 `--validate=yes`（裸 `--validate` 不会开启 DITA-OT 校验）。
- 示例项目 `product-manual.ditamap` / `admin-book.bookmap` 不再引用故意非法的
  `references/specialized-passthrough.dita`，避免演示发布被严格校验拦截；该文件仍保留用于编辑器无损测试。
- 版本号统一升级至 `0.7.0`，品牌副标题更新为 `DITA 1.3 · Phase 5`。

### Known limitations

- DITA-OT 严格校验依赖本机或容器内已安装的 DITA-OT 4.x；未安装时接口返回 503 并在 UI 提示，
  Docker 镜像已内置。
- PDF 排版仍可能出现 DITA-OT / FOP 对 SVG `auto-start-reverse`、`table-layout="auto"` 等非阻断警告。
- 发布历史按 `(project, branch)` 隔离；跨分支查看需先切换分支。HTML5 预览随保留期清理而失效。

[0.7.0]: https://github.com/Ericfeng84/DITAEditor/releases/tag/v0.7.0

## [0.6.0] — 2026-11-21

覆盖架构基线中的 **Phase 4**：零外部依赖的本地 Git 版本管理、SQLite + Drizzle 轻量身份与三档角色，
以及 Check-out 独占锁与可视化版本对比闭环。

### Added

- **本地 Git 与版本对比（Phase 4）**
  - `simple-git` 本地仓库自动初始化（`.gitignore` + 首个提交）与绑定，分支按 `git worktree` 隔离，
    切换分支自动重定向工作区且不复制项目；支持分支新建、项目与单文件提交历史、指定版本文件读取。
  - 基于 CodeMirror 6 `MergeView` 的工作区改动 / 任意两版本可视化 Diff，签入前预览差异。
  - 左侧「版本」面板：分支切换与新建、检出锁、工作区改动、提交历史与快速差异入口。
- **轻量身份与权限**
  - SQLite + Drizzle ORM（`better-sqlite3`）持久化作者身份、仓库、检出锁与解锁备份，零外部数据库依赖。
  - 工具栏免密码身份切换（管理员 / 编辑者 / 只读），前端对只读身份与未检出文件自动禁用可视化/源码编辑；
    服务端对保存、创建、重命名、删除、上传与 Git 操作强制校验角色与锁归属。
- **Check-out 独占锁**
  - 以 `(project, branch, file_path)` 唯一约束实现同文件互斥，不同文件与不同分支互不阻塞。
  - 检出加锁、编辑草稿保存、仅提交本人检出且有改动的文件并在签入后自动释放锁。
  - 取消检出回滚到 `HEAD`；释放锁保留草稿；管理员强制解锁会把当前内容与补丁写入 `lock_backups`。
- **测试与文档**
  - 新增 `apps/api/test/phase4-git-locks.test.ts` 端到端覆盖身份角色、Git 初始化、同文件互斥/异文件并行、
    签入提交、历史 Diff、跨分支隔离、撤销检出与管理员强制解锁备份；新增 `apps/web/test/lock-helpers.test.ts`
    覆盖管理员/编辑者/只读与跨作者锁的编辑权限投影。全仓 **126/126** Vitest 测试通过。

### Changed

- 保存接口 `PUT /api/files/content` 及文件创建/目录/重命名/删除/上传接口增加身份与检出锁授权；
  既有 API 测试默认以管理员身份运行。
- 顶栏新增身份切换器，品牌副标题更新为 `DITA 1.3 · Phase 4`；左侧边栏新增「版本」页签。

### Known limitations

- Phase 4 仅实现本地 Git，不包含 GitHub / GitLab / Gitee OAuth、PAT 与 PR/MR 工作流。
- Phase 5（Java 21 Worker + Xerces2/Jing + DITA 1.3 Catalog + DITA-OT 4.x 发布、BullMQ + SSE、Docker Compose）尚未实现。

[0.6.0]: https://github.com/Ericfeng84/DITAEditor/releases/tag/v0.6.0

## [0.5.0] — 2026-11-21

首个里程碑版本，覆盖架构基线中的 **Phase 0–3**：无损 XML 内核、双模式 Topic 编辑器、
可视化 Map/Bookmap 工作台，以及 Keys / Conref / DITAVAL 单一信息源语义引擎。

### Added

- **`@dita/core` 无损 XML 内核（Phase 0）**
  - `slimdom` + `slimdom-sax-parser` + `fontoxpath` 构建同构 DITA XML 内核，解析时记录源码起止行列号。
  - 往返零丢失：XML 声明、`<!DOCTYPE>`（含 PUBLIC/SYSTEM 与内部子集）、注释、处理指令、CDATA、
    `xml:*` / `xmlns:*` / `ditaarch:*` 命名空间，以及元素原始属性顺序（`rawAttrs`）。
  - 幂等确定性序列化（`roundTrip(roundTrip(xml)) === roundTrip(xml)`），仅改动文本时不扰动其他节点格式。
  - 10 份复杂 DITA 1.3 黄金往返测试样本（`packages/dita-core/test/fixtures/`）。
  - 原生 ProseMirror Schema 与无损 `slimdom ⇄ PM Doc` 转换：行内元素建模为 inline node 而非 mark，
    `xml_text_block` 承载混合内容，未知/特化标签透传为 `unknown_block` / `unknown_pre_block` /
    `unknown_inline` / `unknown_inline_block`。
  - OASIS CALS 表格适配（`cals_colspec` 显式子节点、`namest`/`nameend`/`morerows` 与
    `colspan`/`rowspan` 互转、多 `tgroup` 保护），并支持 `<simpletable>`。
- **双模式 Topic 编辑器（Phase 1）**
  - ProseMirror 可视化结构化编辑：上下文感知 `/` 插入菜单、选区悬浮气泡工具栏、块级操作手柄与块间 `+` 插块、
    三种标签渲染模式（无标签 / 标签 / 含属性）。
  - CodeMirror 6 XML 源码编辑：DITA 1.3 标签/属性智能补全、实时良构性 Lint、源码格式化。
  - Source → Visual 切换保护：`checkXmlWellFormed()` 校验失败时拦截切换并定位 `{ line, column }`。
  - 右侧属性检查器（保持原始 XML 属性顺序）、条件属性编辑器、可点击元素面包屑。
- **可视化 Map / Bookmap 工作台（Phase 2）**
  - `react-arborist` Map 树：拖拽调整 `topicref` / `mapref` / `topichead` / `chapter` / `keydef` 层级与顺序，
    右键按模板新建并挂载 Topic、挂载已有文件、编辑属性、查看 Map 源码，原位保留 `<reltable>`、`<topicmeta>`、注释与 PI。
  - 多 Tab 编辑、未保存追踪、单文件/全部保存、还原基线，底部项目级诊断面板
    （XML 良构错误、断链 `href`、循环 `<mapref>`、缺失图片、未定义 `keyref`、非法/循环 `conref`、`.ditaval` 语法错误）。
  - Fastify 本地工作区文件 CRUD 与 multipart 资源接口、POSIX 相对路径工具、
    `samples/demo-dita-project/` 示例工程。
- **单一信息源语义引擎（Phase 3）**
  - Root Map BFS 键空间（`keydef` / `keyref` / `keyscope`，First Definition Wins 冲突裁决与作用域隔离）。
  - `conref` / `conkeyref` / `conrefend` 解析与 DFS 循环引用检测、特化标签兼容性校验。
  - `.ditaval` 解析与三态投影（全部 / 淡化 / 隐藏）联动 Map 树与可视化编辑器，Flag 标记高亮，全程不改写 XML。
  - 增量语义索引 API（`/api/semantics/*`）、Keys 面板、插入 Keyref 对话框、条件属性编辑器、
    CodeMirror 6 语义自动补全。
- **复用的可视化入口**：右侧检视区新增「复用」tab（`ConrefReusePanel`），按 Key 或相对路径挑选带 `id` 的
  可复用元素，实时展示循环校验与内容预览，并支持「新建复用元素」与「绑定到当前元素」两种写入方式。

### Changed

- 工作台顶栏精简为品牌、视图切换（可视化 / 双栏对比 / XML 源码）、保存、诊断与属性入口；
  工作区切换与 Root Map 选择器移入左侧文件面板，DITAVAL 条件过滤配置与三态投影开关移入 Map 树面板。
- 替换原「插入复用」模态框为检视区 tab，`@dita/core` 复用逻辑抽为
  `apps/web/src/components/conref-reuse-model.ts` 并通过单元测试覆盖。
- 可视化标签药丸（tag pill）开合对齐改用 `vertical-align: middle`，修复行内元素开/闭标签基线错位。

### Removed

- 移除 `apps/web/src/components/InsertConrefDialog.tsx` 模态框及其状态管理，改由右侧检视区「复用」tab 承担。

### Known limitations

- Phase 5（Java 21 Worker + Xerces2/Jing + DITA 1.3 Catalog + DITA-OT 4.x 发布、BullMQ + SSE、Docker Compose）尚未实现。
- 当前为单机本地工作区模式，无多用户协作与文件锁。

[0.5.0]: https://github.com/Ericfeng84/DITAEditor/releases/tag/v0.5.0
