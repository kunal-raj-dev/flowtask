import React, { useState, useMemo } from 'react';
import { Timer, Check, Calendar } from 'lucide-react';
import { parseTimeToMinutes } from '../../utils/timelineUtils';
import { useTodayStr, useTomorrowStr } from '../../hooks/useCurrentDate';
import type { Task } from '../../types/task';

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
  onApply: (draft: SessionDraft) => void;
  onCancel: () => void;
}

const PRESETS = [
  { label: 'Morning 08:00–11:00 (3h)', start: '08:00', end: '11:00' },
  { label: 'Midday 11:30–14:00 (2.5h)', start: '11:30', end: '14:00' },
  { label: 'Afternoon 14:30–17:30 (3h)', start: '14:30', end: '17:30' },
  { label: 'Evening 18:00–21:00 (3h)', start: '18:00', end: '21:00' },
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
  onApply,
  onCancel,
}) => {
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

  return (
    <div className="p-3 rounded-xl bg-teal-500/[0.08] dark:bg-teal-500/[0.12] border border-teal-500/30 space-y-2.5 animate-slide-down text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-200">
          <Timer size={14} className="text-teal-600 dark:text-teal-400" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono tabular-nums font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 dark:text-teal-200 border border-teal-500/30 text-[11px]">
            {duration.formatted}
          </span>
        </div>
      </div>

      {/* Date & Session Number Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Planned Date */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
          <Calendar size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="text-[11px] text-[var(--text-secondary)] shrink-0">Date:</span>
          <input
            type="date"
            aria-label="Session planned date"
            value={plannedDate}
            onChange={(e) => {
              chooseDate(e.target.value);
            }}
            className="w-full bg-transparent text-[var(--text-primary)] font-mono text-xs outline-none cursor-pointer"
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                chooseDate(todayStr);
              }}
              className={`px-1.5 py-0.5 text-[10px] rounded font-medium border ${
                plannedDate === todayStr
                  ? 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40 font-bold'
                  : 'bg-[var(--bg-surface-l2)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                chooseDate(tomorrowStr);
              }}
              className={`px-1.5 py-0.5 text-[10px] rounded font-medium border ${
                plannedDate === tomorrowStr
                  ? 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40 font-bold'
                  : 'bg-[var(--bg-surface-l2)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
              }`}
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Session Number */}
        <div className="flex items-center justify-between bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
          <span className="text-[11px] text-[var(--text-secondary)]">Session #:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="99"
              aria-label="Session number"
              value={sessionNum}
              onChange={(e) => {
                const n = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
                setCustomSessionNum(n);
              }}
              className="w-12 bg-transparent text-[var(--text-primary)] font-bold font-mono outline-none text-right"
            />
            {sessionNum !== computedNextNum && (
              <button
                type="button"
                onClick={() => {
                  setCustomSessionNum(null);
                }}
                className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline"
                title={`Reset to suggested #${computedNextNum}`}
              >
                (Auto #{computedNextNum})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Start Time & End Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Start Time */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
          <span className="text-[11px] text-[var(--text-secondary)]">Start:</span>
          <input
            type="time"
            aria-label="Session start time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
            }}
            className="w-full bg-transparent text-[var(--text-primary)] font-mono font-medium outline-none cursor-pointer"
          />
        </div>

        {/* End Time */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
          <span className="text-[11px] text-[var(--text-secondary)]">End:</span>
          <input
            type="time"
            aria-label="Session end time"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
            }}
            className="w-full bg-transparent text-[var(--text-primary)] font-mono font-medium outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-teal-500/20">
        <span className="text-[10px] text-[var(--text-muted)] mr-1">Presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setStartTime(p.start);
              setEndTime(p.end);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {!valid && <p role="status">Choose a planned date, a non-zero time interval and a session number from 1 to 99.</p>}
      {/* Actions: Apply / Cancel */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-stone-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!valid}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer active:scale-95"
        >
          <Check size={13} />
          <span>Apply Session</span>
        </button>
      </div>
    </div>
  );
};
