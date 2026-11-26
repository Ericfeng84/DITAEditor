import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DITA_KEY_NAME_PATTERN, type KeyspaceResult } from '@dita/core';
import { AlertTriangle, FileText, Globe2, KeyRound, Link2, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { CreateMapKeyOptions } from '../store/editor-store/types.js';

/** Where the new `<keydef>` will be mounted, plus what the invoking UI already knows. */
export interface NewKeyDialogContext {
  mapPath: string;
  parentPath: number[] | null;
  parentLabel?: string;
  initialKeyName?: string;
  initialKind?: 'text' | 'file' | 'external';
}

export interface NewKeyDialogProps {
  open: boolean;
  context: NewKeyDialogContext | null;
  /** Map files currently loaded in `mapBuffers`; more than one unlocks the target-map switch. */
  availableMaps: string[];
  /** Workspace topics, maps and images usable as a file binding. */
  availableFiles: string[];
  topicTitles: Record<string, string>;
  keyspace: KeyspaceResult | null;
  onClose: () => void;
  onCreate: (options: CreateMapKeyOptions) => Promise<{ ok: boolean; qualifiedKey?: string }>;
  onCreated?: (qualifiedKey: string) => void;
}

type BindingKind = 'text' | 'file' | 'external';

/** Everything the dialog collects; the input of the pure preview and payload builders. */
export interface NewKeyDraft {
  keyName: string;
  kind: BindingKind;
  textValue: string;
  targetFilePath: string;
  externalUrl: string;
  linkText: string;
  format: string;
  keyscope: string;
}

const KIND_TABS: Array<{ id: BindingKind; labelKey: 'newKey.kind.text' | 'newKey.kind.file' | 'newKey.kind.external'; Icon: typeof Link2 }> = [
  { id: 'text', labelKey: 'newKey.kind.text', Icon: KeyRound },
  { id: 'file', labelKey: 'newKey.kind.file', Icon: FileText },
  { id: 'external', labelKey: 'newKey.kind.external', Icon: Globe2 },
];

/** Infer the DITA `@format` token shown in the preview for a workspace asset path. */
function inferFormatToken(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.') + 1);
  if (ext === 'ditamap' || ext === 'bookmap') return 'ditamap';
  if (ext === 'dita' || ext === 'xml') return null;
  if (ext === 'htm') return 'html';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'pdf', 'html', 'txt'].includes(ext)) {
    return ext;
  }
  return null;
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mirrors the attribute order `createMapKey` writes, so authors see the exact result. */
export function buildKeydefPreviewXml(draft: NewKeyDraft): string {
  const key = draft.keyName.trim();
  if (!key || !DITA_KEY_NAME_PATTERN.test(key)) return '';
  if (draft.kind === 'text' && !draft.textValue.trim()) return '';
  if (draft.kind === 'file' && !draft.targetFilePath.trim()) return '';
  if (draft.kind === 'external' && !/^https?:\/\/\S+$/i.test(draft.externalUrl.trim())) return '';

  const formatValue =
    draft.format.trim() || (draft.kind === 'file' ? (inferFormatToken(draft.targetFilePath) ?? '') : '');
  const attrs: string[] = [`keys="${escapeXmlAttr(key)}"`];
  if (draft.kind === 'file') {
    attrs.push(`href="${escapeXmlAttr(draft.targetFilePath.trim())}"`);
  } else if (draft.kind === 'external') {
    attrs.push(`href="${escapeXmlAttr(draft.externalUrl.trim())}"`);
  }
  if (formatValue) attrs.push(`format="${escapeXmlAttr(formatValue)}"`);
  if (draft.kind === 'external') attrs.push('scope="external"');
  if (draft.keyscope.trim()) attrs.push(`keyscope="${escapeXmlAttr(draft.keyscope.trim())}"`);
  attrs.push('processing-role="resource-only"');

  const children: string[] = [];
  if (draft.kind === 'external' && draft.linkText.trim()) {
    children.push(`    <linktext>${escapeXmlAttr(draft.linkText.trim())}</linktext>`);
  }
  const keyword = draft.textValue.trim();
  if (keyword) {
    children.push('    <keywords>');
    children.push(`      <keyword>${escapeXmlAttr(keyword)}</keyword>`);
    children.push('    </keywords>');
  }

  const openTag = `<keydef ${attrs.join(' ')}>`;
  if (children.length === 0) return `${openTag}</keydef>`;
  return [openTag, '  <topicmeta>', ...children, '  </topicmeta>', '</keydef>'].join('\n');
}

