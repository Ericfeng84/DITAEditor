/**
 * Browser-side analysis helpers for the in-browser DITA sandbox. Everything here is pure and
 * runs against the real `@dita/core` kernel — the site never ships mock semantics.
 */
import {
  DITA_MAP_CONTAINER_NODE_TAGS,
  DITA_MAP_ROOT_TAGS,
  buildKeyspace,
  checkXmlWellFormed,
  evaluateElementConditions,
  getElementSpec,
  parseDitaval,
  resolveKeyrefInKeyspace,
  roundTripXmlThroughPm,
  type XmlAttributeEntry,
  type ParsedDitaval,
} from '@dita/core';
import type { PlaygroundPreset } from '../data/playground-presets.js';

const ELEMENT_NODE = 1;

interface MinimalNode {
  nodeType: number;
  tagName?: string;
  childNodes: ArrayLike<MinimalNode>;
}

function walkElements(node: MinimalNode, visit: (node: MinimalNode) => void): void {
  if (node.nodeType === ELEMENT_NODE) visit(node);
  const children = node.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child) walkElements(child, visit);
  }
}

export interface XmlDiagnostics {
  wellFormed: boolean;
  error?: { line: number; column: number; message: string };
  elementCount: number;
  unknownTags: string[];
  roundTripIdempotent: boolean;
  serialized: string | null;
}

/** Parse, count specialised/unknown elements, and verify the PM round-trip is idempotent. */
export function analyseXml(xml: string): XmlDiagnostics {
  const check = checkXmlWellFormed(xml);
  if (!check.ok) {
    return {
      wellFormed: false,
      error: {
        line: check.error.line,
        column: check.error.column,
        message: check.error.message,
      },
      elementCount: 0,
      unknownTags: [],
      roundTripIdempotent: false,
      serialized: null,
    };
  }

  let elementCount = 0;
  const unknown = new Set<string>();
  walkElements(check.parsed.document as unknown as MinimalNode, (node) => {
    elementCount += 1;
    const tag = node.tagName ?? '';
    const known =
      getElementSpec(tag) !== undefined ||
      DITA_MAP_ROOT_TAGS.has(tag) ||
      DITA_MAP_CONTAINER_NODE_TAGS.has(tag);
    if (tag && !known) unknown.add(tag);
  });

  let serialized: string | null = null;
  let idempotent = false;
  try {
    const first = roundTripXmlThroughPm(xml);
    serialized = first.xml;
    idempotent = roundTripXmlThroughPm(first.xml).xml === first.xml;
  } catch {
    idempotent = false;
  }

  return {
    wellFormed: true,
    elementCount,
    unknownTags: [...unknown].sort(),
    roundTripIdempotent: idempotent,
    serialized,
  };
}

export interface KeyRow {
  key: string;
  value: string;
  status: 'resolved' | 'unresolved';
}

/** Build a real keyspace from the preset's root map and resolve every declared key. */
export function keyspaceRows(preset: PlaygroundPreset): KeyRow[] {
  if (!preset.keyspace) return [];
  const files = preset.keyspace.files;
  const keyspace = buildKeyspace(preset.keyspace.rootMapPath, (path) => files[path] ?? null);
  return keyspace.allDefinitions.map((definition) => {
    const resolved = resolveKeyrefInKeyspace(definition.key, keyspace);
    const value =
      resolved.resolvedText ??
      resolved.definition?.inlineText ??
      resolved.definition?.href ??
      definition.inlineText ??
      definition.href ??
      '—';
    return { key: definition.qualifiedKey, value, status: resolved.status };
  });
}

export interface ConditionRow {
  label: string;
  status: 'include' | 'exclude' | 'flag';
  reason: string;
}

const PROFILING_ATTRIBUTES = [
  'audience',
  'platform',
  'product',
  'props',
  'otherprops',
  'rev',
  'importance',
  'deliveryTarget',
] as const;

/** Summarise how a `.ditaval` projects onto the current document. */
export function conditionRows(xml: string, ditaval: ParsedDitaval | null): ConditionRow[] {
  if (!ditaval) return [];
  const check = checkXmlWellFormed(xml);
  if (!check.ok) return [];

  const rows: ConditionRow[] = [];
  const seen = new Set<string>();

  walkElements(check.parsed.document as unknown as MinimalNode, (node) => {
    const attrs: XmlAttributeEntry[] = [];
    const element = node as unknown as { tagName: string; getAttribute: (name: string) => string | null };
    for (const name of PROFILING_ATTRIBUTES) {
      const value = element.getAttribute?.(name);
      if (value) attrs.push({ name, value });
    }
    if (attrs.length === 0) return;

    const evaluation = evaluateElementConditions(attrs, ditaval);
    const label = `<${node.tagName ?? ''}> ${attrs.map((attr) => `${attr.name}="${attr.value}"`).join(' ')}`;
    if (seen.has(label)) return;
    seen.add(label);
    rows.push({
      label,
      status: evaluation.status,
      reason:
        evaluation.excludedBy !== undefined
          ? evaluation.excludedBy.attr
          : evaluation.status === 'flag'
            ? (evaluation.flags[0]
                ? `${evaluation.flags[0].att}="${evaluation.flags[0].val}"`
                : 'flag')
            : 'default',
    });
  });

  return rows.slice(0, 8);
}

/** Parse a `.ditaval` string defensively — a broken profile must not break the sandbox. */
export function safeParseDitaval(xml: string | null | undefined): ParsedDitaval | null {
  if (!xml) return null;
  try {
    return parseDitaval(xml);
  } catch {
    return null;
  }
}
