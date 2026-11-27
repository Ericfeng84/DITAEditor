/**
 * Phase 15: PDF theme preview.
 *
 * The web workbench shows this document inside an `<iframe srcDoc>` before a
 * PDF job is created. It is generated from the same resolved tokens that drive
 * the XSLT (`pdf-themes.ts`) so what the user sees matches the paper output:
 * page size, margins, font scale, accent colour, cover style, chapter numbers,
 * task labels and mirror margins are all reflected.
 *
 * The document is fully self-contained (no images, no scripts, no network), and
 * every user supplied string is escaped with `escapeHtmlText()`.
 */
import type { ApiLocale } from '../../i18n/locale.js';
import { escapeHtmlText } from './theme-enhancer.js';
import {
  PDF_MARGIN_PRESETS,
  PDF_PAGE_GEOMETRY,
  isPdfThemeId,
  getPdfTheme,
  pdfThemeColors,
  pdfThemeDefinition,
  resolvePdfTheme,
  toFoColor,
  type PdfThemeId,
  type PdfThemeOptions,
  type PdfThemePalette,
} from './pdf-themes.js';

export interface PdfThemePreviewInput {
  themeId: string;
  options: PdfThemeOptions;
  locale: ApiLocale;
}

/** Typed failure so the route layer can map an unknown theme to HTTP 404. */
export class PdfThemePreviewError extends Error {
  readonly code = 'theme-not-found';
  readonly themeId: string;

  constructor(themeId: string) {
    super(`pdf theme not found: ${themeId}`);
    this.name = 'PdfThemePreviewError';
    this.themeId = themeId;
  }
}

interface PreviewStrings {
  cover: string;
  contents: string;
  subtitle: string;
  chapter: string;
  chapterOne: string;
  section: string;
  intro: string;
  introBody: string;
  tasks: string;
  taskOne: string;
  taskTwo: string;
  taskThree: string;
  notes: string;
  noteTip: string;
  noteWarning: string;
  noteImportant: string;
  noteBody: string;
  table: string;
  tableHead1: string;
  tableHead2: string;
  tableHead3: string;
  rowOption: string;
  rowDefault: string;
  rowNote: string;
  code: string;
  page: string;
  previewNote: string;
}

const STRINGS: Record<ApiLocale, PreviewStrings> = {
  'zh-CN': {
    cover: '产品手册',
    contents: '目录',
    subtitle: '安装、配置与发布指南',
    chapter: '第 1 章',
    chapterOne: '开始使用',
    section: '1.1 运行环境',
    intro: '产品手册样例',
    introBody: '本文档展示所选 PDF 样式在真实 A4 版面上的排版效果：标题层级、提示框、表格与代码块。',
    tasks: '操作步骤',
    taskOne: '安装 DITA-OT 4.x 运行时。',
    taskTwo: '在项目中打开 product-manual.ditamap。',
    taskThree: '选择 PDF 主题并发布，检查页眉与页脚。',
    notes: '注意事项',
    noteTip: '提示：示例配置可直接用于生产环境。',
    noteWarning: '警告：发布前请先完成图稿校验。',
    noteImportant: '重要：主题设置按手册独立保存。',
    noteBody: '注意：自定义样式仅影响本次发布，不会修改 XML 源文件。',
    table: '参数对照',
    tableHead1: '参数',
    tableHead2: '默认值',
    tableHead3: '说明',
    rowOption: 'themeOptions',
    rowDefault: '主题默认值',
    rowNote: '可通过发布对话框覆盖',
    code: '构建命令',
    page: '页',
    previewNote: '预览按真实纸张开幅缩放渲染，实际 PDF 由 DITA-OT 与 FOP 生成。',
  },
  en: {
    cover: 'Product Manual',
    contents: 'Contents',
    subtitle: 'Installation, configuration and publishing',
    chapter: 'Chapter 1',
    chapterOne: 'Getting started',
    section: '1.1 Runtime requirements',
    intro: 'Sample manual',
    introBody:
      'This page shows how the selected PDF theme lays out headings, notes, tables and code on real paper geometry.',
    tasks: 'Task steps',
    taskOne: 'Install the DITA-OT 4.x runtime.',
    taskTwo: 'Open product-manual.ditamap in the project.',
    taskThree: 'Pick a PDF theme, publish, and inspect the header and footer.',
    notes: 'Notes',
    noteTip: 'Tip: the sample configuration is production ready.',
    noteWarning: 'Warning: validate artwork before publishing.',
    noteImportant: 'Important: theme settings are stored per manual.',
    noteBody: 'Note: custom styling never modifies the DITA XML sources.',
    table: 'Parameters',
    tableHead1: 'Parameter',
    tableHead2: 'Default',
    tableHead3: 'Description',
    rowOption: 'themeOptions',
    rowDefault: 'theme default',
    rowNote: 'overridable in the publish dialog',
    code: 'Build command',
    page: 'page',
    previewNote:
      'Preview is scaled to real paper geometry; the PDF itself is produced by DITA-OT and FOP.',
  },
};

