import type { LocalizedString } from '../i18n/index.js';
import type { DocSlug } from '../i18n/locales.js';

export type FeatureIcon =
  | 'hub'
  | 'dual'
  | 'outline'
  | 'keys'
  | 'map'
  | 'git'
  | 'publish'
  | 'ai'
  | 'i18n';

export interface Capability {
  id: FeatureIcon;
  index: string;
  title: LocalizedString;
  summary: LocalizedString;
  bullets: { zh: string[]; en: string[] };
  screenshot?: { src: LocalizedString; alt: LocalizedString };
  docs: DocSlug;
}

/** Nine capabilities, each anchored in shipped code and covered by the automated suite. */
export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'hub',
    index: '01',
    title: { zh: '从手册开始，待办不丢', en: 'Start from a manual, never lose a task' },
    summary: {
      zh: '打开就是一张手册台：每本手册有多少章节、在哪个分支、谁在等你，都写在卡片上；右侧按「我收到的 / 我委派的」列出待办，带截止日期和逾期提醒，写完一键标记完成。',
      en: 'The workbench opens on your manuals: each card shows how many chapters it holds, which branch is active and who is waiting on you, while the task rail groups what you received and delegated with due dates, overdue badges and one-click completion.',
    },
    bullets: {
      zh: [
        '一本手册一张卡片，章节数、分支与待办一眼看清',
        '任务带负责人、截止日期与备注，逾期自动提醒',
        '委派、转派、标记完成都不改动文档本身',
      ],
      en: [
        'One card per manual with its chapter count, branch and open work',
        'Tasks carry an owner, due date and notes, with automatic overdue reminders',
        'Assigning, reassigning and completing never touch the documents',
      ],
    },
    screenshot: {
      src: { zh: '/images/manual-hub.webp', en: '/images/en/manual-hub.webp' },
      alt: {
        zh: 'DITAEditor 手册工作台：手册卡片与我的编辑任务',
        en: 'DITAEditor manual workbench with manual cards and my assignments',
      },
    },
    docs: 'features',
  },
  {
    id: 'dual',
    index: '02',
    title: { zh: '双模式编辑，改完不跑版', en: 'Two editing modes, nothing breaks' },
    summary: {
      zh: '平时像写普通文档一样改内容，要精细控制时切到源码视图；两边始终是同一份文件。切回可视化前会自动检查，格式坏了一次性定位到具体行列。',
      en: 'Edit content the way you would in any word processor, and switch to the source view when you need precision — both sides are always the same file. Switching back runs a format check that points to the exact line and column.',
    },
    bullets: {
      zh: [
        '标题、列表、表格、提示框都是真正的结构，不会被写成「看起来像」的样子',
        '改一个字，版本记录里就只有一行变化',
        '注释、特殊标记与自定义标签来回切换一字不丢',
      ],
      en: [
        'Headings, lists, tables and notes stay real structure, never something that merely looks right',
        'Change one word and the version history shows exactly one changed line',
        'Comments, special markers and custom tags survive every switch',
      ],
    },
    screenshot: {
      src: { zh: '/images/dual-view.webp', en: '/images/en/dual-view.webp' },
      alt: {
        zh: 'DITAEditor 双模式编辑：可视化与源码同步',
        en: 'DITAEditor dual-mode editing with visual and source views in sync',
      },
    },
    docs: 'features',
  },
  {
    id: 'outline',
    index: '03',
    title: { zh: '文档大纲：长文不再迷路', en: 'Outline: never lose your place' },
    summary: {
      zh: '编辑器左侧常驻一份大纲，可以折叠到只看章节，也可以展开到每个段落；点一下跳到正文，光标移动时大纲同步高亮。想调整章节顺序，直接拖动即可，系统会先判断哪些位置是安全的。',
      en: 'A collapsible outline sits beside the editor: collapse it to chapters or expand it to every paragraph, click to jump into the text, and watch it highlight as the caret moves. To reorder, just drag — the editor tells you which positions are safe.',
    },
    bullets: {
      zh: [
        '章节结构与每个段落都能在左侧看清，点一下即定位',
        '拖动调整顺序，跨章节、跨列表移动也会先判断是否安全',
        '键盘也能排序；别人正在编辑的文件自动禁止拖动，避免误改',
      ],
      en: [
        'See the section structure and every block at a glance, and click to jump',
        'Drag to reorder, with cross-section and cross-list moves checked first',
        'Reordering works from the keyboard too, and files other people are editing stay locked',
      ],
    },
    screenshot: {
      src: { zh: '/images/outline.webp', en: '/images/en/outline.webp' },
      alt: {
        zh: 'DITAEditor 文档大纲：章节结构与段落定位、拖拽重排',
        en: 'DITAEditor document outline with section structure, locating and drag reordering',
      },
    },
    docs: 'features',
  },
  {
    id: 'keys',
    index: '04',
    title: { zh: '单一信息源：写一次，到处复用', en: 'Write once, reuse everywhere' },
    summary: {
      zh: '产品名、版本号、接口地址只需定义一次，改一处，所有引用它的手册同时更新；被复用的内容以只读卡片显示，谁在引用什么一目了然。要按版本或客户裁剪内容时，切换一套过滤方案就能预览效果，原文一字不动。',
      en: 'Define a product name, version number or endpoint once and every manual that references it updates together; reused content appears as a read-only card so you can see what depends on what. To tailor output by version or customer, switch a filter profile and preview it — the source never changes.',
    },
    bullets: {
      zh: [
        '产品名、版本号、接口地址集中维护，改一处全局同步',
        '新建和改名都在键面板完成，不用记语法',
        '复用内容只读展示，循环引用当场拦住；过滤预览不改原文',
      ],
      en: [
        'Product names, versions and endpoints live in one place and update everywhere',
        'Create and rename keys in the panel without memorising markup',
        'Reused content renders read-only with circular references blocked, and filter previews leave the source untouched',
      ],
    },
    screenshot: {
      src: { zh: '/images/single-sourcing.webp', en: '/images/en/single-sourcing.webp' },
      alt: {
        zh: 'DITAEditor 键面板：集中维护产品名与版本号',
        en: 'DITAEditor key panel maintaining product names and versions',
      },
    },
    docs: 'features',
  },
  {
    id: 'map',
    index: '05',
    title: { zh: '整本书的结构，拖出来', en: 'Shape the whole book by dragging' },
    summary: {
      zh: '章节挂在哪里、以什么顺序出现，在一棵可视化目录树里排好；新增章节从模板起步，标题、正文、表格骨架天然合规，不会写出格式不对的文档。',
      en: 'Decide which chapter sits where and in what order on a visual tree; new chapters start from a template, so headings, body and table skeletons are valid from the first keystroke.',
    },
    bullets: {
      zh: [
        '整本书、子地图与附录在同一棵树里编排',
        '新增章节直接套用模板，格式从源头就正确',
        '排序与移动都写回标准 DITA 文件，不产生私有数据',
      ],
      en: [
        'Books, sub-maps and appendices are orchestrated in one tree',
        'New chapters start from templates, so structure is right from the start',
        'Every move is written back to standard DITA files with no private data',
      ],
    },
    screenshot: {
      src: { zh: '/images/workbench.webp', en: '/images/en/workbench.webp' },
      alt: { zh: 'DITAEditor Map 树与写作工作台', en: 'DITAEditor map tree and authoring workbench' },
    },
    docs: 'features',
  },
  {
    id: 'git',
    index: '06',
    title: { zh: '改稿不冲突：草稿、对比、合并', en: 'Collaborate without collisions' },
    summary: {
      zh: '每个人未提交的改动都留在自己的草稿区，共享版本始终是干净、可发布的基线；要提交时先自动体检，再并排看差异，确认后才并入。合并前就能看到会不会冲突，真冲突也能逐处解决。',
      en: 'Everyone’s uncommitted work stays in a private draft area, so the shared version is always a clean, publishable baseline. Check-in runs a health check first, shows a side-by-side diff, and merges only after you confirm — conflicts are predicted before anything is touched.',
    },
    bullets: {
      zh: [
        '共享文件始终保持可发布状态，个人草稿彼此不可见',
        '提交前自动检查格式与结构，问题直接跳到出错行',
        '差异并排看、合并前预判冲突，历史与标签可随时回退',
      ],
      en: [
        'The shared tree stays publishable while private drafts stay private',
        'Check-in validates format and structure and jumps straight to the problem line',
        'Diffs sit side by side, conflicts are predicted up front, and history or tags restore any point',
      ],
    },
    screenshot: {
      src: { zh: '/images/git-diff.webp', en: '/images/en/git-diff.webp' },
      alt: { zh: 'DITAEditor 本地版本、协作锁与提交历史', en: 'DITAEditor local versions, collaboration locks and history' },
    },
    docs: 'features',
  },
  {
    id: 'publish',
    index: '07',
    title: { zh: '一键发布网页与中文 PDF', en: 'Publish HTML and Chinese PDF in one click' },
    summary: {
      zh: '基于官方 DITA 工具链产出网页与 PDF，内置严格校验；四套成品主题，可换 logo 与品牌色，发布完就是能交付的成品。中文 PDF 所需字体已打包，不用另配 Java。',
      en: 'Publishing runs on the official DITA toolchain with strict validation built in. Four finished themes accept your logo and brand colour, and the output is ready to hand over; Chinese PDF fonts are bundled, so no Java setup is needed.',
    },
    bullets: {
      zh: [
        '报错直接指到原文行号，改完再发',
        '四套主题开箱即用，品牌色与 logo 按手册保存',
        '产物可直接双击打开，或打包分发给客户',
      ],
      en: [
        'Errors point straight at the source line, so you fix and republish',
        'Four ready-made themes with logo and brand colour saved per manual',
        'Output opens from disk or ships to customers as a package',
      ],
    },
    screenshot: {
      src: { zh: '/images/publish.webp', en: '/images/en/publish.webp' },
      alt: { zh: 'DITAEditor 发布对话框、主题与构建日志', en: 'DITAEditor publish dialog with themes and build log' },
    },
    docs: 'features',
  },
  {
    id: 'ai',
    index: '08',
    title: { zh: 'AI 改写，改动你说了算', en: 'AI edits, you decide' },
    summary: {
      zh: '让 AI 起草或改写一段内容，它只会给出候选片段；写入前你会看到改了什么、影响哪几行，确认后才落到文档，一次撤销即可全部回退。密钥只保存在服务端。',
      en: 'Ask AI to draft or rewrite a passage and it only ever proposes a fragment. You see what changed and which lines it touches, nothing is written until you confirm, and a single undo reverts the whole change. Keys stay on the server.',
    },
    bullets: {
      zh: [
        '先看差异再决定是否写入，绝不直接覆盖文档',
        '可以只改选中的一段、某几行或整篇',
        '写入后一步撤销；格式或结构不达标会自动重试',
      ],
      en: [
        'Review the diff before anything is written — no silent overwrites',
        'Target a selection, a few lines, or the whole topic',
        'One undo reverts it, and failed format or structure checks trigger an automatic retry',
      ],
    },
    screenshot: {
      src: { zh: '/images/ai-diff.webp', en: '/images/en/ai-diff.webp' },
      alt: { zh: 'DITAEditor AI 提案 Diff 审阅', en: 'DITAEditor AI proposal diff review' },
    },
    docs: 'ai-setup',
  },
  {
    id: 'i18n',
    index: '09',
    title: { zh: '中英文界面一键切换', en: 'Switch the whole UI between Chinese and English' },
    summary: {
      zh: '界面、对话框、提示与文档站都提供中英两套，切换即时生效并记住偏好；日期、时长与 PDF 字体也随语言调整。',
      en: 'The UI, dialogs, messages and docs site all ship in Chinese and English; switching is instant and remembered, with dates, durations and PDF fonts following the language.',
    },
    bullets: {
      zh: [
        '整套界面与错误提示都有中英两版，不会出现「半截英文」',
        '语言偏好自动记住，不用每次重选',
        '官网与文档站同样中英对称，方便对外分享',
      ],
      en: [
        'The whole UI and its error messages are translated, with no half-English corners',
        'Your language choice is remembered',
        'The site and docs mirror both languages for sharing with customers',
      ],
    },
    screenshot: {
      src: { zh: '/images/bilingual.webp', en: '/images/en/bilingual.webp' },
      alt: { zh: 'DITAEditor 工作台的英文界面', en: 'DITAEditor workbench in Chinese' },
    },
    docs: 'architecture',
  },
];

