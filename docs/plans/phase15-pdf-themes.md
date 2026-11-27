# Phase 15 规划与实施蓝图：PDF 发布样式主题与多套专业印刷排版模板

> **状态**：✅ 已完成并归档（见现行代码与 CHANGELOG）  
> **上游架构基线**：[architecture-and-plan.md](../architecture-and-plan.md)（Phase 0–14 已完成）  
> **目标形态**：发布弹窗在 PDF 模式下支持可视化挑选 **4 套专业印刷排版主题 + 原生默认兜底** · 免 DITA-OT 编译的实时样本预览 · 轻量排版选项（主色 / 纸张 / 字体 / 字号 / 页边距 / 封面副标题 / 页眉页脚 / Logo / 5 项结构开关）与按手册持久化默认配置 · **零 `dita install` 插件门槛**（Docker / 本机 / 桌面端一致可用）· 原生主题输出与 Phase 14 前逐字节一致

---

## 1. 目标、痛点与设计树共识

Phase 5 打通了 DITA-OT 4.x PDF2 发布链路，并用 `com.ditaeditor.pdf-cjk`（纯 XML 字体映射 + `fop.xconf`）解决了中文 PDF 字体缺字问题；Phase 12 又为 HTML5 产物补齐了 4 套专业主题。但 **PDF 侧始终只有 DITA-OT 原生外观**：A4 白纸、Serif 正文、无封面、无页眉页脚、标题层级仅靠字号区分，交付给客户或印刷前往往需要人工二次排版。

Phase 15 在不破坏 **标准 DITA XML 唯一真相源**、**零 Java 业务代码**、**零外部中间件** 与 **零 `dita install` 门槛** 的前提下，构建一套可持久化、可预览、跨平台一致的 PDF 排版主题系统。

### 1.1 已确认设计决策（Design Tree 共识清单）

| 维度 | Phase 15 确认决策 | 明确不做（Non-Goals） |
| :--- | :--- | :--- |
| **技术路线** | **DITA-OT 原生 `--customization.dir`（XML Catalog 重定向）+ 纯 XSLT 3.0 主题资产**：每次发布在作业目录物化 `customization/`，用 `catalog.xml` 把 pdf2 的 `cfg:fo/attrs/custom.xsl`、`cfg:fo/xsl/custom.xsl`、`cfg:fo/font-mappings.xml` 三个 URI 指向导出资产，无需安装插件、无需改 `workDir` | 不引入 headless Chromium / Puppeteer 的 HTML→PDF 第二流水线（体积 + 中文字体 + 分页不可控）；不写自定义 `transtype` Java/XSLT 插件 |
| **主题资产存放** | 全部导出资产放在仓库根 `dita-ot-plugins/pdf-themes/`（`shared/attrs-base.xsl` + `shared/xsl-base.xsl` + 每主题 `attrs.xsl`），与 `com.ditaeditor.pdf-cjk`、`html5-themes/` 并列，随 `dita-ot-plugins/` 目录整体进入 Docker 镜像、桌面端 `extraResources` 与仓库检出 | 不把 XSLT 内联进 TS 字符串（不可读、不可 diff、无法被 Fox/XSLT 编辑器校验） |
| **首批内置模板** | **4 套定位鲜明的印刷主题 + 1 套原生兜底**：① `tech-manual`（技术手册，默认）、② `enterprise-spec`（企业规范）、③ `editorial-book`（编辑书排）、④ `compact-guide`（紧凑指南）、⑤ `vanilla`（DITA-OT 原生输出） | 本期不做可视化 XSLT 拖拽设计器，不做用户上传 ZIP 主题包 |
| **可调项与安全边界** | 仅暴露**强类型白名单**选项：主色 `#RRGGBB`、纸张（A4/Letter/B5）、字体（sans/serif）、字号（9pt/10pt/11pt）、页边距（compact/normal/wide）、封面副标题 / 页眉 / 页脚（前后端统一限长 `120 / 120 / 240` 字符：`PDF_THEME_OPTION_LIMITS` / `PDF_THEME_TEXT_LIMITS`）、工作区 Logo（`.png`/`.jpg`/`.jpeg`/`.svg`，≤ 2 MB）、5 项布尔开关（封面 / 目录 / 章节编号 / 任务标签 / 双面镜像边距） | **永不接受任意 XSLT / XPath 路径**（zod 契约里根本没有该字段）；不做逐元素字号、字体族、颜色表编辑器 |
| **默认配置持久化** | `manual_publish_profiles` 新增 `pdf_theme_id` / `pdf_theme_options_json` 两列按手册记忆 PDF 默认主题；每次发布在 `publish_jobs.options_json.pdfTheme` 留存快照；**绝不向 `.dita` / `.ditamap` 写入任何排版配置** | 零 XML 污染、零 Git Diff 污染 |
| **预览与双语体验** | `PublishDialog` 的 PDF 段落提供主题卡片（迷你版面缩略图 + 打印色板）+ **免 DITA-OT 编译的服务端样本预览**（弹窗内 iframe，支持「适应窗口 / 实际尺寸」与 250ms 防抖刷新）；全链路纳入 Phase 8 中英双语词典与防退化门禁 | 不在用户未点击发布时后台跑 DITA-OT / FOP |
| **向后兼容** | `vanilla` 主题**完全跳过**定制目录组装（直接复用 `com.ditaeditor.pdf-cjk` 插件目录），Phase 14 及之前的 PDF 产物逐字节可复现；旧配置行缺列时按 `tech-manual` 默认值补齐 | 不强制迁移历史 `publish_jobs` 记录 |