/** The store payload for a completed draft. */
export function buildNewKeyOptions(
  draft: NewKeyDraft,
  placement: { mapPath: string; parentPath: number[] | null },
): CreateMapKeyOptions {
  const formatValue =
    draft.format.trim() || (draft.kind === 'file' ? (inferFormatToken(draft.targetFilePath) ?? '') : '');
  return {
    mapPath: placement.mapPath,
    parentPath: placement.parentPath,
    keyName: draft.keyName.trim(),
    bindingKind: draft.kind,
    textValue: draft.textValue.trim() || undefined,
    targetFilePath: draft.kind === 'file' ? draft.targetFilePath.trim() : undefined,
    externalUrl: draft.kind === 'external' ? draft.externalUrl.trim() : undefined,
    linkText: draft.linkText.trim() || undefined,
    format: formatValue || undefined,
    keyscope: draft.keyscope.trim() || undefined,
  };
}

/**
 * Create a `<keydef>` on the map: text variable, workspace file binding or external URL.
 *
 * The dialog only collects intent — every XML write happens through the store action
 * `createMapKey`, which keeps the check-out lock guard and the Draft Overlay persistence.
 */
export function NewKeyDialog({
  open,
  context,
  availableMaps,
  availableFiles,
  topicTitles,
  keyspace,
  onClose,
  onCreate,
  onCreated,
}: NewKeyDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [targetMapPath, setTargetMapPath] = useState(context?.mapPath ?? '');
  const [keyName, setKeyName] = useState(context?.initialKeyName ?? '');
  const [kind, setKind] = useState<BindingKind>(context?.initialKind ?? 'text');
  const [textValue, setTextValue] = useState('');
  const [targetFilePath, setTargetFilePath] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [format, setFormat] = useState('');
  const [keyscope, setKeyscope] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && context) {
      setTargetMapPath(context.mapPath);
      setKeyName(context.initialKeyName ?? '');
      setKind(context.initialKind ?? 'text');
      setTextValue('');
      setTargetFilePath('');
      setExternalUrl('');
      setLinkText('');
      setFormat('');
      setKeyscope('');
      setSubmitting(false);
      setError(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, context]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCloseEvt = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', onCloseEvt);
    return () => dialog.removeEventListener('close', onCloseEvt);
  }, [onClose]);

  const trimmedKey = keyName.trim();
  const keyValid = trimmedKey.length > 0 && DITA_KEY_NAME_PATTERN.test(trimmedKey);
  const duplicate =
    keyValid && keyspace
      ? (keyspace.keys[trimmedKey] ??
        Object.values(keyspace.keys).find((def) => def.key === trimmedKey))
      : undefined;
  const urlValid = /^https?:\/\/\S+$/i.test(externalUrl.trim());
  const formatValue = format.trim() || (kind === 'file' ? inferFormatToken(targetFilePath) : '');

  const validationError = useMemo(() => {
    if (!trimmedKey) return t('newKey.nameRequired');
    if (!keyValid) return t('newKey.nameInvalid');
    if (kind === 'text' && !textValue.trim()) return t('newKey.textRequired');
    if (kind === 'file' && !targetFilePath.trim()) return t('newKey.fileRequired');
    if (kind === 'external' && !urlValid) return t('newKey.urlInvalid');
    return null;
  }, [trimmedKey, keyValid, kind, textValue, targetFilePath, urlValid, t]);

  const draft = useMemo<NewKeyDraft>(
    () => ({ keyName: trimmedKey, kind, textValue, targetFilePath, externalUrl, linkText, format, keyscope }),
    [trimmedKey, kind, textValue, targetFilePath, externalUrl, linkText, format, keyscope],
  );
  const previewXml = validationError ? '' : buildKeydefPreviewXml(draft);

  const canPickTargetMap = context?.parentPath === null && availableMaps.length > 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || submitting || !context) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onCreate(
        buildNewKeyOptions(draft, {
          mapPath: targetMapPath || context.mapPath,
          parentPath: context.parentPath,
        }),
      );
      if (!result.ok) {
        setError(t('newKey.failed'));
        return;
      }
      onCreated?.(result.qualifiedKey ?? trimmedKey);
      dialogRef.current?.close('ok');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-xl rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 id={titleId} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <KeyRound className="h-4 w-4 text-blue-600" aria-hidden="true" />
          {t('newKey.title')}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('newKey.closeAria')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 p-5 text-xs">
        {/* Placement: fixed badge when a parent node was right-clicked, map switch at root */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-500">{t('newKey.targetMapLabel')}</span>
          {canPickTargetMap ? (
            <select
              aria-label={t('newKey.targetMapLabel')}
              value={targetMapPath}
              onChange={(e) => setTargetMapPath(e.target.value)}
              className="max-w-[60%] rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-blue-500 focus:outline-none"
            >
              {availableMaps.map((mapPath) => (
                <option key={mapPath} value={mapPath}>
                  {mapPath}
                </option>
              ))}
            </select>
          ) : (
            <code className="truncate font-mono text-[11px] font-semibold text-slate-800">
              {targetMapPath || context?.mapPath}
            </code>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] text-slate-600">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
            {context?.parentPath === null || context?.parentPath === undefined
              ? t('newKey.placementRoot')
              : t('newKey.placementChild', { label: context?.parentLabel ?? '' })}
          </span>
        </div>

        {/* Key name */}
        <div>
          <label htmlFor="new-key-name" className="mb-1 block font-medium text-slate-700">
            {t('newKey.nameLabel')}
          </label>
          <input
            id="new-key-name"
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder={t('newKey.namePlaceholder')}
            aria-invalid={trimmedKey.length > 0 && !keyValid}
            className={`w-full rounded-lg border px-3 py-1.5 font-mono text-xs focus:outline-none ${
              trimmedKey.length > 0 && !keyValid
                ? 'border-rose-300 focus:border-rose-500'
                : 'border-slate-200 focus:border-blue-500'
            }`}
          />
          <p className="mt-1 text-[10px] text-slate-400">{t('newKey.nameHint')}</p>
          {duplicate ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {t('newKey.nameDuplicate', { key: duplicate.qualifiedKey })}
            </p>
          ) : null}
        </div>

        {/* Binding kind tabs */}
        <div
          role="tablist"
          aria-label={t('newKey.kindAria')}
          className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {KIND_TABS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={kind === id}
              onClick={() => setKind(id)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors ${
                kind === id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {kind === 'text' ? (
          <div>
            <label htmlFor="new-key-text" className="mb-1 block font-medium text-slate-700">
              {t('newKey.textLabel')}
            </label>
            <input
              id="new-key-text"
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={t('newKey.textPlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        ) : null}

        {kind === 'file' ? (
          <div className="space-y-2">
            <div>
              <label htmlFor="new-key-file" className="mb-1 block font-medium text-slate-700">
                {t('newKey.fileLabel')}
              </label>
              <select
                id="new-key-file"
                value={targetFilePath}
                onChange={(e) => setTargetFilePath(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="">—</option>
                {availableFiles.map((filePath) => (
                  <option key={filePath} value={filePath}>
                    {topicTitles[filePath] ? `${topicTitles[filePath]} · ${filePath}` : filePath}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-key-file-keyword" className="mb-1 block font-medium text-slate-700">
                {t('newKey.textLabel')}
              </label>
              <input
                id="new-key-file-keyword"
                type="text"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={t('newKey.textPlaceholder')}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        {kind === 'external' ? (
          <div className="space-y-2">
            <div>
              <label htmlFor="new-key-url" className="mb-1 block font-medium text-slate-700">
                {t('newKey.urlLabel')}
              </label>
              <input
                id="new-key-url"
                type="text"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={t('newKey.urlPlaceholder')}
                aria-invalid={externalUrl.trim().length > 0 && !urlValid}
                className={`w-full rounded-lg border px-3 py-1.5 font-mono text-xs focus:outline-none ${
                  externalUrl.trim().length > 0 && !urlValid
                    ? 'border-rose-300 focus:border-rose-500'
                    : 'border-slate-200 focus:border-blue-500'
                }`}
              />
            </div>
            <div>
              <label htmlFor="new-key-linktext" className="mb-1 block font-medium text-slate-700">
                {t('newKey.linkTextLabel')}
              </label>
              <input
                id="new-key-linktext"
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder={t('newKey.linkTextPlaceholder')}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-key-format" className="mb-1 block font-medium text-slate-700">
              {t('newKey.formatLabel')}
            </label>
            <input
              id="new-key-format"
              type="text"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder={t('newKey.formatPlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-key-keyscope" className="mb-1 block font-medium text-slate-700">
              {t('newKey.keyscopeLabel')}
            </label>
            <input
              id="new-key-keyscope"
              type="text"
              value={keyscope}
              onChange={(e) => setKeyscope(e.target.value)}
              placeholder={t('newKey.keyscopePlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Live XML preview */}
        <div>
          <p className="mb-1 font-medium text-slate-700">{t('newKey.previewLabel')}</p>
          <pre className="dita-scroller max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-slate-100">
            {previewXml || t('newKey.previewEmpty')}
          </pre>
        </div>

        {error ?? validationError ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{error ?? validationError}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={Boolean(validationError) || submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {submitting ? t('newKey.creating') : t('newKey.submit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
