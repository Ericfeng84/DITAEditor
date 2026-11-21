import { useMemo, useState } from 'react';
import {
  computeRelativeDitaHref,
  getAttributesForElement,
  getElementSpec,
  getRawAttr,
  parseDitaMap,
  resolveDitaHref,
  type DitaAttributeGroup,
  type DitaAttributeSpec,
  type DitaMapTreeNode,
} from '@dita/core';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { MapBufferState } from './map-tree-utils';

export interface MapNodeInspectorProps {
  selected: { mapPath: string; elementPath: number[] | null } | null;
  mapBuffers: Record<string, MapBufferState>;
  availableFiles: string[];
  onUpdateAttr: (
    mapPath: string,
    elementPath: number[] | null,
    attrName: string,
    value: string | null,
  ) => void;
  onUpdateNavtitle: (mapPath: string, elementPath: number[], navtitle: string) => void;
  onUpdateRootTitle: (mapPath: string, title: string) => void;
  onOpenTargetFile: (filePath: string) => void;
  onJumpToSource: (mapPath: string, line?: number) => void;
  onDeleteNode: (mapPath: string, elementPath: number[]) => void;
}

const GROUP_LABELS: Record<DitaAttributeGroup, { title: string; subtitle: string }> = {
  element: { title: 'Map / 引用专属属性', subtitle: 'Element' },
  core: { title: '通用核心属性', subtitle: 'Universal' },
  profiling: { title: '条件过滤 (DITAVAL)', subtitle: 'Profiling' },
  reuse: { title: '内容复用 (Conref)', subtitle: 'Reuse' },
  presentation: { title: '排版展示', subtitle: 'Display' },
};

function findTreeNodeByPath(
  nodes: readonly DitaMapTreeNode[],
  targetPath: readonly number[],
): DitaMapTreeNode | null {
  for (const n of nodes) {
    if (
      n.elementPath.length === targetPath.length &&
      n.elementPath.every((v, i) => v === targetPath[i])
    ) {
      return n;
    }
    if (n.children) {
      const hit = findTreeNodeByPath(n.children, targetPath);
      if (hit) return hit;
    }
  }
  return null;
}

