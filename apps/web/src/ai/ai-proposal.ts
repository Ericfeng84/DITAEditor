import type { AiProposal } from './ai-types';

/** Buffer comparison ignores line-ending noise and the leading/trailing whitespace of a patch. */
function normalizeBuffer(xml: string): string {
  return xml.replace(/\r\n/g, '\n').trim();
}

/** True when two XML buffers hold the same bytes modulo line endings and edge whitespace. */
export function isSameXmlBuffer(a: string, b: string): boolean {
  return normalizeBuffer(a) === normalizeBuffer(b);
}

/**
 * A proposal that echoes the target back unchanged would "apply" without touching the buffer.
 *
 * Fix flows hit this whenever the reported line is not the cause (see `buildDiagnosticFixTarget`):
 * the model returns the same lines, the splice verifies, and the workbench announces success while
 * the editor stays byte-identical. Detecting it up front keeps the UI honest.
 */
export function hasAiProposalChanges(
  proposal: Pick<AiProposal, 'originalXml' | 'patchedXml'>,
): boolean {
  return !isSameXmlBuffer(proposal.originalXml, proposal.patchedXml);
}

/**
 * The buffer changed after the proposal was generated (an edit, an undo, or another file's patch),
 * so applying it would silently revert that work.
 */
export function isAiProposalStale(
  proposal: Pick<AiProposal, 'originalXml'>,
  currentXml: string,
): boolean {
  return !isSameXmlBuffer(proposal.originalXml, currentXml);
}
