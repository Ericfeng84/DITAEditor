/**
 * Isomorphic bilingual (`zh-CN` / `en`) DITA attribute knowledge base.
 *
 * Holds the long-form documentation that must NOT live in the compact attribute registry:
 * group purpose blurbs, real-world usage scenarios, concrete XML examples, and human-readable
 * labels for every enumerated attribute value. Shared by the Topic attribute panel, the Map
 * node inspector, and CodeMirror XML attribute completion.
 *
 * Zero Node-only imports: this module also runs in the browser.
 */

import type { UiLocale } from '../i18n/locale.js';
import type { DitaAttributeGroup, DitaAttributeSpec } from './dita-rules.js';

export interface DitaAttributeGroupMeta {
  /** Localized group title (`zh-CN`). */
  titleZh: string;
  /** English group title. */
  title: string;
  /** Short English subtitle rendered next to the localized title. */
  subtitle: string;
  /** Localized one-sentence group purpose (`zh-CN`). */
  descriptionZh: string;
  /** English one-sentence group purpose. */
  description: string;
}

export interface DitaAttributeValueLabel {
  label: string;
  labelZh: string;
}

// ---------------------------------------------------------------------------
// Attribute groups
// ---------------------------------------------------------------------------

export const DITA_ATTRIBUTE_GROUP_META: Readonly<Record<DitaAttributeGroup, DitaAttributeGroupMeta>> = {
  element: {
    title: 'Element attributes',
    titleZh: '元素专属属性',
    subtitle: 'Element',
    description:
      'Attributes that only this DITA element (or its specialization) accepts — target paths, table geometry, navigation behaviour.',
    descriptionZh:
      '仅当前元素或其特化元素支持的属性，例如目标路径、表格几何信息与导航行为；决定这个元素“做什么”。',
  },
  core: {
    title: 'Common attributes',
    titleZh: '常用通用属性',
    subtitle: 'Core',
    description:
      'Universal attributes available on almost every DITA element; they create anchors and style hooks and are the ones you edit most often.',
    descriptionZh:
      '几乎所有 DITA 元素都支持的基础属性，用于建立锚点与样式钩子，是日常编写中修改频率最高的一组。',
  },
  localization: {
    title: 'Localization & status',
    titleZh: '本地化与修订',
    subtitle: 'Localization',
    description:
      'Controls translation skipping, editorial revision marks, and right-to-left layout; single-language documents rarely need any of them.',
    descriptionZh:
      '控制多语言翻译跳过、修订审校标记与从右到左排版；单语文档通常无需填写，因此默认折叠。',
  },
  profiling: {
    title: 'Conditional profiling (DITAVAL)',
    titleZh: '条件过滤（DITAVAL）',
    subtitle: 'Profiling',
    description:
      'Tags content by audience, platform, product, or revision so a DITAVAL file can include, exclude, or flag it at publish time.',
    descriptionZh:
      '按受众、平台、产品与修订版本给内容打标签，发布时用 DITAVAL 文件包含、排除或高亮对应内容。',
  },
  reuse: {
    title: 'Content reuse (conref)',
    titleZh: '内容复用（Conref）',
    subtitle: 'Reuse',
    description:
      'Pulls a block or inline element from another topic, directly or through a key, so one source of truth feeds many documents.',
    descriptionZh:
      '从其他主题整块引用元素，或通过 key 间接定位，让同一段内容只维护一次、却被多个文档复用。',
  },
  presentation: {
    title: 'Presentation',
    titleZh: '排版展示',
    subtitle: 'Presentation',
    description:
      'Affects rendering only — borders, page width, font scale, column widths — and never changes the content semantics.',
    descriptionZh:
      '只影响渲染外观（边框、页宽、字号、列宽等），不改变内容的语义与结构，可安全删除而不影响含义。',
  },
};

// ---------------------------------------------------------------------------
// Real-world usage scenarios (per attribute name)
// ---------------------------------------------------------------------------

