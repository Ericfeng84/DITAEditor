import { useEffect, useRef, useState } from 'react';
import type { SiteDictionary } from '../i18n/index.js';
import { QUICK_START_TABS } from '../data/features.js';

interface Props {
  dict: SiteDictionary;
  docsHref: string;
  githubUrl: string;
}

export default function QuickStartTabs({ dict, docsHref, githubUrl }: Props) {
  const copy = dict.quickStart;
  const [active, setActive] = useState(QUICK_START_TABS[0]?.id ?? 'docker');
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | null>(null);
  const tab = QUICK_START_TABS.find((item) => item.id === active) ?? QUICK_START_TABS[0];

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function copyCode() {
    if (!tab) return;
    try {
      await navigator.clipboard.writeText(tab.code);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus('idle'), 2000);
  }

  return (
    <div className="quickstart">
      <div className="tab-list" role="tablist" aria-label={copy.title}>
        {QUICK_START_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            className={`tab-btn ${item.id === active ? 'is-active' : ''}`}
            onClick={() => setActive(item.id)}
          >
            {copy.tabs[item.labelKey]}
          </button>
        ))}
      </div>

      <div className="quickstart__panel">
        <div className="quickstart__bar">
          <span className="quickstart__path">{tab?.id === 'docker' ? 'terminal' : tab?.id === 'pnpm' ? 'workspace' : '.env'}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={copyCode}
            aria-live="polite"
          >
            {status === 'copied' ? copy.copied : copy.copy}
          </button>
        </div>
        <pre className="quickstart__code">
          <code>{tab?.code ?? ''}</code>
        </pre>
        {tab?.id === 'docker' && <p className="quickstart__note">{copy.dockerNote}</p>}
      </div>

      <div className="quickstart__actions">
        <a
          className="btn btn-blue"
          href={docsHref}
        >
          {copy.docsCta}
        </a>
        <a
          className="btn btn-ghost"
          href={githubUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {copy.githubCta}
        </a>
      </div>
    </div>
  );
}
