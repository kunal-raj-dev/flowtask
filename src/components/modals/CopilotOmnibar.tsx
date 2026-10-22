import { useRef, useState } from 'react';
import { Plus, Layers, CalendarDays, Play, BarChart3, Trash2 } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { useModalStore } from '../../store/useModalStore';
import { executeWebMcpTool } from '../../services/webMcpService';
import { suggestSubtasks, generateStarterStep, type SuggestedSubtask } from '../../utils/aiCopilot';
import { parseCopilotCommand, type CopilotAction } from '../../utils/copilotCommands';
import { parseTaskInput } from '../../utils/nlpParser';
import { formatSecondsToHumanReadable } from '../../utils/focusTimeFormat';
import type { Priority } from '../../types/task';
import { Dialog } from '../ui/Dialog';
import { SchedulePlannerDialog } from '../workflow/SchedulePlannerDialog';
import { isPlanDate } from '../../services/schedulePlanner';

export interface CopilotOmnibarProps { isOpen: boolean; onClose: () => void }
const ACTIONS = [
  ['add', 'Add task', Plus], ['breakdown', 'Break into steps', Layers],
  ['schedule', 'Plan / schedule day', CalendarDays], ['focus', 'Start focus', Play],
  ['summary', 'Daily summary', BarChart3],
] as const;
interface Summary { totalTasks: number; completedTasks: number; completionRate: number; topThreeCount: number; topThreeCompleted: number; totalPlannedMinutes: number; focusedSeconds: number }

export function CopilotOmnibar(props: CopilotOmnibarProps) {
  return props.isOpen ? <Copilot onClose={props.onClose} /> : null;
}

