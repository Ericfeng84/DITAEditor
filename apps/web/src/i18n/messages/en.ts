import type { MessageKey } from './zh-CN.js';

/**
 * English catalogue, mirroring the zh-CN group files (`./en/*.ts`).
 * `Record<MessageKey, string>` makes catalogue drift a compile error: a missing key or a
 * typo fails `pnpm --filter @dita/web typecheck`. `中文` is kept for the language switcher.
 */
import { enCommon } from './en/common.js';
import { enEditor } from './en/editor.js';
import { enStructure } from './en/structure.js';
import { enCollab } from './en/collab.js';
import { enAi } from './en/ai.js';
import { enGuide } from './en/guide.js';
import { enWorkbench } from './en/workbench.js';
import { enAssignments } from './en/assignments.js';

export const en: Record<MessageKey, string> = {
  ...enCommon,
  ...enEditor,
  ...enStructure,
  ...enCollab,
  ...enAi,
  ...enGuide,
  ...enWorkbench,
  ...enAssignments,
};
