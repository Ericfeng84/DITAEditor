import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { computeRelativeDitaHref, generateSemanticElementId } from '@dita/core';
import { Archive, Sparkles, Wand2, X } from 'lucide-react';
import { useI18n, type MessageKey } from '../i18n/index.js';

/**
 * Pure helpers live next to the dialog so Node unit tests can exercise the id / target-resolution
 * rules without mounting a DOM (the component only wires them to inputs).
 */

/** The exact id charset DITA 1.3 + the core warehouse writer accept. */
export const DITA_ELEMENT_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Default path offered when the author creates the first warehouse topic. */
export const DEFAULT_WAREHOUSE_PATH = 'reuse/common-snippets.dita';

/** Tags the create form offers; every one of them is a valid standalone reusable fragment. */
export const SNIPPET_TAGS = ['p', 'note', 'section', 'codeblock', 'ph'] as const;

export type SnippetTagName = (typeof SNIPPET_TAGS)[number];

/** Create mode starts from a paragraph: the most common reusable unit and the cheapest to fill in. */
export const DEFAULT_SNIPPET_TAG: SnippetTagName = 'p';

export type SnippetIdIssue = 'empty' | 'pattern' | 'duplicate';

export type SnippetIdCheck = { ok: true; id: string } | { ok: false; issue: SnippetIdIssue };

/** Validate a manually typed semantic id against the charset and the target topic's ids. */
export function validateSnippetId(
  rawId: string,
  existingIds: ReadonlySet<string>,
): SnippetIdCheck {
  const id = rawId.trim();
  if (!id) return { ok: false, issue: 'empty' };
  if (!DITA_ELEMENT_ID_PATTERN.test(id)) return { ok: false, issue: 'pattern' };
  if (existingIds.has(id)) return { ok: false, issue: 'duplicate' };
  return { ok: true, id };
}

/** Suggest a self-describing id (`note_battery_warning`, `note_battery_warning_2`, …). */
export function suggestSnippetId(
  tagName: string,
  textPreview: string,
  existingIds: ReadonlySet<string>,
): string {
  return generateSemanticElementId(tagName, textPreview, existingIds);
}

export interface WarehouseTargetValueOptions {
  /** Root-map key bound to the warehouse file; `conkeyref` is preferred whenever it is usable. */
  keyName?: string | null;
  /** Path of the topic being edited, so `conref` stays a relative href. */
  activeDocPath?: string | null;
  targetFilePath: string;
  elementId: string;
}

/**
 * Resolve the attribute a freshly created snippet must be referenced with: `conkeyref` when the
 * warehouse is mounted under a root-map key (portable across directories), otherwise a relative
 * `conref` href resolved from the editing topic.
 */
export function resolveWarehouseTargetValue(
  options: WarehouseTargetValueOptions,
): { attrName: 'conref' | 'conkeyref'; value: string } {
  const keyName = options.keyName?.trim() ?? '';
  if (keyName) {
    return { attrName: 'conkeyref', value: `${keyName}/${options.elementId}` };
  }
  const href = options.activeDocPath?.trim()
    ? computeRelativeDitaHref(options.activeDocPath, options.targetFilePath)
    : options.targetFilePath;
  return { attrName: 'conref', value: `${href}#${options.elementId}` };
}

/** Warehouse-looking topics sort first so the dropdown does not bury the reuse file. */
export function isWarehousePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.startsWith('reuse/') ||
    lower.includes('/reuse/') ||
    lower.includes('warehouse') ||
    lower.includes('snippet') ||
    lower.includes('common')
  );
}

