/**
 * Task content-model variants — "Strict Task" vs "General Task".
 *
 * OASIS DITA 1.3 ships two task shells that share the same root element (`<task>`) but carry
 * different `taskbody` content models:
 *
 * - `technicalContent/dtd/task.dtd` → pulls in `strictTaskbodyConstraint.mod`:
 *   `(prereq?, context?, (steps | steps-unordered)?, result?, tasktroubleshooting?, example?, postreq?)`
 *   Every slot appears at most once and only in this order; `<section>` and `<steps-informal>` are
 *   **not** allowed inside `<taskbody>`.
 * - `base/dtd/generalTask.dtd` / `base/dtd/ditabase.dtd` (unconstrained `task.mod`):
 *   `((prereq | context | section)*, (steps | steps-unordered | steps-informal)?, result?,
 *   tasktroubleshooting?, example*, postreq*)`
 *   Prose containers repeat and may interleave; `<section>` and `<steps-informal>` are legal.
 *
 * Everything else in the task body — `step`, `substep`, `choices`, `choicetable`, `itemgroup`,
 * `tutorialinfo`, `stepresult`, `steptroubleshooting` — is identical in both shells, so only the
 * `taskbody` slot list (and its allowed-child set) is variant-dependent.
 *
 * Resolution order used by the editors: an explicit user setting wins, otherwise the document's
 * own `<!DOCTYPE …>` public/system identifier decides, otherwise Strict Task is assumed.
 */

/** Task content-model variant. */
export type TaskContentModel = 'strict' | 'general';

/** User-facing preference: detect the variant from the document, or force one. */
export type TaskContentModelSetting = 'auto' | TaskContentModel;

export const DEFAULT_TASK_CONTENT_MODEL: TaskContentModel = 'strict';

/** Minimal shape of a DOCTYPE declaration needed to identify the task shell. */
export interface TaskModelDoctypeRef {
  readonly name?: string;
  readonly publicId?: string | null;
  readonly systemId?: string | null;
}

const GENERAL_TASK_DOCTYPE_PATTERN = /generalTask\.dtd|ditabase\.dtd|DTD\s+DITA\s+General\s+Task|DTD\s+DITA\s+Composite/i;

/**
 * Detect the task content model from a DOCTYPE declaration.
 *
 * `generalTask.dtd` / `ditabase.dtd` (and their public identifiers `-//OASIS//DTD DITA General
 * Task//EN` / `-//OASIS//DTD DITA Composite//EN`) use the unconstrained model; every other shell —
 * including `task.dtd` and documents without a DOCTYPE — keeps the strict default.
 */
export function detectTaskContentModelFromDoctype(
  doctype: TaskModelDoctypeRef | null | undefined,
): TaskContentModel {
  if (!doctype) return DEFAULT_TASK_CONTENT_MODEL;
  const haystack = [doctype.publicId ?? '', doctype.systemId ?? '', doctype.name ?? ''].join(' ');
  return GENERAL_TASK_DOCTYPE_PATTERN.test(haystack) ? 'general' : DEFAULT_TASK_CONTENT_MODEL;
}

/**
 * Detect the task content model from raw XML source: only the leading `<!DOCTYPE …>` declaration is
 * inspected, so a `<generalTask.dtd>` mention inside body text can never flip the model.
 */
export function detectTaskContentModel(xml: string | null | undefined): TaskContentModel {
  if (!xml) return DEFAULT_TASK_CONTENT_MODEL;
  const head = xml.slice(0, 4096);
  const match = /<!DOCTYPE\s[^>]*>/i.exec(head);
  if (!match) return DEFAULT_TASK_CONTENT_MODEL;
  const declaration = match[0];
  const systemId = /["']([^"']*\.dtd)["']/i.exec(declaration)?.[1] ?? '';
  const publicId = /PUBLIC\s+["']([^"']*)["']/i.exec(declaration)?.[1] ?? '';
  const name = /<!DOCTYPE\s+([^\s[]>+)/.exec(declaration)?.[1] ?? '';
  return detectTaskContentModelFromDoctype({ name, publicId, systemId });
}

/** Combine the user preference with a detected variant: an explicit setting always wins. */
export function resolveTaskContentModel(
  setting: TaskContentModelSetting | undefined,
  detected: TaskContentModel,
): TaskContentModel {
  if (setting === 'strict' || setting === 'general') return setting;
  return detected;
}
