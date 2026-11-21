import type * as slimdom from 'slimdom';
import { getRawAttr } from '../model/dita-rules.js';
import { parseXml } from '../xml/parser.js';
import type { XmlAttributeEntry } from '../xml/types.js';

const ELEMENT_NODE = 1;

export const DITA_PROFILING_ATTRS = [
  'audience',
  'platform',
  'product',
  'otherprops',
  'props',
  'rev',
] as const;

export type DitaProfilingAttrName = (typeof DITA_PROFILING_ATTRS)[number];

export type DitavalAction = 'include' | 'exclude' | 'passthrough' | 'flag';

export type DitavalDisplayMode = 'show-all' | 'dim-excluded' | 'hide-excluded';

export interface DitavalFlagEndpoint {
  imageref?: string;
  altText?: string;
}

export interface DitavalFlagStyle {
  att: string;
  val: string;
  color?: string;
  backcolor?: string;
  style?: string;
  changebar?: string;
  startFlag?: DitavalFlagEndpoint;
  endFlag?: DitavalFlagEndpoint;
}

export interface DitavalPropRule {
  kind: 'prop' | 'revprop';
  att?: string;
  val?: string;
  action: DitavalAction;
  color?: string;
  backcolor?: string;
  style?: string;
  changebar?: string;
  startFlag?: DitavalFlagEndpoint;
  endFlag?: DitavalFlagEndpoint;
}

export interface ParsedDitaval {
  defaultAction: 'include' | 'exclude' | 'passthrough';
  attrDefaults: Record<string, DitavalAction>;
  /** Exact attribute/value rules keyed by `${att}\0${val}` */
  exactRules: Record<string, DitavalPropRule>;
  revDefault?: DitavalPropRule;
  revRules: Record<string, DitavalPropRule>;
  styleConflict?: {
    foregroundConflictColor?: string;
    backgroundConflictColor?: string;
  };
  rules: DitavalPropRule[];
}

export interface ElementConditionEvaluation {
  status: 'include' | 'exclude' | 'flag';
  excludedBy?: { attr: string; values: string[] };
  flags: DitavalFlagStyle[];
  effectiveStyle?: {
    color?: string;
    backcolor?: string;
    style?: string;
  };
  presentAttrs: Partial<Record<DitaProfilingAttrName, string[]>>;
}

function findDirectChildByTag(el: slimdom.Element, tagName: string): slimdom.Element | null {
  for (const child of el.childNodes) {
    if (child.nodeType === ELEMENT_NODE && (child as slimdom.Element).tagName === tagName) {
      return child as slimdom.Element;
    }
  }
  return null;
}

function parseFlagEndpoint(parent: slimdom.Element, tagName: 'startflag' | 'endflag'): DitavalFlagEndpoint | undefined {
  const flagEl = findDirectChildByTag(parent, tagName);
  if (!flagEl) return undefined;
  const imageref = flagEl.getAttribute('imageref')?.trim() || undefined;
  const altEl = findDirectChildByTag(flagEl, 'alt-text');
  const altText = altEl?.textContent?.trim() || undefined;
  if (!imageref && !altText) return undefined;
  return { imageref, altText };
}

function normalizeDitavalAction(raw: string | null): DitavalAction {
  const v = raw?.trim().toLowerCase();
  if (v === 'exclude' || v === 'passthrough' || v === 'flag' || v === 'include') {
    return v;
  }
  return 'include';
}

function toFlagStyle(rule: DitavalPropRule, att: string, val: string): DitavalFlagStyle {
  return {
    att,
    val,
    color: rule.color,
    backcolor: rule.backcolor,
    style: rule.style,
    changebar: rule.changebar,
    startFlag: rule.startFlag,
    endFlag: rule.endFlag,
  };
}

/**
 * Parse a DITA 1.3 `.ditaval` document into an indexed rule structure.
 */
