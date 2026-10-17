import React, { useState } from 'react';
import type { DashboardWidget } from '../../types/dashboard';
import { useTaskContext } from '../../context/TaskContext';
import { WIDGET_REGISTRY } from '../../services/widgetRegistry';
import { normalizeWidgetConfig } from '../../utils/dashboardModel';
import { useBuiltInScenes } from '../../hooks/useBuiltInScenes';
import { Dialog } from '../ui/Dialog';
interface Props { widget: DashboardWidget | null; isOpen: boolean; onClose: () => void; onSave: (id: string, title: string, config: Record<string, unknown>) => void; }
function Content({ widget, onClose, onSave }: Props & { widget: DashboardWidget }) {
  const { projects = [], smartViews = [] } = useTaskContext(), scenes = useBuiltInScenes();
  const [title, setTitle] = useState(widget.title || ''), [config, setConfig] = useState(widget.config);
  const def = WIDGET_REGISTRY[widget.type];
  const set = (key: string, value: unknown) => setConfig(c => ({ ...c, [key]: value }));
  const toggle = (key: string, label: string) => <label className="desk-setting-check"><input type="checkbox" checked={config[key] !== false} onChange={e => set(key,e.target.checked)}/>{label}</label>;
  return <Dialog isOpen onClose={onClose} title={'Configure ' + def.name} description="A few details to make this widget useful to you." footer={<><button className="desk-button" onClick={onClose}>Cancel</button><button className="desk-button primary" onClick={() => { onSave(widget.id, title.trim() || def.defaultTitle, normalizeWidgetConfig(widget.type, config)); onClose(); }}>Apply Changes</button></>}>
    <div className="desk-settings-fields">
      <label>Widget title<input value={title} maxLength={80} onChange={e => setTitle(e.target.value)}/></label>
      {widget.type === 'taskList' && <>
        <label>Task source<select value={String(config.source || 'today')} onChange={e => setConfig(c => ({ ...c, source: e.target.value, ...(e.target.value === 'project' ? { projectId: projects[0]?.id || '' } : {}), ...(e.target.value === 'filter' ? { filterId: smartViews[0]?.id || '' } : {}) }))}><option value="today">Today's tasks</option><option value="inbox">Inbox</option><option value="project">Project</option><option value="filter">Saved view</option></select></label>
        {config.source === 'project' && <label>Project<select value={String(config.projectId || '')} onChange={e => set('projectId',e.target.value)}><option value="" disabled>Choose a project</option>{projects.filter(p => !p.isArchived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {config.source === 'filter' && <label>Saved view<select value={String(config.filterId || '')} onChange={e => set('filterId',e.target.value)}><option value="" disabled>Choose a saved view</option>{smartViews.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
        {toggle('showCompleted','Show completed tasks')}
        {config.source === 'today' && <label className="desk-setting-check"><input type="checkbox" checked={config.excludeTop3 === true} onChange={e => set('excludeTop3',e.target.checked)}/>Keep Top 3 in the priorities widget</label>}
      </>}
      {widget.type === 'top3' && toggle('showNextAction','Show the next action')}
      {widget.type === 'dayAgenda' && <>{toggle('showCalendar','Show calendar events')}{toggle('showScheduledTasks','Show scheduled tasks')}{toggle('showNextBlockHighlight','Highlight the next block')}</>}
      {widget.type === 'focusLaunchpad' && <label>Recipes to show<select value={String(config.maxRecipes || 3)} onChange={e => set('maxRecipes',Number(e.target.value))}>{[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></label>}
      {widget.type === 'quickNotes' && <label>Note sources<select value={String(config.mode || 'both')} onChange={e => set('mode',e.target.value)}><option value="both">Scratchpad and task notes</option><option value="scratchpad">Scratchpad only</option><option value="task">Selected task notes</option></select></label>}
      {widget.type === 'projects' && <fieldset><legend>Projects to show</legend><p className="desk-muted">Leave all unchecked to show every active project.</p>{projects.filter(p => p.id !== 'inbox' && !p.isArchived).map(p => <label className="desk-setting-check" key={p.id}><input type="checkbox" checked={Array.isArray(config.projectIds) && config.projectIds.includes(p.id)} onChange={e => { const ids = Array.isArray(config.projectIds) ? config.projectIds as string[] : []; set('projectIds',e.target.checked ? [...ids,p.id] : ids.filter(id => id !== p.id)); }}/>{p.name}</label>)}</fieldset>}
      {widget.type === 'quietScene' && <><label>Scene<select value={String(config.sceneId || 'misty-pines')} onChange={e => set('sceneId',e.target.value)}>{scenes.length ? scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>) : <option value="misty-pines">Misty Pines</option>}</select></label>{toggle('showClock','Show the clock')}<label>Clock format<select value={String(config.clockFormat || '12h')} onChange={e => set('clockFormat',e.target.value)}><option value="12h">12 hour</option><option value="24h">24 hour</option></select></label></>}
    </div>
  </Dialog>;
}
export const WidgetSettingsModal: React.FC<Props> = props => props.isOpen && props.widget ? <Content key={props.widget.id} {...props} widget={props.widget}/> : null;
