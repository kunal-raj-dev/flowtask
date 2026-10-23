import { getEffectiveTaskEstimate } from '../../../utils/taskTimeSummary';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CalendarClock } from 'lucide-react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { isTodayTask } from '../../../utils/taskSelectors';
import { parseTimeToMinutes, minutesToTimeStr } from '../../../utils/timelineUtils';
import type { WidgetComponentProps } from '../../../types/dashboard';
export const DayAgendaWidget: React.FC<WidgetComponentProps> = ({ widget, onSelectTask }) => {
  const { tasks, calendarEvents = [], settings, setActiveView } = useTaskContext(), today = useTodayStr();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()),60000); return () => clearInterval(timer); },[]);
  const current = now.getHours()*60+now.getMinutes();
  const events = useMemo(() => calendarEvents.filter(e => !e.date || e.date === today), [calendarEvents,today]);
  const items = useMemo(() => {
    const result: { id: string; title: string; start: number; end: number; task: boolean; done: boolean }[] = [];
    if (widget.config.showCalendar !== false) for (const e of events) { const start = parseTimeToMinutes(e.startTime), end = parseTimeToMinutes(e.endTime); if (!e.isAllDay && start !== null && end !== null && end > start) result.push({ id: e.id,title:e.title,start,end,task:false,done:false }); }
    if (widget.config.showScheduledTasks !== false) for (const t of tasks) {
      if (!isTodayTask(t,today) && !(t.status === 'done' && !t.deletedAt && !t.archivedAt && t.plannedDate === today)) continue;
      const start = parseTimeToMinutes(t.scheduledStart); if (start === null) continue;
      const end = parseTimeToMinutes(t.scheduledEnd) ?? start + (getEffectiveTaskEstimate(t) || settings?.defaultTaskDuration || 30);
      result.push({ id:t.id,title:t.title,start,end,task:true,done:t.status==='done' });
    }
    return result.sort((a,b) => a.start-b.start);
  },[tasks,events,today,widget.config,settings]);
  const next = items.find(item => item.end > current && !item.done);
  return <div className="desk-agenda">
    {next && widget.config.showNextBlockHighlight !== false && <p className="desk-agenda-next"><span>{next.start <= current ? 'Now' : 'Up next'}</span>{next.title}</p>}
    {widget.config.showCalendar !== false && events.filter(e => e.isAllDay).map(e => <p key={e.id} className="desk-agenda-all-day"><CalendarDays size={13}/>All day · {e.title}</p>)}
    {!items.length ? <div className="desk-widget-empty"><CalendarClock size={25}/><h3>A little breathing room.</h3><p>Your scheduled tasks and calendar events will find a place here.</p></div> : <ol>{items.map(item => <li key={(item.task?'task:':'event:')+item.id} data-now={item.start<=current && item.end>current || undefined} data-past={item.end<=current || undefined}><time>{minutesToTimeStr(item.start)}<small>{minutesToTimeStr(item.end)}</small></time><span className="desk-agenda-marker"/>{item.task ? <button onClick={() => onSelectTask?.(item.id)} className={item.done?'line-through':''}>{item.title}<small>Task</small></button> : <span>{item.title}<small>Calendar</small></span>}</li>)}</ol>}
    <button className="desk-text-action" onClick={() => setActiveView('timeline')}>Open day plan<ArrowRight size={14}/></button>
  </div>;
};
