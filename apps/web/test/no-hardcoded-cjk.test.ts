import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase 8 invariant: no user-visible Chinese may be hardcoded in the workbench sources.
 *
 * Every string belongs in `src/i18n/messages/zh-CN.ts` + `en.ts`. Two modules are allowed to
 * contain Chinese literals because they hold *content* rather than UI chrome:
 *
 * - `src/i18n/messages/zh-CN.ts` / `en.ts`: the catalogues themselves (en keeps `中文` for the
 *   language switcher).
 * - `src/services/demo-workspace.ts`: the offline demo project written in Chinese.
 *
 * Comments and the leftover documentation strings in `index.css` are stripped before scanning so
 * a Chinese code comment (which never reaches the UI) cannot fail the build.
 */

const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

const SKIPPED_FILES = new Set([
  // Catalogue sources: zh-CN is the source of truth, en intentionally keeps 「中文」.
  join('i18n', 'messages', 'zh-CN.ts'),
  join('i18n', 'messages', 'en.ts'),
  // Authored demo DITA content (user content, never UI chrome).
  join('services', 'demo-workspace.ts'),
  // The five DITA section pseudo-labels (`prereq`, `context`, `postreq`, …) are CSS-only and are
  // translated in place by the `:root[lang="en"]` overrides further down the same stylesheet.
  'index.css',
]);

const CJK = /[\u3400-\u9fff]/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...collectFiles(abs));
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry)) out.push(abs);
  }
  return out;
}

describe('workbench source carries no hardcoded Chinese UI strings', () => {
  it('only the catalogue and the demo project contain CJK literals', () => {
    const offenders: string[] = [];
    for (const abs of collectFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, abs);
      if (SKIPPED_FILES.has(rel)) continue;
      const stripped = stripComments(readFileSync(abs, 'utf8'));
      const hits = stripped.split('\n');
      hits.forEach((line, index) => {
        if (!CJK.test(line)) return;
        offenders.push(`${rel.split(sep).join('/')}:${index + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the English catalogue only keeps 「中文」 for the language switcher', () => {
    const enSource = readFileSync(join(SRC_DIR, 'i18n', 'messages', 'en.ts'), 'utf8');
    const cjkLines = enSource.split('\n').filter((line) => CJK.test(line));
    expect(cjkLines).toHaveLength(1);
    expect(cjkLines[0]).toContain('中文');
  });
});
