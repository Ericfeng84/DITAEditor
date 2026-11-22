import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SiteDictionary } from '../i18n/index.js';
import { MINI_DEMO_XML } from '../data/playground-presets.js';
import { compactDiff, computeLineDiff, isByteIdentical } from '../lib/diff.js';

type OutputTab = 'xml' | 'diff';
type SampleKey = 'body' | 'note' | 'command';

interface Props {
  dict: SiteDictionary;
  playgroundHref: string;
}

const SAMPLE_TARGETS: Record<SampleKey, string> = {
  body: '停止写入并创建快照',
  note: '快照文件默认保留 14 天。',
  command: '校验快照完整性',
};

export default function MiniRoundTripDemo({ dict, playgroundHref }: Props) {
  const copy = dict.miniDemo;
  const [xml, setXml] = useState(MINI_DEMO_XML);
  const [tab, setTab] = useState<OutputTab>('diff');
  const [serialized, setSerialized] = useState(MINI_DEMO_XML);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sample, setSample] = useState<SampleKey>('body');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const roundTripRef = useRef<((input: string) => string) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('@dita/core').then((core) => {
      if (cancelled) return;
      roundTripRef.current = (input: string) => core.roundTripXmlThroughPm(input).xml;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        const next = roundTripRef.current?.(xml) ?? xml;
        setSerialized(next);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'XML error');
      }
    }, 140);
    return () => window.clearTimeout(timer);
  }, [xml, ready]);

  const diff = useMemo(() => computeLineDiff(MINI_DEMO_XML, serialized), [serialized]);
  const diffRows = useMemo(() => compactDiff(diff, 1), [diff]);
  const changed = diff.added + diff.removed;
  const identical = isByteIdentical(MINI_DEMO_XML, serialized) && !error;

  const selectSample = useCallback((key: SampleKey) => {
    setSample(key);
    const node = textareaRef.current;
    if (!node) return;
    const target = SAMPLE_TARGETS[key];
    const start = node.value.indexOf(target);
    if (start < 0) return;
    node.focus();
    node.setSelectionRange(start, start + target.length);
  }, []);

  return (
    <div className="mini-demo">
      <div className="mini-demo__panes">
        <div className="mini-demo__pane">
          <div className="mini-demo__head">
            <span className="mini-demo__label">{copy.editorLabel}</span>
            <div className="mini-demo__samples">
              {(['body', 'note', 'command'] as SampleKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`chip ${sample === key ? 'chip-blue' : ''}`}
                  onClick={() => selectSample(key)}
                >
                  {copy.presets[key]}
                </button>
              ))}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="mini-demo__textarea"
            value={xml}
            spellCheck={false}
            aria-label={copy.editorLabel}
            onChange={(event) => setXml(event.target.value)}
          />
          <div className="mini-demo__foot">
            <span>{copy.hint}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setXml(MINI_DEMO_XML);
                setSample('body');
              }}
              disabled={xml === MINI_DEMO_XML}
            >
              {copy.reset}
            </button>
          </div>
        </div>

        <div className="mini-demo__pane mini-demo__pane--output">
          <div className="mini-demo__head">
            <div className="mini-demo__tabs" role="tablist" aria-label={copy.outputXml}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'xml'}
                className={tab === 'xml' ? 'is-active' : ''}
                onClick={() => setTab('xml')}
              >
                {copy.outputXml}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'diff'}
                className={tab === 'diff' ? 'is-active' : ''}
                onClick={() => setTab('diff')}
              >
                {copy.outputDiff}
              </button>
            </div>
            <span className={error ? 'status-dot is-error' : 'status-dot is-ok'}>
              {error ? copy.badgePrefix + ' ✕' : copy.badgePrefix + ' ✓'}
            </span>
          </div>

          {error ? (
            <pre className="mini-demo__error">{error}</pre>
          ) : tab === 'xml' ? (
            <pre className="mini-demo__output" aria-label={copy.outputXml}>
              <code>{serialized}</code>
            </pre>
          ) : diffRows.length === 0 ? (
            <pre className="mini-demo__output" aria-label={copy.outputXml}>
              <code>{serialized}</code>
            </pre>
          ) : (
            <ol className="diff-list diff-list--mini">
              {diffRows.map((line, index) => (
                <li
                  key={`${index}-${line.type}`}
                  className={`diff-line diff-line--${line.type}`}
                >
                  <span className="diff-gutter">{line.beforeLine ?? ''}</span>
                  <span className="diff-gutter">{line.afterLine ?? ''}</span>
                  <span className="diff-sign">
                    {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                  </span>
                  <code>{line.text === '' ? '\u00a0' : line.text}</code>
                </li>
              ))}
            </ol>
          )}

          <div className="mini-demo__status">
            <span>{!ready ? copy.loading : identical ? copy.unchanged : copy.changed.replace('{count}', String(changed))}</span>
          </div>
        </div>
      </div>

      <div className="mini-demo__badges">
        {copy.preserve.map((item) => (
          <span
            key={item}
            className="chip chip-green"
          >
            {item}
          </span>
        ))}
        <a
          className="mini-demo__link"
          href={playgroundHref}
        >
          {copy.openFull}
        </a>
      </div>
    </div>
  );
}