export function parseDitaval(xml: string): ParsedDitaval {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root || root.tagName !== 'val') {
    throw new Error(`Expected <val> root element in DITAVAL file, got <${root?.tagName ?? 'none'}>.`);
  }

  let defaultAction: 'include' | 'exclude' | 'passthrough' = 'include';
  const attrDefaults: Record<string, DitavalAction> = {};
  const exactRules: Record<string, DitavalPropRule> = {};
  let revDefault: DitavalPropRule | undefined;
  const revRules: Record<string, DitavalPropRule> = {};
  let styleConflict: ParsedDitaval['styleConflict'];
  const rules: DitavalPropRule[] = [];

  for (const child of root.childNodes) {
    if (child.nodeType !== ELEMENT_NODE) continue;
    const el = child as slimdom.Element;

    if (el.tagName === 'style-conflict') {
      const fg = el.getAttribute('foreground-conflict-color')?.trim() || undefined;
      const bg = el.getAttribute('background-conflict-color')?.trim() || undefined;
      if (fg || bg) {
        styleConflict = {
          foregroundConflictColor: fg,
          backgroundConflictColor: bg,
        };
      }
      continue;
    }

    if (el.tagName === 'prop') {
      const att = el.getAttribute('att')?.trim() || undefined;
      const val = el.getAttribute('val')?.trim() || undefined;
      const action = normalizeDitavalAction(el.getAttribute('action'));
      const rule: DitavalPropRule = {
        kind: 'prop',
        att,
        val,
        action,
        color: el.getAttribute('color')?.trim() || undefined,
        backcolor: el.getAttribute('backcolor')?.trim() || undefined,
        style: el.getAttribute('style')?.trim() || undefined,
        startFlag: parseFlagEndpoint(el, 'startflag'),
        endFlag: parseFlagEndpoint(el, 'endflag'),
      };
      rules.push(rule);

      if (!att && !val) {
        if (action === 'include' || action === 'exclude' || action === 'passthrough') {
          defaultAction = action;
        }
      } else if (att && !val) {
        if (!(att in attrDefaults)) {
          attrDefaults[att] = action;
        }
      } else if (att && val) {
        const key = `${att}\0${val}`;
        if (!(key in exactRules)) {
          exactRules[key] = rule;
        }
      }
      continue;
    }

    if (el.tagName === 'revprop') {
      const val = el.getAttribute('val')?.trim() || undefined;
      const rawAct = normalizeDitavalAction(el.getAttribute('action'));
      const action: DitavalAction = rawAct === 'exclude' ? 'include' : rawAct;
      const rule: DitavalPropRule = {
        kind: 'revprop',
        att: 'rev',
        val,
        action,
        color: el.getAttribute('color')?.trim() || undefined,
        backcolor: el.getAttribute('backcolor')?.trim() || undefined,
        style: el.getAttribute('style')?.trim() || undefined,
        changebar: el.getAttribute('changebar')?.trim() || undefined,
        startFlag: parseFlagEndpoint(el, 'startflag'),
        endFlag: parseFlagEndpoint(el, 'endflag'),
      };
      rules.push(rule);

      if (!val) {
        if (!revDefault) revDefault = rule;
      } else if (!(val in revRules)) {
        revRules[val] = rule;
      }
    }
  }

  return {
    defaultAction,
    attrDefaults,
    exactRules,
    revDefault,
    revRules,
    styleConflict,
    rules,
  };
}

/**
 * Split a DITA profiling attribute string into tokens while preserving DITA 1.3
 * parenthesized group syntax such as `deployment(onprem cloud)`.
 */
export function parseProfilingAttrValue(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
    } else if (/\s/.test(ch) && parenDepth === 0) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

/**
 * Format an array of profiling tokens back into a clean space-separated attribute value,
 * or `null` when empty (which removes the attribute).
 */
export function formatProfilingAttrValue(tokens: readonly string[]): string | null {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    cleaned.push(t);
  }
  return cleaned.length > 0 ? cleaned.join(' ') : null;
}

interface ConditionGroup {
  att: string;
  fallbackAtt?: string;
  values: string[];
}