---

## 2. 首批内置 PDF 排版模板设计矩阵

所有 4 套主题共享同一套设计令牌骨架（`shared/attrs-base.xsl`：页面几何、边距、字号、强调色阶、`base-font` 与属性集）与同一套结构覆写（`shared/xsl-base.xsl`：封面、页眉页脚、页面母版、目录开关、章节编号、`note` 强调条），通过独立的 `<themeId>/attrs.xsl` 只覆写令牌与属性集，从而在同一套 DITA 1.3 内容上呈现截然不同的印刷气质，并完整覆盖 `topic`/`concept`/`task`/`reference`、`title`、`shortdesc`、`steps`/`step`/`cmd`/`info`/`stepresult`、`note[@type]`、`codeblock`/`pre`、`fig`/`image`、CALS `table`、`ul`/`ol`/`dl`、`uicontrol`/`menucascade`/`codeph`/`filepath`/`varname`/`xref`/`related-links` 的排版。

| 主题 ID | 中文名称 / 英文名称 | 视觉气质与默认色板 | 版式与结构特色（默认值） | 典型适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **`tech-manual`** *(默认)* | **技术手册** / Tech Manual | 纯白纸面 + 深青绿主色 `#0f766e` + 墨黑正文 + 浅灰表头 `#f1f5f9` | A4 · 无衬线 10pt · 常规边距 · 左侧色条封面（`left-accent`）· 封面 + 目录 + DITA-OT 任务标签 · 单面（不镜像） | SaaS / 平台产品手册、API 指南、团队知识库导出 |
| **`enterprise-spec`** | **企业规范** / Enterprise Spec | 深海军蓝 `#0f2942` + 冷灰边框 `#c3d0de` + 高对比正文 `#0b1220` | A4 · 无衬线 10pt · 常规边距 · 顶部深蓝通栏封面（`navy-band`）· 封面 + 目录 + **章节编号** + 任务标签 · 单面 | 政企交付规范、硬件规格书、验收文档 |
| **`editorial-book`** | **编辑书排** / Editorial Book | 暖纸白 `#fffdf9` + 焦糖陶土主色 `#9a3412` + 衬线正文 `#1c1917` | A4 · **衬线 11pt** · **宽边距**（内 30 / 外 26 / 上下 28mm）· 居中书籍封面（`editorial-center`）· 封面 + 目录 + 章节编号（不显示任务标签）· **双面镜像边距** | 白皮书、长篇概念说明、正式出版物式手册 |
| **`compact-guide`** | **紧凑指南** / Compact Guide | 纯白纸面 + 亮蓝主色 `#2563eb` + 紧凑页眉 `#eef2f8` | A4 · 无衬线 **9pt** · **紧凑边距**（15/15/16/16mm）· 紧凑页眉封面（`compact-header`）· 封面 + 目录 + 任务标签 · **双面镜像边距** | 现场速查卡、快速上手指南、省纸打印稿 |
| **`vanilla`** | **原生输出** / Native Output | DITA-OT PDF2 官方默认外观（`#1f4e79`） | 跳过全部定制，仅保留 `com.ditaeditor.pdf-cjk` 中文字体映射；结构开关与调色项对该主题禁用（`supportsCustomization: false`） | 客户自有后处理管线、排查 DITA-OT 原生行为 |

> 令牌清单（`shared/attrs-base.xsl` 声明默认值 → 主题覆写 → 作业 `theme-vars.xsl` 最终覆写）：`$de-page-width`/`$de-page-height`、`$de-page-margin-inside/-outside/-top/-bottom`、`$de-font-size`/`$de-font-family`、`$de-accent`/`$de-accent-soft`/`$de-accent-border`/`$de-accent-contrast`、`$de-cover-enabled`/`$de-toc-enabled`、`$de-chapter-numbers`/`$de-task-labels`、`$de-mirror-margins`、`$de-cover-style`、`$de-cover-subtitle`/`$de-header-text`/`$de-footer-text`/`$de-logo-uri`。