export interface QuickStartTab {
  id: 'docker' | 'pnpm' | 'ai';
  labelKey: 'docker' | 'pnpm' | 'ai';
  language: string;
  code: string;
}

export const QUICK_START_TABS: readonly QuickStartTab[] = [
  {
    id: 'docker',
    labelKey: 'docker',
    language: 'bash',
    code: `# 1. Build the single container (Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK)
docker build -t ditaeditor:1.0.0 .

# 2. Run it with a persistent data volume
docker run -d --name ditaeditor \\
  -p 3001:3001 \\
  -v dita_data:/data \\
  -e PORT=3001 \\
  ditaeditor:1.0.0

# 3. Open the workbench
open http://localhost:3001`,
  },
  {
    id: 'pnpm',
    labelKey: 'pnpm',
    language: 'bash',
    code: `# Requirements: Node >= 20, pnpm 11, local JRE 21 + DITA-OT for publishing
pnpm install
pnpm -r build

# API (Fastify + SQLite + DITA-OT runner) on :3001
pnpm --filter @dita/api dev

# Web workbench on :5173 with /api proxied to :3001
pnpm --filter @dita/web dev

# Full verification
pnpm -r build && pnpm -r typecheck && pnpm -r test`,
  },
  {
    id: 'ai',
    labelKey: 'ai',
    language: 'bash',
    code: `# Server-side only — never exposed to the browser
DEEPSEEK_API_KEY=sk-... \\
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 \\
DEEPSEEK_MODEL=deepseek-chat \\
DITA_PUBLISH_CONCURRENCY=1 \\
docker run -d -p 3001:3001 -v dita_data:/data \\
  -e DEEPSEEK_API_KEY -e DEEPSEEK_BASE_URL -e DEEPSEEK_MODEL \\
  ditaeditor:1.0.0

# Or configure it in the UI (admin only)
# Settings → AI 配置 → provider / baseURL / model / apiKey
# GET /api/ai/config returns maskedApiKey only.`,
  },
];