function Copilot({ onClose }: { onClose: () => void }) {
  const ctx = useTaskContext();
  const today = useTodayStr();
  const [action, setAction] = useState<CopilotAction | null>(null);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>(ctx.settings.defaultTaskPriority || 'p3');
  const [projectId, setProjectId] = useState('inbox');
  const [minutes, setMinutes] = useState(ctx.settings.defaultTaskDuration || 30);
  const [targetId, setTargetId] = useState('');
  const [steps, setSteps] = useState<SuggestedSubtask[]>([]);
  const [starter, setStarter] = useState('');
  const [ready, setReady] = useState(false);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>();
  const submitting = useRef(false);
  const previewTarget = useRef('');
  const activeTasks = ctx.tasks.filter(t => !t.deletedAt && !t.archivedAt && t.status !== 'done');
  const target = activeTasks.find(t => t.id === targetId);
  const resetReview = () => { setReady(false); setError(''); };
  const choose = (next: CopilotAction) => {
    if (busy) return;
    setAction(next); setReady(false); setApplied(false); setError(''); submitting.current = false;
    setSummary(null); setSteps([]); setStarter(''); setTargetId(''); setTitle(''); setDate(today); setDeadline('');
    setMinutes(next === 'focus' ? 25 : ctx.settings.defaultTaskDuration || 30);
    if (next === 'schedule') { setScheduleDate(undefined); setScheduleOpen(true); }
    if (next === 'summary') void loadSummary();
  };
  const loadSummary = async () => {
    setBusy(true); setError('');
    try { setSummary(await executeWebMcpTool('getDailySummary', {}) as Summary); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load your summary. Try again.'); }
    finally { setBusy(false); }
  };
  const generate = (taskTitle = target?.title || title) => {
    if (!taskTitle.trim()) { setError('Enter a task title or choose an existing task.'); return; }
    setSteps(suggestSubtasks(taskTitle, target?.description));
    setStarter(generateStarterStep(taskTitle, target?.description)); setReady(false); setError('');
  };
  const runCommand = () => {
    if (busy) return;
    const command = parseCopilotCommand(query);
    setError('');
    if (command.action === 'unknown') { setError(command.message); return; }
    choose(command.action);
    if (command.action === 'add') {
      const parsed = parseTaskInput(command.title);
      setTitle(parsed.cleanTitle); setDate(parsed.plannedDate || today); setDeadline(parsed.dueDate || '');
      setPriority(parsed.priority || ctx.settings.defaultTaskPriority || 'p3');
      setMinutes(parsed.estimatedMinutes || ctx.settings.defaultTaskDuration || 30);
      const project = ctx.projects.find(p => p.id === parsed.projectTag || p.name.toLowerCase() === parsed.projectTag?.toLowerCase());
      setProjectId(project?.id || 'inbox');
    } else if (command.action === 'breakdown') {
      setTitle(command.title); setSteps(suggestSubtasks(command.title)); setStarter(generateStarterStep(command.title));
    } else if (command.action === 'schedule') {
      setScheduleDate(command.date); setScheduleOpen(true);
    } else if (command.action === 'focus') {
      setMinutes(command.minutes);
      if (command.taskTitle) {
        const matches = activeTasks.filter(t => t.title.toLowerCase().includes(command.taskTitle!.toLowerCase()));
        if (matches.length === 1) setTargetId(matches[0].id);
        else setError(matches.length ? 'Several tasks match. Choose the task to focus on.' : 'No matching task. Choose a task below.');
      }
    }
  };
  const effectiveTitle = target?.title || title;
  const duration = action === 'breakdown' ? steps.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0) : minutes;
  const valid = !!effectiveTitle.trim() && effectiveTitle.length <= 500 && Number.isFinite(duration) && duration > 0 && duration <= 1440
    && (action !== 'breakdown' || steps.length > 0 && steps.every(s => s.title.trim() && s.title.length <= 500 && Number.isFinite(s.estimatedMinutes) && s.estimatedMinutes! > 0 && s.estimatedMinutes! <= 1440))
    && (!!targetId || isPlanDate(date) && (!deadline || isPlanDate(deadline)));
  const apply = () => {
    if (submitting.current || applied || !ready || !valid) return;
    submitting.current = true;
    try {
      if (targetId && (!target || JSON.stringify(target) !== previewTarget.current)) {
        setError('This task changed since your preview. Review it again before applying.'); setReady(false); submitting.current = false; return;
      }
      const subtasks = steps.map(step => ({ id: crypto.randomUUID(), title: step.title.trim(), completed: false, estimatedMinutes: step.estimatedMinutes }));
      if (target && action === 'breakdown') {
        ctx.applyTaskChanges([{ id: target.id, updates: { subtasks: [...target.subtasks, ...subtasks], nextAction: starter.trim(), estimatedMinutes: (target.estimatedMinutes || 0) + duration } }], 'Add task breakdown');
      } else {
        ctx.addTask(effectiveTitle.trim(), { title: effectiveTitle.trim(), plannedDate: date, dueDate: deadline || undefined, projectId, priority, estimatedMinutes: duration, subtasks, nextAction: starter.trim() || undefined });
      }
      setApplied(true); ctx.showToast(target ? 'Steps added to your task.' : 'Task added to your workspace.', 'Undo', ctx.undoLastAction);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this task. Please try again.'); submitting.current = false; }
  };
  const startFocus = () => {
    if (submitting.current) return;
    if (!ctx.focusSession && (!target || !Number.isFinite(minutes) || minutes < 1 || minutes > 240)) { setError('Choose a task and a duration from 1 to 240 minutes.'); return; }
    submitting.current = true;
    try {
      if (ctx.focusSession?.state === 'paused') ctx.resumeFocusSession();
      else if (!ctx.focusSession) ctx.startFocusSession('pomodoro', target!.id, target!.title, minutes * 60);
      onClose(); useModalStore.getState().openModal('pomodoro');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start focus. Try again.'); submitting.current = false; }
  };
  return <>
    <Dialog isOpen onClose={onClose} title="FlowTask Copilot" description="Your local planning assistant. Review every change before applying it." size="lg" className="copilot-dialog" footer={action === 'add' || action === 'breakdown' ? <>
      {applied ? <span role="status">{targetId ? 'Steps saved to your task.' : 'Added to workspace.'}</span> : <>
        <button className="desk-button" disabled={!valid} onClick={() => { previewTarget.current = target ? JSON.stringify(target) : ''; setReady(true); setError(''); }}>Preview task</button>
        <button className="desk-button primary" disabled={!ready || !valid} onClick={apply}>{action === 'breakdown' ? targetId ? 'Add steps to task' : 'Add task with subtasks' : 'Add task to workspace'}</button>
      </>}
    </> : action === 'focus' ? <button className="desk-button primary" onClick={startFocus}>{ctx.focusSession ? ctx.focusSession.state === 'paused' ? 'Resume focus' : 'Return to focus' : 'Start focus session'}</button> : undefined}>
      <div className="copilot-actions" aria-label="Copilot actions">{ACTIONS.map(([id, label, Icon]) => <button key={id} className="desk-button" aria-pressed={action === id} disabled={busy} onClick={() => choose(id)}><Icon size={16} />{label}</button>)}</div>
      <form className="copilot-command" onSubmit={e => { e.preventDefault(); runCommand(); }}>
        <input aria-label="Copilot command" placeholder="Try: add Read chapter 3, plan my day…" value={query} onChange={e => setQuery(e.target.value)} />
        <button className="desk-button" disabled={!query.trim() || busy}>Use command</button>
      </form>
      <details className="copilot-help"><summary>Supported commands</summary><p>add Read chapter 3 · decompose Prepare presentation · plan my day · schedule tasks for 2026-10-25 · focus 25m on Read chapter · daily summary</p><p>Breakdowns use local templates. Review their wording and estimates for your task.</p></details>
      {error && <p role="alert" className="desk-notice">{error}</p>}
      {(action === 'add' || action === 'breakdown') && <fieldset className="copilot-fields" disabled={applied}>
        {action === 'breakdown' && <label>Task to break down<select aria-label="Task to break down" value={targetId} onChange={e => { const task = activeTasks.find(t => t.id === e.target.value); setTargetId(e.target.value); setSteps([]); setStarter(''); if (task) setTitle(task.title); resetReview(); }}><option value="">Create a new task</option>{activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
        {!targetId && <label>Task title<input aria-label="Copilot task title" maxLength={500} value={title} onChange={e => { setTitle(e.target.value); resetReview(); }} /></label>}
        {!targetId && <div className="copilot-form-row"><label>Planned date<input type="date" value={date} onChange={e => { setDate(e.target.value); resetReview(); }} /></label><label>Deadline (optional)<input type="date" value={deadline} onChange={e => { setDeadline(e.target.value); resetReview(); }} /></label><label>Project<select value={projectId} onChange={e => { setProjectId(e.target.value); resetReview(); }}>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Priority<select value={priority} onChange={e => { setPriority(e.target.value as Priority); resetReview(); }}>{(['p1', 'p2', 'p3', 'p4'] as const).map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select></label>{action === 'add' && <label>Estimated minutes<input type="number" min={1} max={1440} value={Number.isNaN(minutes) ? '' : minutes} onChange={e => { setMinutes(e.target.valueAsNumber); resetReview(); }} /></label>}</div>}
        {action === 'breakdown' && <>
          <button className="desk-button" type="button" onClick={() => generate()}>Suggest steps</button>
          {steps.map((step, index) => <div key={index} className="copilot-subtask"><label>Step {index + 1}<input aria-label={`Step ${index + 1} title`} maxLength={500} value={step.title} onChange={e => { setSteps(steps.map((s, i) => i === index ? { ...s, title: e.target.value } : s)); resetReview(); }} /></label><label>Minutes<input aria-label={`Step ${index + 1} minutes`} type="number" min={1} max={1440} value={Number.isNaN(step.estimatedMinutes) ? '' : step.estimatedMinutes ?? ''} onChange={e => { setSteps(steps.map((s, i) => i === index ? { ...s, estimatedMinutes: e.target.valueAsNumber } : s)); resetReview(); }} /></label><button type="button" className="desk-icon-button" aria-label={`Remove step ${index + 1}`} onClick={() => { setSteps(steps.filter((_, i) => i !== index)); resetReview(); }}><Trash2 size={16} /></button></div>)}
          <button className="desk-button" disabled={steps.length >= 30} onClick={() => { setSteps([...steps, { title: '', estimatedMinutes: 15 }]); resetReview(); }}>Add a step</button>
          <label>Starter action<textarea aria-label="Starter action" value={starter} maxLength={500} onChange={e => { setStarter(e.target.value); resetReview(); }} /></label>
        </>}
      </fieldset>}
      {ready && !applied && <section className="copilot-result" aria-label="Task preview"><strong>{effectiveTitle}</strong><p className="copilot-help">{target ? `Add ${steps.length} steps to the existing task; its current steps stay in place. Additional estimate: ${duration} min.` : `${duration} min · ${date}${deadline ? ` · Deadline ${deadline}` : ''} · ${steps.length} subtasks. Creates one task.`}</p><p className="copilot-help">{starter}</p></section>}
      {action === 'focus' && <div className="copilot-fields">{ctx.focusSession ? <p className="copilot-help">Your existing session on “{ctx.focusSession.taskTitle || 'Focus'}” is ready to {ctx.focusSession.state === 'paused' ? 'resume' : 'open'}.</p> : <><label>Focus task<select aria-label="Focus task" value={targetId} onChange={e => { setTargetId(e.target.value); setError(''); }}><option value="">Choose a task</option>{activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>Focus minutes<input type="number" min={1} max={240} value={Number.isNaN(minutes) ? '' : minutes} onChange={e => setMinutes(e.target.valueAsNumber)} /></label></>}</div>}
      {action === 'summary' && <section className="copilot-result"><h3>Daily productivity summary</h3>{busy ? <p role="status">Loading summary…</p> : summary ? <div className="copilot-summary"><p><strong>{summary.completedTasks} / {summary.totalTasks}</strong>Tasks completed</p><p><strong>{summary.completionRate}%</strong>Completion</p><p><strong>{summary.topThreeCompleted} / {summary.topThreeCount}</strong>Top 3 completed</p><p><strong>{formatSecondsToHumanReadable(summary.focusedSeconds)}</strong>Focused</p></div> : <button className="desk-button" onClick={() => void loadSummary()}>Retry summary</button>}</section>}
      {action === 'schedule' && <button className="desk-button" onClick={() => setScheduleOpen(true)}>Review schedule plan</button>}
    </Dialog>
    <SchedulePlannerDialog isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} date={scheduleDate} />
  </>;
}
import '../../styles/copilot.css';
