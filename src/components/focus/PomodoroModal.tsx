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
  Flame,
  Maximize2,
  Minimize2,
} from 'lucide-react';

import type { AmbientSoundType } from '../../utils/audioEngine';

interface PomodoroModalProps {
  taskId: string | null;
  onClose: () => void;
}

type Mode = 'focus' | 'short_break' | 'long_break';

export const PomodoroModal: React.FC<PomodoroModalProps> = ({ taskId, onClose }) => {
  const { tasks, toggleTaskStatus, stashActiveFocus } = useTaskContext();
  const task = tasks.find((t) => t.id === taskId);

  const [mode, setMode] = useState<Mode>('focus');
  const [focusDuration, setFocusDuration] = useState(25 * 60); // 25 mins
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('none');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cycleCount, setCycleCount] = useState<number>(1);

  const intervalRef = useRef<number | null>(null);

  // Keyboard shortcut: F to toggle Zen Fullscreen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

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

            if (mode === 'focus') {
              if (cycleCount >= 4) {
                // Completed full round of 4 cycles -> Long Break
                setCycleCount(1);
                setMode('long_break');
                setTimeLeft(15 * 60);
              } else {
                setCycleCount((c) => c + 1);
                setMode('short_break');
                setTimeLeft(5 * 60);
              }
            } else {
              // Break finished -> back to Focus
              setMode('focus');
              setTimeLeft(focusDuration);
            }
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
  }, [isRunning, mode, cycleCount, focusDuration]);

  // Ambient sound management
  useEffect(() => {
    if (isRunning && ambientSound !== 'none') {
      audioEngine.startAmbientSound(ambientSound, 0.08);
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

  const handleStash = () => {
    const elapsed = Math.max(0, currentDurationTotal - timeLeft);
    stashActiveFocus(
      task ? { id: task.id, title: task.title, projectId: task.projectId } : undefined,
      elapsed
    );
    onClose();
  };

  // Shared Mode Selector Component
  const renderModeSelector = (isZen = false) => (
    <div className={`flex justify-center gap-1.5 p-1 bg-[var(--bg-surface-l1)] rounded-2xl border border-[var(--border-subtle)] ${isZen ? 'max-w-sm' : 'max-w-xs mx-auto mb-6'}`}>
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
  );

  // Shared Ambient Sound Pills
  const renderSoundPills = () => (
    <div className="flex items-center justify-center gap-1">
      {(
        [
          { id: 'none', label: 'Off' },
          { id: 'brown', label: 'Brown' },
          { id: 'pink', label: 'Pink' },
          { id: 'white', label: 'White' },
          { id: 'rain', label: 'Rain' },
        ] as const
      ).map((snd) => (
        <button
          key={snd.id}
          type="button"
          onClick={() => setAmbientSound(snd.id)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all ${
            ambientSound === snd.id
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
          }`}
        >
          {snd.label}
        </button>
      ))}
    </div>
  );

  // Shared Cycle Counter Badges
  const renderCycleIndicators = () => (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
      <span className="font-medium">Cycle {cycleCount}/4</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((stepNum) => (
          <button
            key={stepNum}
            type="button"
            onClick={() => setCycleCount(stepNum)}
            title={`Set to cycle ${stepNum}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              stepNum < cycleCount
                ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                : stepNum === cycleCount
                ? 'bg-amber-500 ring-4 ring-amber-500/25 scale-110'
                : 'bg-stone-300 dark:bg-stone-700'
            }`}
          />
        ))}
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // ZEN FULLSCREEN MODE
  // -------------------------------------------------------------
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col justify-between p-6 sm:p-10 select-none animate-fade-in overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderCycleIndicators()}
            {task && (
              <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-200/50 dark:bg-white/[0.06] text-xs font-semibold text-[var(--text-secondary)] truncate max-w-xs">
                🎯 {task.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(false)}
              title="Exit Zen Fullscreen (F / Esc)"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <Minimize2 size={18} />
              <span className="hidden sm:inline">Exit Zen (F)</span>
            </button>
            <button
              onClick={onClose}
              title="Close Focus Mode"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Center: Massive Breathing Timer */}
        <div className="flex flex-col items-center justify-center my-auto relative">
          {/* Subtle pulsating breathing ring */}
          <div
            className={`absolute w-72 h-72 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem] rounded-full -z-10 transition-all duration-1000 ${
              isRunning
                ? 'bg-amber-500/5 dark:bg-amber-500/10 blur-3xl scale-110 animate-pulse'
                : 'bg-stone-500/5 blur-2xl scale-95 opacity-50'
            }`}
          />

          {/* Mode Switcher */}
          <div className="mb-6">{renderModeSelector(true)}</div>

          {/* Huge Clock */}
          <div
            className={`text-7xl sm:text-9xl md:text-[10rem] font-mono font-bold tracking-tighter text-[var(--text-primary)] select-none tabular-nums transition-all ${
              isRunning ? 'scale-105' : 'scale-100'
            }`}
          >
            {timeFormatted}
          </div>

          <p className="text-sm sm:text-base font-medium text-[var(--text-secondary)] mt-3">
            {mode === 'focus' ? 'Deep Work Chamber • Zero Distractions' : 'Restorative Break • Rehydrate & Breathe'}
          </p>

          {/* Progress Bar */}
          <div className="w-64 sm:w-80 md:w-96 h-2 bg-stone-200/70 dark:bg-stone-800 rounded-full mt-6 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Large Zen Controls */}
          <div className="flex items-center justify-center gap-6 mt-10">
            <button
              onClick={resetTimer}
              title="Reset Timer"
              className="p-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-2xl transition-colors"
            >
              <RotateCcw size={22} />
            </button>

            <button
              onClick={toggleTimer}
              className="w-20 h-20 rounded-3xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 flex items-center justify-center hover:scale-105 active:scale-95 shadow-2xl transition-all"
            >
              {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-1 fill-current" />}
            </button>

            <button
              onClick={() => {
                const order: AmbientSoundType[] = ['none', 'brown', 'pink', 'white', 'rain'];
                const nextIdx = (order.indexOf(ambientSound) + 1) % order.length;
                setAmbientSound(order[nextIdx]);
              }}
              title={`Ambient Soundscape: ${ambientSound === 'none' ? 'Off' : ambientSound.toUpperCase()}`}
              className={`p-4 rounded-2xl transition-all ${
                ambientSound !== 'none'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-glow-amber'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Waves size={22} />
            </button>
          </div>

          {/* Sound pills */}
          <div className="mt-6">{renderSoundPills()}</div>
        </div>

        {/* Bottom Bar: Quick Presets & Stash */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--border-hairline)]">
          {mode === 'focus' && !isRunning ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">Duration:</span>
              {[15, 25, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    setFocusDuration(mins * 60);
                    setTimeLeft(mins * 60);
                  }}
                  className={`px-3 py-1 rounded-xl font-mono text-xs transition-all ${
                    focusDuration === mins * 60
                      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">Press <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px]">F</kbd> to toggle Zen Fullscreen</div>
          )}

          {mode === 'focus' && (
            <button
              onClick={handleStash}
              title="Stash focus session & park an interruption (Alt+S)"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all shadow-xs"
            >
              <Flame size={14} />
              <span>Stash Focus & Park Interruption (Alt+S)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STANDARD POPUP MODAL
  // -------------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--bg-surface-l2)] rounded-3xl p-7 border border-[var(--border-hairline)] shadow-modal relative text-center card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Controls: Fullscreen toggle & Close Button */}
        <div className="absolute top-5 right-5 flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen(true)}
            title="Zen Fullscreen Mode (F)"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Cycle Indicators */}
        <div className="mb-4">{renderCycleIndicators()}</div>

        {/* Mode Selector */}
        {renderModeSelector(false)}

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
            onClick={() => {
              const order: AmbientSoundType[] = ['none', 'brown', 'pink', 'white', 'rain'];
              const nextIdx = (order.indexOf(ambientSound) + 1) % order.length;
              setAmbientSound(order[nextIdx]);
            }}
            title={`Ambient Soundscape: ${ambientSound === 'none' ? 'Off' : ambientSound.toUpperCase()} (Click to cycle)`}
            className={`p-3.5 rounded-2xl transition-all ${
              ambientSound !== 'none'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-glow-amber'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Waves size={18} />
          </button>
        </div>

        {/* Ambient Soundscapes Selector Pills */}
        <div className="mb-4">{renderSoundPills()}</div>

        {/* Interruption Stash Button */}
        {mode === 'focus' && (
          <div className="flex justify-center -mt-2 mb-4">
            <button
              onClick={handleStash}
              title="Stash focus session & park an interruption (Alt+S)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all shadow-xs"
            >
              <Flame size={13} />
              <span>Stash Focus & Park Interruption (Alt+S)</span>
            </button>
          </div>
        )}

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
