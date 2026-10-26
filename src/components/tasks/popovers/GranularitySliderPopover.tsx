import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check } from 'lucide-react';
import { decomposeTask } from '../../../utils/aiCopilot';
import { SPRING_TACTILE } from '../../../utils/springPhysics';
import { audioEngine } from '../../../utils/audioEngine';
import { useMotionPreference } from '../../../hooks/useMotionPreference';

export interface GranularitySliderPopoverProps {
  taskId: string;
  taskTitle: string;
  onApplySubtasks: (
    subtasks: Array<{ id: string; title: string; completed: boolean; estimatedMinutes?: number }>
  ) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

const GRANULARITY_LABELS: Record<number, { title: string; desc: string; iconCount: number }> = {
  1: { title: 'Macro', desc: '2 high-level roadmap milestones', iconCount: 1 },
  2: { title: 'Standard', desc: '3–4 actionable subtasks', iconCount: 2 },
  3: { title: 'Detailed', desc: '5–6 focused steps', iconCount: 3 },
  4: { title: 'Atomic', desc: '7–8 bite-sized subtasks', iconCount: 4 },
  5: { title: 'Hyper-Atomic', desc: '10–12 physical starter actions (Goblin.tools style)', iconCount: 5 },
};

export const GranularitySliderPopover: React.FC<GranularitySliderPopoverProps> = ({
  taskTitle,
  onApplySubtasks,
  onClose,
  anchorRect,
}) => {
  const reduced = useMotionPreference();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [granularity, setGranularity] = useState<1 | 2 | 3 | 4 | 5>(3);

  const previewSteps = decomposeTask(taskTitle, granularity);

  const handleApply = useCallback(() => {
    const subtasks = previewSteps.map((step) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: step.title,
      completed: false,
      estimatedMinutes: step.estimatedMinutes,
    }));
    audioEngine.playTaskComplete();
    onApplySubtasks(subtasks);
    onClose();
  }, [previewSteps, onApplySubtasks, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleApply();
        return;
      }
      if (['1', '2', '3', '4', '5'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const val = Number(e.key) as 1 | 2 | 3 | 4 | 5;
        setGranularity(val);
        audioEngine.playPopSound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleApply]);

  const getPopoverStyle = (): React.CSSProperties => {
    if (!anchorRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const width = 340;
    let left = anchorRect.left;
    if (left + width > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - width - 16);
    }
    let top = anchorRect.bottom + 8;
    if (top + 400 > window.innerHeight - 16) {
      top = Math.max(16, anchorRect.top - 408);
    }
    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
    };
  };

  return (
    <AnimatePresence>
      <div
        key="granularity-backdrop"
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        key="granularity-dialog"
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label="ADHD Task Breakdown Granularity"
        style={getPopoverStyle()}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
        transition={reduced ? { duration: 0.1 } : SPRING_TACTILE}
        className="z-50 bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-2xl shadow-xl p-4 flex flex-col gap-3.5 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)]">Deconstruct Task</h3>
              <p className="text-[11px] text-[var(--text-muted)]">ADHD initiation scaffolding</p>
            </div>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.04] text-[var(--text-muted)]"
            onClick={onClose}
            aria-label="Close popover"
          >
            <X size={15} />
          </button>
        </div>

        {/* Granularity 1-5 Slider */}
        <div className="space-y-1.5 px-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <span>Granularity:</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {GRANULARITY_LABELS[granularity].title} (Level {granularity})
              </span>
            </span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {previewSteps.length} steps
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {GRANULARITY_LABELS[granularity].desc}
          </p>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={granularity}
            onChange={(e) => {
              setGranularity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5);
              audioEngine.playPopSound();
            }}
            aria-label="Granularity level 1 to 5"
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
            <span>1 Macro</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5 Atomic</span>
          </div>
        </div>

        {/* Preview of Steps */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-48 border border-[var(--border-subtle)] rounded-xl p-2.5 bg-[var(--bg-surface-l2)]/60 text-xs">
          {previewSteps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 py-0.5">
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0 w-4">
                {idx + 1}.
              </span>
              <span className="text-[var(--text-primary)] leading-tight flex-1">
                {step.title}
              </span>
              {step.estimatedMinutes && (
                <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                  {step.estimatedMinutes}m
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleApply}
          className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
        >
          <Check size={14} strokeWidth={2.5} />
          <span>Apply {previewSteps.length} Breakdown Steps</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