export const DITA_ATTR_USAGE_ZH: Readonly<Record<string, string>> = {
  id: '给章节或段落一个稳定锚点，其他主题用 <xref href="topic.dita#topic_id/port_table"/> 精确跳转；HTML5 输出为 id 属性，PDF 用于内部交叉引用与目录书签，翻译时不应改动。',
  outputclass: '追加一个或多个空格分隔的 CSS 类名，HTML5 发布时原样写入 class 属性，可配合主题 CSS 做高亮、网格布局或品牌样式；PDF 仅在定制 XSLT 时生效。',
  'xml:lang': '声明元素内容的 BCP-47 语言（根元素上必填性最强）：浏览器据此选择断行、字体与朗读语音，DITA-OT 据此决定翻译语言与 PDF 连字符规则。',
  translate: '把品牌名、命令行、代码标识等标记为不翻译，翻译管理系统（TMS）会跳过该元素及其子元素，避免产品名被误译。',
  status: '标记本次修订是新增、修改还是已删除，供审校与发布评审快速识别变更段落；默认不会渲染到 HTML5/PDF，需要时用 outputclass 或 DITAVAL 高亮。',
  dir: '为混合语言段落强制文本方向：嵌入阿拉伯语、希伯来语片段时设为 rtl，或用 lro/rlo 覆盖继承方向，避免双向文本标点错位。',
  audience: '给内容打上读者角色标签（如 admin、developer），发布时用 DITAVAL 只保留目标读者需要的段落，实现单源多版本手册。',
  platform: '标记段落适用的操作系统或运行时（linux、macos、windows），一份主题即可同时服务多平台安装说明，发布时按平台过滤。',
  product: '标记段落适用的产品或版本（cloud、enterprise），发布时按产品线过滤，避免为每个 SKU 复制一份手册。',
  otherprops: '当 audience/platform/product 都不合适时，用自定义标记（如 beta、internal）承载任意条件过滤维度，需在 DITAVAL 中自行声明。',
  props: 'DITAVAL 条件属性的基础属性，供特化元素扩展自定义筛选维度；普通主题直接使用 audience/platform/product 即可。',
  rev: '标记内容所属的产品或文档修订批次（如 2.1），配合 DITAVAL 的 rev 属性可只发布“2.1 新增”的变更说明。',
  conref: '把一个可复用元素（提示框、警告、参数表）整块引入当前主题，源文件改动后所有引用处同步更新；发布时 DITA-OT 在解析阶段展开。',
  conkeyref: '通过 key 间接引用可复用内容，源文件路径变化时只需改 Map 中的 keydef；适合跨手册共享的公共提示与术语。',
  conrefend: '与 conref 组成区间引用（conref="a.dita#t/first" conrefend="a.dita#t/last"），一次引入连续多个同级元素，例如一整组步骤或表格行。',
  conaction: '在复用点做“推入”操作：mark 标记插入位置，pushafter/pushbefore 在其前后推入内容，pushreplace 直接替换当前元素，用于拼装可变章节。',
  href: '指定该元素指向的目标：主题引用写相对 .dita 路径，mapref 写 .ditamap，图片与外部链接写资源地址；发布时据此生成链接或嵌入内容。',
  navtitle: '覆盖目录、导航与 Map 树中显示的文字，不动目标主题的 <title>；适合长标题在导航中需要缩短，或同一主题在不同地图中叫法不同。',
  keys: '为条目定义一个或多个 key 名称，正文用 keyref 引用它；key 由根 Map 解析，实现“一处定义、全局替换”的变量机制。',
  keyref: '通过 key 名称间接指向目标（主题、图片、外部链接或文本变量），重构目录结构时只改 keydef，正文链接全部自动跟随。',
  keyscope: '为嵌套的 key 定义划定独立命名空间，避免子地图与主地图的 key 名冲突；在 keyref 中用 scope.key 形式跨作用域引用。',
  format: '告知处理器目标格式（dita、ditamap、pdf、html、png…），决定是作为 DITA 内容解析还是当作外部资源直接链接。',
  scope: '区分本手册内部（local）、同级独立交付物（peer）与外部系统（external）；影响链接校验、相关链接生成与 HTML5 的 target 行为。',
  type: '声明目标主题或元素类型（concept、task、table…），发布时用于生成正确的链接文字与相关链接关系。',
  'processing-role': '把 keydef 或仅用于变量定义的条目设为 resource-only，使其不进入正文与目录，只作为 key 解析的依据。',
  toc: '决定该条目是否出现在目录与导航中；常用 toc="no" 隐藏封面、版权、colophon 等附属主题。',
  linking: '控制 DITA-OT 自动生成 related-links 的方向：targetonly、sourceonly、normal 或完全关闭（none），避免出现大量无关链接。',
  'collection-type': '告诉处理器子主题之间的阅读关系：sequence 生成“上一篇/下一篇”，choice 生成并列选项导航，family 生成家族式互链。',
  chunk: '指示 DITA-OT 如何切分输出：to-content 合并为单页便于打印，by-topic 每主题一页便于检索，select-* 只保留指定分支。',
  'copy-to': '让同一个主题在地图中以另一个文件名再输出一份（例如不同上下文的别名页），正文内容保持一致、URL 不同。',
  locktitle: '设为 yes 时目录强制使用 Map 中的 navtitle，忽略目标主题标题；需要导航文案与正文标题不一致时使用。',
  title: '旧式地图标题属性，仅为向后兼容保留；新文档应改用 <title> 子元素以便携带内联标记与翻译。',
  othertype: '当 note/@type="other" 时提供自定义标签文字（如“法规提示”），HTML5 会渲染为该文字而非通用 Other。',
  role: '在相关链接中声明目标与当前主题的关系（parent、child、sibling、next…），DITA-OT 据此生成“上级/下一篇”等链接分组。',
  alt: '为图片提供替代文本，HTML5 输出为 alt 属性供读屏软件朗读，PDF 用于图像不可用时的占位说明；无障碍发布的必填项。',
  placement: 'inline 让图片跟随文字流，break 让图片独占一行成为块级图；影响 HTML5 的包裹结构与 PDF 的分页。',
  align: '设置图片、列或单元格的水平对齐；HTML5 输出为 text-align/对齐样式，PDF 由表格与图像 XSLT 应用。',
  width: '指定显示宽度（如 480px、80%、6in），HTML5 写入 width 样式，PDF 按换算后的尺寸排版；不改变原始图片文件。',
  height: '指定显示高度，通常与 width 二选一以免图片比例失真；PDF 排版按该尺寸缩放。',
  scalefit: '设为 yes 时图片按容器（栏目或页面）边界等比缩放，避免大图溢出 PDF 页面或 HTML5 内容区。',
  'xml:space': '设为 preserve 让代码块与预格式化文本中的空格、缩进、换行原样保留；编辑器与发布器都不会压缩空白。',
  scale: '按百分比缩放代码块字号（如 80 让长命令行在 PDF 中放得下），只影响渲染字号，不改变代码内容。',
  frame: '控制表格或预格式化文本的外边框（all、topbot、sides、none…），HTML5 转为边框样式，PDF 由 CALS 表格 XSLT 应用。',
  importance: '把步骤标记为 optional（可跳过）或 required（必需），发布时可选择隐藏可选步骤以生成精简版流程。',
  relcolwidth: '用比例值（1* 2* 3*）声明 simpletable 各列相对宽度，发布时按比例分配可用宽度，避免短列被拉得过宽。',
  keycol: '指定哪一列作为行标题（从 1 开始），HTML5 输出为 th 以提升表格可访问性与读屏体验。',
  colsep: '1 显示、0 隐藏列之间的垂直分隔线，控制表格视觉密度；只影响渲染，不改变单元格结构。',
  rowsep: '1 显示、0 隐藏行之间的水平分隔线，常用于去掉紧凑表格的多余横线。',
  pgwide: '设为 1 让表格在 PDF 中横向占满整页（跨栏），适合宽参数表；HTML5 中通常配合 CSS 处理。',
  cols: '声明 CALS tgroup 的列数，必须与 colspec 数量一致，否则发布时表格列宽与合并计算会错位。',
  colnum: '列的序号（从 1 开始），用于校验 colspec 顺序并与 namest/nameend 的列名对应。',
  colname: '给列一个符号名（如 c1），供 entry 的 namest/nameend 引用以实现跨列合并；entry 上的 colname 则用于直接指定所属列。',
  colwidth: '声明列宽：比例值（1.5*）按比例分配，固定值（120pt、2in）为绝对宽度；决定 PDF 与 HTML5 表格的列比例。',
  namest: '与 nameend 配对，声明横向合并的起始列名；编辑器据此计算 colspan 并在表格中合并单元格显示。',
  nameend: '声明横向合并的结束列名，与 namest 一起定义跨列范围；缺失会导致合并失效并退回单列。',
  morerows: '声明纵向合并的额外行数（rowspan - 1），用于跨行表头或多行合一的说明单元格。',
  valign: '设置单元格内容的垂直对齐（top、middle、bottom），HTML5 转为 vertical-align，PDF 由 CALS 表格排版应用。',
  callout: '为脚注指定自定义标记符号（*、a、1），使正文与脚注编号一一对应，常用于代码行标注。',
};

