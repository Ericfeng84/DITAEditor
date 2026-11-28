import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same SSR harness as `phase13-ui-components.test.tsx` / `checkin-validation-ui.test.tsx`:
// React 19 reads Zustand's server snapshot unless `useStore` is pointed at the live store.
vi.mock('zustand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zustand')>();
  return {
    ...actual,
    create: <T,>(initializer: Parameters<typeof actual.create<T>>[0]) => {
      const store = actual.create(initializer);
      const bound = ((selector?: (state: T) => unknown) => {
        const current = store.getState();
        return selector ? selector(current) : current;
      }) as typeof store;
      Object.assign(bound, store);
      return bound;
    },
  };
});

import {
  mergeProblemDiagnostics,
  strictDiagnosticsToProblems,
} from '../src/services/problem-diagnostics.js';
import type { PublishDiagnostic } from '../src/services/publish-api';
import type { WorkspaceDiagnostic } from '../src/services/workspace-api';
import { ProblemsPanel } from '../src/components/ProblemsPanel';
import { StrictValidationDialog } from '../src/components/publish/StrictValidationDialog';
import { usePublishStore } from '../src/store/publish-store';

/** Static markup escapes `&`/`<`/`"`, so compare against the HTML-escaped copy. */
const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function semanticDiag(overrides: Partial<WorkspaceDiagnostic> = {}): WorkspaceDiagnostic {
  return {
    id: 'sem-1',
    filePath: 'topics/intro.dita',
    line: 3,
    column: 1,
    severity: 'warning',
    source: 'structure',
    message: 'Element section is not allowed after steps',
    ...overrides,
  };
}

function strictDiag(overrides: Partial<PublishDiagnostic> = {}): PublishDiagnostic {
  return {
    id: 'strict-1',
    filePath: 'topics/intro.dita',
    line: 12,
    column: 5,
    severity: 'error',
    message: 'Element p is not allowed here',
    code: 'DOTJ013E',
    ...overrides,
  };
}

describe('strictDiagnosticsToProblems', () => {
  it('converts DITA-OT diagnostics into Problems rows', () => {
    const converted = strictDiagnosticsToProblems([strictDiag()]);
    expect(converted).toHaveLength(1);
    expect(converted[0]).toEqual({
      id: 'dita-ot:strict-1',
      filePath: 'topics/intro.dita',
      line: 12,
      column: 5,
      severity: 'error',
      source: 'dita-ot',
      message: 'Element p is not allowed here',
      code: 'DOTJ013E',
    });
  });

  it('falls back to the index for rows without an id and keeps the optional code off', () => {
    const converted = strictDiagnosticsToProblems([strictDiag({ id: '', code: undefined })]);
    expect(converted[0]?.id).toBe('dita-ot:0');
    expect(converted[0]?.code).toBeUndefined();
  });

  it('deduplicates identical findings while preserving order', () => {
    const converted = strictDiagnosticsToProblems([
      strictDiag({ id: 'a' }),
      strictDiag({ id: 'b', message: 'Other failure', code: 'DOTJ039E' }),
      strictDiag({ id: 'c' }),
      strictDiag({ id: 'd', line: 20 }),
    ]);
    expect(converted.map((item) => item.line)).toEqual([12, 12, 20]);
    expect(converted.map((item) => item.message)).toEqual([
      'Element p is not allowed here',
      'Other failure',
      'Element p is not allowed here',
    ]);
  });

  it('handles null and empty input', () => {
    expect(strictDiagnosticsToProblems(null)).toEqual([]);
    expect(strictDiagnosticsToProblems(undefined)).toEqual([]);
    expect(strictDiagnosticsToProblems([])).toEqual([]);
  });
});

describe('mergeProblemDiagnostics', () => {
  it('preserves semantic diagnostics and appends DITA-OT rows', () => {
    const merged = mergeProblemDiagnostics([semanticDiag()], [strictDiag()]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: 'sem-1', source: 'structure' });
    expect(merged[1]).toMatchObject({
      id: 'dita-ot:strict-1',
      source: 'dita-ot',
      code: 'DOTJ013E',
    });
  });

  it('never drops strict diagnostics when semantic diagnostics are empty', () => {
    const merged = mergeProblemDiagnostics([], [strictDiag()]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe('dita-ot');
  });

  it('returns semantic diagnostics untouched when there is no strict result', () => {
    const merged = mergeProblemDiagnostics([semanticDiag()], null);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe('structure');
  });
});