function extractConditionGroups(attrName: DitaProfilingAttrName, rawValue: string): ConditionGroup[] {
  const rawTokens = parseProfilingAttrValue(rawValue);
  const groups: ConditionGroup[] = [];
  const flatValues: string[] = [];

  for (const token of rawTokens) {
    const groupMatch = /^([A-Za-z_][\w.-]*)\(([^)]*)\)$/.exec(token);
    if (groupMatch) {
      const groupAtt = groupMatch[1]!;
      const inner = groupMatch[2]!.trim().split(/\s+/).filter(Boolean);
      if (inner.length > 0) {
        groups.push({
          att: groupAtt,
          fallbackAtt: attrName,
          values: inner,
        });
      }
    } else {
      flatValues.push(token);
    }
  }

  if (flatValues.length > 0) {
    groups.unshift({
      att: attrName,
      values: flatValues,
    });
  }

  return groups;
}

function resolvePropAction(
  ditaval: ParsedDitaval,
  att: string,
  val: string,
  fallbackAtt?: string,
): { action: DitavalAction; rule?: DitavalPropRule } {
  const exact = ditaval.exactRules[`${att}\0${val}`];
  if (exact) return { action: exact.action, rule: exact };

  if (fallbackAtt) {
    const fallbackExact = ditaval.exactRules[`${fallbackAtt}\0${val}`];
    if (fallbackExact) return { action: fallbackExact.action, rule: fallbackExact };
  }

  if (att in ditaval.attrDefaults) {
    return { action: ditaval.attrDefaults[att]! };
  }
  if (fallbackAtt && fallbackAtt in ditaval.attrDefaults) {
    return { action: ditaval.attrDefaults[fallbackAtt]! };
  }

  return { action: ditaval.defaultAction };
}

/**
 * Evaluate DITA 1.3 conditional processing (`include` / `exclude` / `flag`) for an element's
 * profiling attributes against a parsed `.ditaval` profile.
 *
 * Per DITA 1.3 specification:
 * - Each profiling attribute / parenthesized group excludes the element IFF EVERY value in that
 *   attribute/group evaluates to `exclude`.
 * - If ANY attribute/group evaluates to exclude, the element is excluded.
 * - Otherwise, any matching `flag` rules (including `<revprop>`) are collected and merged.
 */
export function evaluateElementConditions(
  rawAttrs: readonly XmlAttributeEntry[],
  ditaval: ParsedDitaval | null,
): ElementConditionEvaluation {
  const presentAttrs: Partial<Record<DitaProfilingAttrName, string[]>> = {};

  for (const attrName of DITA_PROFILING_ATTRS) {
    const val = getRawAttr(rawAttrs, attrName)?.trim();
    if (val) {
      const tokens = parseProfilingAttrValue(val);
      if (tokens.length > 0) {
        presentAttrs[attrName] = tokens;
      }
    }
  }

  if (!ditaval) {
    return {
      status: 'include',
      flags: [],
      presentAttrs,
    };
  }

  const collectedFlags: DitavalFlagStyle[] = [];

  for (const attrName of DITA_PROFILING_ATTRS) {
    if (attrName === 'rev') continue;
    const rawVal = getRawAttr(rawAttrs, attrName)?.trim();
    if (!rawVal) continue;

    const groups = extractConditionGroups(attrName, rawVal);
    for (const group of groups) {
      if (group.values.length === 0) continue;

      let allExcluded = true;
      const groupFlags: DitavalFlagStyle[] = [];

      for (const v of group.values) {
        const res = resolvePropAction(ditaval, group.att, v, group.fallbackAtt);
        if (res.action !== 'exclude') {
          allExcluded = false;
        }
        if (res.action === 'flag' && res.rule) {
          groupFlags.push(toFlagStyle(res.rule, group.att, v));
        }
      }

      if (allExcluded) {
        return {
          status: 'exclude',
          excludedBy: { attr: group.att, values: group.values },
          flags: [],
          presentAttrs,
        };
      }

      collectedFlags.push(...groupFlags);
    }
  }

  // Evaluate `rev` attribute separately (`<revprop>` never excludes, only flags or passes through)
  const revVal = getRawAttr(rawAttrs, 'rev')?.trim();
  if (revVal) {
    const revTokens = parseProfilingAttrValue(revVal);
    for (const v of revTokens) {
      const rule = ditaval.revRules[v] ?? ditaval.revDefault;
      if (rule && rule.action === 'flag') {
        collectedFlags.push(toFlagStyle(rule, 'rev', v));
      }
    }
  }

  if (collectedFlags.length === 0) {
    return {
      status: 'include',
      flags: [],
      presentAttrs,
    };
  }

  const distinctColors = new Set<string>();
  const distinctBackcolors = new Set<string>();
  let firstStyle: string | undefined;

  for (const f of collectedFlags) {
    if (f.color) distinctColors.add(f.color);
    if (f.backcolor) distinctBackcolors.add(f.backcolor);
    if (!firstStyle && f.style) firstStyle = f.style;
  }

  let effectiveColor: string | undefined;
  if (distinctColors.size === 1) {
    effectiveColor = Array.from(distinctColors)[0];
  } else if (distinctColors.size > 1) {
    effectiveColor =
      ditaval.styleConflict?.foregroundConflictColor ?? Array.from(distinctColors)[0];
  }

  let effectiveBackcolor: string | undefined;
  if (distinctBackcolors.size === 1) {
    effectiveBackcolor = Array.from(distinctBackcolors)[0];
  } else if (distinctBackcolors.size > 1) {
    effectiveBackcolor =
      ditaval.styleConflict?.backgroundConflictColor ?? Array.from(distinctBackcolors)[0];
  }

  return {
    status: 'flag',
    flags: collectedFlags,
    effectiveStyle: {
      color: effectiveColor,
      backcolor: effectiveBackcolor,
      style: firstStyle,
    },
    presentAttrs,
  };
}