export const DITA_ATTR_USAGE_EN: Readonly<Record<string, string>> = {
  id: 'Gives a section or block a stable anchor so other topics can jump to it with <xref href="topic.dita#topic_id/port_table"/>. Emitted as the HTML5 id attribute, used for internal PDF cross-references and bookmarks, and never translated.',
  outputclass: 'Appends one or more space-separated CSS class names. HTML5 publishing copies them verbatim into the class attribute for theme styling, highlighting, or grid layouts; PDF uses them only with custom XSLT.',
  'xml:lang': 'Declares the BCP-47 language of the content (most important on the root element): browsers pick line breaking, fonts, and speech, while DITA-OT uses it for translation language and PDF hyphenation.',
  translate: 'Marks brand names, commands, and code identifiers as non-translatable so a TMS skips the element and its descendants instead of mistranslating product names.',
  status: 'Records whether a block is new, changed, or deleted for review and release notes. It is not rendered by default in HTML5/PDF; use outputclass or DITAVAL to surface it.',
  dir: 'Forces text direction for mixed-language content: set rtl for embedded Arabic or Hebrew, or use lro/rlo to override an inherited direction and keep punctuation in place.',
  audience: 'Tags content with a reader role (admin, developer…). A DITAVAL build keeps only the audience it targets, so one source produces role-specific manuals.',
  platform: 'Tags the operating system or runtime a block applies to (linux, macos, windows) so one topic can serve multi-platform install instructions filtered at publish time.',
  product: 'Tags the product edition or version a block applies to (cloud, enterprise) and filters it at publish time instead of duplicating the manual per SKU.',
  otherprops: 'Carries any custom conditional dimension (beta, internal) when audience/platform/product do not fit; declare the matching condition in your DITAVAL file.',
  props: 'Base conditional attribute that specializations extend with custom dimensions; ordinary topics should use audience/platform/product instead.',
  rev: 'Tags content with the product or document revision it belongs to (2.1). A DITAVAL rev filter can then publish only the "new in 2.1" changes.',
  conref: 'Pulls a reusable element (note, warning, parameter row) into the current topic so every reference updates when the source changes; DITA-OT expands it during preprocessing.',
  conkeyref: 'References reusable content through a key, so moving the source file only requires editing a keydef in the map; ideal for shared notes and glossary terms.',
  conrefend: 'Combines with conref for a range reference (conref="a.dita#t/first" conrefend="a.dita#t/last") that pulls in several consecutive sibling elements at once.',
  conaction: 'Pushes content at a reuse point: mark flags the insertion location, pushafter/pushbefore insert around it, and pushreplace replaces the element outright.',
  href: 'Points the element at its target: a relative .dita path for topic references, a .ditamap for mapref, a resource URL for images and external links.',
  navtitle: 'Overrides the text shown in the table of contents, navigation, and map tree without touching the topic <title>; useful for shortening long titles or renaming a shared topic per map.',
  keys: 'Defines one or more key names for the entry that body content references with keyref, giving you one-place-definition, global-substitution variables resolved by the root map.',
  keyref: 'Points indirectly at a target (topic, image, external link, or text variable) through a key name, so restructuring the map updates every reference automatically.',
  keyscope: 'Gives nested key definitions their own namespace so sub-map keys do not collide with the parent map; reference across scopes as scope.key.',
  format: 'Tells the processor what the target is (dita, ditamap, pdf, html, png…), deciding whether it is parsed as DITA content or linked as an external resource.',
  scope: 'Distinguishes content inside this deliverable (local), a sibling deliverable shipped separately (peer), and an external system (external); affects link checking and link generation.',
  type: 'Declares the target topic or element type (concept, task, table…) so published links get the right wording and related-link relationships.',
  'processing-role': 'Set keydef and variable-only entries to resource-only so they never appear in the body or TOC and exist purely for key resolution.',
  toc: 'Controls whether the entry appears in the table of contents; toc="no" is the usual choice for covers, legal notices, and colophons.',
  linking: 'Controls the direction DITA-OT generates related links in — targetonly, sourceonly, normal, or none — preventing floods of irrelevant links.',
  'collection-type': 'Describes how child topics relate: sequence produces previous/next navigation, choice produces alternative links, family produces parent/child/sibling links.',
  chunk: 'Tells DITA-OT how to split output: to-content merges into one page for printing, by-topic keeps one file per topic for search, select-* keeps only the chosen branch.',
  'copy-to': 'Publishes the same topic a second time under another filename (an alias page for a different context) while keeping a single source of content.',
  locktitle: 'When set to yes the TOC always uses the map navtitle and ignores the topic title; use it when navigation wording must differ from the heading.',
  title: 'Legacy map title attribute kept for backward compatibility; new documents should use the <title> element so inline markup and translation work.',
  othertype: 'Supplies the custom label rendered when note/@type="other" (for example "Legal notice") instead of the generic Other caption.',
  role: 'States how the linked topic relates to the current one (parent, child, sibling, next…), so DITA-OT can group rendered links as parent/next/etc.',
  alt: 'Provides the image alternative text: emitted as the HTML5 alt attribute for screen readers and used as a PDF fallback caption, making it mandatory for accessible output.',
  placement: 'inline keeps the image in the text flow while break makes it a standalone block, changing the HTML5 wrapper and PDF pagination.',
  align: 'Sets horizontal alignment for an image, column, or cell. HTML5 maps it to text-align styling and PDF table/image XSLT applies it during layout.',
  width: 'Sets the rendered width (480px, 80%, 6in). HTML5 writes it as a width style and PDF converts it to layout dimensions without touching the source image.',
  height: 'Sets the rendered height; usually paired with width or omitted to preserve the aspect ratio of the image in PDF and HTML5.',
  scalefit: 'When yes, the image scales proportionally to its container (column or page) so large screenshots do not overflow PDF pages or HTML5 content areas.',
  'xml:space': 'preserve keeps spaces, indentation, and line breaks in code blocks and preformatted text exactly as typed; neither editor nor publisher collapses them.',
  scale: 'Shrinks or enlarges code block text by a percentage (80 fits long command lines in PDF) without changing the code content itself.',
  frame: 'Draws the outer border of a table or preformatted block (all, topbot, sides, none…); HTML5 maps it to border styles and PDF table XSLT applies it.',
  importance: 'Marks a step as optional or required, letting a publishing profile hide optional steps to produce a condensed procedure.',
  relcolwidth: 'Declares proportional simpletable column widths (1* 2* 3*) so published tables distribute the available width instead of leaving short columns too wide.',
  keycol: 'Designates which column (1-based) acts as the row header, which HTML5 renders as th for better screen reader table semantics.',
  colsep: '1 draws vertical lines between columns and 0 hides them, tuning table density without changing the cell structure.',
  rowsep: '1 draws horizontal lines between rows and 0 hides them, the usual choice for compact tables with a strong header.',
  pgwide: 'Set to 1 to let the table span the full page width in PDF output (across columns), which suits wide parameter tables.',
  cols: 'Declares the number of columns in a CALS tgroup; it must match the colspec count or published column widths and spans misalign.',
  colnum: 'The 1-based column ordinal, used to validate colspec order and to match the column names referenced by namest/nameend.',
  colname: 'Names a column symbolically (c1) so entry namest/nameend can target it for horizontal spans; on entry it pins the cell to a specific column.',
  colwidth: 'Declares column width as a proportion (1.5*) or an absolute value (120pt, 2in), which drives PDF and HTML5 column proportions.',
  namest: 'Together with nameend, marks the starting column of a horizontal span; the editor uses both to compute colspan and merge the rendered cell.',
  nameend: 'Marks the ending column of a horizontal span started by namest; omitting it breaks the merge and the cell falls back to a single column.',
  morerows: 'Declares how many additional rows a cell spans vertically (rowspan - 1), used for grouped header cells and multi-row descriptions.',
  valign: 'Sets vertical alignment of cell content (top, middle, bottom); HTML5 maps it to vertical-align and PDF CALS layout applies it.',
  callout: 'Assigns a custom footnote marker (*, a, 1) so an inline marker and its footnote match, a common pattern for annotating code lines.',
};

