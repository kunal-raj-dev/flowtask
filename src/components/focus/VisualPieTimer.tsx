import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export interface VisualPieTimerProps {
  initialMinutes?: number;
  taskTitle?: string;
  onSessionComplete?: (durationMinutes: number) => void;
  className?: string;
}

export const VisualPieTimer: React.FC<VisualPieTimerProps> = ({
  initialMinutes = 25,
  taskTitle,
  onSessionComplete,
  className = '',
}) => {
  const [totalSeconds, setTotalSeconds] = useState<number>(initialMinutes * 60);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialMinutes * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isJust10Mode, setIsJust10Mode] = useState<boolean>(false);
  const [showCompletionPrompt, setShowCompletionPrompt] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // SVG Geometry
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Clockwise-emptying progress calculation
  const fractionRemaining = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - fractionRemaining);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            audioEngine.playTimerChime();
            setShowCompletionPrompt(true);
            onSessionComplete?.(Math.round(totalSeconds / 60));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, totalSeconds, onSessionComplete]);

  const toggleTimer = () => {
    setIsActive((prev) => !prev);
    audioEngine.playMagneticSnap();
  };

  const resetTimer = (newMinutes?: number) => {
    const mins = newMinutes || (isJust10Mode ? 10 : initialMinutes);
    setIsActive(false);
    setTotalSeconds(mins * 60);
    setRemainingSeconds(mins * 60);
    setShowCompletionPrompt(false);
    audioEngine.playMagneticSnap();
  };

  const launchJust10Minutes = () => {
    setIsJust10Mode(true);
    setTotalSeconds(10 * 60);
    setRemainingSeconds(10 * 60);
    setIsActive(true);
    setShowCompletionPrompt(false);
    audioEngine.playMagneticSnap();
  };

  const continueFor15More = () => {
    setIsJust10Mode(false);
    setTotalSeconds(15 * 60);
    setRemainingSeconds(15 * 60);
    setIsActive(true);
    setShowCompletionPrompt(false);
    audioEngine.playMagneticSnap();
  };

  return (
    <div
      className={`visual-pie-timer flex flex-col items-center justify-center p-6 bg-[var(--bg-surface-l1)] border border-[var(--border-color)] rounded-2xl shadow-sm text-center ${className}`}
      data-testid="visual-pie-timer"
      role="timer"
      aria-label="Visual Focus Countdown Timer"
    >
      {taskTitle && (
        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold mb-3 max-w-[200px] truncate">
          {taskTitle}
        </div>
      )}

      {/* SVG Circular Ring */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-[var(--border-color)] opacity-40"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-linear ${
              isJust10Mode ? 'text-amber-500' : 'text-[var(--color-brand)]'
            }`}
          />
        </svg>

        {/* Inner Digital Monospace Indicator */}
        <div className="absolute flex flex-col items-center justify-center">
          <span
            className="text-4xl font-extrabold font-mono tracking-tight text-[var(--text-primary)]"
            data-testid="timer-display"
          >
            {formattedTime}
          </span>
          <span className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">
            {isJust10Mode ? '⚡ Just 10m Sprint' : 'Focus Session'}
          </span>
        </div>
      </div>

      {/* Completion Modal / Gentle Check-in */}
      {showCompletionPrompt && (
        <div
          className="mt-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-950 dark:text-emerald-200 text-xs flex flex-col gap-2 animate-fadeIn"
          data-testid="completion-prompt"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>Great start! You broke the inertia.</span>
          </div>
          <p className="text-[11px] opacity-90">
            Permission to stop now, or continue for 15 more minutes while momentum is high?
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <button
              onClick={continueFor15More}
              className="px-3 py-1 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 text-xs"
            >
              +15m Momentum
            </button>
            <button
              onClick={() => resetTimer()}
              className="px-3 py-1 border border-emerald-500/40 rounded-md font-medium hover:bg-emerald-500/20 text-xs"
            >
              Take a Break
            </button>
          </div>
        </div>
      )}

      {/* Primary Controls */}
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={toggleTimer}
          aria-label={isActive ? 'Pause Timer' : 'Start Timer'}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] shadow transition-transform active:scale-95"
          data-testid="toggle-timer-button"
        >
          {isActive ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>

        <button
          onClick={() => resetTimer()}
          aria-label="Reset Timer"
          className="p-2.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-l3)] text-[var(--text-secondary)]"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* "Just 10 Minutes" Anti-Paralysis Mode Button */}
      {!isActive && !isJust10Mode && (
        <button
          onClick={launchJust10Minutes}
          className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-semibold transition-all hover:scale-105"
          data-testid="just-10-minutes-button"
        >
          <Sparkles size={14} className="text-amber-500" />
          <span>Just 10 Minutes (Low Pressure)</span>
        </button>
      )}
    </div>
  );
};