---

## 3. 总体架构与发布定制流水线

```mermaid
flowchart TB
    subgraph Client["前端工作台 (@dita/web)"]
        Dlg["PublishDialog (PDF 模式)<br/>PDF 主题段落 · 保存为默认 · 预览按钮"]
        Sel["PdfThemeSelector<br/>主题卡片网格 · 打印色板缩略图 · 排版选项面板"]
        Prev["PdfThemePreviewModal<br/>服务端渲染样本 iframe (适应窗口 / 实际尺寸)"]
        Dlg --> Sel
        Dlg -->|"即时预览 (免 DITA-OT)"| Prev
    end

    subgraph API["@dita/api"]
        R["publish/routes.ts<br/>GET /api/publish/pdf-themes<br/>GET /api/publish/pdf-themes/:id/preview<br/>PUT /api/publish/profile · POST /api/publish/jobs"]
        Reg["pdf-themes.ts<br/>主题注册表 · 选项清洗 · 令牌派生 (pdfThemeColors/toFoColor)"]
        Cust["pdf-customization.ts<br/>preparePdfCustomizationDir()"]
        Preview["pdf-theme-preview.ts<br/>renderPdfThemePreview()"]
        Svc["PublishService.runJob()<br/>DITA-OT pdf transtype"]
        R --> Reg
        R --> Preview
        R --> Svc
        Svc --> Cust
        Reg --> Cust
    end

    subgraph Assets["dita-ot-plugins/pdf-themes/"]
        Base["shared/attrs-base.xsl<br/>shared/xsl-base.xsl"]
        Theme["tech-manual · enterprise-spec<br/>editorial-book · compact-guide<br/>(<id>/attrs.xsl)"]
    end

    subgraph Storage["SQLite + 作业目录"]
        Prof[("manual_publish_profiles<br/>pdf_theme_id · pdf_theme_options_json")]
        Job[("<publishRoot>/jobs/<id>/<br/>customization/ (catalog.xml + 生成的 custom.xsl)"]
    end

    Sel -->|"PUT profile (保存默认)"| R
    Prev -->|"GET preview (query 选项)"| R
    Dlg -->|"POST jobs { pdfThemeId, pdfThemeOptions }"| R
    R --> Prof
    Base --> Cust
    Theme --> Cust
    Cust --> Job
    Job --> Svc
    Svc -->|"PDF + 日志 # pdf theme: ..."| Dlg
```

### 3.1 为什么用 `--customization.dir` + XML Catalog，而不是安装插件？

DITA-OT PDF2 插件把页面几何、封面、目录、页眉页脚这些结构钩子声明为 **普通 `xsl:variable`**（`basic-settings.xsl`，只被 `topic2fo.xsl` 导入），既不能被定制样式表看见，也没有对应的 Ant 参数。唯一稳定、跨版本、无需 Java 的介入点，就是把 PDF2 通过 Catalog 解析的三个 XSLT 资源重定向到自己的样式表：

| Catalog URI | 物化文件 |
| :--- | :--- |
| `cfg:fo/attrs/custom.xsl` | `fo/attrs/custom.xsl`（生成：`xsl:import` 链） |
| `cfg:fo/xsl/custom.xsl` | `fo/xsl/custom.xsl`（生成：导入 attrs + `xsl:include` 结构覆写） |
| `cfg:fo/font-mappings.xml` | `cfg/fo/font-mappings.xml`（从 `com.ditaeditor.pdf-cjk` 原样复制） |

`<customization.dir>/catalog.xml` 被 DITA-OT 放在 catalog 路径**最前**，因此这些 URI 命中作业目录内的文件，而非 `DITA-OT/plugins/org.dita.pdf2/cfg/...`。该机制纯 XML、零 Java、零 `dita install`：Docker、本机 `dita`、桌面端（`extraResources` 内的同一份资产）行为完全一致。

### 3.2 导入链的两个承重点

```text
fo/attrs/custom.xsl   imports → shared/attrs-base.xsl
                                <themeId>/attrs.xsl
                                fo/attrs/theme-vars.xsl      (最高优先级：用户选项胜出)
fo/xsl/custom.xsl     imports → ../attrs/custom.xsl
                      includes → shared/xsl-base.xsl
```

1. **属性层之间必须用 `xsl:import`。** 三层刻意声明同名变量（`$de-accent`、`$de-title-rule` …）。若用 `xsl:include`，三层处于同一优先级，Saxon 会直接报静态错误 `XTSE0630`（duplicate global variable）；嵌套 `xsl:import` 让后导入模块自然胜出，恰好实现「用户选项 > 主题默认 > 基座默认」。
2. **`xsl-base.xsl` 必须用 `xsl:include`。** 被导入模块中的变量引用只在**它自己的导入链**内可见，若把结构覆写也 `import` 进来，`$de-page-width`、`$de-font-size`、`$de-mirror-margins` 全部越界。改为 `include` 后，结构覆写并入 customs 模块，继承其导入链上的 `theme-vars.xsl`。

