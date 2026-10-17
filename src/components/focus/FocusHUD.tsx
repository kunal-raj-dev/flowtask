import React, { useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import {
  useFocusStore,
  useFocusElapsedSeconds,
} from '../../store/useFocusStore';
import { Play, Pause, Square, Check, PictureInPicture2, Sparkles } from 'lucide-react';
import { pictureInPictureService, isDocumentPipSupported } from '../../services/pictureInPictureService';
import { formatTimerClock } from '../../utils/focusTimeFormat';
import { FocusTimerRing } from '../ui/FocusTimerRing';

export interface FocusHUDProps {
  className?: string;
  onOpenStudio?: () => void;
  compact?: boolean;
}

export const FocusHUD: React.FC<FocusHUDProps> = ({
  className = '',
  onOpenStudio,
  compact = false,
}) => {
  const {
    tasks,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    toggleTaskStatus,
  } = useTaskContext();

  const focusSession = useFocusStore((s) => s.focusSession);
  const elapsed = useFocusElapsedSeconds();

  const sessionTaskId = focusSession?.taskId;
  const activeTask = useMemo(
    () => (sessionTaskId ? tasks.find((t) => t.id === sessionTaskId) : null),
    [tasks, sessionTaskId]
  );

  if (!focusSession) return null;

  const isRunning = focusSession.state === 'running';
  const targetSec = focusSession.targetDurationSec || 0;
  const remainingSec = targetSec > 0 ? Math.max(0, targetSec - elapsed) : elapsed;
  const progressPercent = targetSec > 0 ? Math.min(100, Math.round((elapsed / targetSec) * 100)) : 100;
  const clockDisplay = formatTimerClock(remainingSec);

  const handleTogglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      pauseFocusSession();
    } else {
      resumeFocusSession();
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopFocusSession();
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (focusSession.taskId) {
      toggleTaskStatus(focusSession.taskId);
    }
    stopFocusSession();
  };

  const handleTogglePip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pictureInPictureService.isOpen()) {
      pictureInPictureService.closePipWindow();
    } else if (pictureInPictureService.isSupported()) {
      await pictureInPictureService.requestPipWindow({ width: 340, height: 220 }).catch(() => {});
    }
  };

  if (compact) {
    return (
      <div
        data-testid="focus-hud-compact"
        onClick={onOpenStudio}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-[var(--text-primary)] cursor-pointer hover:bg-amber-500/20 transition-all select-none ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-mono font-bold text-xs tabular-nums text-amber-700 dark:text-amber-300">
          {clockDisplay}
        </span>
        <span className="text-xs font-semibold truncate max-w-[140px]">
          {activeTask?.title || focusSession.taskTitle || 'Focus Session'}
        </span>
        <button
          type="button"
          onClick={handleTogglePlayPause}
          className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
          title={isRunning ? 'Pause' : 'Resume'}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="focus-hud-card"
      onClick={onOpenStudio}
      className={`p-4 rounded-2xl bg-white dark:bg-[var(--bg-surface-l2)] border border-amber-500/30 shadow-card card-surface flex items-center justify-between gap-4 cursor-pointer hover:border-amber-500/50 transition-all ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Progress Ring / Icon */}
        <FocusTimerRing progressPercent={progressPercent} size={44} strokeWidth={3.5}>
          <Sparkles size={14} className="text-amber-500" />
        </FocusTimerRing>

        {/* Task Details & Phase */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
              {focusSession.pomodoroPhase === 'short_break' || focusSession.pomodoroPhase === 'long_break' ? 'Break' : 'Focus'}
            </span>
            {focusSession.mode === 'sprint' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Sprint
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5 max-w-[200px] sm:max-w-[320px]">
            {activeTask?.title || focusSession.taskTitle || 'Deep Work Session'}
          </p>
        </div>
      </div>

      {/* Timer Clock & Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-lg font-black tabular-nums text-amber-600 dark:text-amber-400 mr-2">
          {clockDisplay}
        </span>

        <button
          type="button"
          onClick={handleTogglePlayPause}
          title={isRunning ? 'Pause' : 'Resume'}
          className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-all shadow-subtle active:scale-95"
        >
          {isRunning ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={handleComplete}
          title="Complete Task and Finish Session"
          className="w-8 h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-all border border-emerald-500/30 active:scale-95"
        >
          <Check size={14} strokeWidth={2.5} />
        </button>

        {isDocumentPipSupported() && (
          <button
            type="button"
            onClick={handleTogglePip}
            title={pictureInPictureService.isOpen() ? 'Close Floating Mini-Window' : 'Pop out into Floating Mini-Window'}
            className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center transition-all active:scale-95"
          >
            <PictureInPicture2 size={13} />
          </button>
        )}

        <button
          type="button"
          onClick={handleStop}
          title="Stop Session"
          className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-rose-500/20 hover:text-rose-600 text-stone-400 flex items-center justify-center transition-all active:scale-95"
        >
          <Square size={12} />
        </button>
      </div>
    </div>
  );
};
