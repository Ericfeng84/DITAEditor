import { normalizeCandidateXml } from '@dita/core';

export interface ParsedAiOutput {
  explanation: string;
  patchXml: string | null;
}

const EXPLANATION_BLOCK = /<explanation\b[^>]*>([\s\S]*?)<\/explanation>/i;
const PATCH_OPEN = /<dita_patch\b[^>]*>/i;
const PATCH_CLOSE = /<\/dita_patch\s*>/i;
const CODE_FENCE = /```[A-Za-z0-9_+-]*\s*\r?\n([\s\S]*?)```/;

function stripExplanationTags(text: string): string {
  return text
    .replace(/<explanation\b[^>]*>/gi, '')
    .replace(/<\/explanation\s*>/gi, '')
    .trim();
}

/**
 * Tolerant parser for the `<explanation>…</explanation><dita_patch>…</dita_patch>` protocol.
 * Handles unclosed patches, markdown fences, missing tags, and bare XML replies.
 */
export function parseAiOutput(raw: string): ParsedAiOutput {
  const text = raw ?? '';
  const explanationMatch = EXPLANATION_BLOCK.exec(text);

  let patchXml: string | null = null;
  let patchStart = -1;
  const open = PATCH_OPEN.exec(text);
  if (open) {
    patchStart = open.index;
    const bodyStart = open.index + open[0].length;
    const close = PATCH_CLOSE.exec(text.slice(bodyStart));
    const body = close
      ? text.slice(bodyStart, bodyStart + close.index)
      : text.slice(bodyStart);
    const normalized = normalizeCandidateXml(body);
    patchXml = normalized.length > 0 ? normalized : null;
  } else {
    const fence = CODE_FENCE.exec(text);
    if (fence) {
      patchStart = fence.index;
      const normalized = normalizeCandidateXml(fence[1] ?? '');
      patchXml = normalized.length > 0 ? normalized : null;
    }
  }

  let explanation = explanationMatch ? stripExplanationTags(explanationMatch[1] ?? '') : '';
  if (!explanation) {
    const beforePatch = patchStart >= 0 ? text.slice(0, patchStart) : text;
    const withoutFences = beforePatch.replace(/```[\s\S]*?```/g, '');
    explanation = stripExplanationTags(withoutFences);
  }

  if (!patchXml && !explanationMatch && patchStart < 0) {
    const trimmed = text.trim();
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
      const normalized = normalizeCandidateXml(trimmed);
      if (normalized.length > 0) {
        patchXml = normalized;
        explanation = '';
      }
    }
  }

  return { explanation: explanation.trim(), patchXml };
}

export interface ExplanationStreamFilter {
  push(text: string): string;
  flush(): string;
}

/**
 * Streams only the user-facing explanation. Anything from the first `<dita_patch>` opener onward
 * is suppressed, and split tag fragments are held back until they can be classified.
 */
export function createExplanationStreamFilter(): ExplanationStreamFilter {
  let pending = '';
  let suppressed = false;

  return {
    push(text: string): string {
      if (suppressed || !text) return '';
      pending += text;
      let out = '';
      for (;;) {
        const lt = pending.indexOf('<');
        if (lt === -1) {
          out += pending;
          pending = '';
          break;
        }
        out += pending.slice(0, lt);
        pending = pending.slice(lt);
        const gt = pending.indexOf('>');
        if (gt === -1) break;
        const tag = pending.slice(0, gt + 1);
        const lower = tag.toLowerCase();
        if (lower.startsWith('<dita_patch') || lower.startsWith('</dita_patch')) {
          suppressed = true;
          pending = '';
          break;
        }
        if (/^<\/?explanation\b/i.test(tag)) {
          pending = pending.slice(gt + 1);
          continue;
        }
        out += tag;
        pending = pending.slice(gt + 1);
      }
      return out;
    },
    flush(): string {
      if (suppressed) return '';
      const out = pending;
      pending = '';
      return out;
    },
  };
}