### 3.3 `preparePdfCustomizationDir()` 关键实现细节

- **入口判定**：`pdfThemeDefinition(themeId).supportsCustomization === false`（即 `vanilla`）直接返回 `{ customizationDir: pluginDir, extraDitaArgs: [], warnings: [] }`，完全不写作业目录。
- **资产定位**：`resolvePdfThemesDir(themesDir)` 解析顺序 = 显式覆盖（`PublishServiceOptions.pdfThemesDir`，桌面端注入）→ 环境变量 `DITAEDITOR_PDF_THEMES_DIR` → 仓内向上查找（以 `samples/demo-dita-project` 为仓库根标志），并要求 `shared/attrs-base.xsl` 存在，否则抛 `pdf-themes assets not found: <dir>`；缺任一资产统一转为 `500 publish.pdfThemeAssetsMissing`（附 `{ themeId, asset }`）。
- **中文字体优先**：无条件把 `pluginDir/cfg/fo/font-mappings.xml` 复制进 `customization/cfg/fo/`。丢掉这一步，简体中文 PDF 会回退到无所需字形的字体（Phase 5 的 `#PDFX013F` 类故障复发）。
- **Logo 尽力而为**：`.png`/`.jpg`/`.jpeg`/`.svg` 白名单（FOP 2.9 不能解码 WebP）、必须经 `resolveSafeWorkspacePath(snapshotDir, logoPath)`（越界/不存在/非普通文件/超过 2 MB → 忽略），成功后复制为 `common/artwork/logo.<ext>` 并以 `file:` URI 注入 `$de-logo-uri`；**任何失败都不中断构建**，只在日志追加 `# pdf theme warning: logo '<path>' ignored: <reason>`。
- **令牌写入**：`theme-vars.xsl` 用 `pdfThemeColors(accent)` 生成 `accent/-soft/-border/-contrast`；FOP 只懂 `#RRGGBB` / `rgb()`，因此 `toFoColor()` 把共享 CSS 强调色阶里的 `rgba()` 按白底压平成不透明十六进制。
- **每个生成的 XML 都过 `checkXmlWellFormed()`**（`assertWellFormed()`）：一份畸形 catalog/XSLT 会让整次 PDF 构建以极难定位的 XSLT 错误失败，提前报出文件名与行列。
- **`extraDitaArgs`**：仅当 `features.taskLabels === true` 时追加 `--args.gen.task.lbl=YES`（与 Phase 12 HTML5 保持同一开关语义）。
- **镜像边距**：`features.mirrorMargins === false` 时 `outside` 直接等于 `inside`，让 `generate-page-sequence-master` 只生成单一页面序列。

### 3.4 PDF2 结构钩子覆写清单（`shared/xsl-base.xsl`）

| pdf2 钩子 | 为何必须重写 |
| :--- | :--- |
| `mode="create-page-masters"` | 应用纸张尺寸与边距，并决定每个母版声明哪些 flow 名 |
| `generate-page-sequence-master` | 仅在开启镜像时才输出奇偶页序列 |
| `createFrontMatter` | 让 `showCover` 生效 |
| `match="/" mode="toc"` | 让 `showToc` 生效（空 TOC 树会让 pdf2 跳过整个目录页序列） |
| `insertBodyStaticContents` | 仅在镜像时才区分奇偶页的页眉/页脚与页码外侧对齐 |
| `match="…/topic/title" mode="getTitle"` | 章节自动编号 |
| `match="…/topic/note"` | 用强调条/描边方块包裹 pdf2 自带的本地化标签（`note`/`tip`/`warning`…） |

> 具名模板覆写**不能**用 `xsl:next-match` 委托（它解析不到更低优先级的具名模板），所以上表每一项要么完整重写，要么改为包裹一个**模板规则**来委托。

---

## 4. 数据模型与 API 契约

### 4.1 SQLite 数据表

`manual_publish_profiles`（Phase 12 建表，Phase 15 增列；`apps/api/src/db/schema.ts` + `client.ts` 迁移）：

```sql
CREATE TABLE manual_publish_profiles (
  manual_id                TEXT PRIMARY KEY,
  html_theme_id            TEXT NOT NULL DEFAULT 'tech-docs',
  html_theme_options_json  TEXT NOT NULL DEFAULT '{}',
  pdf_theme_id             TEXT NOT NULL DEFAULT 'tech-manual',   -- Phase 15
  pdf_theme_options_json   TEXT NOT NULL DEFAULT '{}',            -- Phase 15
  updated_by               TEXT,
  updated_at               TEXT NOT NULL
);
```

