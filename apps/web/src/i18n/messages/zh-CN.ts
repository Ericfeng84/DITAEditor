/**
 * zh-CN is the source catalogue: `MessageKey` is derived from it, so adding a
 * string here immediately forces the matching `en` entry (compile error + parity test).
 * Placeholders use `{name}` and must be identical in both catalogues.
 *
 * Entries are grouped by domain in ./zh-CN/*.ts and re-assembled here; keep the spread
 * order stable so the catalogue reads in the same order as before the split.
 */
import { zhCNCommon } from './zh-CN/common.js';
import { zhCNEditor } from './zh-CN/editor.js';
import { zhCNStructure } from './zh-CN/structure.js';
import { zhCNCollab } from './zh-CN/collab.js';
import { zhCNAi } from './zh-CN/ai.js';
import { zhCNGuide } from './zh-CN/guide.js';

export const zhCN = {
  ...zhCNCommon,
  ...zhCNEditor,
  ...zhCNStructure,
  ...zhCNCollab,
  ...zhCNAi,
  ...zhCNGuide,
} as const;

export type MessageKey = keyof typeof zhCN;
export type MessageParams = Readonly<Record<string, string | number>>;
