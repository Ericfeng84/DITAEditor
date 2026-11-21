export interface PublishQueueOptions {
  concurrency: number;
  run: (jobId: string, signal: AbortSignal) => Promise<void>;
  logger?: (message: string, error?: unknown) => void;
}

/**
 * Small in-process FIFO queue. Publishing is CPU/IO heavy and DITA-OT builds are isolated by
 * snapshot, so serialising by default avoids two JVMs racing for memory on a small team server.
 */
export class PublishQueue {
  private readonly concurrency: number;
  private readonly run: PublishQueueOptions['run'];
  private readonly logger: (message: string, error?: unknown) => void;
  private readonly pending: string[] = [];
  private readonly running = new Map<string, AbortController>();
  private readonly activeRuns = new Map<string, Promise<void>>();
  private closed = false;

  constructor(options: PublishQueueOptions) {
    const configured = Number.isFinite(options.concurrency) ? options.concurrency : 1;
    this.concurrency = Math.max(1, Math.floor(configured));
    this.run = options.run;
    this.logger = options.logger ?? (() => undefined);
  }

  enqueue(jobId: string): void {
    if (this.closed) {
      this.logger(`publish queue closed, rejecting job ${jobId}`);
      return;
    }
    if (this.running.has(jobId) || this.pending.includes(jobId)) return;
    this.pending.push(jobId);
    this.pump();
  }

  cancel(jobId: string): 'queued' | 'running' | null {
    const index = this.pending.indexOf(jobId);
    if (index >= 0) {
      this.pending.splice(index, 1);
      return 'queued';
    }
    const controller = this.running.get(jobId);
    if (controller) {
      controller.abort();
      return 'running';
    }
    return null;
  }

  get activeCount(): number {
    return this.running.size;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  isActive(jobId: string): boolean {
    return this.running.has(jobId) || this.pending.includes(jobId);
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    this.pending.length = 0;
    for (const controller of this.running.values()) controller.abort();
    // Let aborted builds release their child processes and log handles before the DB closes.
    await Promise.allSettled([...this.activeRuns.values()]);
  }

  private pump(): void {
    while (!this.closed && this.running.size < this.concurrency && this.pending.length > 0) {
      const jobId = this.pending.shift();
      if (!jobId) return;
      const controller = new AbortController();
      this.running.set(jobId, controller);
      const task = this.run(jobId, controller.signal)
        .catch((err) => {
          this.logger(`publish job ${jobId} crashed`, err);
        })
        .finally(() => {
          this.running.delete(jobId);
          this.activeRuns.delete(jobId);
          this.pump();
        });
      this.activeRuns.set(jobId, task);
    }
  }
}
