import type { LocalizedString } from '../i18n/index.js';
import type { DocSlug } from '../i18n/locales.js';

export type FeatureIcon = 'dual' | 'keys' | 'map' | 'lock' | 'publish' | 'ai';

export interface Capability {
  id: FeatureIcon;
  index: string;
  title: LocalizedString;
  summary: LocalizedString;
  bullets: { zh: string[]; en: string[] };
  screenshot?: { src: string; alt: LocalizedString };
  docs: DocSlug;
}

/** Six capabilities, each anchored in shipped code and covered by the 201-test suite. */
export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'dual',
    index: '01',
    title: { zh: '双模无损编辑', en: 'Lossless dual-mode editing' },
    summary: {
      zh: 'ProseMirror 精细建模 DITA 1.3 块级与行内元素，未知或特化元素通过 unknown_* 节点原样透传；CodeMirror 6 提供 XML 源码、补全与良构拦截。',
      en: 'ProseMirror models DITA 1.3 block and inline elements precisely while unknown or specialised elements pass through as unknown_* nodes; CodeMirror 6 provides XML source, completion and well-formedness guards.',
    },
    bullets: {
      zh: [
        '行内元素用 ProseMirror inline node 建模，空元素与嵌套顺序永不丢失',
        'rawAttrs 按原始顺序保存，序列化幂等，改一字只变一行',
        '切换可视化前强制 checkXmlWellFormed，错误精确到行列',
      ],
      en: [
        'Inline elements are ProseMirror nodes, so empty tags and nesting order never collapse',
        'rawAttrs keeps original attribute order; serialization is idempotent and one edit is one line',
        'checkXmlWellFormed gates the visual mode with exact line/column errors',
      ],
    },
    screenshot: {
      src: '/images/dual-view.webp',
      alt: {
        zh: 'DITAEditor 可视化与 XML 源码双模编辑',
        en: 'DITAEditor visual and XML source dual-mode editing',
      },
    },
    docs: 'features',
  },
  {
    id: 'keys',
    index: '02',
    title: { zh: '单一信息源', en: 'Single sourcing' },
    summary: {
      zh: 'Root Map BFS 构建键空间并支持 keyscope；conref / conkeyref 只读展开并做 DFS 环路与特化兼容检查；.ditaval 提供全部显示 / 淡化 / 隐藏三态投影。',
      en: 'A BFS keyspace over the root map with keyscope support; conref / conkeyref expand read-only with DFS cycle and specialisation checks; .ditaval drives show / dim / hide projection.',
    },
    bullets: {
      zh: [
        'keydef 与 keyref 解析跨 Map 与 keyscope 传播',
        'conref 展开永不写回源文件，环路直接拦截',
        'DITAVAL 过滤与 flag 不修改底层 XML',
      ],
      en: [
        'keydef and keyref resolution propagates across maps and keyscopes',
        'conref expansion never writes back to the source and cycles are blocked',
        'DITAVAL filtering and flagging leave the underlying XML untouched',
      ],
    },
    screenshot: {
      src: '/images/single-sourcing.webp',
      alt: {
        zh: 'DITAEditor 单一信息源与 DITAVAL 过滤',
        en: 'DITAEditor single sourcing and DITAVAL filtering',
      },
    },
    docs: 'features',
  },
  {
    id: 'map',
    index: '03',
    title: { zh: 'Map / Bookmap 编排', en: 'Map / bookmap orchestration' },
    summary: {
      zh: 'react-arborist 可视化 Map 树，支持拖拽层级、模板建 Topic、保留 reltable 与 topicmeta；路径工具是前后端同构的 POSIX 实现。',
      en: 'A visual map tree built on react-arborist with drag-and-drop hierarchy, template-based topics, and preserved reltable plus topicmeta; path utilities are isomorphic POSIX.',
    },
    bullets: {
      zh: [
        'Map、Bookmap 与嵌套 mapref 一致编排',
        '新建主题直接复用 DITA 1.3 模板',
        '所有编辑都落回标准 XML，不产生私有索引文件',
      ],
      en: [
        'Maps, bookmaps and nested maprefs orchestrate consistently',
        'New topics reuse DITA 1.3 templates directly',
        'Every edit lands back in standard XML with no private index files',
      ],
    },
    screenshot: {
      src: '/images/workbench.webp',
      alt: { zh: 'DITAEditor Map 树与写作工作台', en: 'DITAEditor map tree and authoring workbench' },
    },
    docs: 'features',
  },
  {
    id: 'lock',
    index: '04',
    title: { zh: '本地 Git 与 Check-out 独占锁', en: 'Local Git and check-out locks' },
    summary: {
      zh: '不依赖 GitHub / GitLab：每分支隔离 git worktree，单文件悲观锁保证团队不会互相覆盖，管理员可强制解锁并自动留下补丁备份。',
      en: 'No GitHub or GitLab dependency: branch-isolated git worktrees and per-file pessimistic locks stop writers overwriting each other, with admin force-unlock patch backups.',
    },
    bullets: {
      zh: [
        'SQLite + Drizzle 记录身份、锁与提交历史',
        'MergeView 做版本 Diff 与签入前审阅',
        '锁粒度精确到 (project, branch, file_path)',
      ],
      en: [
        'SQLite + Drizzle track identities, locks and commit history',
        'MergeView powers version diffs and pre-check-in review',
        'Lock granularity is exactly (project, branch, file_path)',
      ],
    },
    screenshot: {
      src: '/images/keys.webp',
      alt: { zh: 'DITAEditor Keys 面板与版本 Diff 视图', en: 'DITAEditor keys panel and version diff view' },
    },
    docs: 'features',
  },
  {
    id: 'publish',
    index: '05',
    title: { zh: 'DITA-OT 4.x 严格校验与中文 PDF', en: 'DITA-OT strict validation and CJK PDF' },
    summary: {
      zh: '内置 DITA 1.3 DTD/RNG 严格校验（--processing-mode=strict），HTML5 与 PDF 异步发布，SSE 实时日志，纯 XML Noto CJK 字体映射插件解决中文乱码。',
      en: 'Built-in DITA 1.3 DTD/RNG strict validation (--processing-mode=strict), async HTML5 and PDF publishing, SSE logs, and a pure-XML Noto CJK font-mappings plugin that removes CJK garbling.',
    },
    bullets: {
      zh: [
        '报错直达源文件行号与列号',
        'SQLite 持久化任务队列，无需 Redis',
        '单容器内同时运行 Node 与 JRE 21',
      ],
      en: [
        'Errors map straight back to source line and column',
        'SQLite-backed job queue, no Redis required',
        'Node and JRE 21 run side by side in one container',
      ],
    },
    screenshot: {
      src: '/images/pdf-output.webp',
      alt: { zh: 'DITAEditor Noto CJK PDF 发布结果', en: 'DITAEditor Noto CJK PDF publish output' },
    },
    docs: 'features',
  },
  {
    id: 'ai',
    index: '06',
    title: { zh: 'AI 辅助写作与安全 Diff', en: 'AI assistance with safe diffs' },
    summary: {
      zh: 'LangChain.js 接入 DeepSeek 或任意 OpenAI 兼容私有代理。AI 永远只提交候选片段，经无损拼接、结构校验与重试后，强制在 MergeView 中审阅才写入。',
      en: 'LangChain.js connects DeepSeek or any OpenAI-compatible private proxy. AI only proposes candidate fragments; lossless splicing, structural verification and retries precede mandatory MergeView review.',
    },
    bullets: {
      zh: [
        'API Key 只存服务端，前端仅见掩码',
        'full-document / line-window / element 三种定位模式',
        '应用后单步 Cmd/Ctrl+Z 即可完整撤销',
      ],
      en: [
        'API keys stay server-side; the browser only sees a masked value',
        'full-document, line-window and element targeting modes',
        'One Cmd/Ctrl+Z undoes the whole applied proposal',
      ],
    },
    screenshot: {
      src: '/images/ai-diff.webp',
      alt: { zh: 'DITAEditor AI 提案 Diff 审阅', en: 'DITAEditor AI proposal diff review' },
    },
    docs: 'ai-setup',
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
