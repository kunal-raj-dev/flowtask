import { useTaskAvailabilityClock } from '../../../hooks/useTaskAvailabilityClock';
import { isInboxTask } from '../../../utils/taskSelectors';
import React, { useMemo, useState } from 'react';
import { CheckCheck, ChevronDown, Plus, Moon } from 'lucide-react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { isFocusTask, isTodayTask, completedOn } from '../../../utils/taskSelectors';
import { filterTasksByPredicate } from '../../../utils/smartViewUtils';
import { parseTaskInput } from '../../../utils/nlpParser';
import { WorkspaceTaskRow } from '../../tasks/WorkspaceTaskRow';
import { VirtualTaskList } from '../../tasks/VirtualTaskList';
import type { WidgetComponentProps } from '../../../types/dashboard';
export const TaskListWidget: React.FC<WidgetComponentProps & { captureOnly?: boolean; hideCapture?: boolean }> = ({ widget, onSelectTask, onStartFocus, onStartSprint, captureOnly = false, hideCapture = false }) => {
  const { tasks, projects, settings, smartViews = [], addTask, showToast } = useTaskContext(), today = useTodayStr();
  const availabilityNow = useTaskAvailabilityClock(tasks);
  const source = String(widget.config.source || 'today'), projectId = String(widget.config.projectId || ''), filterId = String(widget.config.filterId || '');
  const missing = source === 'project' ? !projects.some(p => p.id === projectId) : source === 'filter' ? !smartViews.some(v => v.id === filterId) : false;
  const [input, setInput] = useState(''), [completedOpen, setCompletedOpen] = useState(false);
  const parsed = useMemo(() => settings?.enableSmartSyntaxParsing === false ? { cleanTitle: input.trim() } : parseTaskInput(input), [input, settings?.enableSmartSyntaxParsing]);
  const list = useMemo(() => {
    if (missing) return [];
    const visible = tasks.filter(t => !t.deletedAt && !t.archivedAt);
    if (source === 'project') return visible.filter(t => t.projectId === projectId);
    if (source === 'filter') return filterTasksByPredicate(visible, smartViews.find(v => v.id === filterId)!.predicate);
    if (source === 'inbox') return visible.filter(t => isInboxTask(t, today, { tasks, projects, now: availabilityNow }));
    return visible.filter(t => isTodayTask(t, today, { tasks, projects, now: availabilityNow }) || completedOn(t, today));
  }, [tasks, projects, source, projectId, filterId, smartViews, today, missing,availabilityNow]);
  const active = list.filter(t => t.status !== 'done' && !(source === 'today' && widget.config.excludeTop3 && isFocusTask(t, today, { tasks, projects, now: availabilityNow })));
  const daytime = active.filter(t => source !== 'today' || !t.isEvening), evening = source === 'today' ? active.filter(t => t.isEvening) : [];
  const done = list.filter(t => t.status === 'done');
  const row = (task: typeof tasks[0]) => <WorkspaceTaskRow key={task.id} task={task} onSelectTask={id => onSelectTask?.(id)} onStartFocus={onStartFocus} onStartSprint={onStartSprint}/>;
  return <div className="desk-task-widget">
    {!hideCapture && !missing && <form className="desk-inline-capture" onSubmit={e => { e.preventDefault(); if (!input.trim()) return; addTask(input.trim(), { plannedDate: parsed.plannedDate || (source === 'today' && (!parsed.dueDate || parsed.dueDate === today) ? today : undefined), projectId: parsed.projectTag || (source === 'project' ? projectId : 'inbox') }); if (source === 'filter') showToast('Task captured. It will appear here when it matches the saved view.'); if (source === 'today' && parsed.plannedDate && parsed.plannedDate !== today) showToast('Task captured for '+parsed.plannedDate+'. Find it in Upcoming.'); setInput(''); }}><Plus size={17}/><input aria-label="Add a task to this list" value={input} onChange={e => setInput(e.target.value)} placeholder={source === 'today' ? 'What needs your attention today?' : 'Capture a task…'}/><button type="submit" disabled={!input.trim()} aria-label="Add task"><ArrowIcon/></button>{input.trim() && (parsed.plannedDate || parsed.dueDate || parsed.projectTag || parsed.estimatedMinutes || parsed.priority) && <div className="desk-capture-preview" aria-label="Recognized task details">{parsed.plannedDate&&<span>Planned · {parsed.plannedDate}</span>}{parsed.dueDate&&<span>Deadline · {parsed.dueDate}</span>}{parsed.projectTag&&<span>Project · {parsed.projectTag}</span>}{parsed.estimatedMinutes&&<span>{parsed.estimatedMinutes}m</span>}{parsed.priority&&<span>{parsed.priority.toUpperCase()}</span>}</div>}</form>}
    {!captureOnly && <div className="desk-task-widget-list">
      {missing ? <div className="desk-widget-empty"><h3>Reconnect this list</h3><p>Choose an available {source === 'project' ? 'project' : 'saved view'} in widget settings.</p></div> : <>
        {!active.length && <div className="desk-widget-empty"><CheckCheck size={25}/><h3>{list.some(t => isFocusTask(t, today, { tasks, projects, now: availabilityNow })) ? 'Your priorities have the stage.' : 'A clear space to begin.'}</h3><p>{source === 'inbox' ? 'Capture an idea here whenever it arrives.' : 'Add a task below, or make a little room in your day.'}</p></div>}
        <VirtualTaskList tasks={daytime} className="" renderTask={row} estimatedItemHeight={78}/>
        {!!evening.length && <><h3 className="desk-list-section"><Moon size={14}/>This evening<span>{evening.length}</span></h3><VirtualTaskList tasks={evening} className="" renderTask={row} estimatedItemHeight={78}/></>}
        {widget.config.showCompleted !== false && !!done.length && <div className="desk-completed"><button aria-expanded={completedOpen} onClick={() => setCompletedOpen(!completedOpen)}><ChevronDown size={15} style={{ transform: completedOpen ? undefined : 'rotate(-90deg)' }}/>Completed<span>{done.length}</span></button>{completedOpen && done.map(row)}</div>}
      </>}
    </div>}

  </div>;
};
function ArrowIcon() { return <span aria-hidden="true">↵</span>; }