// ---------------------------------------------------------------------------
// Concrete examples (only where an example removes ambiguity)
// ---------------------------------------------------------------------------

export const DITA_ATTR_EXAMPLE_ZH: Readonly<Record<string, string>> = {
  id: 'id="port_table"',
  outputclass: 'outputclass="language-bash"',
  'xml:lang': 'xml:lang="zh-CN"',
  translate: 'translate="no"',
  status: 'status="changed"',
  dir: 'dir="rtl"',
  audience: 'audience="admin developer"',
  platform: 'platform="linux"',
  product: 'product="cloud"',
  otherprops: 'otherprops="beta"',
  props: 'props="internal"',
  rev: 'rev="2.1"',
  conref: 'conref="shared/reuse.dita#reuse/note_warn"',
  conkeyref: 'conkeyref="shared_notes/warn_power"',
  conrefend: 'conref="a.dita#t/first" conrefend="a.dita#t/last"',
  conaction: 'conaction="pushafter"',
  href: 'href="concepts/overview.dita"',
  navtitle: 'navtitle="安装与部署"',
  keys: 'keys="prod_name"',
  keyref: 'keyref="prod_name"',
  keyscope: 'keyscope="cloud"',
  format: 'format="pdf"',
  scope: 'scope="external"',
  type: 'type="concept"',
  'processing-role': 'processing-role="resource-only"',
  toc: 'toc="no"',
  linking: 'linking="none"',
  'collection-type': 'collection-type="sequence"',
  chunk: 'chunk="to-content"',
  'copy-to': 'copy-to="admin-guide-alias.dita"',
  locktitle: 'locktitle="yes"',
  title: 'title="产品手册"',
  othertype: 'type="other" othertype="法规提示"',
  role: 'role="parent"',
  alt: 'alt="登录对话框截图"',
  placement: 'placement="break"',
  align: 'align="center"',
  width: 'width="480px"',
  height: 'height="320px"',
  scalefit: 'scalefit="yes"',
  'xml:space': 'xml:space="preserve"',
  scale: 'scale="80"',
  frame: 'frame="all"',
  importance: 'importance="optional"',
  relcolwidth: 'relcolwidth="1* 2* 3*"',
  keycol: 'keycol="1"',
  colsep: 'colsep="0"',
  rowsep: 'rowsep="1"',
  pgwide: 'pgwide="1"',
  cols: 'cols="3"',
  colnum: 'colnum="2"',
  colname: 'colname="c1"',
  colwidth: 'colwidth="1.5*"',
  namest: 'namest="c1" nameend="c3"',
  nameend: 'namest="c1" nameend="c3"',
  morerows: 'morerows="1"',
  valign: 'valign="middle"',
  callout: 'callout="*"',
};