`publish_jobs` 不新增列：PDF 主题快照写入既有的 `options_json`，形如 `{ "pdfTheme": { "themeId": "editorial-book", "options": { … } } }`，历史记录读取时缺失该键 → `pdfThemeId = null`。

### 4.2 TypeScript 类型契约

```ts
// apps/api/src/modules/publish/pdf-themes.ts（web 侧 apps/web/src/services/publish-api.ts 镜像同一形状）
export type PdfThemeId = 'tech-manual' | 'enterprise-spec' | 'editorial-book' | 'compact-guide' | 'vanilla';
export type PdfPageSize = 'A4' | 'Letter' | 'B5';
export type PdfFontFamily = 'sans' | 'serif';
export type PdfFontSize = '9pt' | '10pt' | '11pt';
export type PdfMargins = 'compact' | 'normal' | 'wide';
export type PdfCoverStyle = 'left-accent' | 'navy-band' | 'editorial-center' | 'compact-header' | 'vanilla';  // web 侧命名为 PdfThemeCoverStyle

export interface PdfThemeFeatures {
  showCover: boolean;
  showToc: boolean;
  chapterNumbers: boolean;
  taskLabels: boolean;
  mirrorMargins: boolean;
}

export interface PdfThemeOptions {
  accentColor?: string;      // #RRGGBB
  pageSize?: PdfPageSize;
  fontFamily?: PdfFontFamily;
  fontSize?: PdfFontSize;
  margins?: PdfMargins;
  coverSubtitle?: string;    // ≤ 120 字符
  headerText?: string;       // ≤ 120 字符
  footerText?: string;       // ≤ 240 字符
  logoPath?: string;         // 工作区相对路径，≤ 1024 字符
  features?: Partial<PdfThemeFeatures>;
}

export interface PdfThemeDescriptor {
  id: PdfThemeId;
  name: string;              // 本地化（x-dita-locale）
  description: string;
  tags: string[];
  defaultAccent: string;
  defaultPageSize: PdfPageSize;
  defaultFontFamily: PdfFontFamily;
  defaultFontSize: PdfFontSize;
  defaultMargins: PdfMargins;
  coverStyle: PdfCoverStyle;
  supportsCustomization: boolean;
  previewPalette: PdfThemePalette;   // page/header/text/muted/accent/border/codeBg
  defaultFeatures: PdfThemeFeatures;
}
```

关键导出函数：

| 符号 | 职责 |
| :--- | :--- |
| `listPdfThemes(locale)` / `getPdfTheme(locale, id)` | 按显示顺序返回本地化描述符；未知 id → `undefined` |
| `resolvePdfThemeOptions(themeId, input)` | 任意 JSON 的清洗器：丢弃未知键、去空串、超长截断、枚举非法即忽略、缺省时保留主题默认布尔开关；**永不抛错** |
| `resolvePdfThemeFeatures(themeId, input)` | 仅接受真实布尔值，其余回落主题默认 |
| `resolvePdfTheme(themeId, input): ResolvedPdfTheme` | 合并默认值并派生 `fontKey`（`sans`/`serif`） |
| `pdfThemeColors(accent)` / `toFoColor(color)` | 派生 emphasis 色阶并按白底压平 `rgba()` |
| `resolvePdfThemesDir(override?)` | 覆盖 → `DITAEDITOR_PDF_THEMES_DIR` → 仓内向上查找 |
| `pdfThemeIdSchema` / `pdfThemeOptionsSchema` | zod 契约；未知键被 strip，**不存在 XSLT 路径字段** |
| `renderPdfThemePreview({ themeId, options, locale })` | 免 DITA-OT 的自包含样本 HTML（无图片/脚本/网络请求，用户文本全部 `escapeHtmlText()`） |
| `preparePdfCustomizationDir(input)` | 物化 `customization/`，返回 `{ customizationDir, extraDitaArgs, warnings }` |

`PublishService`（`apps/api/src/modules/publish/publish-service.ts`）：`PublishServiceOptions` 新增 `pdfThemesDir?: string`；`CreatePublishJobInput` 新增 `pdfThemeId?` / `pdfThemeOptions?`；`PublishJobView` 新增 `pdfThemeId: PdfThemeId | null` 与 `pdfThemeOptions: PdfThemeOptions | null`；PDF 分支构建日志首行输出 `# pdf theme: <id> (pageSize=…, fontFamily=…, fontSize=…, margins=…, accent=…)`，其后逐条输出 `# pdf theme warning: …`。

### 4.3 REST API 端点

