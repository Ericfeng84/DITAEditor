import type { DitaProfilingAttrName } from '@dita/core';

/**
 * Single source of truth for profiling-attribute chip colors in React surfaces.
 *
 * The CSS decorations in `styles/projections.css` (`.dita-ox-prof-badge[data-prof-attr=...]`)
 * read the same `--dita-prof-*` custom properties defined in `styles/base.css`, so structural
 * chips (map tree, breadcrumbs) and visual-mode chips can never drift apart. Every profiling
 * attribute owns a distinct hue; none of them uses the primary blue reserved for actions.
 */
export const PROFILING_BADGE_CLASSES: Record<DitaProfilingAttrName, string> = {
  audience:
    'bg-[var(--dita-prof-audience-bg)] text-[var(--dita-prof-audience-fg)] border-[var(--dita-prof-audience-border)]',
  platform:
    'bg-[var(--dita-prof-platform-bg)] text-[var(--dita-prof-platform-fg)] border-[var(--dita-prof-platform-border)]',
  product:
    'bg-[var(--dita-prof-product-bg)] text-[var(--dita-prof-product-fg)] border-[var(--dita-prof-product-border)]',
  otherprops:
    'bg-[var(--dita-prof-otherprops-bg)] text-[var(--dita-prof-otherprops-fg)] border-[var(--dita-prof-otherprops-border)]',
  props:
    'bg-[var(--dita-prof-props-bg)] text-[var(--dita-prof-props-fg)] border-[var(--dita-prof-props-border)]',
  rev: 'bg-[var(--dita-prof-rev-bg)] text-[var(--dita-prof-rev-fg)] border-[var(--dita-prof-rev-border)]',
};

/** Resolve the chip classes for an arbitrary attribute name, falling back to the neutral `props` hue. */
export function profilingBadgeClasses(attrName: string): string {
  return PROFILING_BADGE_CLASSES[attrName as DitaProfilingAttrName] ?? PROFILING_BADGE_CLASSES.props;
}