export const DITA_ATTR_EXAMPLE_EN: Readonly<Record<string, string>> = {
  id: 'id="port_table"',
  outputclass: 'outputclass="language-bash"',
  'xml:lang': 'xml:lang="en-US"',
  translate: 'translate="no"',
  status: 'status="changed"',
  dir: 'dir="rtl"',
  audience: 'audience="admin developer"',
  platform: 'platform="linux"',
  product: 'product="cloud"',
  otherprops: 'otherprops="beta"',
  props: 'props="internal"',
  rev: 'rev="2.1"',
  conref: 'conref="shared/reuse.dita#reuse/note_warn"',
  conkeyref: 'conkeyref="shared_notes/warn_power"',
  conrefend: 'conref="a.dita#t/first" conrefend="a.dita#t/last"',
  conaction: 'conaction="pushafter"',
  href: 'href="concepts/overview.dita"',
  navtitle: 'navtitle="Install and deploy"',
  keys: 'keys="prod_name"',
  keyref: 'keyref="prod_name"',
  keyscope: 'keyscope="cloud"',
  format: 'format="pdf"',
  scope: 'scope="external"',
  type: 'type="concept"',
  'processing-role': 'processing-role="resource-only"',
  toc: 'toc="no"',
  linking: 'linking="none"',
  'collection-type': 'collection-type="sequence"',
  chunk: 'chunk="to-content"',
  'copy-to': 'copy-to="admin-guide-alias.dita"',
  locktitle: 'locktitle="yes"',
  title: 'title="Product guide"',
  othertype: 'type="other" othertype="Legal notice"',
  role: 'role="parent"',
  alt: 'alt="Screenshot of the login dialog"',
  placement: 'placement="break"',
  align: 'align="center"',
  width: 'width="480px"',
  height: 'height="320px"',
  scalefit: 'scalefit="yes"',
  'xml:space': 'xml:space="preserve"',
  scale: 'scale="80"',
  frame: 'frame="all"',
  importance: 'importance="optional"',
  relcolwidth: 'relcolwidth="1* 2* 3*"',
  keycol: 'keycol="1"',
  colsep: 'colsep="0"',
  rowsep: 'rowsep="1"',
  pgwide: 'pgwide="1"',
  cols: 'cols="3"',
  colnum: 'colnum="2"',
  colname: 'colname="c1"',
  colwidth: 'colwidth="1.5*"',
  namest: 'namest="c1" nameend="c3"',
  nameend: 'namest="c1" nameend="c3"',
  morerows: 'morerows="1"',
  valign: 'valign="middle"',
  callout: 'callout="*"',
};