export function sortWarehouseTargets(paths: readonly string[]): string[] {
  return [...paths].sort((a, b) => {
    const rank = (p: string) => (isWarehousePath(p) ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

export type ReuseSnippetMode = 'create' | 'extract';
export type ReuseSnippetExtractAction = 'replace' | 'copy';

/** The block an `extract` request came from (BlockHandle / AttributesPanel). */
export interface ReuseSnippetExtractSource {
  pos: number;
  tagName: string;
  previewText: string;
  fragmentXml: string;
}

export type ReuseSnippetTarget =
  | { kind: 'existing'; filePath: string }
  | {
      kind: 'new';
      filePath: string;
      title: string;
      keyName: string;
      mountKeyInRootMap: boolean;
    };

export interface ReuseSnippetSubmission {
  mode: ReuseSnippetMode;
  target: ReuseSnippetTarget;
  tagName: string;
  elementId: string;
  textContent?: string;
  fragmentXml?: string;
  /** `create` mode: insert a reference at the pending caret right away. */
  insertReference: boolean;
  /** `extract` mode: swap the source block for a reference, or keep it as a copy source. */
  extractAction?: ReuseSnippetExtractAction;
  /** `extract` mode: original block position, used for the single-transaction swap. */
  sourcePos?: number;
}

export interface CreateReusableSnippetDialogProps {
  open: boolean;
  mode: ReuseSnippetMode;
  /** Required for `extract`; ignored for `create`. */
  source?: ReuseSnippetExtractSource | null;
  /** Topic currently open in the visual editor (`conref` base path + id scope). */
  activeDocPath?: string | null;
  /** Topic files that may receive the snippet (warehouse files are listed first). */
  topicFiles: { path: string; title?: string }[];
  /** Element ids already used per topic file, so the dialog can refuse duplicates up front. */
  existingIdsByFile?: Record<string, readonly string[]>;
  canInsertInActiveDoc?: boolean;
  readOnly?: boolean;
  activeRootMapPath?: string | null;
  canManageKeys?: boolean;
  onClose: () => void;
  onSubmit: (payload: ReuseSnippetSubmission) => Promise<{ ok: boolean; error?: string }>;
}

const NEW_WAREHOUSE_VALUE = '__new-warehouse__';

const TAG_LABEL_KEYS: Record<SnippetTagName, MessageKey> = {
  p: 'reuseDialog.tag.p',
  note: 'reuseDialog.tag.note',
  section: 'reuseDialog.tag.section',
  codeblock: 'reuseDialog.tag.codeblock',
  ph: 'reuseDialog.tag.ph',
};

/**
 * Create (or extract into) a reusable warehouse snippet and, optionally, swap the caller in.
 *
 * Two flows share one form: `create` composes a fragment from a tag + text, `extract` starts from
 * the XML of the block the author picked in the editor and lets them choose between replacing that
 * block with a `conref` / `conkeyref` reference or keeping it untouched.
 */
export function CreateReusableSnippetDialog({
  open,
  mode,
  source = null,
  activeDocPath = null,
  topicFiles,
  existingIdsByFile,
  canInsertInActiveDoc = false,
  readOnly = false,
  activeRootMapPath = null,
  canManageKeys = false,
  onClose,
  onSubmit,
}: CreateReusableSnippetDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const isExtract = mode === 'extract';
  const sortedTargets = useMemo(
    () => sortWarehouseTargets(topicFiles.map((file) => file.path)),
    [topicFiles],
  );
  const defaultTarget = sortedTargets[0] ?? '';

  const [targetValue, setTargetValue] = useState(defaultTarget);
  const [newWarehouse, setNewWarehouse] = useState(sortedTargets.length === 0);
  const [warehousePath, setWarehousePath] = useState(DEFAULT_WAREHOUSE_PATH);
  const [warehouseTitle, setWarehouseTitle] = useState('');
  const [warehouseKey, setWarehouseKey] = useState('');
  const [mountKey, setMountKey] = useState(true);
  const [tagName, setTagName] = useState<SnippetTagName>(DEFAULT_SNIPPET_TAG);
  const [textContent, setTextContent] = useState('');
  const [idValue, setIdValue] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [insertReference, setInsertReference] = useState(true);
  const [extractAction, setExtractAction] = useState<ReuseSnippetExtractAction>(
    readOnly ? 'copy' : 'replace',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the dialog opens so a cancelled run never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    const first = sortWarehouseTargets(topicFiles.map((file) => file.path))[0] ?? '';
    setTargetValue(first);
    setNewWarehouse(first === '');
    setWarehousePath(DEFAULT_WAREHOUSE_PATH);
    setWarehouseTitle('');
    setWarehouseKey('');
    setMountKey(true);
    setTagName((isExtract ? (source?.tagName ?? DEFAULT_SNIPPET_TAG) : DEFAULT_SNIPPET_TAG) as SnippetTagName);
    setTextContent('');
    setIdValue('');
    setIdTouched(false);
    setInsertReference(canInsertInActiveDoc && !isExtract);
    setExtractAction(readOnly ? 'copy' : 'replace');
    setBusy(false);
    setError(null);
  }, [open, mode, source, canInsertInActiveDoc, readOnly, isExtract, topicFiles]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    let cleanupBackdrop: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (ev: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          ev.clientX < r.left ||
          ev.clientX > r.right ||
          ev.clientY < r.top ||
          ev.clientY > r.bottom
        );
      };
      const onDown = (ev: PointerEvent) => {
        pressedOutside = isOutside(ev);
      };
      const onUp = (ev: PointerEvent) => {
        if (pressedOutside && isOutside(ev) && dialog.open) dialog.close();
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupBackdrop?.();
    };
  }, [onClose]);

  const selectedTargetPath = newWarehouse ? warehousePath.trim() : targetValue;
  const existingIds = useMemo(() => {
    const list = existingIdsByFile?.[selectedTargetPath] ?? [];
    return new Set<string>(list);
  }, [existingIdsByFile, selectedTargetPath]);

  // Keep the id self-describing until the author edits it by hand.
  useEffect(() => {
    if (!open || idTouched) return;
    const tag = isExtract ? (source?.tagName ?? DEFAULT_SNIPPET_TAG) : tagName;
    const seed = isExtract ? (source?.previewText ?? '') : textContent;
    setIdValue(suggestSnippetId(tag, seed, existingIds));
  }, [open, idTouched, isExtract, source, tagName, textContent, existingIds]);

  const idCheck = validateSnippetId(idValue, existingIds);
  const idError = idCheck.ok
    ? null
    : idCheck.issue === 'empty'
      ? t('reuseDialog.errorIdEmpty')
      : idCheck.issue === 'pattern'
        ? t('reuseDialog.errorIdPattern')
        : t('reuseDialog.errorIdDuplicate');

  const canSubmit =
    !busy &&
    idCheck.ok &&
    (newWarehouse
      ? warehousePath.trim().length > 0
      : targetValue.trim().length > 0) &&
    (isExtract ? Boolean(source) : true);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const target: ReuseSnippetTarget = newWarehouse
      ? {
          kind: 'new',
          filePath: warehousePath.trim(),
          title: warehouseTitle.trim(),
          keyName: warehouseKey.trim(),
          mountKeyInRootMap: mountKey && Boolean(activeRootMapPath),
        }
      : { kind: 'existing', filePath: targetValue };

    const payload: ReuseSnippetSubmission = {
      mode,
      target,
      tagName: isExtract ? (source?.tagName ?? tagName) : tagName,
      elementId: idCheck.ok ? idCheck.id : idValue.trim(),
      insertReference: isExtract ? false : insertReference && canInsertInActiveDoc,
      ...(isExtract
        ? {
            fragmentXml: source?.fragmentXml,
            extractAction,
            sourcePos: source?.pos,
          }
        : { textContent }),
    };

    try {
      const result = await onSubmit(payload);
      if (!result.ok) {
        setError(result.error ?? t('reuseDialog.errorGeneric'));
        setBusy(false);
        return;
      }
      setBusy(false);
      dialogRef.current?.close('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reuseDialog.errorGeneric'));
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
      data-testid="reusable-snippet-dialog"
    >
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {isExtract ? t('reuseDialog.extractTitle') : t('reuseDialog.createTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isExtract ? t('reuseDialog.extractDesc') : t('reuseDialog.createDesc')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('reuseDialog.closeAria')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 p-5">
        {isExtract && source ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-800">
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                <code className="font-mono">{`<${source.tagName}>`}</code>
              </span>
              <span className="truncate text-[10px] text-teal-700">{source.previewText}</span>
            </div>
            <pre className="dita-scroller mt-1.5 max-h-24 overflow-auto rounded bg-white/80 p-2 font-mono text-[10px] leading-snug text-slate-600">
              {source.fragmentXml}
            </pre>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="reuse-target"
            className="mb-1 block text-xs font-medium text-slate-700"
          >
            {t('reuseDialog.targetLabel')}
          </label>
          <select
            id="reuse-target"
            value={newWarehouse ? NEW_WAREHOUSE_VALUE : targetValue}
            onChange={(event) => {
              const value = event.target.value;
              if (value === NEW_WAREHOUSE_VALUE) {
                setNewWarehouse(true);
                return;
              }
              setNewWarehouse(false);
              setTargetValue(value);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {sortedTargets.map((path) => (
              <option key={path} value={path}>
                {isWarehousePath(path) ? `★ ${path}` : path}
              </option>
            ))}
            <option value={NEW_WAREHOUSE_VALUE}>{t('reuseDialog.newWarehouseOption')}</option>
          </select>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            {t('reuseDialog.targetHint')}
          </p>
        </div>

        {newWarehouse ? (
          <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div>
              <label
                htmlFor="reuse-warehouse-path"
                className="mb-1 block text-[11px] font-medium text-slate-600"
              >
                {t('reuseDialog.warehousePath')}
              </label>
              <input
                id="reuse-warehouse-path"
                type="text"
                value={warehousePath}
                onChange={(event) => setWarehousePath(event.target.value)}
                placeholder={DEFAULT_WAREHOUSE_PATH}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="reuse-warehouse-title"
                className="mb-1 block text-[11px] font-medium text-slate-600"
              >
                {t('reuseDialog.warehouseTitle')}
              </label>
              <input
                id="reuse-warehouse-title"
                type="text"
                value={warehouseTitle}
                onChange={(event) => setWarehouseTitle(event.target.value)}
                placeholder={t('reuseDialog.warehouseTitlePlaceholder')}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            {activeRootMapPath && canManageKeys ? (
              <div className="space-y-1">
                <label
                  htmlFor="reuse-warehouse-key"
                  className="mb-1 block text-[11px] font-medium text-slate-600"
                >
                  {t('reuseDialog.warehouseKey')}
                </label>
                <input
                  id="reuse-warehouse-key"
                  type="text"
                  value={warehouseKey}
                  onChange={(event) => setWarehouseKey(event.target.value)}
                  placeholder={t('reuseDialog.warehouseKeyPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <label className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                  <input
                    type="checkbox"
                    checked={mountKey}
                    onChange={(event) => setMountKey(event.target.checked)}
                    className="mt-0.5 h-3 w-3 rounded border-slate-300"
                  />
                  {t('reuseDialog.mountKey', { map: activeRootMapPath })}
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {isExtract ? (
          <fieldset className="space-y-1.5">
            <legend className="mb-1 block text-xs font-medium text-slate-700">
              {t('reuseDialog.actionLabel')}
            </legend>
            {(['replace', 'copy'] as const).map((action) => (
              <label
                key={action}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  extractAction === action
                    ? 'border-teal-400 bg-teal-50/70 text-teal-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="reuse-extract-action"
                  value={action}
                  checked={extractAction === action}
                  disabled={readOnly && action === 'replace'}
                  onChange={() => setExtractAction(action)}
                  className="mt-0.5 h-3 w-3"
                />
                <span>
                  <span className="block font-medium">
                    {action === 'replace'
                      ? t('reuseDialog.action.replace')
                      : t('reuseDialog.action.copy')}
                  </span>
                  <span className="block text-[10px] leading-snug text-slate-500">
                    {action === 'replace'
                      ? t('reuseDialog.action.replaceHint')
                      : t('reuseDialog.action.copyHint')}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="reuse-tag"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  {t('reuseDialog.tagLabel')}
                </label>
                <select
                  id="reuse-tag"
                  value={tagName}
                  onChange={(event) => {
                    setTagName(event.target.value as SnippetTagName);
                    setIdTouched(false);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {SNIPPET_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {`<${tag}>`} — {t(TAG_LABEL_KEYS[tag])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                  <input
                    type="checkbox"
                    checked={insertReference && canInsertInActiveDoc}
                    disabled={!canInsertInActiveDoc}
                    onChange={(event) => setInsertReference(event.target.checked)}
                    className="mt-0.5 h-3 w-3 rounded border-slate-300"
                  />
                  {t('reuseDialog.insertAtCursor')}
                </label>
              </div>
            </div>
            <div>
              <label
                htmlFor="reuse-content"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                {t('reuseDialog.contentLabel')}
              </label>
              <textarea
                id="reuse-content"
                rows={3}
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
                placeholder={t('reuseDialog.contentPlaceholder')}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="reuse-id" className="block text-xs font-medium text-slate-700">
              {t('reuseDialog.idLabel')}
            </label>
            <button
              type="button"
              onClick={() => {
                setIdTouched(false);
                const tag = isExtract ? (source?.tagName ?? DEFAULT_SNIPPET_TAG) : tagName;
                const seed = isExtract ? (source?.previewText ?? '') : textContent;
                setIdValue(suggestSnippetId(tag, seed, existingIds));
              }}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <Wand2 className="h-3 w-3" aria-hidden="true" />
              {t('reuseDialog.suggestId')}
            </button>
          </div>
          <input
            id="reuse-id"
            type="text"
            value={idValue}
            onChange={(event) => {
              setIdTouched(true);
              setIdValue(event.target.value);
            }}
            spellCheck={false}
            className={`w-full rounded-lg border px-3 py-1.5 font-mono text-[11px] text-slate-900 focus:outline-none ${
              idError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
            }`}
          />
          <p className="mt-1 flex items-center gap-1 text-[10px] leading-snug">
            {idError ? (
              <span className="text-rose-600">{idError}</span>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-teal-600" aria-hidden="true" />
                <span className="text-slate-500">
                  {t('reuseDialog.idHint', { path: selectedTargetPath || DEFAULT_WAREHOUSE_PATH })}
                </span>
              </>
            )}
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('reuseDialog.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? t('reuseDialog.busy')
              : isExtract
                ? t('reuseDialog.submitExtract')
                : t('reuseDialog.submitCreate')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