describe('ProblemsPanel with merged DITA-OT diagnostics', () => {
  const renderPanel = (diagnostics: ReturnType<typeof mergeProblemDiagnostics>) =>
    renderToStaticMarkup(
      <ProblemsPanel
        diagnostics={diagnostics}
        onRefresh={() => undefined}
        onJumpToDiagnostic={() => undefined}
        onClose={() => undefined}
        onAiFixDiagnostic={() => undefined}
        onClearStrictDiagnostics={() => undefined}
      />,
    );

  it('renders source badge, code badge, location, message, filter pill and clear button', () => {
    const markup = renderPanel(
      mergeProblemDiagnostics(
        [semanticDiag()],
        [strictDiag({ id: 'a' }), strictDiag({ id: 'b', line: 20 })],
      ),
    );
    expect(markup).toContain('>DITA-OT<');
    expect(markup).toContain('DOTJ013E');
    expect(markup).toContain(`${esc('topics/intro.dita')}:12:5`);
    expect(markup).toContain(esc('Element p is not allowed here'));
    expect(markup).toContain('DITA-OT (2)');
    expect(markup).toContain('data-testid="problems-clear-strict"');
    // Long DITA-OT messages stay readable on hover.
    expect(markup).toContain(`title="${esc('Element p is not allowed here')}"`);
    // Semantic rows keep their own badge.
    expect(markup).toContain(esc('DITA structure'));
  });

  it('omits the DITA-OT filter pill and clear button without strict diagnostics', () => {
    const markup = renderPanel(mergeProblemDiagnostics([semanticDiag()], null));
    expect(markup).not.toContain('DITA-OT');
    expect(markup).not.toContain('problems-clear-strict');
    expect(markup).toContain(esc('DITA structure'));
  });

  it('hides the clear button when no handler is wired up', () => {
    const markup = renderToStaticMarkup(
      <ProblemsPanel
        diagnostics={mergeProblemDiagnostics([], [strictDiag()])}
        onRefresh={() => undefined}
        onJumpToDiagnostic={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(markup).toContain('DITA-OT (1)');
    expect(markup).not.toContain('problems-clear-strict');
  });
});

describe('StrictValidationDialog "view in Problems" entry point', () => {
  const RUNTIME = {
    available: true,
    command: 'dita',
    ditaHome: '/opt/dita',
    version: '4.2.1',
    pluginInstalled: true,
    pluginPath: null,
    fopConfigPath: null,
    fontsAvailable: true,
    fontsPath: null,
    checkedAt: '2026-01-01T00:00:00.000Z',
  };

  const renderDialog = (diagnostics: PublishDiagnostic[], onViewInProblems?: () => void) => {
    usePublishStore.setState({
      runtime: RUNTIME,
      strictResult: {
        available: true,
        ok: diagnostics.length === 0,
        targets: ['product-manual.ditamap'],
        diagnostics,
        runtime: RUNTIME,
        command: 'dita --processing-mode=strict',
        durationMs: 1200,
        logTail: '',
      },
      strictRunning: false,
      strictError: null,
      strictTargets: [],
    });
    return renderToStaticMarkup(
      <StrictValidationDialog
        open
        input={{ rootMapPath: 'product-manual.ditamap' }}
        targetLabel="product-manual.ditamap"
        onClose={() => undefined}
        onJumpToFile={() => undefined}
        {...(onViewInProblems ? { onViewInProblems } : {})}
      />,
    );
  };

  beforeEach(() => {
    usePublishStore.setState({ strictResult: null });
  });

  it('renders the button when strict diagnostics exist and a handler is provided', () => {
    const markup = renderDialog([strictDiag()], () => undefined);
    expect(markup).toContain('data-testid="strict-view-in-problems"');
  });

  it('omits the button when there are no diagnostics', () => {
    const markup = renderDialog([], () => undefined);
    expect(markup).not.toContain('data-testid="strict-view-in-problems"');
  });

  it('omits the button when no handler is provided', () => {
    const markup = renderDialog([strictDiag()]);
    expect(markup).not.toContain('data-testid="strict-view-in-problems"');
  });
});
