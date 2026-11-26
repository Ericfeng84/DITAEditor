import { spawn } from 'node:child_process';
import {
  IngestParseError,
  type CommandResult,
  type CommandRunOptions,
  type CommandRunner,
} from './types.js';

const DEFAULT_MAX_OUTPUT_CHARS = 1024 * 1024;

/**
 * Splits a configured command string such as `python -m markitdown` into an executable and
 * leading arguments, honouring single/double quotes. Kept intentionally small: parser
 * commands are operator-controlled config values, not untrusted user input.
 */
export function splitCommandLine(commandLine: string): { command: string; args: string[] } {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;

  for (const char of commandLine.trim()) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started || current) {
        tokens.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += char;
    started = true;
  }
  if (started || current) tokens.push(current);

  const [command = '', ...args] = tokens;
  return { command, args };
}

function quoteForCmd(arg: string): string {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg;
}

function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // Process already exited — nothing to clean up.
  }
}

function createAbortError(signal: AbortSignal): IngestParseError {
  const reason = signal.reason;
  if (reason instanceof IngestParseError) return reason;
  return new IngestParseError('cancelled', 'The document parse was cancelled.');
}

/**
 * Production `CommandRunner`: cross-platform spawn, bounded output, hard timeout and
 * `AbortSignal` support. The process tree is killed on Windows through `taskkill /T`.
 */
export function createCommandRunner(): CommandRunner {
  async function run(
    command: string,
    args: readonly string[],
    options: CommandRunOptions = {},
  ): Promise<CommandResult> {
    if (!command.trim()) {
      throw new IngestParseError('engine-unavailable', 'No parser command is configured.');
    }
    if (options.signal?.aborted) throw createAbortError(options.signal);

    const maxChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
    const useShell = process.platform === 'win32';
    const spawnCommand = useShell ? (process.env.ComSpec ?? 'cmd.exe') : command;
    const spawnArgs = useShell
      ? ['/d', '/s', '/c', [command, ...args].map(quoteForCmd).join(' ')]
      : [...args];

    return await new Promise<CommandResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const child = spawn(spawnCommand, spawnArgs, {
        cwd: options.cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        timer = undefined;
        options.signal?.removeEventListener('abort', onAbort);
      };
      const finish = (error: IngestParseError): void => {
        if (settled) return;
        settled = true;
        cleanup();
        killTree(child.pid);
        reject(error);
      };
      const onAbort = (): void => {
        const signal = options.signal;
        if (!signal) return;
        finish(createAbortError(signal));
      };

      options.signal?.addEventListener('abort', onAbort, { once: true });

      if (options.timeoutMs && options.timeoutMs > 0) {
        timer = setTimeout(() => {
          finish(
            new IngestParseError(
              'timeout',
              `Parser command timed out after ${options.timeoutMs} ms.`,
              { command, timeoutMs: options.timeoutMs },
            ),
          );
        }, options.timeoutMs);
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        if (stdout.length < maxChars) stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < maxChars) stderr += chunk.toString('utf8');
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        finish(
          new IngestParseError(
            error.code === 'ENOENT' ? 'engine-unavailable' : 'parse-failed',
            error.code === 'ENOENT'
              ? `Parser command "${command}" was not found on PATH.`
              : `Parser command "${command}" failed to start: ${error.message}`,
            { command },
          ),
        );
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          stdout: stdout.slice(0, maxChars),
          stderr: stderr.slice(0, maxChars),
          exitCode: code ?? 1,
        });
      });
    });
  }

  async function isAvailable(command: string): Promise<boolean> {
    const { command: executable } = splitCommandLine(command);
    if (!executable) return false;
    const probe = process.platform === 'win32' ? 'where' : 'which';
    try {
      const result = await run(probe, [executable], {
        timeoutMs: 10_000,
        maxOutputChars: 8_192,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  return { run, isAvailable };
}