// ---------------------------------------------------------------------------
// Enum value labels (keyed by attribute name, then by raw XML value)
// ---------------------------------------------------------------------------

function buildScaleLabels(): Readonly<Record<string, DitaAttributeValueLabel>> {
  const labels: Record<string, DitaAttributeValueLabel> = {};
  for (const percent of [50, 60, 70, 80, 90, 100, 110, 120]) {
    labels[String(percent)] = {
      label: `${percent}% of the base font size`,
      labelZh: `基础字号的 ${percent}%`,
    };
  }
  return labels;
}

export const DITA_ATTR_VALUE_LABELS: Readonly<
  Record<string, Readonly<Record<string, DitaAttributeValueLabel>>>
> = {
  'xml:lang': {
    'zh-CN': { label: 'Simplified Chinese (China)', labelZh: '简体中文（中国大陆）' },
    'en-US': { label: 'English (United States)', labelZh: '英语（美国）' },
    'ja-JP': { label: 'Japanese (Japan)', labelZh: '日语（日本）' },
    'de-DE': { label: 'German (Germany)', labelZh: '德语（德国）' },
  },
  translate: {
    yes: { label: 'Translate this content', labelZh: '需要翻译' },
    no: { label: 'Do not translate (brand or command names)', labelZh: '不翻译（如品牌名、命令）' },
  },
  status: {
    new: { label: 'New content', labelZh: '新增' },
    changed: { label: 'Changed', labelZh: '已修改' },
    deleted: { label: 'Deleted (kept for review)', labelZh: '已删除（暂留待审）' },
    unchanged: { label: 'Unchanged', labelZh: '未变更' },
  },
  dir: {
    ltr: { label: 'Left to right', labelZh: '从左到右' },
    rtl: { label: 'Right to left (Arabic, Hebrew)', labelZh: '从右到左（阿拉伯语等）' },
    lro: { label: 'Force LTR override', labelZh: '强制左到右覆盖' },
    rlo: { label: 'Force RTL override', labelZh: '强制右到左覆盖' },
  },
  conaction: {
    mark: { label: 'Mark the insertion point', labelZh: '标记插入位置' },
    pushafter: { label: 'Push content after this element', labelZh: '在此元素之后推入内容' },
    pushbefore: { label: 'Push content before this element', labelZh: '在此元素之前推入内容' },
    pushreplace: { label: 'Replace this element with the referenced content', labelZh: '用引用内容替换此元素' },
    '-dita-use-conref-target': {
      label: 'Inherit the conref target value (internal)',
      labelZh: '沿用 conref 目标值（内部标记）',
    },
  },
  format: {
    dita: { label: 'DITA topic', labelZh: 'DITA 主题' },
    ditamap: { label: 'DITA map', labelZh: 'DITA 地图' },
    html: { label: 'HTML page', labelZh: 'HTML 网页' },
    pdf: { label: 'PDF document', labelZh: 'PDF 文档' },
    markdown: { label: 'Markdown file', labelZh: 'Markdown 文件' },
    png: { label: 'PNG image', labelZh: 'PNG 图片' },
    svg: { label: 'SVG vector image', labelZh: 'SVG 矢量图' },
  },
  scope: {
    local: { label: 'Inside this document set', labelZh: '本手册内部' },
    peer: { label: 'Sibling deliverable shipped separately', labelZh: '同级文档（独立交付）' },
    external: { label: 'External website or system', labelZh: '外部链接' },
  },
  type: {
    topic: { label: 'Generic topic', labelZh: '通用主题' },
    concept: { label: 'Concept topic', labelZh: '概念主题' },
    task: { label: 'Task topic', labelZh: '任务主题' },
    reference: { label: 'Reference topic', labelZh: '参考主题' },
    glossentry: { label: 'Glossary entry', labelZh: '术语条目' },
    section: { label: 'Section element', labelZh: '章节元素' },
    fig: { label: 'Figure element', labelZh: '插图元素' },
    table: { label: 'Table element', labelZh: '表格元素' },
    li: { label: 'List item', labelZh: '列表项' },
    fn: { label: 'Footnote', labelZh: '脚注' },
    note: { label: 'Note callout', labelZh: '提示框' },
    tip: { label: 'Tip callout', labelZh: '技巧提示' },
    important: { label: 'Important callout', labelZh: '重要提示' },
    remember: { label: 'Remember callout', labelZh: '请记住' },
    attention: { label: 'Attention callout', labelZh: '注意' },
    caution: { label: 'Caution callout', labelZh: '小心' },
    notice: { label: 'Notice callout', labelZh: '告示' },
    warning: { label: 'Warning callout', labelZh: '警告' },
    danger: { label: 'Danger callout', labelZh: '危险' },
    restriction: { label: 'Restriction callout', labelZh: '限制' },
    fastpath: { label: 'Fast path callout', labelZh: '快捷路径' },
    trouble: { label: 'Troubleshooting callout', labelZh: '故障排查' },
    other: { label: 'Other (set othertype)', labelZh: '其他（请填写 othertype）' },
  },
  'processing-role': {
    normal: { label: 'Appears in the output', labelZh: '正常输出' },
    'resource-only': { label: 'Resource only, hidden from the body', labelZh: '仅作资源（不进正文）' },
  },
  toc: {
    yes: { label: 'Included in the table of contents', labelZh: '包含在目录中' },
    no: { label: 'Excluded from the table of contents', labelZh: '不包含在目录中' },
  },
  linking: {
    targetonly: { label: 'Only targets of this topic get links', labelZh: '仅在目标主题生成回链' },
    sourceonly: { label: 'Only topics linking here get links', labelZh: '仅在来源主题生成链接' },
    normal: { label: 'Generate links in both directions', labelZh: '双向自动生成相关链接' },
    none: { label: 'Do not generate related links', labelZh: '不自动生成相关链接' },
  },
  'collection-type': {
    unordered: { label: 'Unordered siblings', labelZh: '无序同级' },
    sequence: { label: 'Sequential reading order', labelZh: '顺序阅读（上一篇/下一篇）' },
    choice: { label: 'Alternative choices', labelZh: '互斥选项' },
    family: { label: 'Family (parent, child, sibling)', labelZh: '家族（父/子/兄弟）' },
  },
  chunk: {
    'to-content': { label: 'Merge into one output page', labelZh: '合并为单个输出页' },
    'to-navigation': { label: 'Generate a navigation page', labelZh: '生成导航页' },
    'by-topic': { label: 'One output file per topic', labelZh: '每个主题一个输出文件' },
    'by-document': { label: 'One output file per document', labelZh: '每个文档一个输出文件' },
    'select-topic': { label: 'Keep only the selected topic', labelZh: '仅保留所选主题' },
    'select-document': { label: 'Keep only the selected document', labelZh: '仅保留所选文档' },
    'select-branch': { label: 'Keep the selected branch', labelZh: '保留所选分支' },
  },
  locktitle: {
    yes: { label: 'Always use the map navtitle', labelZh: '始终使用地图中的 navtitle' },
    no: { label: 'Prefer the target topic title', labelZh: '优先使用目标主题标题' },
  },
  role: {
    parent: { label: 'Parent topic', labelZh: '父主题' },
    child: { label: 'Child topic', labelZh: '子主题' },
    sibling: { label: 'Sibling topic', labelZh: '同级主题' },
    friend: { label: 'Loose / friendly association', labelZh: '友好关联' },
    next: { label: 'Next in sequence', labelZh: '下一篇' },
    previous: { label: 'Previous in sequence', labelZh: '上一篇' },
    other: { label: 'Other relationship', labelZh: '其他关系' },
  },
  placement: {
    inline: { label: 'Inline with the text flow', labelZh: '随文行内' },
    break: { label: 'Standalone block', labelZh: '独立块级' },
  },
  align: {
    left: { label: 'Align left', labelZh: '左对齐' },
    center: { label: 'Center', labelZh: '居中' },
    right: { label: 'Align right', labelZh: '右对齐' },
    justify: { label: 'Justify both edges', labelZh: '两端对齐' },
    char: { label: 'Align on a character', labelZh: '按字符对齐' },
    current: { label: 'Keep the current alignment', labelZh: '沿用当前对齐' },
  },
  scalefit: {
    yes: { label: 'Scale to fit the container', labelZh: '按容器缩放' },
    no: { label: 'Keep the intrinsic size', labelZh: '保持原始尺寸' },
  },
  'xml:space': {
    preserve: { label: 'Preserve all whitespace verbatim', labelZh: '原样保留空白' },
  },
  scale: buildScaleLabels(),
  frame: {
    top: { label: 'Top border only', labelZh: '仅上边框' },
    bottom: { label: 'Bottom border only', labelZh: '仅下边框' },
    topbot: { label: 'Top and bottom borders', labelZh: '上下边框' },
    all: { label: 'Full border', labelZh: '四周边框' },
    sides: { label: 'Left and right borders', labelZh: '左右边框' },
    none: { label: 'No border', labelZh: '无边框' },
  },
  importance: {
    optional: { label: 'Optional step (can be skipped)', labelZh: '可选步骤（可跳过）' },
    required: { label: 'Required step', labelZh: '必需步骤' },
  },
  colsep: {
    '1': { label: 'Show vertical dividers', labelZh: '显示列分隔线（1）' },
    '0': { label: 'Hide vertical dividers', labelZh: '隐藏列分隔线（0）' },
  },
  rowsep: {
    '1': { label: 'Show horizontal dividers', labelZh: '显示行分隔线（1）' },
    '0': { label: 'Hide horizontal dividers', labelZh: '隐藏行分隔线（0）' },
  },
  pgwide: {
    '1': { label: 'Span the full page width', labelZh: '占满整页宽度（1）' },
    '0': { label: 'Keep the normal text width', labelZh: '保持正文宽度（0）' },
  },
  valign: {
    top: { label: 'Align to the top', labelZh: '顶端对齐' },
    middle: { label: 'Align to the middle', labelZh: '垂直居中' },
    bottom: { label: 'Align to the bottom', labelZh: '底端对齐' },
  },
  outputclass: {
    'language-xml': { label: 'XML syntax highlighting', labelZh: 'XML 语法高亮' },
    'language-bash': { label: 'Bash / shell syntax highlighting', labelZh: 'Bash/Shell 语法高亮' },
    'language-typescript': { label: 'TypeScript syntax highlighting', labelZh: 'TypeScript 语法高亮' },
    'language-json': { label: 'JSON syntax highlighting', labelZh: 'JSON 语法高亮' },
    'language-yaml': { label: 'YAML syntax highlighting', labelZh: 'YAML 语法高亮' },
    'language-java': { label: 'Java syntax highlighting', labelZh: 'Java 语法高亮' },
    'language-sql': { label: 'SQL syntax highlighting', labelZh: 'SQL 语法高亮' },
  },
};