| 方法与路径 | 权限 | 说明 |
| :--- | :--- | :--- |
| `GET /api/publish/pdf-themes` | `admin` / `writer` / `viewer` | 返回 `{ themes: PdfThemeDescriptor[] }`；`cache-control: no-cache` + `vary: x-dita-locale`（描述符是本地化文案） |
| `GET /api/publish/pdf-themes/:id/preview` | 任意已解析作用域 | 返回自包含样本 HTML（`text/html; charset=utf-8`、`cache-control: no-store`）；未知 id → `404 publish.pdfThemeNotFound`；畸形主色 → `400 publish.invalidThemeOptions`；渲染异常 → `500 publish.themePreviewFailed`；query 仅接受 `accent`/`pageSize`/`fontFamily`/`fontSize`/`margins`/`coverSubtitle`/`headerText`/`footerText`/5 个布尔开关/locale |
| `GET /api/publish/profile` | `admin` / `writer` / `viewer` | 手册默认配置，现含 `pdfThemeId` / `pdfThemeOptions` |
| `PUT /api/publish/profile` | `admin` / `writer` | body 可带 `themeId`/`themeOptions`（HTML5）或 `pdfThemeId`/`pdfThemeOptions`（PDF），`.refine` 要求至少一个；非法 PDF 选项 → `400 publish.invalidThemeOptions` |
| `POST /api/publish/jobs` | `admin` / `writer` | PDF 请求体可带 `pdfThemeId` / `pdfThemeOptions`；缺省取手册默认；`vanilla` 强制清空选项；带 `saveAsDefault` 且非 `vanilla` 时同步落库手册默认 |

---

## 5. 前端工作台交互设计（`PublishDialog` PDF 段落）

1. **PDF 主题段落**：仅当 `format === 'pdf'` 渲染，标题行含段落名、提示文案、当前 `pageSize · fontSize` 徽标、「已设为默认」徽标、`保存为默认` 复选框（`viewer` 或 `vanilla` 时隐藏）与 `预览` 按钮；`aria-expanded` 可折叠，展开态限高 `40vh` 内滚动。
2. **主题卡片网格**（`PdfThemeSelector`）：`role="radiogroup"` + 每卡 `role="radio"`，卡内用 `pdfThumbnailStyle(descriptor)` 渲染迷你版面（页眉条、标题线、正文行、强调色块）与打印色板；`vanilla` 卡片标注原生输出。
3. **排版选项面板**：主色支持 6 个预设（`#1d4ed8` / `#0f766e` / `#7c2d12` / `#334155` / `#6d28d9` / `#b91c1c`）+ 原生取色器 + 手动 hex 输入（`normalizePdfAccentColor` 兜底）；纸张、字体、字号、页边距为分段控件；封面副标题 / 页眉 / 页脚为受 `PDF_THEME_TEXT_LIMITS`（120/120/240）约束的文本框并显示计数，服务端再按 `PDF_THEME_OPTION_LIMITS`（80/60/80）收敛；Logo 从工作区文件树（`collectPdfLogoPaths`，仅图片后缀）下拉选择；5 项开关各带一行说明。切换主题时 `applyPdfThemeSelection` 只保留用户「显式改过」的字段，避免把上一主题的默认值误带到新主题。
4. **免编译预览**（`PdfThemePreviewModal`）：打开即按当前草稿组装 `pdfThemePreviewUrl()`（query 携带 accent / 版式 / 文案 / 开关 / locale / manualId / branch + `_` 缓存键），首次渲染后每次改动 **250ms 防抖**刷新；提供「适应窗口（100% 宽）」与「实际尺寸（860px）」两种模式、加载/失败态与重试、`PREVIEW_TIMEOUT_MS` 看门狗、焦点捕获与 `Esc` 关闭。
5. **状态与初始化**：`usePublishStore` 新增 `pdfThemes` / `pdfThemesStatus` / `pdfThemesError` 与 `loadPdfThemes()`，默认保存走 `savePdfProfile(pdfThemeId, pdfThemeOptions)`；弹窗打开且主题列表就绪时**一次性**播种草稿（优先 `profile.pdfThemeId` → `tech-manual` → 列表首项），语言切换后重新播种；`profile` 拉取失败在段落内显示可重试的黄色提示条。
6. **提交**：`POST /api/publish/jobs` 在 `format === 'pdf'` 时附带 `pdfThemeId` 与 `pdfThemeOptions`；勾选「保存为默认」时另行 `PUT /api/publish/profile`。

---

## 6. 涉及文件与目录清单

