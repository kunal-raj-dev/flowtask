import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Routine, RoutineStep } from '../../types/routine';
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

const RoutineRunnerContent: React.FC<RoutineRunnerContentProps> = ({
  routine,
  onClose,
  onCompleteRoutine,
}) => {
  const steps = useMemo(() => routine.steps || [], [routine.steps]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return (routine.steps?.[0]?.durationMinutes || 2) * 60;
  });
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const currentStep: RoutineStep | undefined = steps[currentStepIndex];

  const handleNextStep = useCallback(() => {
    audioEngine.playMagneticSnap();
    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextStep = steps[nextIdx];
      setSecondsRemaining((nextStep?.durationMinutes || 2) * 60);
      setIsTimerRunning(false);
    } else {
      setIsFinished(true);
      audioEngine.playTaskComplete();
      onCompleteRoutine?.(routine.id);
    }
  }, [currentStepIndex, steps, routine.id, onCompleteRoutine]);

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      audioEngine.playMagneticSnap();
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      const prevStep = steps[prevIdx];
      setSecondsRemaining((prevStep?.durationMinutes || 2) * 60);
      setIsTimerRunning(false);
    }
  };

  // Step countdown timer
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          audioEngine.playTimerChime();
          handleNextStep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, handleNextStep]);

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

  return (
    <div
      data-testid="routine-runner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
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
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

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
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:opacity-95 transition"
            >
              Done
            </button>
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
                        ? 'bg-primary'
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
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  isTimerRunning
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                    : 'bg-primary text-white hover:opacity-95'
                }`}
              >
                {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
                {isTimerRunning ? 'Pause Timer' : 'Start Timer'}
              </button>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePrevStep}
                disabled={currentStepIndex === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex items-center gap-2">
                <button
                  data-testid="routine-next-btn"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition shadow-sm"
                >
                  {currentStepIndex === steps.length - 1 ? 'Finish Routine' : 'Next Step'}
                  <ChevronRight size={16} />
                </button>
              </div>
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
