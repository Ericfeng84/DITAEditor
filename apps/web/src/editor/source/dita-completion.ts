import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import {
  areConrefTagsCompatible,
  DITA_ELEMENT_SPECS,
  DITA_PROFILING_ATTRS,
  getAllowedChildElementTags,
  getAttributeDescription,
  getAttributeLabel,
  getAttributesForElement,
  getElementDescription,
  getElementLabel,
  getInsertableTagsBySequence,
  hasSequenceModel,
  type DitaProfilingAttrName,
  type KeyspaceResult,
  type TopicIdIndexEntry,
} from '@dita/core';

export interface SourceSemanticCompletionContext {
  keyspace?: KeyspaceResult | null;
  topicIndices?: readonly TopicIdIndexEntry[];
  profilingCatalog?: Partial<Record<DitaProfilingAttrName, readonly string[]>>;
}

const PROFILING_ATTR_SET = new Set<string>(DITA_PROFILING_ATTRS);

function stripNonTagXml(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '');
}

/**
 * Lightweight backward XML tag stack scanner to identify the innermost open parent element
 * and its already-present direct child tags before/after the cursor.
 */
function findEnclosingXmlContext(
  xmlPrefix: string,
  xmlSuffix = '',
): { parentTag: string | null; directChildren: string[] } {
  const cleanedPrefix = stripNonTagXml(xmlPrefix);
  const stack: { tag: string; children: string[] }[] = [];
  const tagRegex = /<(\/?)([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleanedPrefix)) !== null) {
    const isClose = match[1] === '/';
    const tagName = match[2]!;
    const isSelfClosing = match[3] === '/';

    if (isSelfClosing) {
      if (stack.length > 0) stack[stack.length - 1]!.children.push(tagName);
      continue;
    }
    if (isClose) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tagName) {
          stack.splice(i);
          break;
        }
      }
    } else {
      if (stack.length > 0) stack[stack.length - 1]!.children.push(tagName);
      stack.push({ tag: tagName, children: [] });
    }
  }

  if (stack.length === 0) return { parentTag: null, directChildren: [] };
  const top = stack[stack.length - 1]!;
  const directChildren = [...top.children];

  if (xmlSuffix) {
    const cleanedSuffix = stripNonTagXml(xmlSuffix);
    let depth = 0;
    const suffixRegex = /<(\/?)([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?(\/?)>/g;
    while ((match = suffixRegex.exec(cleanedSuffix)) !== null) {
      const isClose = match[1] === '/';
      const tagName = match[2]!;
      const isSelfClosing = match[3] === '/';

      if (isSelfClosing) {
        if (depth === 0) directChildren.push(tagName);
        continue;
      }
      if (isClose) {
        if (depth === 0) break;
        depth--;
      } else {
        if (depth === 0) directChildren.push(tagName);
        depth++;
      }
    }
  }

  return { parentTag: top.tag, directChildren };
}

/**
 * Lightweight backward XML tag stack scanner to identify the innermost open parent element
 * at `pos` inside an XML document (handles comments, PIs, CDATA, self-closing tags).
 */
export function findEnclosingXmlTag(xmlPrefix: string): string | null {
  return findEnclosingXmlContext(xmlPrefix).parentTag;
}

/**
 * Create a CodeMirror 6 DITA 1.3 context-aware XML completion source powered by `@dita/core` rules
 * and optional Phase 3 semantic context (`keyspace`, `topicIndices`, `profilingCatalog`).
 * Supports:
 * 1. Closing tags (`</...`) -> immediately completes the matching open tag
 * 2. Opening tags (`<...`) -> suggests ONLY legal DITA 1.3 child tags for the enclosing parent
 * 3. Attribute values (`<note type="..."`, `keyref="..."`, `conkeyref="..."`, profiling attrs)
 * 4. Attribute names (`<note ty...`) -> suggests legal element/core/profiling/reuse attributes
 */
export function createDitaXmlCompletionSource(
  getSemanticContext?: () => SourceSemanticCompletionContext | null | undefined,
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
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
            detail: translate(getCurrentLocale(), 'completion.closeTag'),
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
      const afterCursor = context.state.doc.sliceString(context.pos);
      const { parentTag, directChildren } = findEnclosingXmlContext(beforeLt, afterCursor);

      const rawAllowedTags = parentTag
        ? getAllowedChildElementTags(parentTag)
        : ['concept', 'task', 'reference', 'topic', 'map', 'bookmap'];

      // Filter out already-filled single-occurrence slots & exclusive alternatives (e.g. steps | steps-unordered)
      const allowedTags =
        parentTag && rawAllowedTags.length > 0 && hasSequenceModel(parentTag)
          ? getInsertableTagsBySequence(parentTag, directChildren, rawAllowedTags)
          : rawAllowedTags;

      const candidateTags =
        allowedTags.length > 0
          ? allowedTags
          : rawAllowedTags.length > 0
            ? []
            : Array.from(DITA_ELEMENT_SPECS.keys());

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
          detail: spec ? getElementLabel(spec, getCurrentLocale()) : 'DITA element',
          info: spec ? getElementDescription(spec, getCurrentLocale()) : undefined,
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
      const semanticCtx = getSemanticContext?.() ?? null;

      // 3a. Semantic `keyref` completion from Root Map keyspace
      if (attrName === 'keyref' && semanticCtx?.keyspace) {
        const keyEntries = Object.values(semanticCtx.keyspace.keys);
        if (keyEntries.length > 0) {
          const options: Completion[] = keyEntries.map((def, idx) => ({
            label: def.key,
            type: 'variable',
            detail: def.inlineText
              ? `"${def.inlineText}"`
              : def.href
                ? `→ ${def.href}`
                : def.sourceMapPath,
            info: translate(getCurrentLocale(), 'completion.definedAt', {
              path: `${def.sourceMapPath}${def.line ? `:${def.line}` : ''}`,
            }) + (def.scope ? ` · scope=${def.scope}` : ''),
            boost: 80 - Math.min(idx, 60),
          }));
          return {
            from: context.pos - partialVal.length,
            options,
          };
        }
      }

      // 3b. Semantic `conkeyref` completion: `key/elementId`
      if (attrName === 'conkeyref' && semanticCtx?.keyspace) {
        const slashIdx = partialVal.indexOf('/');
        const topicByPath = new Map<string, TopicIdIndexEntry>();
        for (const t of semanticCtx.topicIndices ?? []) {
          topicByPath.set(t.filePath, t);
        }

        if (slashIdx >= 0) {
          const keyName = partialVal.slice(0, slashIdx);
          const elemPartial = partialVal.slice(slashIdx + 1);
          const keyDef = semanticCtx.keyspace.keys[keyName];
          const targetTopic = keyDef?.resolvedHref
            ? topicByPath.get(keyDef.resolvedHref)
            : undefined;
          if (targetTopic && targetTopic.elements.length > 0) {
            const options: Completion[] = targetTopic.elements
              .filter((el) => areConrefTagsCompatible(currentTag, el.tagName))
              .map((el, idx) => ({
                label: el.elementId,
                type: 'constant',
                detail: `<${el.tagName}> ${el.previewText.slice(0, 48)}`,
                info: `${targetTopic.filePath}#${el.topicId}/${el.elementId}`,
                boost: (el.tagName === currentTag ? 90 : 60) - Math.min(idx, 50),
              }));
            if (options.length > 0) {
              return {
                from: context.pos - elemPartial.length,
                options,
              };
            }
          }
        } else {
          const options: Completion[] = [];
          for (const def of Object.values(semanticCtx.keyspace.keys)) {
            if (!def.resolvedHref) continue;
            const targetTopic = topicByPath.get(def.resolvedHref);
            if (targetTopic) {
              const compatible = targetTopic.elements.filter((el) =>
                areConrefTagsCompatible(currentTag, el.tagName),
              );
              for (const el of compatible.slice(0, 12)) {
                options.push({
                  label: `${def.key}/${el.elementId}`,
                  type: 'constant',
                  detail: `<${el.tagName}> ${el.previewText.slice(0, 40)}`,
                  info: `${def.resolvedHref}#${el.topicId}/${el.elementId}`,
                  boost: el.tagName === currentTag ? 90 : 65,
                });
              }
            }
            options.push({
              label: `${def.key}/`,
              type: 'variable',
              detail: def.resolvedHref,
              info: translate(getCurrentLocale(), 'completion.elementIdHint', { href: def.resolvedHref }),
              boost: 50,
            });
          }
          if (options.length > 0) {
            return {
              from: context.pos - partialVal.length,
              options,
            };
          }
        }
      }

      // 3c. Semantic profiling attribute value completion (supports space-separated tokens)
      if (PROFILING_ATTR_SET.has(attrName) && semanticCtx?.profilingCatalog) {
        const catalogVals =
          semanticCtx.profilingCatalog[attrName as DitaProfilingAttrName] ?? [];
        const attrSpecs = getAttributesForElement(currentTag);
        const staticVals = attrSpecs.find((a) => a.name === attrName)?.values ?? [];
        const allVals = Array.from(new Set([...catalogVals, ...staticVals]));
        if (allVals.length > 0) {
          const lastSpaceIdx = partialVal.search(/\s[^\s]*$/);
          const tokenStartInPartial = lastSpaceIdx >= 0 ? lastSpaceIdx + 1 : 0;
          const tokenPartial = partialVal.slice(tokenStartInPartial);
          const existingTokens = new Set(
            partialVal
              .slice(0, tokenStartInPartial)
              .split(/\s+/)
              .map((t) => t.trim())
              .filter(Boolean),
          );
          const options: Completion[] = allVals
            .filter((val) => !existingTokens.has(val))
            .map((val, idx) => ({
              label: val,
              type: 'enum',
              detail: `DITAVAL @${attrName}`,
              boost: 70 - Math.min(idx, 50),
            }));
          if (options.length > 0) {
            return {
              from: context.pos - tokenPartial.length,
              options,
            };
          }
        }
      }

      // 3d. Default static attribute enum values from `@dita/core`
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
        detail: spec.group === 'element' ? getAttributeLabel(spec, getCurrentLocale()) : `${spec.group} · ${getAttributeLabel(spec, getCurrentLocale())}`,
        info: spec ? getAttributeDescription(spec, getCurrentLocale()) : undefined,
        apply: `${spec.name}=""`,
        boost: spec.group === 'element' ? 50 - idx : 10,
      }));

      return {
        from: context.pos - partialAttr.length,
        options,
      };
    }

    return null;
  };
}

/**
 * Default CodeMirror 6 DITA 1.3 context-aware XML completion source (without live semantic index).
 */
export const ditaXmlCompletionSource = createDitaXmlCompletionSource();