```text
dita-ot-plugins/pdf-themes/            # 新增：纯 XSLT 主题资产（无 Java、无插件描述符）
├── README.md                          # 资产说明：Catalog 映射、导入链、令牌表、新增主题步骤
├── shared/attrs-base.xsl              # 设计令牌默认值 + 属性集
├── shared/xsl-base.xsl                # 结构覆写（封面/页眉页脚/页面母版/目录/编号/note）
├── tech-manual/attrs.xsl              # 默认主题令牌覆写
├── enterprise-spec/attrs.xsl
├── editorial-book/attrs.xsl
└── compact-guide/attrs.xsl

apps/api/src/modules/publish/
├── pdf-themes.ts                      # 主题注册表、选项清洗、令牌派生、资产定位、zod 契约
├── pdf-customization.ts               # --customization.dir 物化（catalog + 生成 XSLT + Logo + 字体映射）
├── pdf-theme-preview.ts               # 免 DITA-OT 样本 HTML 渲染（中英双语）
├── publish-service.ts                 # pdfThemesDir 注入、作业快照、日志前缀、DITA-OT 调用
├── publish-profiles.ts                # pdfThemeId/pdfThemeOptions 读写与 mergePdfThemeOptions()
└── routes.ts                          # GET pdf-themes / GET preview / PUT profile / POST jobs

apps/api/src/db/{schema.ts,client.ts}  # manual_publish_profiles 两列 + 幂等迁移
apps/api/src/i18n/messages.ts          # publish.pdfTheme.* / pdfThemeTag.* / pdf.* 双语键（zh-CN + en）
apps/api/src/index.ts                  # createServer 透传 pdfThemesDir
apps/api/test/phase15-pdf-themes.test.ts  # 注册表 / 定制目录 / 预览 / 路由四组用例

apps/web/src/components/publish/
├── PublishDialog.tsx                  # PDF 段落、默认保存、提交附带 PDF 主题字段
├── PdfThemeSelector.tsx               # 主题卡片网格 + 排版选项面板
├── PdfThemePreviewModal.tsx           # iframe 样本预览（防抖 / 缩放 / 看门狗）
└── pdf-theme-model.ts                 # 草稿模型、默认值、主题切换、选项映射、Logo 扫描、缩略图样式
apps/web/src/services/publish-api.ts   # 类型镜像、fetchPdfThemes()、pdfThemePreviewUrl()
apps/web/src/store/publish-store.ts     # pdfThemes 状态与 loadPdfThemes() / savePdfProfile()
apps/web/test/phase15-pdf-themes.test.ts  # 草稿模型 / 主题切换 / 选项映射 / 预览 URL / 缩略图 / store

apps/desktop/src/paths.ts              # DesktopRuntimePaths.pdfThemesDir（打包 resources / 开发 repoRoot）
apps/desktop/src/main.ts               # createServer({ pdfThemesDir })
apps/desktop/scripts/stage.mjs         # requiredPaths 增加 pdf-themes/shared/attrs-base.xsl 与 html5-themes 校验
apps/desktop/test/paths.test.ts        # 打包态与开发态 pdfThemesDir 断言

docs/plans/phase15-pdf-themes.md        # 本文档
```

---

## 7. 分步垂直切片实施计划（Slices 1–5）

### Slice 1：纯 XSLT 主题基座与 4 套主题资产（`dita-ot-plugins/pdf-themes/`）
- `shared/attrs-base.xsl` 声明设计令牌与属性集（`base-font` 必须与令牌同模块，否则看不到 `$de-font-size`）；`shared/xsl-base.xsl` 重写 §3.4 的 pdf2 结构钩子。
- 4 套 `<themeId>/attrs.xsl` 只覆写令牌与已声明属性集，保持最小 diff，便于后续新增主题。
- `README.md` 固化 Catalog 映射、导入链、令牌表与「新增主题 4 步」。

### Slice 2：后端主题注册表、定制目录与样本预览（`apps/api`）
- `pdf-themes.ts`：类型、5 个描述符（本地化）、选项清洗、zod 契约、`pdfThemeColors`/`toFoColor`、`resolvePdfThemesDir`。
- `pdf-customization.ts`：`catalog.xml` + `fo/attrs/theme-vars.xsl` + `fo/attrs/custom.xsl` + `fo/xsl/custom.xsl` + 字体映射复制 + Logo 暂存，全部过 `checkXmlWellFormed()`。
- `pdf-theme-preview.ts`：双页样本（封面+目录 / 正文：标题、`shortdesc`、`steps`、4 种 `note`、CALS 表格、`codeblock`、页眉页脚页码）。

### Slice 3：持久化与 `PublishService` 集成（`apps/api` + `apps/desktop`）
- `manual_publish_profiles` 增列与幂等迁移（`ALTER TABLE` 仅当列缺失）。
- `publish-profiles.ts`：默认 `pdfThemeId = 'tech-manual'`、`mergePdfThemeOptions()`、`vanilla` 存 `{}`、未知 id 拒绝。
- `publish-service.ts`：`pdfThemeForRow()` 读作业快照、PDF 分支注入定制目录与 `extraDitaArgs`、日志前缀。
- 桌面端：`paths.ts` 新增 `pdfThemesDir`，`main.ts` 注入 `createServer()`，`stage.mjs` 增加资产存在性校验（`electron-builder.yml` 已把整个 `dita-ot-plugins/` 复制为 `Resources/dita-ot-plugins`）。