/**
 * Scan any slimdom Document (topic, map, or `.ditaval`) and collect all unique profiling token values
 * grouped by profiling attribute name (used to power autocomplete & chip suggestions).
 */
export function extractProfilingValuesFromDocument(
  doc: slimdom.Document,
): Record<DitaProfilingAttrName, string[]> {
  const buckets: Record<DitaProfilingAttrName, Set<string>> = {
    audience: new Set(),
    platform: new Set(),
    product: new Set(),
    otherprops: new Set(),
    props: new Set(),
    rev: new Set(),
  };

  const root = doc.documentElement;
  if (!root) {
    return {
      audience: [],
      platform: [],
      product: [],
      otherprops: [],
      props: [],
      rev: [],
    };
  }

  const walk = (el: slimdom.Element) => {
    if (root.tagName === 'val') {
      if (el.tagName === 'prop') {
        const att = el.getAttribute('att')?.trim() as DitaProfilingAttrName | undefined;
        const val = el.getAttribute('val')?.trim();
        if (att && att in buckets && val) {
          buckets[att].add(val);
        }
      } else if (el.tagName === 'revprop') {
        const val = el.getAttribute('val')?.trim();
        if (val) {
          buckets.rev.add(val);
        }
      }
    } else {
      for (const attrName of DITA_PROFILING_ATTRS) {
        const raw = el.getAttribute(attrName)?.trim();
        if (!raw) continue;
        for (const token of parseProfilingAttrValue(raw)) {
          buckets[attrName].add(token);
        }
      }
    }

    for (const child of el.childNodes) {
      if (child.nodeType === ELEMENT_NODE) {
        walk(child as slimdom.Element);
      }
    }
  };

  walk(root);

  return {
    audience: Array.from(buckets.audience).sort(),
    platform: Array.from(buckets.platform).sort(),
    product: Array.from(buckets.product).sort(),
    otherprops: Array.from(buckets.otherprops).sort(),
    props: Array.from(buckets.props).sort(),
    rev: Array.from(buckets.rev).sort(),
  };
}

/**
 * Generate a clean DITA 1.3 `.ditaval` starter file.
 */
export function createDitavalTemplate(options: { description?: string } = {}): string {
  const comment = options.description?.trim()
    ? `<!-- ${options.description.trim()} -->\n`
    : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `${comment}<val>`,
    '  <prop att="audience" val="admin" action="include"/>',
    '  <prop att="otherprops" val="internal" action="exclude"/>',
    '  <revprop val="2.4" action="flag" color="#1d4ed8" backcolor="#dbeafe">',
    '    <startflag><alt-text>v2.4</alt-text></startflag>',
    '  </revprop>',
    '</val>',
    '',
  ].join('\n');
}