const NOTE_TONES = {
  tip: '#059669',
  warning: '#d97706',
  important: '#7c3aed',
  note: '#475569',
} as const;

function cssColor(value: string): string {
  return escapeHtmlText(toFoColor(value));
}

function fontStack(family: string): string {
  return family === 'serif'
    ? "'Noto Serif CJK SC', 'Source Han Serif SC', Georgia, 'Times New Roman', serif"
    : "'Noto Sans CJK SC', 'Source Han Sans SC', system-ui, -apple-system, 'Segoe UI', sans-serif";
}

function renderCover(
  resolved: ReturnType<typeof resolvePdfTheme>,
  palette: PdfThemePalette,
  strings: PreviewStrings,
): string {
  const style = pdfThemeDefinition(resolved.themeId).coverStyle;
  const title = escapeHtmlText(strings.cover);
  const subtitle = escapeHtmlText(resolved.options.coverSubtitle ?? strings.subtitle);
  const footerMeta = `<div class="cover-meta">${escapeHtmlText(
    resolved.options.headerText ?? strings.cover,
  )}</div>`;
  if (style === 'navy-band') {
    return `<section class="cover cover-band" style="--cover:${cssColor(palette.accent)};--cover-text:#ffffff">
      <div class="band">
        <div class="kicker">DITAEditor</div>
        <h1>${title}</h1>
        <p class="cover-sub">${subtitle}</p>
      </div>
      ${footerMeta}
    </section>`;
  }
  if (style === 'editorial-center') {
    return `<section class="cover cover-center" style="--cover:${cssColor(palette.accent)}">
      <div class="center-block">
        <div class="kicker">DITAEditor</div>
        <h1>${title}</h1>
        <div class="center-rule"></div>
        <p class="cover-sub">${subtitle}</p>
      </div>
      ${footerMeta}
    </section>`;
  }
  if (style === 'compact-header') {
    return `<section class="cover cover-compact" style="--cover:${cssColor(palette.accent)}">
      <div class="chip">DITAEditor</div>
      <h1>${title}</h1>
      <p class="cover-sub">${subtitle}</p>
      ${footerMeta}
    </section>`;
  }
  if (style === 'vanilla') {
    return `<section class="cover cover-vanilla" style="--cover:${cssColor(palette.accent)}">
      <h1>${title}</h1>
      <p class="cover-sub">${subtitle}</p>
    </section>`;
  }
  return `<section class="cover cover-accent" style="--cover:${cssColor(palette.accent)}">
    <div class="kicker">DITAEditor</div>
    <div class="accent-rule"></div>
    <h1>${title}</h1>
    <p class="cover-sub">${subtitle}</p>
    ${footerMeta}
  </section>`;
}

function renderToc(strings: PreviewStrings): string {
  const entries = [
    { label: strings.chapterOne, page: '1' },
    { label: strings.section, page: '2' },
    { label: strings.tasks, page: '3' },
    { label: strings.notes, page: '5' },
    { label: strings.table, page: '6' },
    { label: strings.code, page: '7' },
  ]
    .map(
      (entry) =>
        `<li><span>${escapeHtmlText(entry.label)}</span><span>${entry.page}</span></li>`,
    )
    .join('\n');
  return `<section class="toc-page">
    <h2 class="toc-title">${escapeHtmlText(strings.contents)}</h2>
    <ol class="toc">${entries}</ol>
  </section>`;
}

function renderNotes(strings: PreviewStrings): string {
  const notes: Array<{ label: string; body: string; tone: string }> = [
    { label: 'Tip', body: strings.noteTip, tone: NOTE_TONES.tip },
    { label: 'Warning', body: strings.noteWarning, tone: NOTE_TONES.warning },
    { label: 'Important', body: strings.noteImportant, tone: NOTE_TONES.important },
    { label: 'Note', body: strings.noteBody, tone: NOTE_TONES.note },
  ];
  return notes
    .map(
      (note) =>
        `<div class="note" style="--note:${note.tone}"><span class="note-label">${escapeHtmlText(
          note.label,
        )}</span><span>${escapeHtmlText(note.body)}</span></div>`,
    )
    .join('\n');
}

