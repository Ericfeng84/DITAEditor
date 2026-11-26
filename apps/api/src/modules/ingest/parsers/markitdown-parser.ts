import { mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { materializeMarkdownAssets, readTextFile } from './assets.js';
import { createCommandRunner, splitCommandLine } from './command-runner.js';
import { IngestParseError, type ParseDocumentInput, type ParsedDocumentOutput } from './types.js';

/** Below this many visible characters a PDF almost certainly has no text layer. */
const SCANNED_PDF_TEXT_THRESHOLD = 40;

const SCANNED_PDF_NOTE =
  '> **Note:** This PDF contains very little extractable text, so it may be a scanned document. ' +
  'Re-import it with the Docling engine (OCR enabled) to recover the page text.';

function visibleTextLength(markdown: string): number {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#>*_`|[\]()-]/g, '')
    .replace(/\s+/g, '')
    .length;
}

/**
 * Converts a document with the local `markitdown` CLI. Embedded Office images arrive as data
 * URIs (`--keep-data-uris`) and are lifted into `assetsDir`; anything MarkItDown writes beside
 * its output is copied as well. A near-empty PDF gets a hint to re-run through Docling OCR.
 */
export async function parseWithMarkItDownCli(
  input: ParseDocumentInput,
): Promise<ParsedDocumentOutput> {
  const { config } = input;
  const runner = input.commandRunner ?? createCommandRunner();
  const { command, args: leadingArgs } = splitCommandLine(config.markitdownCliCommand);
  if (!command) {
    throw new IngestParseError('engine-unavailable', 'No MarkItDown CLI command is configured.');
  }

  await mkdir(input.outputDir, { recursive: true });
  const stem = basename(input.inputPath, extname(input.inputPath)) || 'document';
  const outputPath = join(input.outputDir, `${stem}.md`);

  const args = [...leadingArgs, input.inputPath];
  if (config.markitdownKeepDataUris) args.push('--keep-data-uris');
  args.push('-o', outputPath);

  const result = await runner.run(command, args, {
    timeoutMs: config.timeoutMs,
    signal: input.signal,
  });
  if (result.exitCode !== 0) {
    const detail = (result.stderr || result.stdout).trim().slice(-800);
    throw new IngestParseError(
      'parse-failed',
      `MarkItDown exited with code ${result.exitCode}${detail ? `: ${detail}` : '.'}`,
      { exitCode: result.exitCode },
    );
  }

  let rawMarkdown: string;
  try {
    rawMarkdown = await readTextFile(outputPath);
  } catch {
    throw new IngestParseError(
      'parse-failed',
      `MarkItDown did not write its expected output file (${outputPath}).`,
    );
  }

  const { markdown, assets } = await materializeMarkdownAssets(rawMarkdown, input.assetsDir, [
    input.outputDir,
  ]);
  const warnings: string[] = [];
  let finalMarkdown = markdown;

  if (!markdown.trim()) {
    warnings.push('MarkItDown produced an empty Markdown document.');
  }
  if (input.extension === '.pdf' && visibleTextLength(markdown) < SCANNED_PDF_TEXT_THRESHOLD) {
    warnings.push(
      'The PDF appears to be scanned: very little text was extracted. Docling with OCR is recommended.',
    );
    finalMarkdown = `${markdown.trimEnd()}\n\n${SCANNED_PDF_NOTE}\n`;
  }

  return { markdown: finalMarkdown, engine: 'markitdown-cli', assets, warnings };
}