export function MapNodeInspector({
  selected,
  mapBuffers,
  availableFiles,
  onUpdateAttr,
  onUpdateNavtitle,
  onUpdateRootTitle,
  onOpenTargetFile,
  onJumpToSource,
  onDeleteNode,
}: MapNodeInspectorProps) {
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

  const parsedMap = useMemo(() => {
    if (!selected) return null;
    const buf = mapBuffers[selected.mapPath];
    if (!buf) return null;
    try {
      return parseDitaMap(buf.xml);
    } catch {
      return null;
    }
  }, [selected, mapBuffers]);

  if (!selected || !parsedMap) {
    return (
      <aside
        aria-label="Map 节点属性检查器"
        className="flex h-full flex-col border-l border-slate-200 bg-slate-50/70"
      >
        <div className="border-b border-slate-200 px-3 py-2.5">
          <h2 className="text-xs font-semibold text-slate-800">Map 属性检查器</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
          <Tag className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
          <p>在左侧 Map 树中选中任意节点以编辑 href、navtitle、keys 与条件属性。</p>
        </div>
      </aside>
    );
  }

  const isRoot = selected.elementPath === null;
  const node = isRoot ? null : findTreeNodeByPath(parsedMap.nodes, selected.elementPath!);
  if (!isRoot && !node) {
    return (
      <aside className="flex h-full flex-col border-l border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-400">
        所选节点已移动或移除，请重新点击左侧树节点。
      </aside>
    );
  }

  const tagName = isRoot ? parsedMap.rootTag : node!.tagName;
  const rawAttrs = isRoot ? parsedMap.rootAttrs : node!.rawAttrs;
  const spec = getElementSpec(tagName);
  const allAttrSpecs = getAttributesForElement(tagName);
  const knownNames = new Set(allAttrSpecs.map((a) => a.name));

  const grouped = new Map<DitaAttributeGroup, DitaAttributeSpec[]>();
  for (const attrSpec of allAttrSpecs) {
    const list = grouped.get(attrSpec.group) ?? [];
    list.push(attrSpec);
    grouped.set(attrSpec.group, list);
  }

  const currentHref = getRawAttr(rawAttrs, 'href') ?? '';
  const resolvedTarget = currentHref ? resolveDitaHref(selected.mapPath, currentHref) : null;
  const canOpenTarget = Boolean(
    resolvedTarget && !resolvedTarget.isExternal && !resolvedTarget.escapesRoot && resolvedTarget.targetPath,
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddCustomAttr = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customAttrName.trim();
    if (!name || !/^[A-Za-z_][\w:.-]*$/.test(name)) return;
    onUpdateAttr(selected.mapPath, selected.elementPath, name, customAttrValue);
    setCustomAttrName('');
    setCustomAttrValue('');
  };

  return (
    <aside
      aria-label="Map 节点属性检查器"
      className="flex h-full flex-col border-l border-slate-200 bg-white text-slate-800"
    >
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <code className="rounded bg-sky-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
              &lt;{tagName}&gt;
            </code>
            <span className="truncate font-mono text-[10px] text-slate-400">
              {selected.mapPath}
            </span>
          </div>
        </div>
        <p className="mt-1 truncate text-xs font-medium text-slate-700">
          {spec ? `${spec.labelZh} · ${spec.label}` : 'Map 结构节点'}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {canOpenTarget ? (
            <button
              type="button"
              onClick={() => onOpenTargetFile(resolvedTarget!.targetPath)}
              className="dita-mini-btn text-indigo-700"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              打开目标
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onJumpToSource(selected.mapPath, node?.line)}
            className="dita-mini-btn text-sky-700"
          >
            <Code2 className="h-3 w-3" aria-hidden="true" />
            定位源码
          </button>
          {!isRoot ? (
            <button
              type="button"
              onClick={() => onDeleteNode(selected.mapPath, selected.elementPath!)}
              className="dita-mini-btn ml-auto text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              移除
            </button>
          ) : null}
        </div>
      </div>

      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
        {/* Title / Navtitle quick editor */}
        <section className="p-3">
          {isRoot ? (
            <div>
              <label
                htmlFor="map-root-title-input"
                className="mb-1 block text-[11px] font-semibold text-slate-700"
              >
                {parsedMap.kind === 'bookmap' ? '书籍主标题 (<mainbooktitle>)' : 'Map 标题 (<title>)'}
              </label>
              <input
                id="map-root-title-input"
                type="text"
                value={parsedMap.title}
                onChange={(e) => onUpdateRootTitle(selected.mapPath, e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="map-node-navtitle-input"
                className="mb-1 block text-[11px] font-semibold text-slate-700"
              >
                目录导航标题 (navtitle)
              </label>
              <input
                id="map-node-navtitle-input"
                type="text"
                value={node?.navtitle ?? ''}
                placeholder="默认继承目标 Topic 的 <title>"
                onChange={(e) =>
                  onUpdateNavtitle(selected.mapPath, selected.elementPath!, e.target.value)
                }
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </section>

        {/* Raw Attributes in exact XML order */}
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
                <p className="text-[11px] text-slate-400">当前节点暂无属性</p>
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
                      onChange={(e) =>
                        onUpdateAttr(selected.mapPath, selected.elementPath, entry.name, e.target.value)
                      }
                      className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateAttr(selected.mapPath, selected.elementPath, entry.name, null)
                      }
                      aria-label={`移除属性 ${entry.name}`}
                      className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}

              <form onSubmit={handleAddCustomAttr} className="mt-2 flex items-center gap-1">
                <input
                  type="text"
                  value={customAttrName}
                  onChange={(e) => setCustomAttrName(e.target.value)}
                  placeholder="属性名"
                  aria-label="新属性名"
                  className="w-24 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={customAttrValue}
                  onChange={(e) => setCustomAttrValue(e.target.value)}
                  placeholder="属性值"
                  aria-label="新属性值"
                  className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="添加属性"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-white hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </form>
            </div>
          ) : null}
        </section>

        {/* Schema-guided groups */}
        {(['element', 'core', 'profiling', 'reuse'] as DitaAttributeGroup[]).map((groupKey) => {
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
                {filledCount > 0 ? (
                  <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                    {filledCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-normal text-slate-400">{meta.subtitle}</span>
                )}
              </button>

              {isOpen ? (
                <div className="mt-2.5 space-y-2.5">
                  {attrs.map((attr) => {
                    const currentVal = getRawAttr(rawAttrs, attr.name) ?? '';
                    const hasValue = getRawAttr(rawAttrs, attr.name) !== undefined;
                    const inputId = `map-attr-${tagName}-${attr.name}`;

                    return (
                      <div key={attr.name}>
                        <div className="mb-1 flex items-center justify-between">
                          <label
                            htmlFor={inputId}
                            className="flex items-center gap-1 text-[11px] font-medium text-slate-700"
                            title={attr.description}
                          >
                            <code className="font-mono text-slate-900">{attr.name}</code>
                          </label>
                          {hasValue ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateAttr(selected.mapPath, selected.elementPath, attr.name, null)
                              }
                              className="text-[10px] text-slate-400 hover:text-rose-600"
                            >
                              清除
                            </button>
                          ) : null}
                        </div>

                        {attr.values && attr.values.length > 0 ? (
                          <select
                            id={inputId}
                            value={currentVal}
                            onChange={(e) =>
                              onUpdateAttr(
                                selected.mapPath,
                                selected.elementPath,
                                attr.name,
                                e.target.value === '' ? null : e.target.value,
                              )
                            }
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
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
                          <div className="space-y-1">
                            <input
                              id={inputId}
                              type="text"
                              value={currentVal}
                              placeholder={attr.placeholder ?? attr.label}
                              onChange={(e) =>
                                onUpdateAttr(
                                  selected.mapPath,
                                  selected.elementPath,
                                  attr.name,
                                  e.target.value === '' ? null : e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
                            />
                            {attr.name === 'href' && availableFiles.length > 0 ? (
                              <select
                                aria-label="从工作区快速选择目标文件"
                                value=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const rel = computeRelativeDitaHref(
                                    selected.mapPath,
                                    e.target.value,
                                  );
                                  onUpdateAttr(
                                    selected.mapPath,
                                    selected.elementPath,
                                    'href',
                                    rel,
                                  );
                                }}
                                className="w-full rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10.5px] text-slate-600 focus:border-indigo-500 focus:outline-none"
                              >
                                <option value="">快速从工作区选择目标路径…</option>
                                {availableFiles
                                  .filter((f) => f !== selected.mapPath)
                                  .map((f) => (
                                    <option key={f} value={f}>
                                      {f}
                                    </option>
                                  ))}
                              </select>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}

        {/* Lossless Metadata Card */}
        <section className="bg-emerald-50/40 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Map 原生结构无损保真
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
            DOCTYPE：{parsedMap.preservedMetaSummary.hasDoctype ? '已保留' : '无'} · 注释：
            {parsedMap.preservedMetaSummary.commentCount} · PI：
            {parsedMap.preservedMetaSummary.piCount}
            {parsedMap.preservedMetaSummary.hasReltable ? ' · 含 <reltable> 关联表' : ''}
            {parsedMap.preservedMetaSummary.hasBookmeta ? ' · 含 <bookmeta>' : ''}
          </p>
        </section>
      </div>
    </aside>
  );
}
