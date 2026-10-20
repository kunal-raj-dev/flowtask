import React, { useRef, useEffect, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FeatureBoundary } from '../ui/FeatureBoundary';
import { ViewSkeleton } from '../ui';
import { Share2, X } from 'lucide-react';
import type { SnapshotPayload } from '../../utils/snapshotShare';

export interface ViewContainerProps {
  activeView: string;
  viewTitle: string;
  onBackToToday: () => void;
  pendingSnapshot: SnapshotPayload | null;
  onImportSnapshot: (snapshot: SnapshotPayload) => void;
  onDismissSnapshot: () => void;
  children: React.ReactNode;
}

export const ViewContainer: React.FC<ViewContainerProps> = ({
  activeView,
  viewTitle,
  onBackToToday,
  pendingSnapshot,
  onImportSnapshot,
  onDismissSnapshot,
  children,
}) => {
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Reset viewport scroll to top on activeView transition
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeView]);

  return (
    <div
      ref={mainScrollRef}
      className="desk-view-host flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
    >
      {/* Incoming Shared Task Snapshot Banner */}
      {pendingSnapshot && (
        <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-teal-500/15 to-emerald-500/15 border border-indigo-500/30 shadow-card card-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Share2 size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                Shared Task Snapshot: "{pendingSnapshot.title}"
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Contains {pendingSnapshot.tasks.length} task{pendingSnapshot.tasks.length === 1 ? '' : 's'} shared via zero-auth client link.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => onImportSnapshot(pendingSnapshot)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <span>Import {pendingSnapshot.tasks.length} Tasks</span>
            </button>
            <button
              type="button"
              onClick={onDismissSnapshot}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06]"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <FeatureBoundary key={activeView} title={viewTitle} onBack={onBackToToday}>
        <Suspense fallback={<ViewSkeleton title={`Loading ${viewTitle}…`} />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="desk-view h-full flex flex-col"
              data-workspace-view={activeView}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </FeatureBoundary>
    </div>
  );
};
