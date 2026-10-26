import { shouldIgnoreShortcut } from '../../services/shortcutRegistry';
import { useUIStore } from '../../store/useUIStore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardWidget, WidgetType, WorkspaceDashboard } from '../../types/dashboard';
import { STARTER_DASHBOARDS, getStarterDashboard } from '../../services/starterDashboards';
import { getWidgetDefinition } from '../../services/widgetRegistry';
import { exportDashboard, importDashboard, normalizeDashboard, normalizeDashboardLayout, reorderDashboardWidget } from '../../utils/dashboardModel';
import { GridLayoutAdapter } from './GridLayoutAdapter';
import { DashboardHeader } from './DashboardHeader';
import { WidgetCatalogModal } from './WidgetCatalogModal';
import { WidgetSettingsModal } from './WidgetSettingsModal';
import { useTaskContext } from '../../context/TaskContext';
import type { WorkspacePreferences } from '../../types/dashboard';
import { resolveActiveDashboard } from '../../utils/activeDashboard';
import { Monitor, Tablet, Smartphone, Plus, Undo2, Redo2, Save, X, LayoutGrid } from 'lucide-react';

interface DashboardEditorProps {
  dashboards: WorkspaceDashboard[];
  workspaceId?: string;
  activeDashboardId?: string;
  onActiveDashboardChange?: (id: string) => void;
  onUpdateDashboards: (dashboards: WorkspaceDashboard[], activeId?: string) => void;
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onPlanMyDay: () => void;
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string | null) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); return true; } catch { return false; } }

