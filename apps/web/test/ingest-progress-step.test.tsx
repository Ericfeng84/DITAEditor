import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { IngestJobView } from '../src/services/ingest-api.js';
import { IngestProgressStep } from '../src/ingest/IngestProgressStep.js';
import { INGEST_PROGRESS_STAGES, progressStageIndex } from '../src/ingest/types.js';

/**
 * A failed job used to snap the stepper back to `解析` with a spinning pill, which reads as
 * "still working" on a job that already died. The stage pill must stay on the stage that
 * actually failed and stop spinning.
 */

function makeJob(overrides: Partial<IngestJobView> = {}): IngestJobView {
  return {
    id: 'job-1',
    targetMode: 'new_manual',
    projectId: 'manual-1',
    branch: 'main',
    userId: 'u-admin',
    sourceFilename: 'import.md',
    sourceExt: '.md',
    sourceSize: 1200,
    requestedEngine: 'markitdown',
    engineUsed: 'markitdown',
    status: 'validating',
    autoApprove: true,
    options: { engine: 'auto' },
    assets: [],
    plan: null,
    progress: {
      stage: 'validating',
      percent: 70,
      message: 'Validating',
      planReady: true,
      topics: [
        {
          topicId: 'concept_overview',
          filePath: 'concepts/overview.dita',
          title: 'Product Overview',
          status: 'failed',
          attempts: 2,
          error: 'DOTJ013E: element "steps" not allowed here.',
        },
      ],
      updatedAt: Date.now(),
    },
    validation: null,
    result: null,
    createdManualId: null,
    error: 'The generated DITA content failed validation: DOTJ013E',
    cancelRequested: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:01.000Z',
    finishedAt: '2026-01-01T00:00:02.000Z',
    ...overrides,
  } as IngestJobView;
}

function render(job: IngestJobView): string {
  return renderToStaticMarkup(
    React.createElement(IngestProgressStep, {
      job,
      logs: [],
      cancelling: false,
      error: null,
      onCancel: () => undefined,
    }),
  );
}

describe('ingest progress stepper', () => {
  it('keeps a failed job on the stage where it stopped', () => {
    expect(progressStageIndex(makeJob({ status: 'failed' }))).toBe(
      INGEST_PROGRESS_STAGES.indexOf('validating'),
    );
    expect(
      progressStageIndex(makeJob({ status: 'cancelled', progress: { stage: 'writing', percent: 60 } })),
    ).toBe(INGEST_PROGRESS_STAGES.indexOf('writing'));
    // A live job still follows its status.
    expect(progressStageIndex(makeJob({ status: 'materializing' }))).toBe(
      INGEST_PROGRESS_STAGES.indexOf('materializing'),
    );
  });

  it('renders a static failure badge instead of a spinner on the active pill', () => {
    const failed = render(makeJob({ status: 'failed' }));
    const stepper = failed.slice(0, failed.indexOf('</ol>'));
    expect(stepper).not.toContain('animate-spin');
    expect(stepper).toContain('lucide-alert-circle');
    // ... and it stays on the `校验 / 修复` pill instead of resetting to `解析`.
    expect(stepper).toContain('bg-blue-600');

    const running = render(makeJob({ status: 'validating' }));
    expect(running.slice(0, running.indexOf('</ol>'))).toContain('animate-spin');
  });

  it('shows the failed topic with its attempt count and error', () => {
    const markup = render(makeJob({ status: 'failed' }));
    expect(markup).toContain('Product Overview');
    expect(markup).toContain('DOTJ013E');
  });
});
