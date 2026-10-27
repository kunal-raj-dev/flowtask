import React, { useMemo, useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { useTaskAvailabilityClock } from '../../hooks/useTaskAvailabilityClock';
import { isTodayTask, isInboxTask } from '../../utils/taskSelectors';
import { filterTasksByPredicate } from '../../utils/smartViewUtils';
import { shortcutHintsEnabled, MOD_KEY, ALT_KEY } from '../../services/shortcutRegistry';
import type { ViewId } from '../../types/task';
import { Badge, BrandLogo } from '../ui';
import { Sun, Inbox, Calendar, Folder, TrendingUp, Headphones, ChevronRight, ChevronDown, PanelLeftClose, PanelLeftOpen, Search, Pin, PinOff, Plus, Trash2, FileEdit, BookOpen, Compass, Target, Repeat, CheckCircle2, Lightbulb, Archive, Filter, LayoutGrid, Columns3, Scale, Settings, Palette, DownloadCloud, Zap, Cloud, Keyboard } from 'lucide-react';
import '../../styles/shell.css';

interface SidebarProps {
  onOpenPomodoro: () => void;
  onOpenShortcuts?: () => void;
  onOpenExportImport: () => void;
  onOpenBrainDump: () => void;
  onOpenAesthetics?: () => void;
  onOpenScratchpad?: () => void;
  onOpenStudySession?: () => void;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onItemClick?: () => void;
  isMobileDrawer?: boolean;
}
interface Destination { id: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; count?: number; custom?: boolean; }

export const Sidebar: React.FC<SidebarProps> = ({ onOpenPomodoro, onOpenShortcuts, onOpenExportImport, onOpenBrainDump, onOpenAesthetics, onOpenScratchpad, onOpenStudySession, onOpenSettings, isCollapsed = false, onToggleCollapse, onItemClick, isMobileDrawer = false }) => {
  const { tasks, projects, activeView, setActiveView, addProject, smartViews, deleteSmartView, setIsSmartFilterModalOpen, setIsWeeklyReviewOpen, setIsAuthModalOpen, syncStatus, workspacePreferences = {}, setWorkspacePreference, settings } = useTaskContext();
  const today = useTodayStr();
  const now = useTaskAvailabilityClock(tasks);
  const hints = shortcutHintsEnabled(settings);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const workspace = (workspacePreferences.workspace || {}) as { pinnedDestinations?: string[]; lastPlanView?: string };
  const pinnedIds = Array.isArray(workspace.pinnedDestinations) ? workspace.pinnedDestinations : [];
  const counts = useMemo(() => {
    const active = tasks.filter(t => !t.deletedAt && !t.archivedAt && t.status !== 'done');
    return {
      today: active.filter(t => isTodayTask(t, today, { tasks, projects, now })).length,
      inbox: active.filter(t => isInboxTask(t, today, { tasks, projects, now })).length,
      upcoming: active.filter(t => (t.plannedDate || t.dueDate || '') > today).length,
      all: active.length,
      project: (id: string) => active.filter(t => t.projectId === id).length,
    };
  }, [tasks, projects, today, now]);
  const primary: Destination[] = [
    { id: 'today', label: 'Today', icon: Sun, count: counts.today },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: counts.inbox },
    { id: workspace.lastPlanView === 'timeline' ? 'timeline' : 'upcoming', label: 'Plan', icon: Calendar, count: counts.upcoming },
    { id: 'projects', label: 'Projects', icon: Folder },
    { id: 'review', label: 'Review', icon: TrendingUp },
  ];
  const tools: Destination[] = [
    { id: 'notes', label: 'Notes', icon: FileEdit }, { id: 'study', label: 'Study', icon: BookOpen },
    { id: 'goals', label: 'Goals', icon: Target }, { id: 'areas', label: 'Life Areas', icon: Compass },
    { id: 'routines', label: 'Routines', icon: Repeat }, { id: 'dashboard', label: 'My dashboards', icon: LayoutGrid },
    { id: 'all', label: 'All Tasks', icon: CheckCircle2, count: counts.all }, { id: 'someday', label: 'Someday', icon: Lightbulb },
    { id: 'kanban', label: 'Board', icon: Columns3 }, { id: 'matrix', label: 'Priority matrix', icon: Scale },
    { id: 'insights', label: 'Insights', icon: TrendingUp }, { id: 'logbook', label: 'Logbook', icon: Archive },
    { id: 'archive', label: 'Archive', icon: Archive }, { id: 'trash', label: 'Trash', icon: Trash2 },
    ...projects.filter(p => !p.isArchived && p.id !== 'inbox' && p.id !== 'ideas').map(p => ({ id: `project:${p.id}`, label: p.name, icon: Folder, count: counts.project(p.id) })),
    ...smartViews.map(v => ({ id: `smart:${v.id}`, label: v.name, icon: Filter, count: filterTasksByPredicate(tasks, v.predicate).length, custom: !v.isBuiltIn })),
  ];
  const pinned = tools.filter(item => pinnedIds.includes(item.id));
  const filtered = tools.filter(item => !pinnedIds.includes(item.id) && item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const currentView = activeView || '';
  const isActive = (item: Destination) => item.label === 'Plan' ? ['upcoming', 'timeline'].includes(currentView) : item.id === 'projects' ? currentView === 'projects' || currentView.startsWith('project:') : item.id === 'review' ? ['review', 'insights', 'logbook'].includes(currentView) : currentView === item.id;
  const select = (id: string) => { setActiveView(id as ViewId); onItemClick?.(); };
  const pin = (id: string) => setWorkspacePreference?.('workspace', { ...workspace, pinnedDestinations: pinnedIds.includes(id) ? pinnedIds.filter(value => value !== id) : [...pinnedIds, id] });
  const action = (callback: (() => void) | undefined) => { callback?.(); onItemClick?.(); };
  const renderDestination = (item: Destination, pinnable = false) => {
    const Icon = item.icon;
    return <div className="library-destination" key={item.id}>
      <button type="button" className="sidebar-nav-item" aria-current={isActive(item) ? 'page' : undefined} onClick={() => select(item.id)} title={isCollapsed ? item.label : undefined} aria-label={isCollapsed ? item.label : undefined}>
        <Icon size={17} strokeWidth={1.75} /><span>{item.label}</span>{!!item.count && <Badge size="xs" variant={isActive(item) ? 'brand' : 'neutral'}>{item.count}</Badge>}
      </button>
      {pinnable && !isCollapsed && <button type="button" className="library-row-action" onClick={() => pin(item.id)} title={`${pinnedIds.includes(item.id) ? 'Unpin' : 'Pin'} ${item.label}`} aria-label={`${pinnedIds.includes(item.id) ? 'Unpin' : 'Pin'} ${item.label}`}>{pinnedIds.includes(item.id) ? <PinOff size={14} /> : <Pin size={14} />}</button>}
      {item.custom && !isCollapsed && <button type="button" className="library-row-action library-delete" onClick={() => deleteSmartView(item.id.slice(6))} title="Delete Smart View" aria-label={`Delete Smart View ${item.label}`}><Trash2 size={14} /></button>}
    </div>;
  };
  return <aside className={`flow-sidebar refined-sidebar ${isCollapsed ? 'flow-sidebar-rail' : ''}`} aria-label={isMobileDrawer ? 'Mobile navigation drawer' : 'Desktop navigation'}>
    <div className="sidebar-brand-header">
      <button type="button" className="sidebar-brand" onClick={() => isCollapsed && onToggleCollapse ? onToggleCollapse() : select('today')} aria-label={isCollapsed ? 'FlowTask — Expand Sidebar' : 'FlowTask — Return to Today'}><BrandLogo size={32} showWordmark={!isCollapsed} subtitle="" /></button>
      {onToggleCollapse && !isMobileDrawer && <button type="button" className="sidebar-icon-control" onClick={onToggleCollapse} aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} title={hints ? 'Toggle sidebar ([)' : 'Toggle sidebar'}>{isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>}
    </div>
    <div className="sidebar-navigation">
      {!isCollapsed && <p className="sidebar-section-label">Your workspace</p>}
      <nav aria-label="Main destinations">{primary.map(item => renderDestination(item))}</nav>
      <button type="button" className={isCollapsed ? 'sidebar-studio-compact sidebar-icon-control' : 'sidebar-studio-entry'} onClick={() => action(onOpenPomodoro)} aria-label="Focus Studio" title="Focus Studio"><Headphones size={27} strokeWidth={1.5} />{!isCollapsed && <><span>Focus Studio<small>A place for your best work</small></span><ChevronRight size={15} /></>}</button>
      {pinned.length > 0 && <section className="sidebar-pinned" aria-label="Pinned destinations">{!isCollapsed && <p className="sidebar-section-label">Pinned</p>}{pinned.map(item => renderDestination(item, true))}</section>}
      <button type="button" className="sidebar-library-toggle" aria-label="Tools library" aria-expanded={!isCollapsed && toolsOpen} onClick={() => { if (isCollapsed) onToggleCollapse?.(); setToolsOpen(!toolsOpen || isCollapsed); }}><LayoutGrid size={17} />{!isCollapsed && <><span>Tools library</span><ChevronDown size={14} className={toolsOpen ? 'is-open' : ''} /></>}</button>
      {!isCollapsed && toolsOpen && <section className="sidebar-library" aria-label="Tools library contents">
        <label className="library-search"><Search size={15} /><input type="search" aria-label="Search tools" placeholder="Find a tool or project…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="library-results">{filtered.map(item => renderDestination(item, true))}{filtered.length === 0 && <p className="library-empty">No matching tools.</p>}</div>
        <div className="library-actions">
          <button type="button" onClick={() => setAddingProject(true)}><Plus size={15} />Add Project</button>
          <button type="button" onClick={() => action(() => setIsSmartFilterModalOpen(true))}><Filter size={15} />Create Smart Filter View</button>
          <button type="button" onClick={() => action(() => setIsWeeklyReviewOpen(true))}><TrendingUp size={15} />Weekly review</button>
          {onOpenStudySession && <button type="button" onClick={() => action(onOpenStudySession)}><BookOpen size={15} />New study session</button>}
          <button type="button" onClick={() => action(onOpenBrainDump)}><Zap size={15} />Multi-line Brain Dump</button>
          <button type="button" onClick={() => action(onOpenExportImport)}><DownloadCloud size={15} />Backup & restore</button>
          {onOpenShortcuts && <button type="button" onClick={() => action(onOpenShortcuts)}><Keyboard size={15} />Keyboard shortcuts</button>}
        </div>
        {addingProject && <form className="library-project-form" onSubmit={event => { event.preventDefault(); if (!projectName.trim()) return; const color = getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim() || '#496650'; addProject(projectName.trim(), color); setProjectName(''); setAddingProject(false); }}><input autoFocus aria-label="Project name" placeholder="Project name…" value={projectName} onChange={event => setProjectName(event.target.value)} /><button type="submit" className="desk-button primary">Add</button><button type="button" onClick={() => setAddingProject(false)}>Cancel</button></form>}
      </section>}
    </div>
    <div className="sidebar-footer">
      {onOpenAesthetics && <button type="button" className="sidebar-utility" aria-label="Customize appearance" title="Appearance" onClick={() => action(onOpenAesthetics)}><Palette size={16} />{!isCollapsed && <span>Appearance</span>}</button>}
      {onOpenScratchpad && <button type="button" className="sidebar-utility" aria-label="Sticky Scratchpad" title="Quick Notes" onClick={() => action(onOpenScratchpad)}><FileEdit size={16} />{!isCollapsed && <><span>Quick Notes</span>{hints && <kbd>{ALT_KEY}+N</kbd>}</>}</button>}
      <button type="button" className="sidebar-utility" aria-label="Preferences and Settings" title="Settings" onClick={() => action(onOpenSettings || onOpenExportImport)}><Settings size={16} />{!isCollapsed && <><span>Settings</span>{hints && <kbd>{MOD_KEY} ,</kbd>}</>}</button>
      {isMobileDrawer && <><button type="button" className="sidebar-utility" onClick={() => action(() => setIsAuthModalOpen(true))}><Cloud size={16} /><span>{syncStatus === 'synced' ? 'Account · Synced' : 'Account & saving'}</span></button><a className="sidebar-utility" href="/">Visit welcome page<ChevronRight size={14} /></a></>}
    </div>
  </aside>;
};

