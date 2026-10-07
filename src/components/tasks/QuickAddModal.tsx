import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import { TaskComposer } from './TaskComposer';
import { X, Sparkles } from 'lucide-react';

export const QuickAddModal: React.FC = () => {
  const {
    isQuickAddOpen,
    setIsQuickAddOpen,
    quickAddDraft,
    setQuickAddDraft,
  } = useTaskContext();

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus containment & escape key handler
  useEffect(() => {
    if (!isQuickAddOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsQuickAddOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickAddOpen, setIsQuickAddOpen]);

  return (
    <AnimatePresence>
      {isQuickAddOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setIsQuickAddOpen(false)}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', y: 8 }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)', y: 4 }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
            className="w-full max-w-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-2xl shadow-modal p-4 sm:p-6 card-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500">
                  <Sparkles size={16} strokeWidth={1.75} />
                </div>
                <h2 id="quick-add-title" className="text-sm font-bold text-[var(--text-primary)]">
                  Quick Capture
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Close Quick Add dialog"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <TaskComposer
              initialDraft={quickAddDraft}
              onDraftChange={setQuickAddDraft}
              onSuccess={() => setIsQuickAddOpen(false)}
              isModal={true}
              autoFocus={true}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
