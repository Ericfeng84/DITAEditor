import { useState } from 'react';
import type { SiteDictionary } from '../i18n/index.js';

interface Props {
  tabs: SiteDictionary['hero']['showcaseTabs'];
  images: Record<string, string>;
  label: string;
  hint: string;
}

export default function HeroShowcase({ tabs, images, label, hint }: Props) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const activeIndex = tabs.findIndex((tab) => tab.id === active?.id);

  return (
    <figure className="showcase">
      <div className="showcase__head">
        <span className="eyebrow">{label}</span>
        <span className="showcase__hint">{hint}</span>
      </div>

      <div className="showcase__tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active?.id}
            className={`showcase__tab ${tab.id === active?.id ? 'is-active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            <span className="showcase__tab-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="showcase__tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="showcase__frame">
        <div className="showcase__chrome" aria-hidden="true">
          <span />
          <span />
          <span />
          <span className="showcase__url">ditaeditor · {active?.label ?? ''}</span>
        </div>
        {active && (
          <img
            key={active.id}
            className="showcase__image"
            src={images[active.id] ?? ''}
            alt={active.alt}
            width={1400}
            height={875}
            loading={activeIndex === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
          />
        )}
      </div>

      <figcaption className="showcase__caption">{active?.caption ?? ''}</figcaption>
    </figure>
  );
}
