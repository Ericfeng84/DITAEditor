import { useState } from 'react';
import {
  evaluateElementConditions,
  getAttributesForElement,
  getElementSpec,
  getRawAttr,
  makeConrefOverlayKey,
  type DitaAttributeGroup,
  type DitaAttributeSpec,
  type DitaProfilingAttrName,
  type DocumentSemanticOverlay,
  type ParsedDitaval,
  type XmlDeclaration,
  type XmlPrologItem,
} from '@dita/core';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  ExternalLink,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ProfilingAttrEditor } from '../../components/ProfilingAttrEditor';
import type { EditorSelectionSnapshot } from './selection-info';

export interface AttributesPanelProps {
  snapshot: EditorSelectionSnapshot | null;
  docMetadata: {
    xmlDeclaration: XmlDeclaration | null;
    prolog: XmlPrologItem[];
    epilog: XmlPrologItem[];
  } | null;
  semanticOverlay?: DocumentSemanticOverlay | null;
  activeDitaval?: ParsedDitaval | null;
  profilingCatalog?: Partial<Record<DitaProfilingAttrName, string[]>>;
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void;
  onOpenConrefDialog?: () => void;
  onUpdateAttr: (nodePos: number, attrName: string, value: string | null) => void;
  onSelectBreadcrumb: (pos: number) => void;
  onMoveNode: (nodePos: number, direction: 'up' | 'down') => void;
  onDeleteNode: (nodePos: number) => void;
}

const GROUP_LABELS: Record<DitaAttributeGroup, { title: string; subtitle: string }> = {
  element: { title: '元素专属属性', subtitle: 'Element' },
  core: { title: '通用核心属性', subtitle: 'Universal' },
  profiling: { title: '条件过滤 (DITAVAL)', subtitle: 'Profiling' },
  reuse: { title: '内容复用 (Conref)', subtitle: 'Reuse' },
  presentation: { title: '排版展示', subtitle: 'Display' },
};

