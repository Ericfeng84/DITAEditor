import { useState } from 'react';
import {
  formatProfilingAttrValue,
  parseProfilingAttrValue,
  type DitaProfilingAttrName,
} from '@dita/core';
import { Plus, X } from 'lucide-react';

export interface ProfilingAttrEditorProps {
  attrName: DitaProfilingAttrName;
  inputId: string;
  value: string;
  suggestions: readonly string[];
  placeholder?: string;
  onChange: (nextValue: string | null) => void;
}

const ATTR_BADGE_COLORS: Record<DitaProfilingAttrName, string> = {
  audience: 'bg-sky-50 text-sky-800 border-sky-200',
  platform: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  product: 'bg-violet-50 text-violet-800 border-violet-200',
  otherprops: 'bg-amber-50 text-amber-800 border-amber-200',
  props: 'bg-slate-100 text-slate-700 border-slate-300',
  rev: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

export function ProfilingAttrEditor({
  attrName,
  inputId,
  value,
  suggestions,
  placeholder,
  onChange,
}: ProfilingAttrEditorProps) {
  const [draft, setDraft] = useState('');
  const tokens = parseProfilingAttrValue(value);
  const badgeStyle = ATTR_BADGE_COLORS[attrName] ?? ATTR_BADGE_COLORS.props;

  const commitToken = (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;
    const next = formatProfilingAttrValue([...tokens, trimmed]);
    onChange(next);
    setDraft('');
  };

  const removeToken = (target: string) => {
    const next = formatProfilingAttrValue(tokens.filter((t) => t !== target));
    onChange(next);
  };

  const toggleSuggestion = (sug: string) => {
    if (tokens.includes(sug)) {
      removeToken(sug);
    } else {
      commitToken(sug);
    }
  };

  return (
    <div className="space-y-1.5">
      {tokens.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tokens.map((token) => (
            <span
              key={token}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${badgeStyle}`}
            >
              <span>{token}</span>
              <button
                type="button"
                onClick={() => removeToken(token)}
                aria-label={`移除 ${attrName} 值 ${token}`}
                className="rounded hover:bg-black/10"
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (draft.trim()) {
                e.preventDefault();
                commitToken(draft);
              }
            }
          }}
          placeholder={placeholder ?? `输入 ${attrName} 值后按 Enter…`}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => commitToken(draft)}
          disabled={!draft.trim()}
          aria-label={`添加 ${attrName} 条件值`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-slate-400">已有值:</span>
          {suggestions.map((sug) => {
            const active = tokens.includes(sug);
            return (
              <button
                key={sug}
                type="button"
                onClick={() => toggleSuggestion(sug)}
                className={`rounded px-1.5 py-0.2 font-mono text-[10px] transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sug}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
