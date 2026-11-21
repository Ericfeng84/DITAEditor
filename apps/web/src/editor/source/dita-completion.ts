import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import {
  DITA_ELEMENT_SPECS,
  getAllowedChildElementTags,
  getAttributesForElement,
} from '@dita/core';

/**
 * Lightweight backward XML tag stack scanner to identify the innermost open parent element
 * at `pos` inside an XML document (handles comments, PIs, CDATA, self-closing tags).
 */
export function findEnclosingXmlTag(xmlPrefix: string): string | null {
  // Strip comments, PIs, DOCTYPE, and CDATA so they don't confuse tag matching
  const cleaned = xmlPrefix
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '');

  const stack: string[] = [];
  const tagRegex = /<(\/?)([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const isClose = match[1] === '/';
    const tagName = match[2]!;
    const isSelfClosing = match[3] === '/';

    if (isSelfClosing) continue;
    if (isClose) {
      // Pop until matching open tag
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === tagName) {
          stack.splice(i);
          break;
        }
      }
    } else {
      stack.push(tagName);
    }
  }

  return stack.length > 0 ? stack[stack.length - 1]! : null;
}

/**
 * CodeMirror 6 DITA 1.3 context-aware XML completion source powered by `@dita/core` rules.
 * Supports:
 * 1. Closing tags (`</...`) -> immediately completes the matching open tag
 * 2. Opening tags (`<...`) -> suggests ONLY legal DITA 1.3 child tags for the enclosing parent
 * 3. Attribute values (`<note type="...`) -> suggests enumerated DITA 1.3 attribute values
 * 4. Attribute names (`<note ty...`) -> suggests legal element/core/profiling/reuse attributes
 */
export function ditaXmlCompletionSource(context: CompletionContext): CompletionResult | null {
  const docBefore = context.state.doc.sliceString(0, context.pos);

  // 1. Closing tag completion: `</prefix`
  const closeMatch = /<\/([A-Za-z0-9_:-]*)$/.exec(docBefore);
  if (closeMatch) {
    const prefix = closeMatch[1] ?? '';
    const beforeTag = docBefore.slice(0, docBefore.length - closeMatch[0].length);
    const openParent = findEnclosingXmlTag(beforeTag);
    if (!openParent) return null;

    return {
      from: context.pos - prefix.length,
      options: [
        {
          label: openParent,
          type: 'type',
          detail: '关闭当前标签',
          apply: `${openParent}>`,
          boost: 100,
        },
      ],
    };
  }

  // 2. Opening tag completion: `<prefix` (not inside an already-open start tag's attributes)
  const openTagMatch = /<([A-Za-z0-9_:-]*)$/.exec(docBefore);
  if (openTagMatch) {
    const prefix = openTagMatch[1] ?? '';
    const beforeLt = docBefore.slice(0, docBefore.length - openTagMatch[0].length);
    const parentTag = findEnclosingXmlTag(beforeLt);

    const allowedTags = parentTag
      ? getAllowedChildElementTags(parentTag)
      : ['concept', 'task', 'reference', 'topic', 'map', 'bookmap'];

    const candidateTags =
      allowedTags.length > 0 ? allowedTags : Array.from(DITA_ELEMENT_SPECS.keys());

    const options: Completion[] = candidateTags.map((tag) => {
      const spec = DITA_ELEMENT_SPECS.get(tag);
      const isVoidStyle =
        tag === 'colspec' ||
        tag === 'link' ||
        tag === 'topicref' ||
        tag === 'mapref' ||
        tag === 'keydef' ||
        tag === 'toc';
      return {
        label: tag,
        type: 'type',
        detail: spec ? `${spec.labelZh}` : 'DITA element',
        info: spec?.description,
        apply: isVoidStyle ? `${tag} />` : `${tag}></${tag}>`,
      };
    });

    return {
      from: context.pos - prefix.length,
      options,
    };
  }

  // Check if cursor sits inside an unfinished start tag `<tagName ...`
  const lastLt = docBefore.lastIndexOf('<');
  const lastGt = docBefore.lastIndexOf('>');
  if (lastLt === -1 || lastGt > lastLt) {
    return null;
  }

  const tagFragment = docBefore.slice(lastLt + 1);
  const tagNameMatch = /^([A-Za-z_][\w:.-]*)\s+([\s\S]*)$/.exec(tagFragment);
  if (!tagNameMatch) return null;

  const currentTag = tagNameMatch[1]!;
  const attrsSection = tagNameMatch[2] ?? '';

  // 3. Attribute value completion: `attrName="partial`
  const attrValMatch = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)$/.exec(attrsSection);
  if (attrValMatch) {
    const attrName = attrValMatch[1]!;
    const partialVal = attrValMatch[2] ?? '';
    const attrSpecs = getAttributesForElement(currentTag);
    const matchedAttr = attrSpecs.find((a) => a.name === attrName);
    if (!matchedAttr?.values || matchedAttr.values.length === 0) return null;

    return {
      from: context.pos - partialVal.length,
      options: matchedAttr.values.map((val) => ({
        label: val,
        type: 'enum',
        detail: `${currentTag}/@${attrName}`,
      })),
    };
  }

  // 4. Attribute name completion inside `<tagName ...`
  const attrNameMatch = /(?:^|\s)([A-Za-z0-9_:-]*)$/.exec(attrsSection);
  if (attrNameMatch) {
    const partialAttr = attrNameMatch[1] ?? '';
    if (!context.explicit && partialAttr.length === 0) return null;

    // Collect already present attribute names so we don't suggest duplicates
    const existing = new Set<string>();
    const existingRegex = /([A-Za-z_][\w:.-]*)\s*=/g;
    let m: RegExpExecArray | null;
    while ((m = existingRegex.exec(attrsSection)) !== null) {
      existing.add(m[1]!);
    }

    const attrSpecs = getAttributesForElement(currentTag).filter((a) => !existing.has(a.name));
    if (attrSpecs.length === 0) return null;

    const options: Completion[] = attrSpecs.map((spec, idx) => ({
      label: spec.name,
      type: 'property',
      detail: spec.group === 'element' ? spec.label : `${spec.group} · ${spec.label}`,
      info: spec.description,
      apply: `${spec.name}=""`,
      boost: spec.group === 'element' ? 50 - idx : 10,
    }));

    return {
      from: context.pos - partialAttr.length,
      options,
    };
  }

  return null;
}
