import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { X, Undo2 } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useTaskContext();

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-down flex items-center gap-3 px-4 py-3 bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 rounded-xl shadow-elevated border border-stone-800 dark:border-stone-200 text-sm font-medium">
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          onClick={() => {
            toast.onAction?.();
            clearToast();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-800 dark:bg-stone-200 hover:bg-stone-700 dark:hover:bg-stone-300 rounded-lg text-xs font-semibold text-amber-300 dark:text-amber-700 transition-colors"
        >
          <Undo2 size={13} />
          {toast.actionLabel}
        </button>
      )}
      <button
        onClick={clearToast}
        className="text-stone-400 hover:text-stone-200 dark:hover:text-stone-700 p-0.5 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  );
};
