import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { X, Undo2 } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useTaskContext();

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 animate-slide-down flex items-center gap-3 px-4 py-3 bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 rounded-xl shadow-elevated border border-stone-800 dark:border-stone-200 text-sm font-medium"
    >
      <span className="leading-snug">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            clearToast();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 dark:text-amber-800 hover:bg-amber-500/30 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
        >
          <Undo2 size={13} />
          <span>{toast.actionLabel}</span>
          <span className="hidden sm:inline-block text-[10px] opacity-75 font-mono">(Ctrl+Z)</span>
        </button>
      )}
      <button
        type="button"
        onClick={clearToast}
        className="text-stone-400 hover:text-stone-200 dark:hover:text-stone-700 p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  );
};
