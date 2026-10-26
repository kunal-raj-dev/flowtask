import React, { useState, useMemo, useId } from 'react';
import { Timer, Check, Calendar, Clock, Hash } from 'lucide-react';
import { parseTimeToMinutes, minutesToTimeStr } from '../../utils/timelineUtils';
import { useTodayStr, useTomorrowStr } from '../../hooks/useCurrentDate';
import type { Task } from '../../types/task';
import '../../styles/task-session-editor.css';

export interface SessionDraft {
  sessionNumber: number;
  plannedDate?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface TaskSessionEditorProps {
  initialSessionNumber?: number;
  initialPlannedDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  suggestedSessionNumber?: number;
  tasks?: Task[];
  excludeTaskId?: string;
  title?: string;
  taskEstimatedMinutes?: number;
  onApply: (draft: SessionDraft) => void;
  onCancel: () => void;
}

const PRESETS = [
  { name: 'Morning', label: 'Morning 08:00–11:00 (3h)', start: '08:00', end: '11:00', duration: '3h' },
  { name: 'Midday', label: 'Midday 11:30–14:00 (2.5h)', start: '11:30', end: '14:00', duration: '2.5h' },
  { name: 'Afternoon', label: 'Afternoon 14:30–17:30 (3h)', start: '14:30', end: '17:30', duration: '3h' },
  { name: 'Evening', label: 'Evening 18:00–21:00 (3h)', start: '18:00', end: '21:00', duration: '3h' },
];

export const TaskSessionEditor: React.FC<TaskSessionEditorProps> = ({
  initialSessionNumber,
  initialPlannedDate,
  initialStartTime = '08:00',
  initialEndTime = '11:00',
  suggestedSessionNumber,
  tasks,
  excludeTaskId,
  title = 'Session Duration Generator',
  taskEstimatedMinutes,
  onApply,
  onCancel,
}) => {
  const editorId = useId();
  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();
  const [plannedDate, setPlannedDate] = useState<string>(initialPlannedDate || todayStr);
  const [customSessionNum, setCustomSessionNum] = useState<number | null>(
    initialSessionNumber !== undefined ? initialSessionNumber : null
  );

  // Compute next available session number dynamically for current plannedDate
  const computedNextNum = useMemo(() => {
    if (!tasks || tasks.length === 0) return suggestedSessionNumber ?? 1;
    const target = plannedDate || todayStr;
    const matchingSessions = tasks.filter(
      (t) => t.id !== excludeTaskId && !t.deletedAt && !t.archivedAt && (t.plannedDate || t.dueDate) === target && t.sessionMetadata?.isSession
    );
    const nums = matchingSessions.map((t) => t.sessionMetadata?.sessionNumber || 1);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [tasks, plannedDate, todayStr, excludeTaskId, suggestedSessionNumber]);

  const sessionNum = customSessionNum !== null ? customSessionNum : computedNextNum;

  const [startTime, setStartTime] = useState<string>(initialStartTime);
  const [endTime, setEndTime] = useState<string>(initialEndTime);

  const chooseDate = (date: string) => {
    if (date !== plannedDate) setCustomSessionNum(null);
    setPlannedDate(date);
  };

  const duration = useMemo(() => {
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin === null || endMin === null) return { minutes: 0, formatted: 'Choose start and end times' };
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const formatted = h > 0 ? (m > 0 ? `${h}h ${m}m (${diff}m)` : `${h}h (${diff}m)`) : `${m}m`;
    return { minutes: diff, formatted };
  }, [startTime, endTime]);

  const valid = duration.minutes > 0 && Boolean(plannedDate) && Number.isInteger(sessionNum) && sessionNum >= 1 && sessionNum <= 99;

  const handleApply = () => {
    if (!valid) return;
    onApply({
      sessionNumber: sessionNum || 1,
      plannedDate: plannedDate || undefined,
      startTime,
      endTime,
      durationMinutes: duration.minutes,
    });
  };

  const overnight = Boolean(startTime && endTime && endTime < startTime);

  return (
    <section className="task-session-editor" aria-labelledby={editorId}>
      <header className="session-editor-heading">
        <div className="session-editor-title"><Timer size={18} /><h4 id={editorId}>{title}</h4></div>
        <span className="session-duration" role="status" aria-label={`Session duration: ${duration.formatted}`}>{duration.formatted}</span>
      </header>
      <p className="session-editor-description">Give this session a day and a clear time window.</p>
      <div className="session-details-grid">
        <div className="session-field">
          <label htmlFor={`${editorId}-date`}><Calendar size={14} />Planned date</label>
          <input id={`${editorId}-date`} type="date" aria-label="Session planned date" value={plannedDate} onChange={e => chooseDate(e.target.value)} required />
          <div className="session-quick-dates" role="group" aria-label="Quick session dates">
            <button type="button" aria-pressed={plannedDate === todayStr} onClick={() => chooseDate(todayStr)}>Today</button>
            <button type="button" aria-pressed={plannedDate === tomorrowStr} onClick={() => chooseDate(tomorrowStr)}>Tomorrow</button>
          </div>
        </div>
        <div className="session-field">
          <label htmlFor={`${editorId}-number`}><Hash size={14} />Session number</label>
          <input id={`${editorId}-number`} type="number" min="1" max="99" aria-label="Session number" value={sessionNum} onChange={e => setCustomSessionNum(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))} />
          {sessionNum !== computedNextNum ? <button type="button" className="session-auto-number" onClick={() => setCustomSessionNum(null)} title={`Reset to suggested #${computedNextNum}`}>Use suggested #{computedNextNum}</button> : <span className="session-field-hint">Suggested for this day</span>}
        </div>
      </div>
      <div className="session-time-grid">
        <div className="session-field">
          <label htmlFor={`${editorId}-start`}><Clock size={14} />Start time</label>
          <input id={`${editorId}-start`} type="time" aria-label="Session start time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
        </div>
        <div className="session-field">
          <label htmlFor={`${editorId}-end`}><Clock size={14} />End time{overnight && <span className="session-next-day">+1 day</span>}</label>
          <input id={`${editorId}-end`} type="time" aria-label="Session end time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
        </div>
      </div>
      <div className="session-presets" role="group" aria-label="Session time presets">
        <span className="session-presets-label">QUICK TIME BLOCKS</span>
        <div className="session-presets-grid">
          {PRESETS.map(p => <button key={p.name} type="button" aria-label={p.label} aria-pressed={startTime === p.start && endTime === p.end} onClick={() => {
            setStartTime(p.start);
            if (taskEstimatedMinutes && taskEstimatedMinutes > 0) {
              const startMin = parseTimeToMinutes(p.start) ?? 480;
              setEndTime(minutesToTimeStr(startMin + taskEstimatedMinutes));
            } else {
              setEndTime(p.end);
            }
          }}>
            <span className="session-preset-name">{p.name}<span>{p.duration}</span></span>
            <span className="session-preset-time">{p.start} – {p.end}</span>
          </button>)}
        </div>
      </div>
      {!valid && <p className="session-validation" role="status">Choose a planned date, a non-zero time interval and a session number from 1 to 99.</p>}
      <footer className="session-editor-actions">
        <button type="button" className="session-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="session-apply" onClick={handleApply} disabled={!valid}><Check size={16} />Apply Session</button>
      </footer>
    </section>
  );
};
