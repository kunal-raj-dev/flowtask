import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Task } from '../../types/task';
import type { ViewDisplaySettings, WorkspacePreferences } from '../../types/dashboard';
import { useTaskContext } from '../../context/TaskContext';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { Dialog } from '../ui/Dialog';
import { TaskCard } from './TaskCard';
import { VirtualTaskList } from './VirtualTaskList';
interface Props { tasks:Task[]; viewKey:string; onSelectTask:(id:string)=>void; onStartFocus:(id:string)=>void; onStartSprint?:(id:string)=>void; }
export const TaskCollection:React.FC<Props> = p => {
  const ctx=useTaskContext(), workspace=(ctx.workspacePreferences?.workspace||{}) as WorkspacePreferences;
  const saved=workspace.viewDisplaySettings?.[p.viewKey]||{};
  const groupBy=['none','project','priority','status','date'].includes(saved.groupBy||'')?saved.groupBy!:'none';
  const sortBy=['priority','date','title','estimate'].includes(saved.sortBy||'')?saved.sortBy!:'priority';
  const [open,setOpen]=useState(false);
  const set=(patch:Partial<ViewDisplaySettings>)=>ctx.setWorkspacePreference('workspace',{...workspace,viewDisplaySettings:{...workspace.viewDisplaySettings,[p.viewKey]:{...saved,...patch}}});
  const groups=useMemo(()=>{
    const sorted=[...p.tasks].sort((a,b)=>{
      const result=sortBy==='title'?a.title.localeCompare(b.title):sortBy==='estimate'?(a.estimatedMinutes||0)-(b.estimatedMinutes||0):sortBy==='date'?(a.plannedDate||a.dueDate||'9999').localeCompare(b.plannedDate||b.dueDate||'9999'):a.priority.localeCompare(b.priority);
      return (saved.sortOrder==='desc'?-1:1)*result;
    });
    const map=new Map<string,Task[]>();
    for(const task of sorted){const key=groupBy==='project'?ctx.projects.find(project=>project.id===task.projectId)?.name||'Inbox':groupBy==='priority'?task.priority.toUpperCase():groupBy==='status'?task.status==='in_progress'?'In progress':'To do':groupBy==='date'?task.plannedDate||'Unscheduled':'';map.set(key,[...(map.get(key)||[]),task]);}
    return [...map.entries()];
  },[p.tasks,ctx.projects,groupBy,sortBy,saved.sortOrder]);
  const keyboard=useKeyboardNavigation({tasks:groups.flatMap(([,tasks])=>tasks),onSelectTask:p.onSelectTask,onStartFocus:p.onStartFocus,onToggleStatus:ctx.toggleTaskStatus,onTogglePinToday:ctx.toggleTaskPinToday,onUpdateTask:ctx.updateTask,onDeleteTask:ctx.deleteTask,onBatchUpdate:ctx.batchUpdateTasks,onBatchDelete:ctx.batchDeleteTasks,onBatchArchive:ids=>ctx.batchUpdateTasks(ids,{archivedAt:Date.now()}),enabled:true});
  return <><div className="desk-collection-toolbar"><span>{p.tasks.length} {p.tasks.length===1?'task':'tasks'}</span><button className="desk-button" onClick={()=>setOpen(true)}><SlidersHorizontal size={14}/>Display</button></div>
    {groups.map(([label,tasks])=><section key={label} aria-label={label||'Tasks'} className="desk-task-group">{label&&<h2>{label}<span>{tasks.length}</span></h2>}<VirtualTaskList className="" tasks={tasks} estimatedItemHeight={78} renderTask={task=><TaskCard key={task.id} task={task} onSelectTask={p.onSelectTask} onStartFocus={p.onStartFocus} onStartSprint={p.onStartSprint} isKeyboardFocused={keyboard.focusedTaskId===task.id} showEstimates={saved.showEstimates!==false}/>}/></section>)}
    <Dialog isOpen={open} onClose={()=>setOpen(false)} title="Display options" description="Choose the information and order that help you scan this view."><div className="desk-settings-fields"><label>Group by<select value={groupBy} onChange={e=>set({groupBy:e.target.value as ViewDisplaySettings['groupBy']})}><option value="none">No grouping</option><option value="project">Project</option><option value="priority">Priority</option><option value="status">Status</option><option value="date">Planned date</option></select></label><label>Sort by<select value={sortBy} onChange={e=>set({sortBy:e.target.value as ViewDisplaySettings['sortBy']})}><option value="priority">Priority</option><option value="date">Planned date</option><option value="title">Title</option><option value="estimate">Estimate</option></select></label><label>Order<select value={saved.sortOrder||'asc'} onChange={e=>set({sortOrder:e.target.value as 'asc'|'desc'})}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label><label className="desk-setting-check"><input type="checkbox" checked={saved.showEstimates!==false} onChange={e=>set({showEstimates:e.target.checked})}/>Show time estimates</label><button className="desk-button" onClick={()=>set({groupBy:'none',sortBy:'priority',sortOrder:'asc',showEstimates:true})}>Reset view display</button></div></Dialog>
  </>;
};