export function AttributesPanel({
  snapshot,
  docMetadata,
  semanticOverlay = null,
  activeDitaval = null,
  profilingCatalog = {},
  onJumpToSource,
  onOpenConrefDialog,
  onUpdateAttr,
  onSelectBreadcrumb,
  onMoveNode,
  onDeleteNode,
}: AttributesPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    element: true,
    core: true,
    profiling: false,
    reuse: false,
    presentation: false,
    raw: true,
  });
  const [customAttrName, setCustomAttrName] = useState('');
  const [customAttrValue, setCustomAttrValue] = useState('');

  const activeItem = snapshot?.activeItem ?? null;

  if (!activeItem || !snapshot) {
    return (
      <aside
        aria-label="元素属性面板"
        className="flex h-full flex-col border-l border-slate-200 bg-slate-50/70"
      >
        <div className="border-b border-slate-200 px-3 py-2.5">
          <h2 className="text-xs font-semibold text-slate-800">属性检查器</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
          <Tag className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
          <p>在可视化视图中点击任意元素或底部面包屑节点以查看和编辑其 DITA 属性。</p>
        </div>
      </aside>
    );
  }

  const tagName = activeItem.tagName;
  const spec = getElementSpec(tagName);
  const rawAttrs = snapshot.rawAttrs;
  const allAttrSpecs = getAttributesForElement(tagName);
  const knownNames = new Set(allAttrSpecs.map((a) => a.name));

  const keyrefVal = getRawAttr(rawAttrs, 'keyref')?.trim();
  const resolvedKeyref = keyrefVal ? semanticOverlay?.keyrefs[keyrefVal] : undefined;

  const conkeyrefVal = getRawAttr(rawAttrs, 'conkeyref')?.trim();
  const conrefVal = getRawAttr(rawAttrs, 'conref')?.trim();
  const conrefendVal = getRawAttr(rawAttrs, 'conrefend')?.trim() || undefined;
  const activeConrefAttr = conkeyrefVal ? 'conkeyref' : conrefVal ? 'conref' : null;
  const activeConrefVal = conkeyrefVal ?? conrefVal ?? '';
  const resolvedConref =
    activeConrefAttr && activeConrefVal
      ? semanticOverlay?.conrefs[
          makeConrefOverlayKey(tagName, activeConrefAttr, activeConrefVal, conrefendVal)
        ]
      : undefined;

  const conditionEval = activeDitaval
    ? evaluateElementConditions(rawAttrs, activeDitaval)
    : null;

  // Group schema attributes cleanly
  const grouped = new Map<DitaAttributeGroup, DitaAttributeSpec[]>();
  for (const attrSpec of allAttrSpecs) {
    const list = grouped.get(attrSpec.group) ?? [];
    list.push(attrSpec);
    grouped.set(attrSpec.group, list);
  }

  const parentCrumb =
    snapshot.breadcrumbs.length >= 2
      ? snapshot.breadcrumbs[
          Math.max(
            0,
            snapshot.breadcrumbs.findIndex((b) => b.pos === activeItem.pos) - 1,
          )
        ]
      : null;
  const canSelectParent = Boolean(parentCrumb && parentCrumb.pos !== activeItem.pos);
  const isRootElement = activeItem.depth === 1;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddCustomAttr = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customAttrName.trim();
    if (!name || !/^[A-Za-z_][\w:.-]*$/.test(name)) return;
    onUpdateAttr(activeItem.pos, name, customAttrValue);
    setCustomAttrName('');
    setCustomAttrValue('');
  };

  const doctypeItem = docMetadata?.prolog.find((p) => p.type === 'doctype');

  return (
    <aside
      aria-label="DITA 元素属性检查器"
      className="flex h-full flex-col border-l border-slate-200 bg-white text-slate-800"
    >
      {/* Selected Element Header */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <code className="rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                &lt;{tagName}&gt;
              </code>
              {activeItem.isUnknown ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  未知/特化透传
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs font-medium text-slate-700">
              {spec ? `${spec.labelZh} · ${spec.label}` : '自定义 / 特化 DITA 元素'}
            </p>
            {spec?.description ? (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                {spec.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* Element Structure Actions */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!canSelectParent}
            onClick={() => parentCrumb && onSelectBreadcrumb(parentCrumb.pos)}
            className="dita-mini-btn disabled:opacity-40"
            title="选中父级容器元素"
          >
            <ArrowUpLeft className="h-3 w-3" aria-hidden="true" />
            选父级
          </button>
          <button
            type="button"
            disabled={isRootElement || activeItem.node.isInline}
            onClick={() => onMoveNode(activeItem.pos, 'up')}
            className="dita-mini-btn disabled:opacity-40"
            title="上移同级块"
          >
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
            上移
          </button>
          <button
            type="button"
            disabled={isRootElement || activeItem.node.isInline}
            onClick={() => onMoveNode(activeItem.pos, 'down')}
            className="dita-mini-btn disabled:opacity-40"
            title="下移同级块"
          >
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
            下移
          </button>
          <button
            type="button"
            disabled={isRootElement}
            onClick={() => onDeleteNode(activeItem.pos)}
            className="dita-mini-btn ml-auto text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            title="删除当前元素"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            删除
          </button>
        </div>
      </div>

      {/* Scrollable Inspector Sections */}
      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
        {/* Active Raw Attributes in Exact XML Order */}
        <section className="p-3">
          <button
            type="button"
            onClick={() => toggleGroup('raw')}
            className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
          >
            <span className="flex items-center gap-1">
              {expandedGroups.raw ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              )}
              已设置属性（原始 XML 顺序）
            </span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
              {rawAttrs.length}
            </span>
          </button>

          {expandedGroups.raw ? (
            <div className="mt-2 space-y-1.5">
              {rawAttrs.length === 0 ? (
                <p className="text-[11px] text-slate-400">当前元素暂无 XML 属性</p>
              ) : (
                rawAttrs.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center gap-1.5 rounded border border-slate-200/80 bg-slate-50 px-2 py-1"
                  >
                    <span
                      className={`shrink-0 font-mono text-[11px] font-medium ${
                        knownNames.has(entry.name) ? 'text-indigo-700' : 'text-amber-700'
                      }`}
                    >
                      {entry.name}
                    </span>
                    <span className="text-slate-400">=</span>
                    <input
                      type="text"
                      aria-label={`属性 ${entry.name}`}
                      value={entry.value}
                      onChange={(e) => onUpdateAttr(activeItem.pos, entry.name, e.target.value)}
                      className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateAttr(activeItem.pos, entry.name, null)}
                      aria-label={`移除属性 ${entry.name}`}
                      title="移除属性"
                      className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}

              {/* Add custom / specialized attribute */}
              <form onSubmit={handleAddCustomAttr} className="mt-2 flex items-center gap-1">
                <input
                  type="text"
                  value={customAttrName}
                  onChange={(e) => setCustomAttrName(e.target.value)}
                  placeholder="属性名"
                  aria-label="新属性名"
                  className="w-24 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={customAttrValue}
                  onChange={(e) => setCustomAttrValue(e.target.value)}
                  placeholder="属性值"
                  aria-label="新属性值"
                  className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="添加自定义属性"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-white hover:bg-slate-700"
                  title="添加自定义/特化属性"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </form>
            </div>
          ) : null}
        </section>

        {/* Schema-Guided Attribute Groups */}
        {(['element', 'core', 'profiling', 'reuse', 'presentation'] as DitaAttributeGroup[]).map(
          (groupKey) => {
            const attrs = grouped.get(groupKey);
            if (!attrs || attrs.length === 0) return null;
            const meta = GROUP_LABELS[groupKey];
            const isOpen = Boolean(expandedGroups[groupKey]);
            const filledCount = attrs.filter((a) => getRawAttr(rawAttrs, a.name) !== undefined).length;

            return (
              <section key={groupKey} className="p-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKey)}
                  className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-slate-700"
                >
                  <span className="flex items-center gap-1">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    )}
                    {meta.title}
                  </span>
                  {groupKey === 'profiling' && conditionEval ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        conditionEval.status === 'exclude'
                          ? 'bg-rose-100 text-rose-800'
                          : conditionEval.status === 'flag'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {conditionEval.status === 'exclude'
                        ? '已排除'
                        : conditionEval.status === 'flag'
                          ? '标记高亮'
                          : '包含'}
                    </span>
                  ) : filledCount > 0 ? (
                    <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                      {filledCount}
                    </span>
                  ) : (
                    <span className="text-[10px] font-normal text-slate-400">{meta.subtitle}</span>
                  )}
                </button>

                {isOpen ? (
                  <div className="mt-2.5 space-y-2.5">
                    {groupKey === 'element' && keyrefVal && resolvedKeyref ? (
                      <div
                        className={`rounded-md border p-2 text-[11px] ${
                          resolvedKeyref.status === 'resolved'
                            ? 'border-violet-200 bg-violet-50/70 text-violet-950'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            {resolvedKeyref.status === 'resolved'
                              ? `Key 解析：${resolvedKeyref.resolvedText ?? resolvedKeyref.targetFilePath ?? '有效'}`
                              : resolvedKeyref.errorMessage}
                          </span>
                          {resolvedKeyref.definition && onJumpToSource ? (
                            <button
                              type="button"
                              onClick={() =>
                                onJumpToSource(
                                  resolvedKeyref.definition!.sourceMapPath,
                                  resolvedKeyref.definition!.line,
                                )
                              }
                              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
                            >
                              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                              定义
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {groupKey === 'reuse' ? (
                      <div className="space-y-2">
                        {onOpenConrefDialog ? (
                          <button
                            type="button"
                            onClick={onOpenConrefDialog}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] font-medium text-teal-800 hover:bg-teal-100"
                          >
                            <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
                            从项目 ID 列表选取复用目标…
                          </button>
                        ) : null}
                        {resolvedConref ? (
                          <div
                            className={`rounded-md border p-2 text-[11px] ${
                              resolvedConref.status === 'resolved'
                                ? 'border-teal-200 bg-teal-50/60 text-teal-900'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">
                                {resolvedConref.status === 'resolved'
                                  ? `已解析：${resolvedConref.targetFilePath}`
                                  : resolvedConref.errorMessage}
                              </span>
                              {resolvedConref.targetFilePath && onJumpToSource ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onJumpToSource(
                                      resolvedConref.targetFilePath!,
                                      resolvedConref.targetLine,
                                      resolvedConref.targetElementId,
                                    )
                                  }
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
                                >
                                  <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                                  源定义
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {attrs.map((attr) => {
                      const currentVal = getRawAttr(rawAttrs, attr.name) ?? '';
                      const hasValue = getRawAttr(rawAttrs, attr.name) !== undefined;
                      const inputId = `dita-attr-${activeItem.pos}-${attr.name}`;

                      return (
                        <div key={attr.name}>
                          <div className="mb-1 flex items-center justify-between">
                            <label
                              htmlFor={inputId}
                              className="flex items-center gap-1 text-[11px] font-medium text-slate-700"
                              title={attr.description}
                            >
                              <code className="font-mono text-slate-900">{attr.name}</code>
                              {attr.required ? (
                                <span className="text-rose-500" aria-label="必填">
                                  *
                                </span>
                              ) : null}
                            </label>
                            {hasValue ? (
                              <button
                                type="button"
                                onClick={() => onUpdateAttr(activeItem.pos, attr.name, null)}
                                className="text-[10px] text-slate-400 hover:text-rose-600"
                              >
                                清除
                              </button>
                            ) : null}
                          </div>

                          {groupKey === 'profiling' ? (
                            <ProfilingAttrEditor
                              attrName={attr.name as DitaProfilingAttrName}
                              inputId={inputId}
                              value={currentVal}
                              suggestions={profilingCatalog[attr.name as DitaProfilingAttrName] ?? []}
                              placeholder={attr.placeholder ?? attr.label}
                              onChange={(nextVal) => onUpdateAttr(activeItem.pos, attr.name, nextVal)}
                            />
                          ) : attr.values && attr.values.length > 0 ? (
                            <select
                              id={inputId}
                              value={currentVal}
                              onChange={(e) =>
                                onUpdateAttr(
                                  activeItem.pos,
                                  attr.name,
                                  e.target.value === '' ? null : e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="">（未设置）</option>
                              {currentVal && !attr.values.includes(currentVal) ? (
                                <option value={currentVal}>{currentVal}</option>
                              ) : null}
                              {attr.values.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={inputId}
                              type="text"
                              value={currentVal}
                              placeholder={attr.placeholder ?? attr.label}
                              onChange={(e) =>
                                onUpdateAttr(
                                  activeItem.pos,
                                  attr.name,
                                  e.target.value === '' ? null : e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          },
        )}

        {/* Lossless XML Document Prolog Info (shown when inspecting topic root) */}
        {isRootElement && docMetadata ? (
          <section className="bg-emerald-50/40 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              无损 XML 文档元信息已锁定保真
            </div>
            <dl className="mt-2 space-y-1 font-mono text-[10px] text-slate-600">
              <div>
                <dt className="text-slate-400">XML 声明</dt>
                <dd className="truncate text-slate-800">
                  {docMetadata.xmlDeclaration?.raw ?? '（无）'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">DOCTYPE</dt>
                <dd className="break-all text-slate-800">
                  {doctypeItem && doctypeItem.type === 'doctype'
                    ? doctypeItem.info.raw ?? `<!DOCTYPE ${doctypeItem.info.name}>`
                    : '（无）'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">文档级注释 / PI</dt>
                <dd className="text-slate-800">
                  Prolog {docMetadata.prolog.filter((p) => p.type !== 'doctype').length} 项 · Epilog{' '}
                  {docMetadata.epilog.length} 项
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