### Slice 4：前端主题选择器、排版面板与实时预览（`apps/web`）
- `pdf-theme-model.ts` 纯函数先行（草稿、切换、映射、Logo 扫描、缩略图），保证可测试。
- `PdfThemeSelector.tsx`：主题卡片（`role="radio"`）、打印色板缩略图、分段控件与开关。
- `PdfThemePreviewModal.tsx` + `pdfThemePreviewUrl()`：防抖刷新、缩放模式、看门狗、无障碍焦点管理。
- `PublishDialog.tsx`：PDF 段落、一次性播种、`保存为默认`、提交附带 PDF 字段。

### Slice 5：端到端验收与文档同步
- `pnpm -r build && pnpm -r typecheck && pnpm -r test` 全绿，含 `apps/api/test/phase15-pdf-themes.test.ts`、`apps/web/test/phase15-pdf-themes.test.ts`、`apps/desktop/test/paths.test.ts` 与 i18n 双语对称 / 无硬编码中文门禁。
- 真实构建抽查：`dita --input=product-manual.ditamap --format=pdf --customization.dir=<dir>` 分别产出 5 种主题，确认中文不缺字、封面/目录/编号/镜像边距按开关生效。
- 归档 `docs/plans/phase15-pdf-themes.md`、更新 `docs/README.md`、`docs/architecture-and-plan.md`、`AGENTS.md` 并 `graphify update .`。

---

## 8. 主要工程风险与应对策略

| 风险点 | 触发场景 | 应对策略 |
| :--- | :--- | :--- |
| **XSLT 静态错误（同优先级重名变量）** | 把属性层改成 `xsl:include`，Saxon 报 `XTSE0630: duplicate global variable` | 属性层固定 `xsl:import` 链、结构层固定 `xsl:include`；两个承重点写入 `README.md` 与代码注释，任何改动都必须保持该方向 |
| **变量越界 / 结构覆写不生效** | 结构覆写被 `import` 后读不到 `$de-page-width`、`$de-mirror-margins` | `fo/xsl/custom.xsl` 只 `import ../attrs/custom.xsl`（其链上有 `theme-vars.xsl`）+ `include shared/xsl-base.xsl` |
| **中文 PDF 缺字回退** | 定制目录替换了 `font-mappings.xml` 或忘记复制 | 每个主题都无条件从 `com.ditaeditor.pdf-cjk` 复制 `cfg/fo/font-mappings.xml`；`vanilla` 直接复用插件目录 |
| **用户输入引发 XSS / 路径穿越 / 任意 XSLT** | 封面副标题或页脚塞入 HTML；Logo 指向 `../../etc/passwd`；请求体伪造 `xslPath` | 预览文本 `escapeHtmlText()`，XSLT 侧 `xslString()` 转义单引号；Logo 走 `resolveSafeWorkspacePath()` + 后缀白名单 + 2 MB 上限；zod 契约无 XSLT 字段（未知键被 strip） |
| **畸形选项导致 500 或静默灰字** | 前端传入 `#GGG`、`2rem`、超长文案 | `resolvePdfThemeOptions()` 永不抛错（忽略非法枚举/截断文本）；仅预览路由对畸形主色返回 `400 publish.invalidThemeOptions`，避免「静默渲染成灰色」 |
| **作业目录残留 / 污染共享检出** | 把 `customization/` 写进 `workDir`，或跨作业复用 | 全部写入 `<publishRoot>/jobs/<id>/customization`；`workDir` 只读 |
| **生成的 XML 打不开，构建报晦涩 XSLT 错** | 模板拼接漏闭合、Logo 路径含 `&` | 每个生成文件先过 `assertWellFormed()`（含文件名与行列），Logo 用 `file:` URI 并 XML 转义 |
| **桌面端找不到主题资产** | 打包漏掉 `pdf-themes/`，或路径仍指向仓内 | `paths.ts` 打包态取 `resourcesDir/dita-ot-plugins/pdf-themes`；`stage.mjs` 在打包前校验 `shared/attrs-base.xsl` 存在，缺失即快速失败 |
| **FOP 不能表达颜色 / 不能解 WebP** | 强调色阶返回 `rgba()`；用户上传 WebP Logo | `toFoColor()` 按白底压平；Logo 白名单到 `.png`/`.jpg`/`.jpeg`/`.svg`，其余仅告警 |
| **与 Phase 12/14 行为回归** | 新默认值改变既有 PDF 输出，或旧配置行读不出来 | `vanilla` 完全跳过定制，输出逐字节一致；旧行缺列按 `tech-manual` 默认值补齐；`publish_jobs` 无 `pdfTheme` 键时返回 `null` |
