import {
  getAttributeDescription,
  getAttributeExample,
  getAttributeLabel,
  getAttributeUsage,
  getRawAttr,
  type DitaAttributeGroup,
  type DitaAttributeSpec,
  type UiLocale,
  type XmlAttributeEntry,
} from '@dita/core';

export interface FilterGroupedAttributesOptions {
  /** Free-text query matched against the XML name, localized label, description, usage and example. */
  query?: string;
  /** Keep only attributes that are currently set on the element. */
  onlySet?: boolean;
  locale?: UiLocale;
}

export interface FilteredAttributes {
  /** Groups that still contain at least one matching attribute, in the input group order. */
  groups: Map<DitaAttributeGroup, DitaAttributeSpec[]>;
  /** Total number of matching attributes across every group. */
  total: number;
}

/**
 * Pure filtering helper shared by the Topic attribute panel, the Map node inspector and the
 * filter-bar "only set" toggle. It never mutates the input map and preserves the input order so
 * both inspectors render attributes in the schema-declared order.
 */
export function filterGroupedAttributes(
  grouped: ReadonlyMap<DitaAttributeGroup, readonly DitaAttributeSpec[]>,
  rawAttrs: readonly XmlAttributeEntry[],
  options: FilterGroupedAttributesOptions = {},
): FilteredAttributes {
  const { onlySet = false, locale = 'zh-CN' } = options;
  const query = (options.query ?? '').trim().toLowerCase();
  const groups = new Map<DitaAttributeGroup, DitaAttributeSpec[]>();
  let total = 0;

  for (const [group, specs] of grouped) {
    const matches: DitaAttributeSpec[] = [];
    for (const spec of specs) {
      if (onlySet && getRawAttr(rawAttrs, spec.name) === undefined) continue;
      if (query && !matchesQuery(spec, query, locale)) continue;
      matches.push(spec);
    }
    if (matches.length > 0) {
      groups.set(group, matches);
      total += matches.length;
    }
  }

  return { groups, total };
}

/** Exported for direct unit tests: does one attribute spec match a normalized query? */
export function attributeMatchesQuery(
  spec: DitaAttributeSpec,
  query: string,
  locale: UiLocale = 'zh-CN',
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return matchesQuery(spec, normalized, locale);
}

function matchesQuery(spec: DitaAttributeSpec, query: string, locale: UiLocale): boolean {
  const haystack = [
    spec.name,
    getAttributeLabel(spec, locale),
    getAttributeDescription(spec, locale),
    getAttributeUsage(spec, locale),
    getAttributeExample(spec, locale),
  ];
  return haystack.some((value) => value !== undefined && value.toLowerCase().includes(query));
}