function renderBody(
  resolved: ReturnType<typeof resolvePdfTheme>,
  strings: PreviewStrings,
): string {
  const chapterLabel = resolved.features.chapterNumbers
    ? `<span class="chapter-number">1</span>`
    : '';
  const steps = [strings.taskOne, strings.taskTwo, strings.taskThree]
    .map((step) => `<li>${escapeHtmlText(step)}</li>`)
    .join('\n');
  const rows = [
    { a: strings.rowOption, b: strings.rowDefault, c: strings.rowNote },
    { a: 'pageSize', b: resolved.pageSize, c: 'A4 / Letter / B5' },
    { a: 'fontSize', b: resolved.fontSize, c: '9pt / 10pt / 11pt' },
  ]
    .map(
      (row) =>
        `<tr><td>${escapeHtmlText(row.a)}</td><td>${escapeHtmlText(
          row.b,
        )}</td><td>${escapeHtmlText(row.c)}</td></tr>`,
    )
    .join('\n');
  return `<h1 class="chapter-title">${chapterLabel}${escapeHtmlText(strings.chapterOne)}</h1>
    <p class="shortdesc">${escapeHtmlText(strings.introBody)}</p>
    <h2 class="section-title">${escapeHtmlText(strings.section)}</h2>
    <h3 class="task-title">${escapeHtmlText(strings.tasks)}</h3>
    <ol class="steps">${steps}</ol>
    <h3>${escapeHtmlText(strings.notes)}</h3>
    ${renderNotes(strings)}
    <h3>${escapeHtmlText(strings.table)}</h3>
    <table class="cals">
      <thead><tr><th>${escapeHtmlText(strings.tableHead1)}</th><th>${escapeHtmlText(
        strings.tableHead2,
      )}</th><th>${escapeHtmlText(strings.tableHead3)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h3>${escapeHtmlText(strings.code)}</h3>
    <pre class="code"><code>dita --input=product-manual.ditamap --format=pdf --output=out</code></pre>`;
}

function baseCss(
  resolved: ReturnType<typeof resolvePdfTheme>,
  palette: PdfThemePalette,
  page: { width: string; height: string },
  margins: { inside: string; outside: string; top: string; bottom: string },
): string {
  const accent = cssColor(palette.accent);
  const text = cssColor(palette.text);
  return `:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;padding:24px;background:#eef1f5;font-family:${fontStack(
    resolved.fontFamily,
  )};color:${text}}
.wrap{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start;justify-content:center}
.page-frame{--pdf-scale:0.68;width:calc(${page.width} * var(--pdf-scale));height:calc(${page.height} * var(--pdf-scale))}
.page{width:${page.width};height:${page.height};transform:scale(var(--pdf-scale));transform-origin:top left;background:#fff;position:relative;display:flex;flex-direction:column;box-shadow:0 8px 28px rgba(15,23,42,.16);font-size:${resolved.fontSize}}
.page-inner{flex:1;padding:${margins.top} ${margins.outside} ${margins.bottom} ${margins.inside};overflow:hidden}
.chrome{display:flex;justify-content:space-between;gap:8pt;padding:${margins.top} ${margins.outside} 0 ${margins.inside};font-size:.82em;color:${cssColor(
    palette.muted,
  )};border-bottom:.5pt solid ${cssColor(palette.border)};padding-bottom:3pt;margin-bottom:6pt}
.chrome.footer{border-bottom:0;border-top:.5pt solid ${cssColor(
    palette.border,
  )};padding:3pt ${margins.outside} 0 ${margins.inside};margin:0 0 0 0}
.cover{flex:1;display:flex;flex-direction:column;justify-content:flex-start;padding:${margins.top} ${margins.outside} ${margins.bottom} ${margins.inside};gap:18pt}
.cover h1{font-size:2.6em;margin:0;line-height:1.15;color:${text}}
.cover .kicker{font-size:.8em;letter-spacing:.18em;text-transform:uppercase;color:${accent};font-weight:700}
.cover .cover-sub{font-size:1.05em;margin:0;color:${cssColor(palette.muted)}}
.cover-accent .accent-rule{width:36mm;border-top:6pt solid ${accent}}
.cover-meta{margin-top:auto;font-size:.85em;color:${cssColor(palette.muted)}}
.cover-band{padding:0}
.cover-band .band{background:${accent};color:#fff;padding:22mm ${margins.outside} 16mm;display:flex;flex-direction:column;gap:12pt}
.cover-band .band h1,.cover-band .band .cover-sub,.cover-band .band .kicker{color:#fff}
.cover-band .cover-meta{padding:0 ${margins.outside} ${margins.bottom}}
.cover-center{align-items:center;text-align:center;justify-content:center}
.cover-center .center-rule{width:26mm;border-top:1pt solid ${accent};margin:6pt auto}
.cover-compact .chip{display:inline-block;padding:2pt 8pt;border:1pt solid ${accent};color:${accent};font-size:.78em;font-weight:700;letter-spacing:.1em;align-self:flex-start}
.cover-vanilla{border:0}
.toc-page{padding:0}
.toc-title{font-size:1.5em;margin:0 0 10pt;border-bottom:${cssColor(
    palette.border,
  )} 1pt solid;padding-bottom:6pt}
.toc,.steps{list-style:none;margin:0;padding:0}
.toc li{display:flex;justify-content:space-between;gap:8pt;padding:2.4pt 0;border-bottom:.4pt dotted ${cssColor(
    palette.border,
  )};font-size:.95em}
.toc li:first-child{font-weight:700}
.chapter-title{font-size:1.7em;margin:0 0 8pt;color:${cssColor(
    palette.text,
  )};border-bottom:2pt solid ${accent};padding-bottom:5pt}
.chapter-number{color:${accent};margin-right:.4em}
.section-title{font-size:1.2em;margin:14pt 0 5pt;color:${accent}}
.task-title,h3{font-size:1.02em;margin:12pt 0 4pt;color:${text}}
.shortdesc{margin:0 0 10pt;font-size:.98em;color:${cssColor(palette.muted)}}
.steps{margin:0 0 4pt;padding-left:0;counter-reset:step}
.steps li{counter-increment:step;position:relative;padding:1.5pt 0 1.5pt 16pt;font-size:.96em}
.steps li:before{content:counter(step) ".";position:absolute;left:0;color:${accent};font-weight:700}
.note{display:flex;gap:6pt;align-items:flex-start;border-left:3pt solid var(--note);background:${
    cssColor(palette.codeBg)
  };padding:4pt 6pt;margin:0 0 4pt;font-size:.92em}
.note-label{font-weight:700;color:var(--note);white-space:nowrap}
table.cals{width:100%;border-collapse:collapse;font-size:.9em;margin:0 0 8pt}
table.cals th,table.cals td{text-align:left;padding:3pt 5pt;border-bottom:.4pt solid ${cssColor(
    palette.border,
  )}}
table.cals thead th{background:${cssColor(palette.header)};border-top:1pt solid ${accent};border-bottom:1pt solid ${accent};font-size:.95em}
pre.code{background:${cssColor(palette.codeBg)};border-left:2pt solid ${accent};padding:5pt 7pt;margin:0;font-size:.82em;overflow:hidden}
pre.code code{font-family:'JetBrains Mono','SFMono-Regular',Menlo,monospace}
.preview-note{max-width:900px;margin:20px auto 0;font-size:12px;color:#64748b;text-align:center}`;
}

