import { useMemo, useState } from 'react';
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Network,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import type { WorkspaceFileNode, WorkspaceMapSummary } from '../services/workspace-api';

export interface FileExplorerPanelProps {
  files: WorkspaceFileNode[];
  activeTabPath: string | null;
  activeRootMapPath: string | null;
  maps: WorkspaceMapSummary[];
  topicTitles: Record<string, string>;
  onOpenFile: (path: string) => void;
  onActivateMap: (path: string) => void;
  onSelectRootMap: (mapPath: string) => void;
  onNewTopic: () => void;
  onNewMap: () => void;
  onCreateFolder: (dirPath: string) => void;
  onRenameFile: (fromPath: string, toPath: string) => void;
  onDeleteFile: (path: string) => void;
}

function filterTreeNodes(nodes: WorkspaceFileNode[], query: string): WorkspaceFileNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const out: WorkspaceFileNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'directory') {
      const filteredChildren = node.children ? filterTreeNodes(node.children, q) : [];
      if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
        out.push({ ...node, children: filteredChildren });
      }
    } else if (
      node.name.toLowerCase().includes(q) ||
      node.path.toLowerCase().includes(q)
    ) {
      out.push(node);
    }
  }
  return out;
}

function FileIcon({ kind }: { kind: WorkspaceFileNode['kind'] }) {
  switch (kind) {
    case 'ditamap':
      return <Network className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />;
    case 'bookmap':
      return <BookMarked className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />;
    case 'topic':
      return <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden="true" />;
    case 'ditaval':
      return <Filter className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden="true" />;
    case 'image':
      return <ImageIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />;
    default:
      return <FileCode2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />;
  }
}

export function FileExplorerPanel({
  files,
  activeTabPath,
  activeRootMapPath,
  maps,
  topicTitles,
  onOpenFile,
  onActivateMap,
  onSelectRootMap,
  onNewTopic,
  onNewMap,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
}: FileExplorerPanelProps) {
  const [search, setSearch] = useState('');
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const visibleNodes = useMemo(() => filterTreeNodes(files, search), [files, search]);

  const toggleDir = (dirPath: string) => {
    setCollapsedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setNewFolderOpen(false);
  };

  const commitRename = (fromPath: string) => {
    const trimmed = renameValue.trim();
    setRenamingPath(null);
    if (!trimmed || trimmed === fromPath) return;
    onRenameFile(fromPath, trimmed);
  };

  const renderNode = (node: WorkspaceFileNode, depth: number) => {
    const padLeft = 8 + depth * 14;

    if (node.kind === 'directory') {
      const isExpanded = search.trim() ? true : !collapsedDirs[node.path];
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggleDir(node.path)}
            style={{ paddingLeft: `${padLeft}px` }}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && node.children ? (
            <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
          ) : null}
        </div>
      );
    }

    const isActive = activeTabPath === node.path;
    const isRootMap = activeRootMapPath === node.path;
    const isMap = node.kind === 'ditamap' || node.kind === 'bookmap';
    const titleHint = topicTitles[node.path];

    if (renamingPath === node.path) {
      return (
        <form
          key={node.path}
          onSubmit={(e) => {
            e.preventDefault();
            commitRename(node.path);
          }}
          style={{ paddingLeft: `${padLeft + 14}px` }}
          className="px-2 py-1"
        >
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => commitRename(node.path)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setRenamingPath(null);
            }}
            className="w-full rounded border border-indigo-400 bg-white px-1.5 py-0.5 font-mono text-[11px] focus:outline-none"
          />
        </form>
      );
    }

    return (
      <div
        key={node.path}
        style={{ paddingLeft: `${padLeft + 14}px` }}
        className={`group flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
          isActive
            ? 'bg-indigo-50 text-indigo-800 font-medium'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenFile(node.path)}
          title={titleHint ? `${node.path} — ${titleHint}` : node.path}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <FileIcon kind={node.kind} />
          <span className="truncate">{node.name}</span>
        </button>

        {isRootMap ? (
          <span className="shrink-0 rounded bg-sky-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-sky-700">
            ROOT
          </span>
        ) : isMap ? (
          <button
            type="button"
            onClick={() => onActivateMap(node.path)}
            title="设为当前激活 Root Map"
            className="hidden shrink-0 rounded border border-sky-200 bg-sky-50 px-1 py-0.5 text-[9px] font-medium text-sky-700 hover:bg-sky-100 group-hover:inline-block"
          >
            设为Root
          </button>
        ) : null}

        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={() => {
              setRenamingPath(node.path);
              setRenameValue(node.path);
            }}
            aria-label={`重命名 ${node.name}`}
            title="重命名 / 移动"
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteFile(node.path)}
            aria-label={`删除 ${node.name}`}
            title="删除文件"
            className="rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Workspace & Root Map Toolbar */}
      <div className="border-b border-slate-100 px-2.5 py-2">
        <div className="flex min-w-0 items-center justify-between gap-1">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            项目文件
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onNewTopic}
              title="新建 Topic (.dita)"
              aria-label="新建 Topic"
              className="dita-mini-btn shrink-0 p-1"
            >
              <FilePlus2 className="h-3 w-3 text-indigo-600" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onNewMap}
              title="新建 Map / Bookmap"
              aria-label="新建 Map 或 Bookmap"
              className="dita-mini-btn shrink-0 p-1"
            >
              <Network className="h-3 w-3 text-sky-600" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setNewFolderOpen((v) => !v)}
              title="新建文件夹"
              aria-label="新建文件夹"
              className="dita-mini-btn shrink-0 p-1"
            >
              <FolderPlus className="h-3 w-3 text-amber-600" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Active Root Map Selector */}
        <div className="mt-1 flex min-w-0 items-center gap-1">
          <Network className="h-3 w-3 shrink-0 text-sky-600" aria-hidden="true" />
          <label htmlFor="file-root-map-select" className="sr-only">
            切换激活 Root Map
          </label>
          <select
            id="file-root-map-select"
            value={activeRootMapPath ?? ''}
            onChange={(e) => {
              if (e.target.value) onSelectRootMap(e.target.value);
            }}
            disabled={maps.length === 0}
            className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            title="选择当前激活的 Root Map / Bookmap"
          >
            {maps.length === 0 ? (
              <option value="">无 Map 文件</option>
            ) : (
              maps.map((m) => (
                <option key={m.path} value={m.path}>
                  [{m.kind === 'bookmap' ? 'Book' : 'Map'}] {m.path} — {m.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Inline mkdir input */}
      {newFolderOpen ? (
        <form
          onSubmit={handleCreateFolderSubmit}
          className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5"
        >
          <input
            type="text"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="例如：concepts/v2"
            className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-indigo-500"
          >
            创建
          </button>
        </form>
      ) : null}

      {/* Search */}
      <div className="border-b border-slate-100 px-2.5 py-1.5">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2 h-3 w-3 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="过滤文件名或路径..."
            aria-label="过滤工作区文件"
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pr-2 pl-6 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {visibleNodes.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-400">无匹配的工作区文件</p>
        ) : (
          visibleNodes.map((n) => renderNode(n, 0))
        )}
      </div>
    </div>
  );
}
