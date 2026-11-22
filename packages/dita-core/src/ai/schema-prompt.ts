import { DITA_CORE_INLINE_TAGS, getAllowedChildElementTags } from '../model/dita-rules.js';
import { coreT } from '../i18n/messages.js';
import type { UiLocale } from '../i18n/locale.js';

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
 * Build a compact (≤2500 chars) DITA 1.3 constraint summary for AI prompts in the UI locale.
 * Child-element rules come from `model/dita-rules.ts`, so the prompt can never drift from
 * the constraints `isChildAllowed()` enforces during splice verification.
 */
export function buildDitaConstraintSummary(
  rootTag: string | null,
  parentTag: string | null,
  locale: UiLocale = 'zh-CN',
): string {
  const t = (key: Parameters<typeof coreT>[1], params?: Parameters<typeof coreT>[2]) =>
    coreT(locale, key, params);
  const lines: string[] = [];

  lines.push(t('ai.prompt.role'));

  if (rootTag) {
    lines.push(t('ai.prompt.rootTag', { rootTag }));
  }

  if (parentTag) {
    lines.push(t('ai.prompt.singleFragment', { parentTag }));
    const allowedChildren = getAllowedChildElementTags(parentTag);
    if (allowedChildren.length > 0) {
      const listed = allowedChildren.slice(0, MAX_LISTED_CHILD_TAGS).join(', ');
      const suffix = allowedChildren.length > MAX_LISTED_CHILD_TAGS ? ' …' : '';
      lines.push(t('ai.prompt.allowedChildren', { parentTag, children: listed, suffix }));
    } else {
      lines.push(t('ai.prompt.unmodeledParent', { parentTag }));
    }
  } else {
    lines.push(t('ai.prompt.fragmentAnyParent'));
  }

  lines.push(t('ai.prompt.inlineElements', { tags: DITA_CORE_INLINE_TAGS.join(', ') }));
  lines.push(t('ai.prompt.commonAttributes', { attributes: COMMON_ATTRIBUTES.join(', ') }));
  lines.push(
    [
      t('ai.prompt.hardRequirements'),
      t('ai.prompt.preserveText'),
      t('ai.prompt.preserveWhitespace'),
      t('ai.prompt.quoteAttributes'),
      t('ai.prompt.noProlog'),
      t('ai.prompt.wellFormed'),
    ].join(''),
  );

  const summary = lines.join('\n');
  return summary.length > MAX_SUMMARY_CHARS
    ? `${summary.slice(0, MAX_SUMMARY_CHARS - 1)}…`
    : summary;
}
