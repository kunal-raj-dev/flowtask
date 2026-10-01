import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { X, Sparkles, CornerDownLeft } from 'lucide-react';

interface BrainDumpModalProps {
  onClose: () => void;
}

export const BrainDumpModal: React.FC<BrainDumpModalProps> = ({ onClose }) => {
  const { addMultipleTasks } = useTaskContext();
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.)\]\s]+/, '').trim()) // clean up leading bullets/numbers
      .filter((l) => l.length > 0);

    if (lines.length > 0) {
      addMultipleTasks(lines);
      onClose();
    }
  };

  const lineCount = text
    .split('\n')
    .filter((l) => l.trim().length > 0).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l2)] rounded-3xl p-7 border border-[var(--border-hairline)] shadow-modal relative card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm card-surface">
            <Sparkles size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Multi-line Brain Dump
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Paste or type unorganized thoughts. Each line becomes an individual task.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <textarea
            autoFocus
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Buy oat milk #groceries\nReview Q3 presentation tomorrow 2pm p1 ~30m\nCall dentist for cleaning\nRead chapter 4 of Designing Data-Intensive Apps`}
            className="w-full text-xs p-4 bg-[var(--bg-surface-l1)]/60 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-2xl outline-none focus:border-stone-400 dark:focus:border-stone-600 resize-none font-mono leading-relaxed card-surface"
          />

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[var(--text-muted)] font-mono font-medium">
              {lineCount} {lineCount === 1 ? 'task' : 'tasks'} detected
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={lineCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-stone-900 to-stone-800 dark:from-white dark:to-stone-100 text-white dark:text-stone-950 hover:opacity-95 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-40 active:scale-95 card-surface"
              >
                <span>Import {lineCount > 0 ? `(${lineCount})` : ''}</span>
                <CornerDownLeft size={13} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
