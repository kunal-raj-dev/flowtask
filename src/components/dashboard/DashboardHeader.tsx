import React, { useState } from 'react';
import type { WorkspaceDashboard } from '../../types/dashboard';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { Dialog } from '../ui/Dialog';
import { ChevronDown, ArrowRight, SlidersHorizontal, Plus, Copy, Trash2, ArrowUp, ArrowDown, Download, Upload, LayoutTemplate, Check, Compass } from 'lucide-react';
import { useMediaCatalog } from '../../hooks/useStudio';
import { WorkspaceVisualPicker } from '../workspace/WorkspaceVisualPicker';

interface DashboardHeaderProps {
  activeDashboard: WorkspaceDashboard; dashboards: WorkspaceDashboard[];
  onSelectDashboard: (id: string) => void; onCreateDashboard: () => void;
  onRenameDashboard: (id: string, name: string) => void;
  onDuplicateDashboard: (id: string) => void; onDeleteDashboard: (id: string) => void;
  onReorderDashboard?: (id: string, direction: -1 | 1) => void;
  onResetToStarter: (id: string) => void;
  isEditing: boolean; onToggleEdit: () => void; onPlanMyDay: () => void;
  hasDraft: boolean; onResumeDraft: () => void; onDiscardDraft: () => void;
  onExport?: () => void; onImport?: () => void;
  onCoverChange?: (id: string | undefined, focalPoint?: { x: number; y: number }) => void;
  guided?: boolean;
}
export const DashboardHeader: React.FC<DashboardHeaderProps> = props => {
  const { activeDashboard, dashboards, isEditing } = props;
  const media = useMediaCatalog();
  const cover = media.visuals.find(scene => scene.id === activeDashboard.coverImage);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [open, setOpen] = useState(false), [visualPickerOpen, setVisualPickerOpen] = useState(false), [renaming, setRenaming] = useState<string | null>(null), [name, setName] = useState('');
  const today = useTodayStr();
  const date = new Date(today + 'T12:00:00');
  const formatted = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
  return <>
    {cover && failedCover !== cover.id && <img className="desk-dashboard-cover" src={cover.poster || cover.src} alt="" width={cover.width || 1200} height={cover.height || 600} style={{ objectPosition: `${activeDashboard.coverFocalPoint?.x ?? cover.focalPoint?.x ?? 50}% ${activeDashboard.coverFocalPoint?.y ?? cover.focalPoint?.y ?? 50}%` }} onError={() => setFailedCover(cover.id)} />}
    {activeDashboard.coverImage && ((!cover && !media.loading) || failedCover === cover?.id) && <div className="desk-dashboard-cover-missing" role="status"><span>Your saved desk image is unavailable on this device.</span><button type="button" className="desk-button" onClick={() => setVisualPickerOpen(true)}>Choose replacement</button></div>}
    <header className="desk-page-header">
      <div>
        <p className="desk-eyebrow">{formatted}</p>
        <div className="desk-title-line"><h1>Today<span className="desk-title-dot">.</span></h1><button className="desk-switcher" onClick={() => setOpen(true)} aria-label="Switch dashboard" aria-haspopup="dialog" disabled={isEditing}><Compass size={15}/><span>{activeDashboard.name}</span><ChevronDown size={14}/></button></div>
        <p className="desk-page-description">Your priorities, with room to breathe.</p>
      </div>
      <div className="desk-header-actions"><button className="desk-button" onClick={() => setOpen(true)} disabled={isEditing}><SlidersHorizontal size={15}/><span>{isEditing ? 'Editing workspace' : 'Customize'}</span></button>{!props.guided && <button className="desk-button primary" onClick={props.onPlanMyDay} disabled={isEditing}>Plan my day<ArrowRight size={16}/></button>}</div>
    </header>
    {props.hasDraft && !isEditing && <div className="desk-notice"><span>Your unfinished layout is ready whenever you are.</span><button onClick={props.onDiscardDraft}>Discard</button><button onClick={props.onResumeDraft}>Resume Editing</button></div>}
    <Dialog isOpen={open} onClose={() => { setOpen(false); setRenaming(null); }} title="Your desks" description="A different arrangement for every kind of day." size="lg">
      <div className="desk-manager-list">{[...dashboards].sort((a,b) => a.order-b.order).map((desk, index) => <div className="desk-manager-row" key={desk.id} data-current={desk.id === activeDashboard.id || undefined}>
        {renaming === desk.id ? <form className="desk-rename-form" onSubmit={e => { e.preventDefault(); if (name.trim()) props.onRenameDashboard(desk.id, name); setRenaming(null); }}><input aria-label="Dashboard name" autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }}/><button className="desk-icon-button" aria-label="Save dashboard name"><Check size={16}/></button></form> : <button className="desk-manager-select" onClick={() => { props.onSelectDashboard(desk.id); setOpen(false); }}><span className="desk-manager-mark"><Compass size={18}/></span><span><strong>{desk.name}</strong><small>{desk.widgets.length} widgets{desk.id === activeDashboard.id ? ' · Current desk' : ''}</small></span></button>}
        <div className="desk-manager-actions"><button className="desk-icon-button" aria-label={'Rename ' + desk.name} onClick={() => { setRenaming(desk.id); setName(desk.name); }}><SlidersHorizontal size={15}/></button>
          <button className="desk-icon-button" aria-label={'Move ' + desk.name + ' earlier'} disabled={!index} onClick={() => props.onReorderDashboard?.(desk.id, -1)}><ArrowUp size={15}/></button>
          <button className="desk-icon-button" aria-label={'Move ' + desk.name + ' later'} disabled={index === dashboards.length-1} onClick={() => props.onReorderDashboard?.(desk.id, 1)}><ArrowDown size={15}/></button>
          <button className="desk-icon-button" aria-label={'Duplicate ' + desk.name} disabled={dashboards.length >= 20} onClick={() => { props.onDuplicateDashboard(desk.id); setOpen(false); }}><Copy size={15}/></button>
          <button className="desk-icon-button danger" aria-label={'Delete ' + desk.name} disabled={dashboards.length <= 1} onClick={() => { props.onDeleteDashboard(desk.id); setOpen(false); }}><Trash2 size={15}/></button></div>
      </div>)}</div>
      <div className="desk-manager-tools"><button className="desk-button" onClick={() => { setOpen(false); props.onToggleEdit(); }}>Edit workspace</button><button className="desk-button" disabled={dashboards.length >= 20} onClick={() => { props.onCreateDashboard(); setOpen(false); }}><Plus size={16}/>Create New Dashboard</button><button className="desk-button" onClick={() => { props.onExport?.(); }}><Download size={16}/>Export layout</button><button className="desk-button" disabled={dashboards.length >= 20} onClick={() => { props.onImport?.(); setOpen(false); }}><Upload size={16}/>Import layout</button></div>
      <div className="desk-cover-select"><span>Background for {activeDashboard.name}</span>{activeDashboard.coverImage && !cover && !media.loading && <small role="status">Saved personal image is unavailable on this device.</small>}<button type="button" className="desk-button" onClick={() => { setOpen(false); setVisualPickerOpen(true); }}>{cover ? 'Change image' : activeDashboard.coverImage ? 'Choose replacement' : 'Choose an image'}</button></div>
      <div className="desk-template-heading"><LayoutTemplate size={17}/><h3>Start with a little structure</h3></div><p className="desk-muted">Preview a starter on your current desk. Save to apply it, or Cancel to keep your layout.</p>
      <div className="desk-template-grid">{STARTER_DASHBOARDS.map(starter => {
        const layout = starter.layouts.lg;
        const maxY = Math.max(...layout.map(l => l.y + l.h), 1);
        return (
          <button key={starter.id} onClick={() => { props.onResetToStarter(starter.id); setOpen(false); }}>
            <span className="desk-template-mini" aria-hidden="true">
              {layout.map(item => {
                const left = (item.x / 12) * 100;
                const width = (item.w / 12) * 100;
                const top = (item.y / maxY) * 100;
                const height = (item.h / maxY) * 100;
                return (
                  <i
                    key={item.i}
                    style={{
                      left: `calc(${left}% + 1px)`,
                      width: `calc(${width}% - 2px)`,
                      top: `calc(${top}% + 1px)`,
                      height: `calc(${height}% - 2px)`,
                    }}
                  />
                );
              })}
            </span>
            <strong>{starter.name}</strong>
            <small>{starter.widgets.length} widgets · {starter.name === 'Daily Desk' ? 'Plan a realistic day' : starter.name === 'Study Desk' ? 'Study, practice and keep references' : starter.name === 'Developer Desk' ? 'Projects, releases and weekly demand' : 'A quieter single-column workspace'}</small>
          </button>
        );
      })}</div>
    </Dialog>
    {visualPickerOpen && <WorkspaceVisualPicker isOpen={visualPickerOpen} onClose={() => setVisualPickerOpen(false)} assets={media.visuals} loading={media.loading} catalogError={media.error} value={activeDashboard.coverImage} focalPoint={activeDashboard.coverFocalPoint} context={{ kind: 'dashboard' }} onSelect={(id, point) => props.onCoverChange?.(id, point)}/>}
  </>;
};
