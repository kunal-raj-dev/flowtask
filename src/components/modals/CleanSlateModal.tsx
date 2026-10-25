import React, { useState, useMemo } from 'react';
import type { Task } from '../../types/task';
import { X, Sparkles, Archive, ShieldCheck } from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';
import { getOverdueTasks, quarantineTasks } from '../../services/cleanSlateService';

export interface CleanSlateModalProps {
  isOpen: boolean;
  tasks: Task[];
  onClose: () => void;
  onApplyQuarantine: (updatedTasks: Task[], count: number) => void;
}

export const CleanSlateModal: React.FC<CleanSlateModalProps> = ({
  isOpen,
  tasks,
  onClose,
  onApplyQuarantine,
}) => {
  const overdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(overdueTasks.map((t) => t.id))
  );

  if (!isOpen) return null;

  const toggleTask = (id: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTaskIds(next);
  };

  const selectAll = () => {
    setSelectedTaskIds(new Set(overdueTasks.map((t) => t.id)));
  };

  const deselectAll = () => {
    setSelectedTaskIds(new Set());
  };

  const handleExecuteCleanSlate = () => {
    const idsToQuarantine = Array.from(selectedTaskIds);
    const { updatedTasks, quarantinedCount } = quarantineTasks(tasks, idsToQuarantine);
    audioEngine.playTaskComplete();
    onApplyQuarantine(updatedTasks, quarantinedCount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Clean Slate Reset Chamber"
      data-testid="clean-slate-modal"
    >
      <div className="w-full max-w-lg bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]">
        {/* Header Banner */}
        <div className="relative px-6 py-6 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border-b border-[var(--border-color)]">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-[var(--bg-surface-l2)] text-[var(--text-secondary)]"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Life happened. Want a Clean Slate?</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Zero judgment. Zero guilt. A fresh beginning for your workspace.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs text-[var(--text-secondary)] flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <p>
              You have <strong className="text-[var(--text-primary)]">{overdueTasks.length} overdue tasks</strong>{' '}
              accumulating pressure. We can safely move them to your{' '}
              <strong className="text-[var(--text-primary)]">"Someday"</strong> parking lot. No work is
              deleted, and you get an empty, clean today.
            </p>
          </div>

          {/* Task Selection List */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[var(--text-secondary)]">
                Tasks to Quarantine ({selectedTaskIds.size} of {overdueTasks.length})
              </span>
              <div className="flex items-center gap-2 text-[11px] text-[var(--color-brand)]">
                <button onClick={selectAll} className="hover:underline">Select All</button>
                <span>·</span>
                <button onClick={deselectAll} className="hover:underline">Clear</button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)]">
              {overdueTasks.length === 0 ? (
                <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                  No overdue tasks found.
                </div>
              ) : (
                overdueTasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--bg-surface-l3)] cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.has(t.id)}
                      onChange={() => toggleTask(t.id)}
                      className="rounded text-[var(--color-brand)]"
                    />
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                      {t.plannedDate || t.dueDate}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Keep Current Dates
            </button>
            <button
              onClick={handleExecuteCleanSlate}
              disabled={selectedTaskIds.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-xs font-bold hover:bg-[var(--color-brand-hover)] shadow disabled:opacity-50 transition-transform active:scale-95"
              data-testid="confirm-clean-slate-btn"
            >
              <Archive size={15} />
              <span>Clean Slate ({selectedTaskIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