/**
 * Render the self-contained preview document for one PDF theme + option set.
 */
export function renderPdfThemePreview(input: PdfThemePreviewInput): string {
  if (!isPdfThemeId(input.themeId)) throw new PdfThemePreviewError(String(input.themeId));
  const themeId: PdfThemeId = input.themeId;
  const resolved = resolvePdfTheme(themeId, input.options);
  const definition = pdfThemeDefinition(themeId);
  const descriptor = getPdfTheme(input.locale, themeId);
  const palette = definition.previewPalette;
  const colors = pdfThemeColors(resolved.accent);
  const page = PDF_PAGE_GEOMETRY[resolved.pageSize];
  const margins = PDF_MARGIN_PRESETS[resolved.margins];
  const strings = STRINGS[input.locale] ?? STRINGS.en;
  const headerText = escapeHtmlText(resolved.options.headerText ?? strings.cover);
  const footerText = escapeHtmlText(resolved.options.footerText ?? '');
  const pageNumber = `<span>${escapeHtmlText(strings.page)} <b>2</b></span>`;
  const chrome = `<div class="chrome"><span>${headerText}</span><span>${escapeHtmlText(
    strings.section,
  )}</span></div>`;
  const footer = `<div class="chrome footer"><span>${footerText}</span>${pageNumber}</div>`;

  const coverPage = resolved.features.showCover
    ? `<div class="page-frame"><div class="page">${renderCover(resolved, palette, strings)}</div></div>`
    : '';
  const tocPage = resolved.features.showToc
    ? `<div class="page-frame"><div class="page"><div class="page-inner">${renderToc(strings)}</div></div></div>`
    : '';
  const bodyPage = `<div class="page-frame"><div class="page">${chrome}<div class="page-inner">${renderBody(
    resolved,
    strings,
  )}</div>${footer}</div></div>`;

  return `<!doctype html>
<html lang="${input.locale === 'zh-CN' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtmlText(descriptor?.name ?? themeId)} — PDF preview</title>
<style>${baseCss(resolved, palette, page, margins)}</style>
</head>
<body>
<div class="wrap">${coverPage}${tocPage}${bodyPage}</div>
<p class="preview-note">${escapeHtmlText(strings.previewNote)} · ${escapeHtmlText(
    resolved.pageSize,
  )} · ${escapeHtmlText(resolved.fontSize)} · ${escapeHtmlText(resolved.margins)} · ${escapeHtmlText(
    colors.accent,
  )}</p>
</body>
</html>`;
}
