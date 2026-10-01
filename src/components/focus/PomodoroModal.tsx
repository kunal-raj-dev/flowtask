import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { audioEngine } from '../../utils/audioEngine';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Waves,
} from 'lucide-react';

interface PomodoroModalProps {
  taskId: string | null;
  onClose: () => void;
}

type Mode = 'focus' | 'short_break' | 'long_break';

export const PomodoroModal: React.FC<PomodoroModalProps> = ({ taskId, onClose }) => {
  const { tasks, toggleTaskStatus } = useTaskContext();
  const task = tasks.find((t) => t.id === taskId);

  const [mode, setMode] = useState<Mode>('focus');
  const [focusDuration, setFocusDuration] = useState(25 * 60); // 25 mins
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [ambientSound, setAmbientSound] = useState<'none' | 'brown'>('none');

  const intervalRef = useRef<number | null>(null);

  // Switch modes
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setIsRunning(false);
    if (newMode === 'focus') {
      setTimeLeft(focusDuration);
    } else if (newMode === 'short_break') {
      setTimeLeft(5 * 60);
    } else if (newMode === 'long_break') {
      setTimeLeft(15 * 60);
    }
  };

  // Timer tick
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
            }
            setIsRunning(false);
            audioEngine.playPomodoroComplete();
            audioEngine.stopAmbientSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Ambient sound management
  useEffect(() => {
    if (isRunning && ambientSound === 'brown') {
      audioEngine.startBrownNoise(0.08);
    } else {
      audioEngine.stopAmbientSound();
    }
    return () => {
      audioEngine.stopAmbientSound();
    };
  }, [isRunning, ambientSound]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (mode === 'focus') setTimeLeft(focusDuration);
    else if (mode === 'short_break') setTimeLeft(5 * 60);
    else if (mode === 'long_break') setTimeLeft(15 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const currentDurationTotal =
    mode === 'focus' ? focusDuration : mode === 'short_break' ? 5 * 60 : 15 * 60;
  const progressPercent = Math.round(((currentDurationTotal - timeLeft) / currentDurationTotal) * 100);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--bg-surface-l2)] rounded-3xl p-7 border border-[var(--border-hairline)] shadow-modal relative text-center card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Mode Selector */}
        <div className="flex justify-center gap-1.5 p-1 bg-[var(--bg-surface-l1)] rounded-2xl mb-6 max-w-xs mx-auto border border-[var(--border-subtle)]">
          <button
            onClick={() => handleModeChange('focus')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              mode === 'focus'
                ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => handleModeChange('short_break')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              mode === 'short_break'
                ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Short Break
          </button>
          <button
            onClick={() => handleModeChange('long_break')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              mode === 'long_break'
                ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Long Break
          </button>
        </div>

        {/* Linked Task Card */}
        {task && (
          <div className="mb-6 p-3.5 bg-[var(--bg-surface-l1)]/60 rounded-2xl border border-[var(--border-hairline)] text-left flex items-center justify-between gap-3 card-surface">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Current Focus
              </span>
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {task.title}
              </p>
            </div>
            <button
              onClick={() => toggleTaskStatus(task.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all ${
                task.status === 'done'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] card-surface shadow-xs'
              }`}
            >
              <CheckCircle2 size={13} />
              {task.status === 'done' ? 'Done' : 'Mark Done'}
            </button>
          </div>
        )}

        {/* Big Countdown Display */}
        <div className="relative my-5">
          <div className="text-6xl font-mono font-bold tracking-tight text-[var(--text-primary)] select-none tabular-nums">
            {timeFormatted}
          </div>
          <div className="text-xs font-medium text-[var(--text-secondary)] mt-2">
            {mode === 'focus' ? 'Stay in the zone' : 'Take a breath and stretch'}
          </div>

          {/* Minimal Progress Bar */}
          <div className="w-52 h-1.5 bg-stone-200/70 dark:bg-stone-800 rounded-full mx-auto mt-5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300 shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-4 my-7">
          <button
            onClick={resetTimer}
            title="Reset Timer"
            className="p-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-2xl transition-colors"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={toggleTimer}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 dark:from-white dark:to-stone-200 text-white dark:text-stone-950 flex items-center justify-center hover:scale-105 active:scale-95 shadow-elevated transition-all card-surface"
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1 fill-current" />}
          </button>

          <button
            onClick={() =>
              setAmbientSound((prev) => (prev === 'brown' ? 'none' : 'brown'))
            }
            title={ambientSound === 'brown' ? 'Turn off Brown Noise' : 'Enable Brown Noise (Deep Focus)'}
            className={`p-3.5 rounded-2xl transition-all ${
              ambientSound === 'brown'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-glow-amber'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Waves size={18} />
          </button>
        </div>

        {/* Focus Duration Quick Adjust (when in focus mode and paused) */}
        {mode === 'focus' && !isRunning && (
          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-center gap-2 text-xs">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Duration:</span>
            {[15, 25, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  setFocusDuration(mins * 60);
                  setTimeLeft(mins * 60);
                }}
                className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all ${
                  focusDuration === mins * 60
                    ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