export const DashboardEditor: React.FC<DashboardEditorProps> = ({ dashboards, workspaceId = 'local', activeDashboardId, onActiveDashboardChange, onUpdateDashboards, onSelectTask, onStartFocus, onStartSprint, onPlanMyDay }) => {
  const { workspacePreferences = {}, settings, setWorkspacePreference } = useTaskContext();
  const workspace = (workspacePreferences.workspace || {}) as WorkspacePreferences;
  const saved = dashboards.length ? dashboards : STARTER_DASHBOARDS;
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const currentId = (activeDashboardId && saved.some(d => d.id === activeDashboardId))
    ? activeDashboardId
    : (selectedDashboardId && saved.some(d => d.id === selectedDashboardId))
      ? selectedDashboardId
      : activeDashboardId;
  const savedDashboard = resolveActiveDashboard(saved, currentId, workspace);
  const mobileKey = 'flowtask-dashboard-mobile:' + workspaceId + ':' + savedDashboard.id;
  const dashboard = useMemo(() => {
    const result = clone(savedDashboard);
    try { const raw = read(mobileKey); if (raw) result.layouts.sm = normalizeDashboardLayout(result.widgets, JSON.parse(raw), 'sm'); } catch {}
    return result;
  }, [savedDashboard, mobileKey]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingWorking, setEditingWorking] = useState<WorkspaceDashboard | null>(null);
  const working = isEditing && editingWorking ? editingWorking : dashboard;
  const [preview, setPreview] = useState<'lg' | 'md' | 'sm'>('lg');
  const [undo, setUndo] = useState<WorkspaceDashboard[]>([]), [redo, setRedo] = useState<WorkspaceDashboard[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false), [widgetId, setWidgetId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const baseRevision = useRef(dashboard.revision);
  const draftKey = 'flowtask-dashboard-draft:' + workspaceId + ':' + (isEditing ? working.id : savedDashboard.id);
  const [draftRev, setDraftRev] = useState(0);
  const hasDraft = !isEditing && (draftRev >= 0) && !!read(draftKey);
  const [deleted, setDeleted] = useState<WorkspaceDashboard | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && !write(draftKey, JSON.stringify({ dashboard: working, baseRevision: baseRevision.current }))) setMessage('Your layout draft could not be saved. Keep this tab open until you save.');
  }, [working, isEditing, draftKey]);
  const change = useCallback((transform: (value: WorkspaceDashboard) => WorkspaceDashboard) => {
    const next = transform(clone(working));
    if (JSON.stringify(next) === JSON.stringify(working)) return;
    setUndo(stack => [...stack.slice(-19), clone(working)]); setRedo([]); setEditingWorking(next);
  }, [working]);
  const performUndo = useCallback(() => { if (!undo.length) return; setEditingWorking(undo.at(-1)!); setUndo(undo.slice(0, -1)); setRedo([...redo, clone(working)]); }, [undo, redo, working]);
  const performRedo = useCallback(() => { if (!redo.length) return; setEditingWorking(redo.at(-1)!); setRedo(redo.slice(0, -1)); setUndo([...undo, clone(working)]); }, [undo, redo, working]);
  useEffect(() => {
    if (!isEditing) return;
    const listener = (e: KeyboardEvent) => {
      if (settings?.keyboardShortcutsEnabled === false || shouldIgnoreShortcut(e)) return;
      if (!(e.metaKey || e.ctrlKey) || (e.target instanceof Element && e.target.closest('input,textarea,[contenteditable="true"],[role="dialog"]'))) return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); if (e.shiftKey) performRedo(); else performUndo(); }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); e.stopImmediatePropagation(); performRedo(); }
    };
    document.addEventListener('keydown', listener, true); return () => document.removeEventListener('keydown', listener, true);
  }, [isEditing, performUndo, performRedo, settings?.keyboardShortcutsEnabled]);
  const start = () => { baseRevision.current = dashboard.revision; setEditingWorking(clone(dashboard)); setUndo([]); setRedo([]); setPreview('lg'); setIsEditing(true); setMessage(''); };
  const stop = () => { setIsEditing(false); setEditingWorking(null); setPreview('lg'); setWidgetId(null); setCatalogOpen(false); };
  const discard = () => { write(draftKey, null); setDraftRev(r => r + 1); };
  const select = (id: string) => { if (isEditing) stop(); setSelectedDashboardId(id); onActiveDashboardChange?.(id); };
  const resume = () => {
    try {
      const parsed = JSON.parse(read(draftKey) || '{}'), next = normalizeDashboard(parsed.dashboard);
      if (next.id !== dashboard.id) throw new Error('Wrong dashboard.');
      baseRevision.current = parsed.baseRevision ?? next.revision; setEditingWorking(next); setUndo([]); setRedo([]); setIsEditing(true);
    } catch { setMessage('This draft could not be opened. Your saved dashboard is safe; discard the draft to start again.'); }
  };
  const save = () => {
    try {
      let next = normalizeDashboard(working);
      const original = saved.find(d => d.id === working.id);
      const concurrent = !original || original.revision !== baseRevision.current;
      if (concurrent && saved.length >= 20) { setMessage('This desk changed elsewhere. Export your draft before replacing a dashboard; all 20 slots are in use.'); return; }
      if (concurrent) next = { ...next, id: crypto.randomUUID(), name: next.name.slice(0, 80) + ' (Recovered)', order: saved.length, revision: 0, createdAt: Date.now(), isDefault: false };
      next.updatedAt = Date.now();
      write('flowtask-dashboard-mobile:' + workspaceId + ':' + next.id, JSON.stringify(next.layouts.sm));
      onUpdateDashboards(concurrent ? [...saved, next] : saved.map(d => d.id === next.id ? next : d), next.id);
      discard(); stop(); setSelectedDashboardId(next.id); onActiveDashboardChange?.(next.id);
      setMessage(concurrent ? 'Your edits were saved as a recovered desk. The other version is also preserved.' : 'Workspace saved.');
    } catch (error) { setMessage((error as Error).message); }
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"], [data-overlay-open="true"]')) return;
      if (event.key === 'Escape' && isEditing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        discard();
        stop();
        return;
      }
      if (settings?.keyboardShortcutsEnabled === false || shouldIgnoreShortcut(event)) return;
      if (isEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopImmediatePropagation();
        save();
      } else if (!isEditing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'e' && !useUIStore.getState().focusedTaskId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        start();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  });
  const create = () => {
    if (saved.length >= 20) return;
    const next = { ...clone(getStarterDashboard('starter-minimal-desk')!), id: crypto.randomUUID(), name: 'My desk ' + (saved.length + 1), order: saved.length, isDefault: false, revision: 0, createdAt: Date.now(), updatedAt: Date.now() };
    onUpdateDashboards([...saved, next], next.id); select(next.id);
  };
  const duplicate = (id: string) => {
    if (saved.length >= 20) return;
    const target = saved.find(d => d.id === id); if (!target) return;
    const next = { ...clone(target), id: crypto.randomUUID(), name: target.name.slice(0, 85) + ' (Copy)', order: saved.length, isDefault: false, revision: 0, createdAt: Date.now(), updatedAt: Date.now() };
    onUpdateDashboards([...saved, next], next.id); select(next.id);
  };
  const remove = (id: string) => {
    if (saved.length <= 1) return;
    setDeleted(clone(saved.find(d => d.id === id)!));
    const next = saved.filter(d => d.id !== id), active = id === dashboard.id ? next[0].id : dashboard.id;
    onUpdateDashboards(next, active); select(active); setMessage('Dashboard removed. Your tasks and notes are safe.');
  };
  const exportCurrent = () => {
    const blob = new Blob([exportDashboard(isEditing ? working : dashboard)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'flowtask-desk.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (saved.length >= 20) throw new Error('Remove a dashboard before importing another.');
      if (file.size > 1_000_000) throw new Error('Dashboard files must be smaller than 1 MB.');
      const next = { ...importDashboard(await file.text()), id: crypto.randomUUID(), order: saved.length, isDefault: false, revision: 0, createdAt: Date.now(), updatedAt: Date.now() };
      onUpdateDashboards([...saved, next], next.id); select(next.id); setMessage('Dashboard imported. Connect project or filter sources in widget settings.');
    } catch (error) { setMessage((error as Error).message); }
  };
  const addWidget = (type: WidgetType) => {
    if (working.widgets.length >= 24) return;
    const def = getWidgetDefinition(type), widget: DashboardWidget = { id: crypto.randomUUID(), type, title: def.defaultTitle, config: clone(def.defaultConfig), minW: def.minSize.w, minH: def.minSize.h };
    change(d => {
      const widgets = [...d.widgets, widget], layouts = { ...d.layouts };
      for (const bp of ['lg', 'md', 'sm'] as const) {
        const cols = bp === 'lg' ? 12 : bp === 'md' ? 6 : 1, items = d.layouts[bp] || [];
        layouts[bp] = normalizeDashboardLayout(widgets, [...items, { i: widget.id, x: 0, y: items.reduce((n, i) => Math.max(n, i.y + i.h), 0), w: Math.min(cols, def.defaultSize.w), h: def.defaultSize.h }], bp);
      }
      return { ...d, widgets, layouts };
    });
  };
  const configWidget = working.widgets.find(w => w.id === widgetId) || null;
  const guided = false;
  return <div className="dashboard-workspace" data-layout-editing={isEditing || undefined} data-guided-desk={guided || undefined}>
    <DashboardHeader guided={guided} activeDashboard={isEditing ? working : dashboard} dashboards={saved} onSelectDashboard={select} onCreateDashboard={create}
      onRenameDashboard={(id, name) => onUpdateDashboards(saved.map(d => d.id === id ? { ...d, name: name.trim().slice(0, 100), updatedAt: Date.now() } : d))}
      onDuplicateDashboard={duplicate} onDeleteDashboard={remove}
      onReorderDashboard={(id, direction) => { const next = [...saved].sort((a,b) => a.order - b.order), i = next.findIndex(d => d.id === id), j = i + direction; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; onUpdateDashboards(next.map((d, order) => ({ ...d, order }))); }}
      onResetToStarter={id => { const starter = getStarterDashboard(id); if (!starter) return; if (!isEditing) start(); change(() => ({ ...clone(starter), id: dashboard.id, name: dashboard.name, coverImage: dashboard.coverImage, coverFocalPoint: dashboard.coverFocalPoint, createdAt: dashboard.createdAt, revision: dashboard.revision, order: dashboard.order })); setIsEditing(true); }}
      isEditing={isEditing} onToggleEdit={start} onPlanMyDay={onPlanMyDay} hasDraft={hasDraft} onResumeDraft={resume} onDiscardDraft={discard}
      onCoverChange={(coverImage, coverFocalPoint) => {
        onUpdateDashboards(saved.map(d => d.id === dashboard.id ? { ...d, coverImage: coverImage || 'none', coverFocalPoint: coverImage && coverImage !== 'none' ? coverFocalPoint : undefined, updatedAt: Date.now() } : d));
        setWorkspacePreference?.('workspace', { ...workspace, showCovers: true, presentation: { ...workspace.presentation, version: 1, plainBackground: false } });
      }}
      onExport={exportCurrent} onImport={() => fileRef.current?.click()} />
    <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Import dashboard file" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} />
    {message && <div className="desk-notice" role="status"><span>{message}</span>{deleted && <button onClick={() => { const recovered = deleted!; onUpdateDashboards([...saved, recovered], recovered.id); setDeleted(null); select(recovered.id); setMessage('Dashboard restored.'); }}>Undo removal</button>}<button aria-label="Dismiss workspace notice" onClick={() => setMessage('')}><X size={16}/></button></div>}
    {isEditing && <div className="desk-editor-toolbar" aria-label="Workspace layout tools">
      <div className="desk-toolbar-group"><button className="desk-button primary" disabled={working.widgets.length >= 24} onClick={() => setCatalogOpen(true)}><Plus size={16}/>Add Widget</button><button className="desk-icon-button" aria-label="Undo layout change" disabled={!undo.length} onClick={performUndo}><Undo2 size={17}/></button><button className="desk-icon-button" aria-label="Redo layout change" disabled={!redo.length} onClick={performRedo}><Redo2 size={17}/></button></div>
      <div className="desk-device-preview" aria-label="Layout preview">{([['lg', Monitor, 'Desktop'], ['md', Tablet, 'Tablet'], ['sm', Smartphone, 'Mobile']] as const).map(([bp, Icon, label]) => <button key={bp} aria-label={label + ' preview'} aria-pressed={preview === bp} onClick={() => setPreview(bp)}><Icon size={16}/><span>{label}</span></button>)}</div>
      <div className="desk-toolbar-group"><button className="desk-button" onClick={() => { discard(); stop(); }}><X size={16}/>Cancel</button><button className="desk-button primary" onClick={save}><Save size={16}/>Save Layout</button></div>
    </div>}
    {isEditing && <p className="desk-editor-help">Make room for your way of working. Drag a handle, or use each widget’s move and size controls.</p>}
    {!(isEditing ? working : dashboard).widgets.length && <div className="desk-empty-canvas"><LayoutGrid size={32}/><h2>A little room to make it yours.</h2><p>Add your priorities, an agenda, a quiet scene, or a place to think.</p><button className="desk-button primary" onClick={() => { if (!isEditing) start(); setCatalogOpen(true); }}>Add your first widget</button></div>}
    <GridLayoutAdapter dashboard={isEditing ? working : dashboard} isEditing={isEditing} previewBreakpoint={isEditing ? preview : 'lg'}
      onLayoutChange={layouts => change(d => ({ ...d, layouts }))} onSelectTask={onSelectTask} onStartFocus={onStartFocus} onStartSprint={onStartSprint}
      onConfigureWidget={setWidgetId} onRemoveWidget={id => change(d => ({ ...d, widgets: d.widgets.filter(w => w.id !== id), layouts: { lg: d.layouts.lg.filter(i => i.i !== id), md: d.layouts.md?.filter(i => i.i !== id), sm: d.layouts.sm?.filter(i => i.i !== id) } }))}
      onMoveWidgetEarlier={id => change(d => reorderDashboardWidget(d, id, -1))} onMoveWidgetLater={id => change(d => reorderDashboardWidget(d, id, 1))}
      onResizeWidgetPreset={(id, w, h) => change(d => { const width = document.querySelector('[data-dashboard-grid]')?.clientWidth || 1200; const bp = preview === 'lg' ? width < 640 ? 'sm' : width < 960 ? 'md' : 'lg' : preview; return { ...d, layouts: { ...d.layouts, [bp]: normalizeDashboardLayout(d.widgets, (d.layouts[bp] || []).map(i => i.i === id ? { ...i, w, h } : i), bp) } }; })} />
    <WidgetCatalogModal isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} onAddWidget={addWidget} currentWidgetCount={working.widgets.length} existingWidgetTypes={working.widgets.map(w => w.type)}/>
    <WidgetSettingsModal isOpen={!!configWidget} widget={configWidget} onClose={() => setWidgetId(null)} onSave={(id, title, config) => change(d => ({ ...d, widgets: d.widgets.map(w => w.id === id ? { ...w, title, config } : w) }))}/>
  </div>;
};
