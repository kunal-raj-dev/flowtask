import { useState } from 'react';
import { ArrowRight, Check, Play, X } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { Dialog } from '../ui/Dialog';

interface Props { isOpen: boolean; onClose: () => void; inline?: boolean; }

/** One useful action first; appearance and planning preferences can wait. */
export function OnboardingFlow({ isOpen, onClose, inline = false }: Props) {
  const ctx = useTaskContext();
  const { openModal } = useModal();
  const today = useTodayStr();
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const finish = () => { ctx.updateSettings({ onboardingCompleted: true }); onClose(); };
  const start = () => {
    if (!taskId) return;
    if (!ctx.focusSession) {
      ctx.startFocusSession('pomodoro', taskId, undefined, 25 * 60);
      ctx.updateFocusSession({ timerConfiguration: { mode: 'pomodoro', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4, autoStart: false } });
    }
    finish();
    openModal('pomodoro', { taskId: ctx.focusSession?.taskId || taskId });
  };
  if (!isOpen) return null;
  const content = <section className="first-task-welcome" aria-label="Start with one task">
    <div className="first-task-heading"><span className="desk-eyebrow">YOUR FIRST SMALL STEP</span><button type="button" className="desk-icon-button" aria-label="Dismiss introduction" onClick={finish}><X size={18}/></button></div>
    <h2>{taskId ? 'A little progress starts here.' : 'What would you like to work on?'}</h2>
    <p>{taskId ? 'Your task is saved on this device. Begin a quiet session, or keep making room for your day.' : 'Add one thing. You can plan the rest as you go. No setup or account needed.'}</p>
    {!taskId ? <form onSubmit={event => {
      event.preventDefault();
      if (!title.trim()) return;
      const task = ctx.addTask(title.trim(), { plannedDate: today, isPinnedToday: true, topThreeDate: today });
      setTaskId(task.id);
    }}><label htmlFor="first-task-input">Your first task</label><div className="first-task-input"><input id="first-task-input" maxLength={500} value={title} onChange={event => setTitle(event.target.value)} placeholder="Read a chapter, fix a bug, make a start…"/><button className="desk-button primary" type="submit" disabled={!title.trim()}>Add task<ArrowRight size={16}/></button></div></form> : <><p className="first-task-saved"><Check size={16}/>{title}</p><div className="first-task-actions"><button className="desk-button primary" onClick={start}><Play size={16}/>{ctx.focusSession ? 'Return to focus' : 'Start 25-minute focus'}</button><button className="desk-button" onClick={finish}>Keep planning</button></div></>}
    {!taskId && <button type="button" className="desk-text-action" onClick={finish}>Explore on my own</button>}
  </section>;
  return inline ? content : <Dialog isOpen={isOpen} onClose={finish} title="Start with one task" size="md">{content}</Dialog>;
}
