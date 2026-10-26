import { getDerivedSubtaskEstimate, getEffectiveTaskEstimate } from '../../utils/taskTimeSummary';
import { useEffect, useRef, useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { belongsToPlanDay, createSchedulePreview, isPlanDate, scheduleChanges, scheduleExclusion, type SchedulePreview } from '../../services/schedulePlanner';
import { Dialog } from '../ui/Dialog';

export function SchedulePlannerDialog(props: { isOpen: boolean; onClose: () => void; date?: string }) {
  return props.isOpen ? <SchedulePlanner onClose={props.onClose} initialDate={props.date} /> : null;
}

function SchedulePlanner({ onClose, initialDate }: { onClose: () => void; initialDate?: string }) {
  const ctx = useTaskContext();
  const today = useTodayStr();
  const [date, setDate] = useState(initialDate || today);
  const defaults = (day: string) => ctx.tasks.filter(t => !t.isSomeday && belongsToPlanDay(t, day, today) && !scheduleExclusion(t, ctx.tasks, ctx.projects, day)).map(t => t.id);
  const [selected, setSelected] = useState(() => defaults(initialDate || today));
  const [estimates, setEstimates] = useState<Record<string, number>>({});
  const [backlog, setBacklog] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [message, setMessage] = useState('');
  const applying = useRef(false);
  const refreshCalendar = useRef(ctx.refreshCalendarEvents);
  useEffect(() => { refreshCalendar.current = ctx.refreshCalendarEvents; }, [ctx.refreshCalendarEvents]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  useEffect(() => {
    if (!isPlanDate(date) || !refreshCalendar.current) return;
    let active = true;
    setCalendarLoading(true);
    void Promise.resolve(refreshCalendar.current(date)).catch(() => {
      if (active) setMessage('Calendar refresh is unavailable. This preview uses the events already stored on this device.');
    }).finally(() => { if (active) setCalendarLoading(false); });
    return () => { active = false; };
  }, [date]);
  const tasks = ctx.tasks.filter(t => !t.deletedAt && !t.archivedAt && t.status !== 'done' && !t.scheduledStart && (belongsToPlanDay(t, date, today) || backlog || selected.includes(t.id)));
  const valid = isPlanDate(date) && date >= today && !calendarLoading && selected.length > 0 && selected.every(id => estimates[id] === undefined || Number.isFinite(estimates[id]) && estimates[id] > 0 && estimates[id] <= 1440);
  const calculate = () => createSchedulePreview({ date, tasks: ctx.tasks, projects: ctx.projects, calendarEvents: ctx.calendarEvents, settings: ctx.settings, selectedIds: selected, estimates });
  const invalidate = () => { setPreview(null); setMessage(''); };
  const apply = () => {
    if (!preview || !valid || applying.current) return;
    applying.current = true;
    let committed = false;
    try {
      const current = calculate();
      if (current.fingerprint !== preview.fingerprint) {
        setPreview(current); setMessage('Your workspace or available time changed. Review the refreshed plan before applying.'); return;
      }
      if (!current.slotted.length) return;
      ctx.applyTaskChanges(scheduleChanges(current), 'Apply schedule plan');
      committed = true;
      ctx.showToast('Your schedule is ready.', 'Undo', ctx.undoLastAction);
      onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your schedule. Please try again.'); }
    finally { if (!committed) applying.current = false; }
  };
  return <Dialog isOpen onClose={onClose} title="Plan your schedule" description="Choose tasks, review their times, then apply one plan." size="lg" className="schedule-planner" footer={<>
    <button className="desk-button" onClick={onClose}>Cancel</button>
    {preview ? <button className="desk-button primary" disabled={!valid || !preview.slotted.length} onClick={apply}>Apply schedule</button>
      : <button className="desk-button primary" disabled={!valid} onClick={() => { setPreview(calculate()); setMessage(''); }}>Preview schedule</button>}
  </>}>
    <div className="planner-options">
      <label>Plan date<input type="date" aria-label="Plan date" min={today} value={date} onChange={e => { setDate(e.target.value); setSelected(defaults(e.target.value)); invalidate(); }} /></label>
      <label className="planner-check"><input type="checkbox" checked={backlog} onChange={e => { setBacklog(e.target.checked); }} />Show other unscheduled tasks</label>
    </div>
    <p className="planner-hint">Uses your working hours and daily budget. Existing blocks stay in place; tasks are scheduled as whole blocks. Other tasks are included only when you select them.</p>
    <div className="planner-task-list">
      {tasks.map(task => { const reason = scheduleExclusion(task, ctx.tasks, ctx.projects, date); return <div key={task.id} className="planner-task">
        <label className="planner-check"><input type="checkbox" checked={selected.includes(task.id)} disabled={!!reason} onChange={e => { setSelected(e.target.checked ? [...selected, task.id] : selected.filter(id => id !== task.id)); invalidate(); }} /><span>{task.title}{reason && <small>{reason}</small>}</span></label>
        <label className="planner-duration"><span className="sr-only">Minutes for {task.title}</span><input aria-label={`Minutes for ${task.title}`} type="number" min="1" max="1440" value={Number.isNaN(estimates[task.id]) ? '' : getDerivedSubtaskEstimate(task.subtasks) ?? estimates[task.id] ?? (getEffectiveTaskEstimate(task) || ctx.settings.defaultTaskDuration)} disabled={!!reason || getDerivedSubtaskEstimate(task.subtasks) !== null} title={getDerivedSubtaskEstimate(task.subtasks) !== null ? 'Synced from subtasks' : undefined} onChange={e => { setEstimates({ ...estimates, [task.id]: e.target.valueAsNumber }); invalidate(); }} /><span>min</span></label>
      </div>; })}
      {!tasks.length && <p className="planner-hint">No unscheduled tasks for this day. Add a task or show other unscheduled tasks.</p>}
    </div>
    {calendarLoading && <p role="status" className="planner-hint">Checking calendar availability…</p>}
    {message && <p role="alert" className="desk-notice">{message}</p>}
    {preview && <section className="planner-preview" aria-label="Schedule preview">
      <h3>{preview.slotted.length} tasks · {preview.totalSlottedMinutes} minutes</h3>
      <p className="planner-hint">{preview.settings.timelineStartHour}:00–{preview.settings.timelineEndHour}:00 · {preview.settings.autoSlotBufferMinutes} min buffer · {preview.budget} min available before this plan. Missing estimates use your default duration. Deadlines stay unchanged.</p>
      {preview.slotted.map(slot => <div className="planner-slot" key={slot.taskId}><strong>{slot.scheduledStart}–{slot.dueTime}</strong><span>{slot.taskTitle}</span></div>)}
      {Object.entries(preview.reasons).map(([id, reason]) => <p className="planner-hint" key={id}><strong>{ctx.tasks.find(t => t.id === id)?.title || 'Removed task'}:</strong> {reason}</p>)}
      {preview.warnings.map(warning => <p className="planner-hint" key={warning}>{warning}</p>)}
    </section>}
  </Dialog>;
}
