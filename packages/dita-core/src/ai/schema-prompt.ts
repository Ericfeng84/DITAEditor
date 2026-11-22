import { DITA_CORE_INLINE_TAGS, getAllowedChildElementTags } from '../model/dita-rules.js';

/** Hard cap so the summary always fits into a single system message. */
const MAX_SUMMARY_CHARS = 2500;

/** Maximum number of allowed child tags spelled out before the list is elided. */
const MAX_LISTED_CHILD_TAGS = 80;

const COMMON_ATTRIBUTES: readonly string[] = [
  'id',
  'props',
  'audience',
  'platform',
  'product',
  'otherprops',
  'outputclass',
  'rev',
  'importance',
  'status',
];

/**
 * Build a compact (≤2500 chars) Chinese DITA 1.3 constraint summary for AI prompts.
 * Child-element rules come from `model/dita-rules.ts`, so the prompt can never drift from
 * the constraints `isChildAllowed()` enforces during splice verification.
 */
export function buildDitaConstraintSummary(
  rootTag: string | null,
  parentTag: string | null,
): string {
  const lines: string[] = [];

  lines.push(
    '你是严格遵循 OASIS DITA 1.3 的结构化 XML 编写助手。只输出 XML 片段本身：不要 Markdown 代码围栏，不要解释文字。',
  );

  if (rootTag) {
    lines.push(`当前文档根元素：<${rootTag}>。`);
  }

  if (parentTag) {
    lines.push(
      `本次只返回一个可插入 <${parentTag}> 的完整片段，片段顶层元素必须是 <${parentTag}> 的合法子元素。`,
    );
    const allowedChildren = getAllowedChildElementTags(parentTag);
    if (allowedChildren.length > 0) {
      const listed = allowedChildren.slice(0, MAX_LISTED_CHILD_TAGS).join(', ');
      const suffix = allowedChildren.length > MAX_LISTED_CHILD_TAGS ? ' …' : '';
      lines.push(`<${parentTag}> 允许的子元素（仅限这些）：${listed}${suffix}。`);
    } else {
      lines.push(
        `<${parentTag}> 未在内置模型中建模：请沿用原文已有的子元素类型与层级，不要新增元素类型。`,
      );
    }
  } else {
    lines.push(
      '本次需要返回一个良构的 XML 片段：单个顶层元素，且该元素类型与原文保持一致（父元素未建模）。',
    );
  }

  lines.push(
    `行内语义元素（只能出现在行内内容中）：${DITA_CORE_INLINE_TAGS.join(', ')}。`,
  );
  lines.push(
    `通用属性：${COMMON_ATTRIBUTES.join(', ')}；不要虚构未列出的元素、属性或 keyref/conref 目标。`,
  );
  lines.push(
    [
      '硬性要求：',
      '1) 未修改的文本、属性顺序、注释、处理指令必须原样保留；',
      '2) <codeblock>/<pre>/<lines>/<screen>/<msgblock> 以及 xml:space="preserve" 元素内的空白与缩进必须逐字节保留，不要重新缩进；',
      '3) 属性值使用双引号，并正确转义 &、<、>；',
      '4) 不要输出 XML 声明或 DOCTYPE（由系统统一维护）；',
      '5) 输出必须是良构 XML，且不要包裹在 <dita_patch> 之类的包装元素中。',
    ].join(''),
  );

  const summary = lines.join('\n');
  return summary.length > MAX_SUMMARY_CHARS
    ? `${summary.slice(0, MAX_SUMMARY_CHARS - 1)}…`
    : summary;
}
