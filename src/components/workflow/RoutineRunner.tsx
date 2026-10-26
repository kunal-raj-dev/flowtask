import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import type { Routine, RoutineStep } from '../../types/routine';
import { WorkspaceStoreContext } from '../../services/workspaceStore';
import { recordRoutineRun } from '../../services/lifeOrganizationService';
import {
  X,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Sun,
  Sunset,
  Coffee,
  RotateCcw,
} from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export interface RoutineRunnerProps {
  routine: Routine;
  isOpen: boolean;
  onClose: () => void;
  onCompleteRoutine?: (routineId: string) => void;
}

interface RoutineRunnerContentProps {
  routine: Routine;
  onClose: () => void;
  onCompleteRoutine?: (routineId: string) => void;
}

interface SavedRoutineState {
  routineId: string;
  stepIndex: number;
  secondsRemaining: number;
  startedAt: number;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'flowtask_active_routine_';

const RoutineRunnerContent: React.FC<RoutineRunnerContentProps> = ({
  routine,
  onClose,
  onCompleteRoutine,
}) => {
  const store = useContext(WorkspaceStoreContext);
  const steps = useMemo(() => routine.steps || [], [routine.steps]);
  const storageKey = `${STORAGE_KEY_PREFIX}${routine.id}`;

  // Check saved state for resume prompt
  const savedState = useMemo<SavedRoutineState | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.routineId === routine.id && parsed.stepIndex < steps.length) {
          return parsed;
        }
      }
    } catch {}
    return null;
  }, [storageKey, routine.id, steps.length]);

  const [hasPromptedResume, setHasPromptedResume] = useState<boolean>(() => {
    return Boolean(savedState && savedState.stepIndex > 0);
  });

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => {
    if (savedState && !hasPromptedResume) {
      return savedState.stepIndex;
    }
    return 0;
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (savedState && !hasPromptedResume) {
      return savedState.secondsRemaining;
    }
    return (routine.steps?.[0]?.durationMinutes || 2) * 60;
  });

  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const [initialStartedAt] = useState(() => savedState?.startedAt ?? Date.now());
  const routineStartedAtRef = useRef<number>(initialStartedAt);
  const targetEndTimestampRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Capture previous active element to restore focus on unmount
  useEffect(() => {
    triggerElementRef.current = document.activeElement as HTMLElement;
    containerRef.current?.focus();
    return () => {
      triggerElementRef.current?.focus?.();
    };
  }, []);

  // Escape key and focus containment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Persist execution state on change
  useEffect(() => {
    if (isFinished) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      return;
    }

    try {
      const state: SavedRoutineState = {
        routineId: routine.id,
        stepIndex: currentStepIndex,
        secondsRemaining,
        startedAt: routineStartedAtRef.current,
        timestamp: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [routine.id, storageKey, currentStepIndex, secondsRemaining, isFinished]);

  const [stepStates, setStepStates] = useState<Record<string, 'completed' | 'skipped' | 'pending'>>({});
  const currentStep: RoutineStep | undefined = steps[currentStepIndex];

  const handleNextStep = useCallback(() => {
    audioEngine.playMagneticSnap();
    const updatedStates = currentStep
      ? { ...stepStates, [currentStep.id]: 'completed' as const }
      : stepStates;
    setStepStates(updatedStates);

    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextStep = steps[nextIdx];
      const durationSec = (nextStep?.durationMinutes || 2) * 60;
      setSecondsRemaining(durationSec);
      setIsTimerRunning(false);
      targetEndTimestampRef.current = null;
    } else {
      setIsFinished(true);
      setIsTimerRunning(false);
      targetEndTimestampRef.current = null;
      audioEngine.playTaskComplete();

      // Clear storage
      try {
        localStorage.removeItem(storageKey);
      } catch {}

      // Durable RoutineRun recording with status
      if (store) {
        const completedAt = Date.now();
        const durationSec = Math.max(1, Math.round((completedAt - routineStartedAtRef.current) / 1000));
        const completedCount = Object.values(updatedStates).filter((s) => s === 'completed').length;
        recordRoutineRun(store, {
          routineId: routine.id,
          startedAt: routineStartedAtRef.current,
          completedAt,
          completedStepsCount: completedCount,
          totalStepsCount: steps.length,
          totalDurationSeconds: durationSec,
          status: 'completed',
          stepStates: updatedStates,
        });
      }

      onCompleteRoutine?.(routine.id);
    }
  }, [currentStepIndex, steps, currentStep, stepStates, routine.id, storageKey, store, onCompleteRoutine]);

  const handleSkipStep = useCallback(() => {
    audioEngine.playMagneticSnap();
    const updatedStates = currentStep
      ? { ...stepStates, [currentStep.id]: 'skipped' as const }
      : stepStates;
    setStepStates(updatedStates);

    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextStep = steps[nextIdx];
      const durationSec = (nextStep?.durationMinutes || 2) * 60;
      setSecondsRemaining(durationSec);
      setIsTimerRunning(false);
      targetEndTimestampRef.current = null;
    } else {
      setIsFinished(true);
      setIsTimerRunning(false);
      targetEndTimestampRef.current = null;
      audioEngine.playTaskComplete();

      try {
        localStorage.removeItem(storageKey);
      } catch {}

      if (store) {
        const completedAt = Date.now();
        const durationSec = Math.max(1, Math.round((completedAt - routineStartedAtRef.current) / 1000));
        const completedCount = Object.values(updatedStates).filter((s) => s === 'completed').length;
        const status = completedCount === 0 ? 'skipped' : 'partial';
        recordRoutineRun(store, {
          routineId: routine.id,
          startedAt: routineStartedAtRef.current,
          completedAt,
          completedStepsCount: completedCount,
          totalStepsCount: steps.length,
          totalDurationSeconds: durationSec,
          status,
          stepStates: updatedStates,
        });
      }

      onCompleteRoutine?.(routine.id);
    }
  }, [currentStepIndex, steps, currentStep, stepStates, routine.id, storageKey, store, onCompleteRoutine]);

  const handleSkipRoutine = useCallback(() => {
    setIsTimerRunning(false);
    targetEndTimestampRef.current = null;
    try {
      localStorage.removeItem(storageKey);
    } catch {}

    if (store) {
      const completedAt = Date.now();
      const durationSec = Math.max(1, Math.round((completedAt - routineStartedAtRef.current) / 1000));
      const completedCount = Object.values(stepStates).filter((s) => s === 'completed').length;
      const status = completedCount > 0 ? 'partial' : 'skipped';
      recordRoutineRun(store, {
        routineId: routine.id,
        startedAt: routineStartedAtRef.current,
        completedAt,
        completedStepsCount: completedCount,
        totalStepsCount: steps.length,
        totalDurationSeconds: durationSec,
        status,
        stepStates,
      });
    }

    onClose();
  }, [routine.id, storageKey, store, stepStates, steps.length, onClose]);

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      audioEngine.playMagneticSnap();
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      const prevStep = steps[prevIdx];
      const durationSec = (prevStep?.durationMinutes || 2) * 60;
      setSecondsRemaining(durationSec);
      setIsTimerRunning(false);
      targetEndTimestampRef.current = null;
    }
  };

  // Timestamp-derived timer (F18)
  useEffect(() => {
    if (!isTimerRunning) {
      targetEndTimestampRef.current = null;
      return;
    }

    if (!targetEndTimestampRef.current) {
      targetEndTimestampRef.current = Date.now() + secondsRemaining * 1000;
    }

    const tick = () => {
      if (!targetEndTimestampRef.current) return;
      const remaining = Math.max(0, Math.ceil((targetEndTimestampRef.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        targetEndTimestampRef.current = null;
        audioEngine.playTimerChime();
        handleNextStep();
      }
    };

    const interval = setInterval(tick, 500);

    // Immediate check on tab visibility change or sleep/wake recovery
    const onVisibilityChange = () => {
      if (!document.hidden && isTimerRunning) {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isTimerRunning, secondsRemaining, handleNextStep]);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getRoutineIcon = () => {
    if (routine.cadence === 'morning') return <Sun className="text-amber-500" size={20} />;
    if (routine.cadence === 'evening') return <Sunset className="text-indigo-400" size={20} />;
    return <Coffee className="text-amber-600" size={20} />;
  };

  const handleResume = () => {
    if (savedState) {
      setCurrentStepIndex(savedState.stepIndex);
      setSecondsRemaining(savedState.secondsRemaining);
      routineStartedAtRef.current = savedState.startedAt;
    }
    setHasPromptedResume(false);
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setStepStates({});
    setSecondsRemaining((steps[0]?.durationMinutes || 2) * 60);
    routineStartedAtRef.current = Date.now();
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setHasPromptedResume(false);
    setIsFinished(false);
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      data-testid="routine-runner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Paced Routine Runner"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getRoutineIcon()}
            <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">
              {routine.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resume Banner Prompt (F16) */}
        {hasPromptedResume && savedState && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fadeIn">
            <div>
              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Resume Previous Session?
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                You were on step {savedState.stepIndex + 1} ({steps[savedState.stepIndex]?.title || 'Step'}).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResume}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] min-h-[36px]"
              >
                Resume Step {savedState.stepIndex + 1}
              </button>
              <button
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs font-medium hover:bg-[var(--bg-surface-l2)] flex items-center gap-1 min-h-[36px]"
              >
                <RotateCcw size={12} />
                <span>Start from Beginning</span>
              </button>
            </div>
          </div>
        )}

        {/* Finished State */}
        {isFinished ? (
          <div
            data-testid="routine-completion-view"
            className="flex flex-col items-center justify-center py-8 text-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Routine Complete!
              </h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                You've built calm momentum for your day.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs font-semibold hover:bg-[var(--bg-surface-l2)] transition min-h-[44px] flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>Run Again</span>
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[var(--color-brand)] text-white font-medium hover:opacity-95 transition min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Active Step View */
          <>
            {/* Progress indicators */}
            <div className="flex items-center gap-1.5 w-full">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    idx < currentStepIndex
                      ? 'bg-emerald-500'
                      : idx === currentStepIndex
                        ? 'bg-[var(--color-brand)]'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                />
              ))}
            </div>

            {/* Current Step Card */}
            <div className="flex flex-col items-center text-center p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800 gap-3">
              <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <h4 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {currentStep?.title || 'Next Step'}
              </h4>

              {/* Timer Display */}
              <div className="flex items-center gap-2 mt-2 font-mono text-3xl font-semibold text-neutral-800 dark:text-neutral-200">
                <Clock size={22} className="text-neutral-400" />
                <span data-testid="routine-step-timer">{formatTimer(secondsRemaining)}</span>
              </div>

              {/* Timer Controls */}
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition min-h-[44px] ${
                  isTimerRunning
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                    : 'bg-[var(--color-brand)] text-white hover:opacity-95'
                }`}
              >
                {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
                {isTimerRunning ? 'Pause Timer' : 'Start Timer'}
              </button>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-2 gap-2">
              <button
                onClick={handlePrevStep}
                disabled={currentStepIndex === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-30 disabled:pointer-events-none transition min-h-[44px]"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="routine-skip-step-btn"
                  onClick={handleSkipStep}
                  className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-stone-800 transition min-h-[44px]"
                >
                  Skip Step
                </button>

                <button
                  data-testid="routine-next-btn"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition shadow-sm min-h-[44px]"
                >
                  {currentStepIndex === steps.length - 1 ? 'Finish Routine' : 'Complete Step'}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Skip Routine Button */}
            <div className="flex items-center justify-center pt-1">
              <button
                type="button"
                data-testid="routine-skip-routine-btn"
                onClick={handleSkipRoutine}
                className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-rose-500 transition min-h-[36px]"
              >
                Skip Routine for Today
              </button>
            </div>

            {/* Compassionate non-punitive footnote */}
            <p className="text-center text-xs text-neutral-400">
              Take your time. No streaks to break. Ready when you are.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export const RoutineRunner: React.FC<RoutineRunnerProps> = ({
  routine,
  isOpen,
  onClose,
  onCompleteRoutine,
}) => {
  if (!isOpen) return null;
  return (
    <RoutineRunnerContent
      key={`${routine.id}-${isOpen}`}
      routine={routine}
      onClose={onClose}
      onCompleteRoutine={onCompleteRoutine}
    />
  );
};
