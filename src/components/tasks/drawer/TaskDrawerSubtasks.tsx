import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import { suggestSubtasks, suggestDuration } from '../../../utils/aiCopilot';
import { generateStarterAction } from '../../../utils/procrastinationSplitter';
import { saveCustomTemplate } from '../../../utils/templateEngine';
import {
  ListTodo,
  Zap,
  Sparkles,
  Plus,
  Bookmark,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  X,
  ExternalLink,
} from 'lucide-react';

interface TaskDrawerSubtasksProps {
  task: Task;
}

export const TaskDrawerSubtasks: React.FC<TaskDrawerSubtasksProps> = ({ task }) => {
  const {
    updateTask,
    toggleSubTask,
    addSubTask,
    addSubTasks,
    deleteSubTask,
    promoteSubTaskToTask,
    moveSubTask,
    showToast,
  } = useTaskContext();

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskEstimate, setNewSubtaskEstimate] = useState<number | undefined>(undefined);
  const [isDecomposing, setIsDecomposing] = useState(false);

  const completedSubs = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubs = task.subtasks?.length || 0;
  const progressPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
  const totalSubMinutes = task.subtasks?.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;
  const completedSubMinutes =
    task.subtasks?.filter((s) => s.completed).reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;

  const handleStarterStep = () => {
    const starter = generateStarterAction(task.title, task.description);
    addSubTask(task.id, starter.starterAction, starter.suggestedMinutes);
    showToast(`⚡ 5-min starter added: "${starter.starterAction}"`);
  };

  const handleMagicBreakdown = () => {
    setIsDecomposing(true);
    setTimeout(() => {
      const suggested = suggestSubtasks(task.title, task.description);
      const newItems = suggested
        .filter((sub) => !task.subtasks?.some((s) => s.title.toLowerCase() === sub.title.toLowerCase()))
        .map((sub) => ({ title: sub.title }));

      if (newItems.length > 0) {
        addSubTasks(task.id, newItems);
      }

      if (!task.estimatedMinutes) {
        updateTask(task.id, { estimatedMinutes: suggestDuration(task.title) });
      }
      setIsDecomposing(false);
    }, 200);
  };

  const handleAddSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      addSubTask(task.id, newSubtaskTitle.trim(), newSubtaskEstimate);
      setNewSubtaskTitle('');
      setNewSubtaskEstimate(undefined);
    }
  };

  return (
    <div className="p-4 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] space-y-3 card-surface">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
          <ListTodo size={13} className="text-[var(--color-brand)]" />
          <span>Subtasks {totalSubs > 0 && `(${completedSubs}/${totalSubs})`}</span>
        </label>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleStarterStep}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs transition-all active:scale-95"
            title="Cognitive de-escalation: Generate a tailored 5-minute starter action to break inertia"
          >
            <Zap size={11} className="text-amber-500 fill-current" />
            <span>Break Inertia (5m)</span>
          </button>

          <button
            type="button"
            onClick={handleMagicBreakdown}
            disabled={isDecomposing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/20 text-[var(--color-brand)] border border-[var(--color-brand)]/30 shadow-xs transition-all active:scale-95 disabled:opacity-50"
            title="Suggested steps — generated locally"
          >
            <Sparkles
              size={11}
              className={isDecomposing ? 'animate-spin text-[var(--color-brand)]' : 'text-[var(--color-brand)]'}
            />
            <span>{isDecomposing ? 'Suggesting...' : 'Suggest steps'}</span>
          </button>

          {totalSubs > 0 && (
            <span className="text-xs font-mono text-[var(--text-muted)] font-semibold">{progressPercent}%</span>
          )}
        </div>
      </div>

      {/* Progress Bar and Rollup */}
      {totalSubs > 0 && (
        <div className="space-y-1.5 mb-2">
          <div className="w-full h-1.5 bg-stone-200/70 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
            <span>
              {completedSubs} of {totalSubs} steps completed
              {totalSubMinutes > 0 ? ` • ${completedSubMinutes}m / ${totalSubMinutes}m` : ''}
            </span>
            {totalSubMinutes > 0 && task.estimatedMinutes !== totalSubMinutes && (
              <button
                type="button"
                onClick={() => updateTask(task.id, { estimatedMinutes: totalSubMinutes })}
                className="text-[10px] font-bold text-[var(--color-brand)] hover:underline"
                title={`Update parent task estimate to sum of subtasks (${totalSubMinutes}m)`}
              >
                Sync to Task ({totalSubMinutes}m)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtasks List */}
      <div className="space-y-1.5">
        {task.subtasks?.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-surface-l1)] group transition-colors border border-transparent hover:border-[var(--border-hairline)]"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => toggleSubTask(task.id, sub.id)}
                className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all active:scale-90 ${
                  sub.completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-[var(--border-strong)] hover:border-amber-500'
                }`}
                aria-label={sub.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
              >
                {sub.completed && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-2.5 h-2.5 animate-check-spring"
                  >
                    <polyline points="20 6 9 17 4 12" className="animate-check-draw" />
                  </svg>
                )}
              </button>

              {sub.difficulty && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0 ${
                    sub.difficulty === 'HARD'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : sub.difficulty === 'MEDIUM'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {sub.difficulty}
                </span>
              )}

              {sub.problemNumber && (
                <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] shrink-0">
                  #{sub.problemNumber}
                </span>
              )}

              <span
                className={`text-xs ${
                  sub.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                }`}
              >
                {sub.title}
              </span>

              {sub.url && (
                <a
                  href={sub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--color-brand)] hover:opacity-80 p-0.5 shrink-0"
                  title="Open Problem Link"
                >
                  <ExternalLink size={12} />
                </a>
              )}

              {sub.tags && sub.tags.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {sub.tags.map((tg) => (
                    <span
                      key={tg}
                      className="text-[9px] px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-stone-800 text-[var(--text-muted)] font-medium"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
              )}

              {sub.estimatedMinutes && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-l1)] text-[var(--text-muted)] font-semibold border border-[var(--border-hairline)] shrink-0">
                  {sub.estimatedMinutes}m
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                type="button"
                onClick={() => moveSubTask(task.id, sub.id, 'up')}
                title="Move step up"
                aria-label="Move step up"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md transition-all"
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => moveSubTask(task.id, sub.id, 'down')}
                title="Move step down"
                aria-label="Move step down"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md transition-all"
              >
                <ChevronDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => promoteSubTaskToTask(task.id, sub.id)}
                title="Promote subtask to independent task"
                aria-label="Promote subtask to independent task"
                className="text-[var(--text-muted)] hover:text-[var(--color-brand)] p-1 rounded-md transition-all"
              >
                <ArrowUpRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => deleteSubTask(task.id, sub.id)}
                title="Delete subtask"
                aria-label="Delete subtask"
                className="text-[var(--text-muted)] hover:text-rose-500 p-1 rounded-md transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Subtask Form */}
      <form onSubmit={handleAddSub} className="mt-2 flex items-center gap-2">
        <input
          id="new-subtask-title-input"
          name="newSubtaskTitle"
          aria-label="Add subtask"
          type="text"
          placeholder="Add subtask..."
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          className="flex-1 text-xs px-3 py-1.5 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface"
        />
        <input
          id="new-subtask-estimate-input"
          name="newSubtaskEstimate"
          aria-label="Subtask estimate in minutes"
          type="number"
          min="1"
          step="5"
          placeholder="min"
          value={newSubtaskEstimate || ''}
          onChange={(e) => setNewSubtaskEstimate(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          className="w-14 text-xs px-2 py-1.5 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface text-center font-mono"
          title="Optional step duration estimate in minutes"
        />
        <button
          type="submit"
          disabled={!newSubtaskTitle.trim()}
          title="Add subtask"
          aria-label="Add subtask"
          className="p-1.5 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] disabled:opacity-40 rounded-lg border border-[var(--border-hairline)] shadow-xs transition-colors"
        >
          <Plus size={14} />
        </button>
      </form>

      {/* Blueprint Template Save */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              saveCustomTemplate({
                name: task.title,
                description: task.description,
                defaultPriority: task.priority,
                defaultEstimatedMinutes: task.estimatedMinutes,
                subtaskTitles: task.subtasks?.map((s) => s.title) || [],
                contextTags: task.contextTags,
              });
              showToast(`Saved "${task.title}" as reusable template!`);
            }}
            title="Save current task and its subtasks as a reusable template"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/25 transition-all active:scale-95 shadow-xs"
          >
            <Bookmark size={12} />
            <span>Save as Template</span>
          </button>
        </div>
      )}
    </div>
  );
};