// ---------------------------------------------------------------------------
// Bilingual query helpers
// ---------------------------------------------------------------------------

function isEnglish(locale: UiLocale = 'zh-CN'): boolean {
  return locale === 'en';
}

export function getAttributeGroupMeta(
  group: DitaAttributeGroup,
  locale: UiLocale = 'zh-CN',
): { title: string; subtitle: string; description: string } {
  const meta = DITA_ATTRIBUTE_GROUP_META[group];
  return {
    title: isEnglish(locale) ? meta.title : meta.titleZh,
    subtitle: meta.subtitle,
    description: isEnglish(locale) ? meta.description : meta.descriptionZh,
  };
}

export function getAttributeUsage(
  spec: DitaAttributeSpec,
  locale: UiLocale = 'zh-CN',
): string | undefined {
  if (isEnglish(locale)) {
    return spec.usage ?? DITA_ATTR_USAGE_EN[spec.name] ?? spec.description;
  }
  return spec.usageZh ?? DITA_ATTR_USAGE_ZH[spec.name] ?? spec.descriptionZh ?? spec.description;
}

export function getAttributeExample(
  spec: DitaAttributeSpec,
  locale: UiLocale = 'zh-CN',
): string | undefined {
  if (isEnglish(locale)) {
    return spec.example ?? DITA_ATTR_EXAMPLE_EN[spec.name];
  }
  return spec.exampleZh ?? DITA_ATTR_EXAMPLE_ZH[spec.name] ?? DITA_ATTR_EXAMPLE_EN[spec.name];
}

export function getAttributeValueLabel(
  spec: DitaAttributeSpec,
  value: string,
  locale: UiLocale = 'zh-CN',
): string | undefined {
  const entry = spec.valueLabels?.[value] ?? DITA_ATTR_VALUE_LABELS[spec.name]?.[value];
  if (!entry) return undefined;
  return isEnglish(locale) ? entry.label : entry.labelZh;
}

/**
 * Render a `<select>` option label that keeps the raw XML value visible, e.g.
 * `强制左到右覆盖 (lro)` / `Force LTR override (lro)`. Values without a registered
 * human-readable label fall back to the raw value so custom/specialized values still render.
 */
export function formatAttributeOptionLabel(
  spec: DitaAttributeSpec,
  value: string,
  locale: UiLocale = 'zh-CN',
): string {
  const label = getAttributeValueLabel(spec, value, locale);
  if (!label || label === value) return value;
  return `${label} (${value})`;
}

/** Group ordering used by both attribute inspectors. */
export const DITA_ATTRIBUTE_GROUP_ORDER: readonly DitaAttributeGroup[] = [
  'element',
  'core',
  'profiling',
  'reuse',
  'presentation',
  'localization',
];
