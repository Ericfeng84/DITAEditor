import { FolderInput, FolderPlus, Loader2, Pencil, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import type { Manual, ManualCreateInput, ManualUpdateInput } from '../services/manuals-api.js';

export type ManualFormMode = 'create' | 'attach' | 'edit';

export interface ManualFormDialogProps {
  open: boolean;
  mode: ManualFormMode;
  manual: Manual | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: ManualCreateInput) => void;
  onUpdate: (id: string, patch: ManualUpdateInput) => void;
}

const MODES: ReadonlyArray<{ id: 'create' | 'attach'; labelKey: 'workbench.formModeCreate' | 'workbench.formModeAttach'; icon: typeof FolderPlus }> = [
  { id: 'create', labelKey: 'workbench.formModeCreate', icon: FolderPlus },
  { id: 'attach', labelKey: 'workbench.formModeAttach', icon: FolderInput },
];

export function ManualFormDialog({
  open,
  mode,
  manual,
  busy,
  error,
  onClose,
  onCreate,
  onUpdate,
}: ManualFormDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'attach'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [scaffold, setScaffold] = useState<'starter' | 'blank'>('starter');
  const [archived, setArchived] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setFormMode(mode === 'attach' ? 'attach' : 'create');
      setName(manual?.name ?? '');
      setDescription(manual?.description ?? '');
      setRootDir(manual?.rootDir ?? '');
      setScaffold('starter');
      setArchived(manual?.archived ?? false);
      setValidation(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, mode, manual]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const editing = mode === 'edit';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editing && manual) {
      onUpdate(manual.id, {
        name: name.trim(),
        description: description.trim(),
        archived,
      });
      dialogRef.current?.close('ok');
      return;
    }
    if (!name.trim()) {
      setValidation(t('workbench.formNameRequired'));
      return;
    }
    if (formMode === 'attach' && !rootDir.trim()) {
      setValidation(t('workbench.formRootDirRequired'));
      return;
    }
    onCreate(
      formMode === 'attach'
        ? { mode: 'attach', name: name.trim(), description: description.trim(), rootDir: rootDir.trim() }
        : {
            mode: 'create',
            name: name.trim(),
            description: description.trim(),
            scaffold,
            initGit: true,
          },
    );
    dialogRef.current?.close('ok');
  };

  const title = editing
    ? t('workbench.formEditTitle')
    : formMode === 'attach'
      ? t('workbench.formAttachTitle')
      : t('workbench.formCreateTitle');

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('workbench.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('workbench.formCancel')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 p-5 text-xs">
        {editing ? null : (
          <div className="grid grid-cols-2 gap-2.5">
            {MODES.map((item) => {
              const Icon = item.icon;
              const active = formMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFormMode(item.id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-semibold transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-50/70 text-blue-800 ring-1 ring-blue-500'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label htmlFor="manual-form-name" className="mb-1 block font-medium text-slate-700">
            {t('workbench.formName')}
          </label>
          <input
            id="manual-form-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('workbench.formNamePlaceholder')}
            autoFocus
            className="h-8 w-full rounded-md border border-slate-300 px-2 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="manual-form-description" className="mb-1 block font-medium text-slate-700">
            {t('workbench.formDescription')}
          </label>
          <textarea
            id="manual-form-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('workbench.formDescriptionPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-md border border-slate-300 px-2 py-1.5 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {formMode === 'attach' && !editing ? (
          <div>
            <label htmlFor="manual-form-rootdir" className="mb-1 block font-medium text-slate-700">
              {t('workbench.formRootDir')}
            </label>
            <input
              id="manual-form-rootdir"
              value={rootDir}
              onChange={(event) => setRootDir(event.target.value)}
              placeholder={t('workbench.formRootDirPlaceholder')}
              spellCheck={false}
              className="h-8 w-full rounded-md border border-slate-300 px-2 font-mono text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-[10.5px] text-slate-500">{t('workbench.formRootDirHint')}</p>
          </div>
        ) : null}

        {formMode === 'create' && !editing ? (
          <fieldset>
            <legend className="mb-1 font-medium text-slate-700">{t('workbench.formScaffold')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'starter', labelKey: 'workbench.formScaffoldStarter' },
                  { id: 'blank', labelKey: 'workbench.formScaffoldBlank' },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                    scaffold === option.id
                      ? 'border-blue-400 bg-blue-50/60 text-blue-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="manual-scaffold"
                    value={option.id}
                    checked={scaffold === option.id}
                    onChange={() => setScaffold(option.id)}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-200"
                  />
                  {t(option.labelKey)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {editing && manual && !manual.isBuiltin ? (
          <label className="flex items-start gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-[11.5px] text-slate-700">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            />
            <span>
              {t('workbench.formArchived')}
              <span className="mt-0.5 block text-[10.5px] text-slate-500">
                {t('workbench.formArchivedHint')}
              </span>
            </span>
          </label>
        ) : null}

        {validation ?? error ? (
          <p role="alert" className="rounded-md bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
            {validation ?? error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('workbench.formCancel')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : editing ? (
              <Pencil className="h-3 w-3" aria-hidden="true" />
            ) : (
              <FolderPlus className="h-3 w-3" aria-hidden="true" />
            )}
            {editing
              ? t('workbench.formSubmitSave')
              : formMode === 'attach'
                ? t('workbench.formSubmitAttach')
                : t('workbench.formSubmitCreate')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
