import type { Node as PMNode } from 'prosemirror-model';
import {
  detectTaskContentModel,
  resolvePmDocTaskContentModel,
  resolveTaskContentModel,
  type TaskContentModel,
  type TaskContentModelSetting,
} from '@dita/core';

/**
 * Process-wide task content-model preference.
 *
 * The preference lives in the editor store (a UI toggle), but the content-model consumers
 * (`commands.ts`, `block-transforms.ts`, the CodeMirror linter/completion) are plain functions that
 * cannot read React state. They read this module-level mirror instead — the same pattern the
 * locale-dependent core helpers use — while `VisualEditor`/`App` recompute their reactive views
 * from the store.
 *
 * Setting semantics:
 * - `auto` (default): the document's own `<!DOCTYPE …>` decides — `task.dtd` → strict,
 *   `generalTask.dtd` / `ditabase.dtd` → general.
 * - `strict` / `general`: force the variant regardless of the DOCTYPE, for teams that standardise on
 *   one shell (or author without a DOCTYPE at all).
 */
let setting: TaskContentModelSetting = 'auto';
/** Variant detected from the document currently open in the workbench (used by React-free helpers). */
let detected: TaskContentModel = 'strict';

export function setTaskContentModelSetting(next: TaskContentModelSetting): void {
  setting = next;
}

export function getTaskContentModelSetting(): TaskContentModelSetting {
  return setting;
}

export function setDetectedTaskContentModel(next: TaskContentModel): void {
  detected = next;
}

/** Effective model for code paths that have no document at hand (inspector, semantic helpers). */
export function getTaskContentModel(): TaskContentModel {
  return resolveTaskContentModel(setting, detected);
}

/** Effective task model for a live ProseMirror document (reads the DOCTYPE from its prolog). */
export function resolveTaskModelForDocument(doc: PMNode): TaskContentModel {
  return resolvePmDocTaskContentModel(doc, setting);
}

/** Effective task model for raw XML source (reads the leading `<!DOCTYPE …>`). */
/**
 * The strict / general task-model switch only means something for `<task>` topics: concepts,
 * references, maps and DITAVAL files have no taskbody to validate.
 */
export function shouldShowTaskModelSwitch(docType: string | null | undefined): boolean {
  return docType === 'task';
}

export function resolveTaskModelForXml(xml: string | null | undefined): TaskContentModel {
  return resolveTaskContentModel(setting, detectTaskContentModel(xml));
}
