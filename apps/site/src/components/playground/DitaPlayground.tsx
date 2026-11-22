import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PLAYGROUND_PRESETS,
  getPreset,
  type PlaygroundPreset,
  type PlaygroundPresetId,
} from '../../data/playground-presets.js';
import type { SiteDictionary } from '../../i18n/index.js';
import type { Locale } from '../../i18n/locales.js';
import { computeLineDiff, compactDiff, type DiffLine } from '../../lib/diff.js';
import { analyseXml, conditionRows, keyspaceRows, safeParseDitaval } from '../../lib/sandbox.js';
import { SITE } from '../../lib/site.js';
import SandboxSourceEditor from './SandboxSourceEditor.js';
import SandboxVisualEditor, { type InsertKind } from './SandboxVisualEditor.js';

type ViewMode = 'visual' | 'split' | 'source';
type DisplayMode = 'show-all' | 'dim-excluded' | 'hide-excluded';

interface Props {
  locale: Locale;
  dict: SiteDictionary;
}

const INSERT_KINDS: InsertKind[] = ['p', 'note', 'ul', 'codeblock', 'step'];

function presetLabel(preset: PlaygroundPreset, dict: SiteDictionary): string {
  return dict.playground.presets[preset.id].label;
}

export default function DitaPlayground({ locale, dict }: Props) {
  const copy = dict.playground;
  const [presetId, setPresetId] = useState<PlaygroundPresetId>('lossless-roundtrip');
  const preset = useMemo(() => getPreset(presetId), [presetId]);
  const [xml, setXml] = useState<string>(preset.xml);
  const [mode, setMode] = useState<ViewMode>('split');
  const [display, setDisplay] = useState<DisplayMode>('dim-excluded');
  const [ditavalId, setDitavalId] = useState<string>(
    preset.ditavalProfiles?.[0]?.id ?? 'none',
  );
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [insertRequest, setInsertRequest] = useState<{ kind: InsertKind; nonce: number } | null>(
    null,
  );
  const nonceRef = useRef(0);

  const diagnostics = useMemo(() => analyseXml(xml), [xml]);
  const keys = useMemo(() => keyspaceRows(preset), [preset]);
  const keyValues = useMemo(
    () =>
      Object.fromEntries(
        keys.filter((row) => row.status === 'resolved').map((row) => [row.key, row.value]),
      ),
    [keys],
  );
  const ditavalXml = useMemo(() => {
    if (ditavalId === 'none') return null;
    return preset.ditavalProfiles?.find((profile) => profile.id === ditavalId)?.xml ?? null;
  }, [preset, ditavalId]);
  const ditaval = useMemo(() => safeParseDitaval(ditavalXml), [ditavalXml]);
  const conditions = useMemo(() => conditionRows(xml, ditaval), [xml, ditaval]);
  const diff = useMemo(() => computeLineDiff(preset.xml, xml), [preset.xml, xml]);
  const changedLines = diff.added + diff.removed;
  const lineCount = xml.split('\n').length;

  useEffect(() => {
    setCopied(false);
  }, [xml]);

  useEffect(() => {
    if (diagnostics.wellFormed) setBlocked(false);
  }, [diagnostics.wellFormed]);

  function applyPreset(nextId: PlaygroundPresetId) {
    const next = getPreset(nextId);
    setPresetId(nextId);
    setXml(next.xml);
    setDitavalId(next.ditavalProfiles?.[0]?.id ?? 'none');
    setVisualError(null);
    setShowDiff(false);
  }

  function resetPreset() {
    setXml(preset.xml);
    setVisualError(null);
  }

  function changeMode(next: ViewMode) {
    if (next !== 'source' && !diagnostics.wellFormed) {
      setBlocked(true);
      return;
    }
    setMode(next);
  }

  async function copyXml() {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const insertText = useMemo(
    () =>
      ({
        p: locale === 'zh' ? '新段落' : 'New paragraph',
        note: locale === 'zh' ? '提示内容' : 'Note text',
        ul: locale === 'zh' ? '列表项' : 'List item',
        codeblock: locale === 'zh' ? '命令 --flag' : 'command --flag',
        step: locale === 'zh' ? '新步骤' : 'New step',
      }) satisfies Record<InsertKind, string>,
    [locale],
  );

  return (
    <section className="playground-shell">
      <div className="pg-toolbar">
        <div className="pg-toolbar__group">
          <label className="pg-label" htmlFor="pg-preset">
            {copy.presetLabel}
          </label>
          <select
            id="pg-preset"
            className="pg-select"
            value={presetId}
            onChange={(event) => applyPreset(event.target.value as PlaygroundPresetId)}
          >
            {PLAYGROUND_PRESETS.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {presetLabel(item, dict)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={resetPreset}
            disabled={xml === preset.xml}
          >
            {copy.reset}
          </button>
        </div>

        <div className="pg-toolbar__group">
          <span className="pg-label">{copy.modeLabel}</span>
          <div className="pg-segmented" role="group" aria-label={copy.modeLabel}>
            {(['visual', 'split', 'source'] as ViewMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? 'is-active' : ''}
                aria-pressed={mode === item}
                onClick={() => changeMode(item)}
              >
                {copy.modes[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-toolbar__group pg-toolbar__group--end">
          <span className={diagnostics.wellFormed ? 'status-dot is-ok' : 'status-dot is-error'}>
            {diagnostics.wellFormed ? copy.wellFormed : copy.broken}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyXml}
          >
            {copied ? copy.copied : copy.copy}
          </button>
        </div>
      </div>

      <div className="pg-toolbar pg-toolbar--secondary">
        <div className="pg-toolbar__group">
          {preset.ditavalProfiles && preset.ditavalProfiles.length > 0 ? (
            <>
              <label className="pg-label" htmlFor="pg-ditaval">
                {copy.ditavalLabel}
              </label>
              <select
                id="pg-ditaval"
                className="pg-select"
                value={ditavalId}
                onChange={(event) => setDitavalId(event.target.value)}
              >
                <option value="none">—</option>
                {preset.ditavalProfiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.label[locale]}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="pg-label">{copy.ditavalLabel} · —</span>
          )}
        </div>

        <div className="pg-toolbar__group">
          <span className="pg-label">{copy.displayLabel}</span>
          <div className="pg-segmented" role="group" aria-label={copy.displayLabel}>
            {(['show-all', 'dim-excluded', 'hide-excluded'] as DisplayMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={display === item ? 'is-active' : ''}
                aria-pressed={display === item}
                onClick={() => setDisplay(item)}
              >
                {copy.display[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-toolbar__group pg-toolbar__group--end">
          <span className="pg-stats">
            <strong>{lineCount}</strong> {copy.stats.lines} · <strong>{keys.length}</strong>{' '}
            {copy.stats.keys} · <strong>{changedLines}</strong> {copy.stats.changed}
          </span>
          <button
            type="button"
            className={`btn btn-sm ${showDiff ? 'btn-dark' : 'btn-ghost'}`}
            onClick={() => setShowDiff((value) => !value)}
            aria-expanded={showDiff}
          >
            {copy.diffToggle}
          </button>
        </div>
      </div>

      {blocked && <div className="pg-banner pg-banner--warn">{copy.switchBlocked}</div>}
      {diagnostics.wellFormed && visualError && (
        <div className="pg-banner pg-banner--warn">
          {copy.invalidVisual}
          <code>{visualError}</code>
        </div>
      )}

      <div className="pg-grid">
        <div className={`pg-editor pg-editor--${mode}`}>
          {(mode === 'visual' || mode === 'split') && (
            <div className="pg-panel">
              <div className="pg-panel__head">
                <span>{copy.modes.visual}</span>
                <span className="pg-panel__meta">{copy.editingHint}</span>
              </div>
              <div className="pg-panel__body">
                <SandboxVisualEditor
                  value={xml}
                  keyValues={keyValues}
                  ditaval={ditaval}
                  display={display}
                  insertRequest={insertRequest}
                  insertText={insertText}
                  onChange={setXml}
                  onConversionError={setVisualError}
                />
              </div>
            </div>
          )}
          {(mode === 'source' || mode === 'split') && (
            <div className="pg-panel">
              <div className="pg-panel__head">
                <span>{copy.modes.source}</span>
                <span className="pg-panel__meta">
                  {diagnostics.wellFormed ? copy.wellFormed : copy.broken}
                </span>
              </div>
              <div className="pg-panel__body pg-panel__body--source">
                <SandboxSourceEditor
                  value={xml}
                  onChange={setXml}
                  ariaLabel={copy.modes.source}
                />
              </div>
            </div>
          )}
        </div>

        <aside className="pg-rail">
          <div className="rail-card">
            <h2 className="rail-card__title">{copy.presetLabel}</h2>
            <p className="rail-card__body">{copy.presets[preset.id].description}</p>
          </div>

          {mode !== 'source' && (
            <div className="rail-card">
              <h2 className="rail-card__title">{copy.insertLabel}</h2>
              <div className="rail-actions">
                {INSERT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="chip"
                    onClick={() => {
                      nonceRef.current += 1;
                      setInsertRequest({ kind, nonce: nonceRef.current });
                    }}
                  >
                    {copy.insert[kind]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rail-card">
            <h2 className="rail-card__title">{copy.diagTitle}</h2>
            <ul className="rail-list">
              <li>
                <span className={diagnostics.wellFormed ? 'dot dot-ok' : 'dot dot-error'} />
                {diagnostics.wellFormed ? copy.wellFormed : copy.broken}
                {!diagnostics.wellFormed && diagnostics.error && (
                  <span className="rail-mono">
                    {' '}
                    {copy.lineCol
                      .replace('{line}', String(diagnostics.error.line))
                      .replace('{column}', String(diagnostics.error.column))}
                  </span>
                )}
              </li>
              {diagnostics.wellFormed && (
                <>
                  <li>
                    <span className={diagnostics.roundTripIdempotent ? 'dot dot-ok' : 'dot dot-warn'} />
                    {diagnostics.roundTripIdempotent ? copy.roundtripOk : copy.roundtripBroken}
                  </li>
                  <li className="rail-mono">
                    {diagnostics.elementCount} elements
                    {diagnostics.unknownTags.length > 0 && (
                      <> · unknown: {diagnostics.unknownTags.join(', ')}</>
                    )}
                  </li>
                </>
              )}
            </ul>
            {!diagnostics.wellFormed && diagnostics.error && (
              <p className="rail-card__error">{diagnostics.error.message}</p>
            )}
          </div>

          {keys.length > 0 && (
            <div className="rail-card">
              <h2 className="rail-card__title">{copy.keyspaceTitle}</h2>
              <ul className="rail-list">
                {keys.map((row) => (
                  <li key={row.key}>
                    <span className={row.status === 'resolved' ? 'dot dot-ok' : 'dot dot-warn'} />
                    <code>{row.key}</code>
                    <span className="rail-mono"> → {row.value}</span>
                  </li>
                ))}
              </ul>
              <p className="rail-card__hint">{copy.keyspaceHint}</p>
            </div>
          )}

          <div className="rail-card">
            <h2 className="rail-card__title">{copy.condTitle}</h2>
            {conditions.length === 0 ? (
              <p className="rail-card__hint">{copy.condEmpty}</p>
            ) : (
              <ul className="rail-list">
                {conditions.map((row) => (
                  <li key={row.label}>
                    <span
                      className={
                        row.status === 'exclude'
                          ? 'dot dot-error'
                          : row.status === 'flag'
                            ? 'dot dot-warn'
                            : 'dot dot-ok'
                      }
                    />
                    <code>{row.label}</code>
                    <span className="rail-mono">
                      {' '}
                      →{' '}
                      {row.status === 'exclude'
                        ? copy.condExcluded
                        : row.status === 'flag'
                          ? copy.condFlagged
                          : copy.condIncluded}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rail-card rail-card--dark">
            <h2 className="rail-card__title">{copy.fullWorkbenchTitle}</h2>
            <p className="rail-card__body">{copy.fullWorkbenchBody}</p>
            <a
              className="btn btn-paper btn-sm"
              href={`${SITE.base.replace(/\/$/, '')}${locale === 'zh' ? '/docs/getting-started' : '/en/docs/getting-started'}`}
            >
              {copy.fullWorkbenchCta}
            </a>
          </div>
        </aside>
      </div>

      {showDiff && (
        <section className="pg-diff" aria-label={copy.diffTitle}>
          <header className="pg-diff__head">
            <div>
              <h2>{copy.diffTitle}</h2>
              <p>{copy.diffHint}</p>
            </div>
            <span className="chip chip-blue">
              {changedLines === 0 ? copy.emptyDiff : `+${diff.added} / -${diff.removed}`}
            </span>
          </header>
          <ol className="diff-list">
            {compactDiff(diff, 2).map((line, index) => (
              <DiffRow
                key={`${index}-${line.type}-${line.beforeLine ?? line.afterLine ?? 0}`}
                line={line}
              />
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const sign = line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' ';
  return (
    <li className={`diff-line diff-line--${line.type}`}>
      <span className="diff-gutter">{line.beforeLine ?? ''}</span>
      <span className="diff-gutter">{line.afterLine ?? ''}</span>
      <span className="diff-sign">{sign}</span>
      <code>{line.text === '' ? '\u00a0' : line.text}</code>
    </li>
  );
}
