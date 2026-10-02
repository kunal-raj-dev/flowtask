import React from 'react';
import type { Task, Priority } from '../../types/task';
import { X } from 'lucide-react';

interface KeyboardHaloDockProps {
  task: Task;
  onSelect: () => void;
  onToggleStatus: () => void;
  onStartFocus: () => void;
  onRescheduleToday: () => void;
  onRescheduleTomorrow: () => void;
  onRescheduleSomeday: () => void;
  onSetPriority: (priority: Priority) => void;
  onDismiss: () => void;
}

export const KeyboardHaloDock: React.FC<KeyboardHaloDockProps> = ({
  task,
  onSelect,
  onToggleStatus,
  onStartFocus,
  onRescheduleToday,
  onRescheduleTomorrow,
  onRescheduleSomeday,
  onSetPriority,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-stone-900/95 dark:bg-stone-900/95 text-white border border-stone-700/70 shadow-2xl backdrop-blur-xl animate-slide-up select-none">
      {/* Active task badge */}
      <div className="flex items-center gap-2 max-w-[200px] truncate border-r border-stone-700/80 pr-3">
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <span className="text-xs font-semibold text-stone-200 truncate" title={task.title}>
          {task.title}
        </span>
      </div>

      {/* Action shortcut pills */}
      <div className="flex items-center gap-1.5 text-[11px]">
        {/* Toggle complete */}
        <button
          type="button"
          onClick={onToggleStatus}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          title="Toggle completion (Space / x)"
        >
          <kbd className="px-1 py-0.5 rounded bg-stone-700 font-mono text-[9px] font-bold text-stone-200">Space</kbd>
          <span>{task.status === 'done' ? 'Undone' : 'Done'}</span>
        </button>

        {/* Open details */}
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          title="Open task details (Enter)"
        >
          <kbd className="px-1 py-0.5 rounded bg-stone-700 font-mono text-[9px] font-bold text-stone-200">↵</kbd>
          <span>Details</span>
        </button>

        {/* Start Focus Timer */}
        <button
          type="button"
          onClick={onStartFocus}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white transition-colors"
          title="Start Pomodoro focus session (P)"
        >
          <kbd className="px-1 py-0.5 rounded bg-indigo-900/60 font-mono text-[9px] font-bold text-indigo-200">P</kbd>
          <span>Focus</span>
        </button>

        {/* Today */}
        <button
          type="button"
          onClick={onRescheduleToday}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          title="Schedule for Today (T)"
        >
          <kbd className="px-1 py-0.5 rounded bg-stone-700 font-mono text-[9px] font-bold text-stone-200">T</kbd>
          <span>Today</span>
        </button>

        {/* Tomorrow */}
        <button
          type="button"
          onClick={onRescheduleTomorrow}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          title="Schedule for Tomorrow (M)"
        >
          <kbd className="px-1 py-0.5 rounded bg-stone-700 font-mono text-[9px] font-bold text-stone-200">M</kbd>
          <span>Tomorrow</span>
        </button>

        {/* Someday */}
        <button
          type="button"
          onClick={onRescheduleSomeday}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          title="Park in Someday backlog (S)"
        >
          <kbd className="px-1 py-0.5 rounded bg-stone-700 font-mono text-[9px] font-bold text-stone-200">S</kbd>
          <span>Someday</span>
        </button>

        {/* Priorities 1-4 */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-stone-700/80">
          {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p, idx) => (
            <button
              key={p}
              type="button"
              onClick={() => onSetPriority(p)}
              className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[10px] font-bold transition-all ${
                task.priority === p
                  ? 'bg-amber-500 text-white font-extrabold shadow-xs scale-105'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
              title={`Set Priority ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors ml-1"
          title="Dismiss focus highlight (Esc)"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
