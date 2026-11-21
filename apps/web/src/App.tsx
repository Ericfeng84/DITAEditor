import { useCallback, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { RawAttrs, XmlDeclaration, XmlPrologItem } from '@dita/core';
import { NewTopicDialog } from './components/NewTopicDialog';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { XrefImageDialog } from './components/XrefImageDialog';
import { syncSourceToVisual, syncVisualToSource } from './editor/bridge/xml-bridge';
import { SourceEditor } from './editor/source/SourceEditor';
import { AttributesPanel } from './editor/visual/AttributesPanel';
import { BreadcrumbBar } from './editor/visual/BreadcrumbBar';
import { EditorToolbar } from './editor/visual/EditorToolbar';
import type { BreadcrumbItem, EditorSelectionSnapshot } from './editor/visual/selection-info';
import { VisualEditor, type VisualEditorHandle } from './editor/visual/VisualEditor';
import {
  getActiveDocDiffStats,
  selectActiveDocument,
  useEditorStore,
  type EditorViewMode,
} from './store/editor-store';

export function App() {
  const documents = useEditorStore((s) => s.documents);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const mode = useEditorStore((s) => s.mode);
  const xmlError = useEditorStore((s) => s.xmlError);
  const switchBlockedReason = useEditorStore((s) => s.switchBlockedReason);
  const tagDisplayMode = useEditorStore((s) => s.tagDisplayMode);
  const inspectorOpen = useEditorStore((s) => s.inspectorOpen);
  const statusMessage = useEditorStore((s) => s.statusMessage);
  const visualReloadToken = useEditorStore((s) => s.visualReloadToken);
  const pendingSourceOffset = useEditorStore((s) => s.pendingSourceOffset);
  const pendingVisualPmPos = useEditorStore((s) => s.pendingVisualPmPos);

  const selectDocument = useEditorStore((s) => s.selectDocument);
  const createNewDocument = useEditorStore((s) => s.createNewDocument);
  const importLocalDocument = useEditorStore((s) => s.importLocalDocument);
  const resetCurrentToBaseline = useEditorStore((s) => s.resetCurrentToBaseline);
  const markBaselineSaved = useEditorStore((s) => s.markBaselineSaved);
  const setMode = useEditorStore((s) => s.setMode);
  const updateXmlFromVisual = useEditorStore((s) => s.updateXmlFromVisual);
  const updateXmlFromSource = useEditorStore((s) => s.updateXmlFromSource);
  const setTagDisplayMode = useEditorStore((s) => s.setTagDisplayMode);
  const setInspectorOpen = useEditorStore((s) => s.setInspectorOpen);
  const announce = useEditorStore((s) => s.announce);
  const clearPendingSourceOffset = useEditorStore((s) => s.clearPendingSourceOffset);
  const clearPendingVisualPmPos = useEditorStore((s) => s.clearPendingVisualPmPos);
  const requestSourceJump = useEditorStore((s) => s.requestSourceJump);
  const requestVisualJump = useEditorStore((s) => s.requestVisualJump);

  const activeDoc = useMemo(
    () => selectActiveDocument({ documents, activeDocId } as Parameters<typeof selectActiveDocument>[0]),
    [documents, activeDocId],
  );
  const diffStats = useMemo(() => getActiveDocDiffStats(activeDoc), [activeDoc]);

  const visualRef = useRef<VisualEditorHandle | null>(null);
  const sourceCursorOffsetRef = useRef<number>(0);

  const [snapshot, setSnapshot] = useState<EditorSelectionSnapshot | null>(null);
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });
  const [docMeta, setDocMeta] = useState<{
    xmlDeclaration: XmlDeclaration | null;
    prolog: XmlPrologItem[];
    epilog: XmlPrologItem[];
  } | null>(null);

  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [refDialogMode, setRefDialogMode] = useState<'xref' | 'image' | null>(null);

  const handleSnapshotChange = useCallback(
    (
      nextSnap: EditorSelectionSnapshot,
      nextHistory: { canUndo: boolean; canRedo: boolean },
      nextMeta: {
        xmlDeclaration: XmlDeclaration | null;
        prolog: XmlPrologItem[];
        epilog: XmlPrologItem[];
      },
    ) => {
      setSnapshot(nextSnap);
      setHistoryFlags(nextHistory);
      setDocMeta(nextMeta);
    },
    [],
  );

  const handleChangeMode = useCallback(
    (nextMode: EditorViewMode) => {
      if (nextMode === mode) return;

      // Visual -> Source / Split: sync exact element offset into CodeMirror
      if (mode === 'visual' && (nextMode === 'source' || nextMode === 'split')) {
        const pmState = visualRef.current?.getCurrentPmState();
        if (pmState) {
          const synced = syncVisualToSource(pmState.doc, pmState.selection.from);
          updateXmlFromVisual(synced.xml);
          if (synced.targetOffset !== null) {
            requestSourceJump(synced.targetOffset);
          }
        }
        setMode(nextMode);
        return;
      }

      // Source -> Visual / Split: guard well-formedness & map CodeMirror offset back to ProseMirror pos
      if (mode === 'source' && (nextMode === 'visual' || nextMode === 'split')) {
        const res = syncSourceToVisual(activeDoc.xml, sourceCursorOffsetRef.current);
        if (!res.ok) {
          // Let store record exact blocked state and keep user in Source mode
          setMode(nextMode);
          return;
        }
        const switched = setMode(nextMode);
        if (switched && res.targetPmPos !== null) {
          requestVisualJump(res.targetPmPos);
        }
        return;
      }

      setMode(nextMode);
    },
    [
      mode,
      activeDoc.xml,
      setMode,
      updateXmlFromVisual,
      requestSourceJump,
      requestVisualJump,
    ],
  );

  const handleExportFile = useCallback(() => {
    const blob = new Blob([activeDoc.xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.fileName.endsWith('.dita') || activeDoc.fileName.endsWith('.xml')
      ? activeDoc.fileName
      : `${activeDoc.fileName}.dita`;
    a.click();
    URL.revokeObjectURL(url);
    announce(`已导出 ${a.download}`);
  }, [activeDoc, announce]);

  const handleConfirmXref = useCallback((attrs: RawAttrs, linkText: string) => {
    visualRef.current?.toggleInline('xref', attrs, linkText || undefined);
  }, []);

  const handleConfirmImage = useCallback((attrs: RawAttrs, placement: 'inline' | 'break') => {
    if (placement === 'inline') {
      visualRef.current?.toggleInline('image', attrs);
    } else {
      visualRef.current?.insertBlock('image', undefined, attrs);
    }
  }, []);

  const handleSelectBreadcrumb = useCallback((crumb: BreadcrumbItem) => {
    visualRef.current?.selectNode(crumb.pos, true);
  }, []);

  const showVisual = mode === 'visual' || mode === 'split';
  const showSource = mode === 'source' || mode === 'split';
  const showRightInspector = inspectorOpen && showVisual;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <WorkbenchHeader
        documents={documents}
        activeDoc={activeDoc}
        mode={mode}
        xmlError={xmlError}
        inspectorOpen={inspectorOpen}
        isDirty={!diffStats.isIdentical}
        onSelectDoc={selectDocument}
        onOpenNewTopic={() => setNewTopicOpen(true)}
        onImportFile={importLocalDocument}
        onExportFile={handleExportFile}
        onResetBaseline={resetCurrentToBaseline}
        onSaveSnapshot={markBaselineSaved}
        onChangeMode={handleChangeMode}
        onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
      />

      {/* Contextual Formatting & Element Insert Toolbar (shown in Visual & Split modes) */}
      {showVisual ? (
        <EditorToolbar
          snapshot={snapshot}
          canUndo={historyFlags.canUndo}
          canRedo={historyFlags.canRedo}
          canInsertBlock={(tag) => visualRef.current?.canInsertBlock(tag) ?? false}
          canInsertInline={(tag) => visualRef.current?.canInsertInline(tag) ?? false}
          onUndo={() => visualRef.current?.undo()}
          onRedo={() => visualRef.current?.redo()}
          onOpenInsertMenu={(el) => visualRef.current?.openInsertMenuAtElement(el)}
          onToggleInline={(tag) => visualRef.current?.toggleInline(tag)}
          onInsertBlock={(tag) => visualRef.current?.insertBlock(tag)}
          onOpenXrefDialog={() => setRefDialogMode('xref')}
          onOpenImageDialog={() => setRefDialogMode('image')}
          onTableAction={(action) => visualRef.current?.runTableAction(action)}
        />
      ) : null}

      {/* Accessible live region outside the toolbar for screen reader feedback */}
      <p role="status" className="sr-only">
        {statusMessage}
      </p>

      {/* Main Resizable Split Workbench Area */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <Group
          key={`${mode}-${showRightInspector ? 'insp' : 'noinsp'}`}
          orientation="horizontal"
          className="h-full w-full"
        >
          {showVisual ? (
            <Panel
              id="visual-pane"
              defaultSize={
                mode === 'split'
                  ? showRightInspector
                    ? '42%'
                    : '52%'
                  : showRightInspector
                    ? '74%'
                    : '100%'
              }
              minSize="25%"
            >
              <VisualEditor
                ref={visualRef}
                xml={activeDoc.xml}
                reloadToken={visualReloadToken}
                tagDisplayMode={tagDisplayMode}
                onChangeTagDisplayMode={setTagDisplayMode}
                pendingJumpPos={pendingVisualPmPos}
                onJumpHandled={clearPendingVisualPmPos}
                onXmlChange={updateXmlFromVisual}
                onSnapshotChange={handleSnapshotChange}
                onOpenXrefDialog={() => setRefDialogMode('xref')}
                onAnnounce={announce}
              />
            </Panel>
          ) : null}

          {showVisual && showSource ? (
            <Separator className="dita-resize-handle" aria-label="调整可视化与源码分栏宽度" />
          ) : null}

          {showSource ? (
            <Panel
              id="source-pane"
              defaultSize={
                mode === 'split'
                  ? showRightInspector
                    ? '36%'
                    : '48%'
                  : '100%'
              }
              minSize="24%"
            >
              <SourceEditor
                xml={activeDoc.xml}
                xmlError={xmlError}
                switchBlockedReason={switchBlockedReason}
                pendingJumpOffset={pendingSourceOffset}
                onJumpHandled={clearPendingSourceOffset}
                onChange={updateXmlFromSource}
                onCursorOffsetChange={(offset) => {
                  sourceCursorOffsetRef.current = offset;
                }}
                onAnnounce={announce}
              />
            </Panel>
          ) : null}

          {showRightInspector ? (
            <>
              <Separator className="dita-resize-handle" aria-label="调整属性检查器宽度" />
              <Panel id="inspector-pane" defaultSize="24%" minSize="18%" maxSize="40%">
                <AttributesPanel
                  snapshot={snapshot}
                  docMetadata={docMeta}
                  onUpdateAttr={(pos, name, val) =>
                    visualRef.current?.updateAttr(pos, name, val)
                  }
                  onSelectBreadcrumb={(pos) => visualRef.current?.selectNode(pos, true)}
                  onMoveNode={(pos, dir) => visualRef.current?.moveNode(pos, dir)}
                  onDeleteNode={(pos) => visualRef.current?.deleteNode(pos)}
                />
              </Panel>
            </>
          ) : null}
        </Group>
      </main>

      {/* Bottom Clickable Element Breadcrumb & Diff Status Bar */}
      <BreadcrumbBar
        breadcrumbs={snapshot?.breadcrumbs ?? []}
        activePos={snapshot?.activeItem?.pos ?? null}
        onSelectCrumb={handleSelectBreadcrumb}
        diffStats={diffStats}
        mode={mode}
      />

      {/* Native Modal Dialogs */}
      <NewTopicDialog
        open={newTopicOpen}
        onClose={() => setNewTopicOpen(false)}
        onCreate={createNewDocument}
      />

      <XrefImageDialog
        mode={refDialogMode}
        onClose={() => setRefDialogMode(null)}
        onConfirmXref={handleConfirmXref}
        onConfirmImage={handleConfirmImage}
      />
    </div>
  );
}
