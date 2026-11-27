import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Resolved conref reuse is an assistive hint, not a warning: the projections stylesheet must keep
 * the resolved palette neutral (slate) while error/cycle alerts stay loud (rose).
 */
describe('Conref projections stylesheet', () => {
  const css = readFileSync(fileURLToPath(new URL('../src/styles/projections.css', import.meta.url)), 'utf8');

  const AMBER_TOKENS = [
    '#fffbeb',
    '#d97706',
    '#92400e',
    '#78350f',
    '#fef3c7',
    '#fcd34d',
    '#fbbf24',
    '245, 158, 11',
    '217, 119, 6',
  ];

  it('keeps resolved reuse previews free of the amber warning palette', () => {
    const start = css.indexOf('.dita-conref-host.dita-conref-resolved {');
    const end = css.indexOf('.dita-conref-alert {');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const resolvedSection = css.slice(start, end);
    const offenders = AMBER_TOKENS.filter((token) => resolvedSection.includes(token));
    expect(offenders).toEqual([]);
  });

  it('renders the resolved host and card neutrally at rest', () => {
    const start = css.indexOf('.dita-conref-host.dita-conref-resolved {');
    const hostRule = css.slice(start, css.indexOf('}', start));
    expect(hostRule).toContain('background: transparent');

    const cardStart = css.indexOf('.dita-conref-preview-block {');
    const cardRule = css.slice(cardStart, css.indexOf('}', cardStart));
    expect(cardRule).toContain('background: transparent');
    expect(cardRule).toContain('border-left: 2px solid #e2e8f0');
  });

  it('keeps error and cycle states in the rose palette', () => {
    const errorStart = css.indexOf('.dita-conref-host.dita-conref-error,');
    const errorRule = css.slice(errorStart, css.indexOf('}', errorStart));
    expect(errorRule).toContain('244, 63, 94');

    const alertStart = css.indexOf('.dita-conref-alert {');
    const alertRule = css.slice(alertStart, css.indexOf('}', alertStart));
    expect(alertRule).toContain('#fff1f2');
    expect(alertRule).toContain('#9f1239');
  });
});
