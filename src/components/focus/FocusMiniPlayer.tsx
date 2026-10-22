import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import {
  useFocusStore,
  useFocusElapsedSeconds,
  useActiveTimerSeconds,
} from '../../store/useFocusStore';
import { useTotalFocusedTodaySeconds } from '../../hooks/useTotalFocusedTodaySeconds';
import { Play, Pause, Timer, PictureInPicture2, MoreHorizontal, RotateCcw, Check, ExternalLink } from 'lucide-react';
import {
  pictureInPictureService,
  isDocumentPipSupported,
} from '../../services/pictureInPictureService';
import { ResetConfirmationDialog } from './ResetConfirmationDialog';

interface FocusMiniPlayerProps {
  variant?: 'desktop' | 'mobile';
}

function formatStopwatch(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const FocusMiniPlayer: React.FC<FocusMiniPlayerProps> = ({ variant = 'desktop' }) => {
  const {
    tasks,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    resetFocusSession,
    restartFocusRound,
    toggleTaskTimer,
    setSelectedTaskId,
  } = useTaskContext();

  const { openModal } = useModal();

  // Granular subscriptions
  const focusSession = useFocusStore((s) => s.focusSession);
  const activeTimerTaskId = useFocusStore((s) => s.activeTimerTaskId);
  const focusElapsedSeconds = useFocusElapsedSeconds();
  const activeTimerSeconds = useActiveTimerSeconds();
  const totalFocusedTodaySeconds = useTotalFocusedTodaySeconds();

  const [menuOpen, setMenuOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isRoundRestartDialog, setIsRoundRestartDialog] = useState(false);
  const wasRunningBeforeReset = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const activeTimerTask = useMemo(
    () => (activeTimerTaskId ? tasks.find((t) => t.id === activeTimerTaskId) : null),
    [tasks, activeTimerTaskId]
  );

  const formattedFocusedToday = useMemo(() => {
    const hours = Math.floor(totalFocusedTodaySeconds / 3600);
    const mins = Math.floor((totalFocusedTodaySeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, [totalFocusedTodaySeconds]);

  const handleOpenStudio = () => {
    if (!focusSession) {
      openModal('pomodoro');
      return;
    }
    if (focusSession.mode === 'sprint') {
      openModal('studySprint', { taskId: focusSession.taskId, initialMode: 'sprint' });
    } else {
      openModal('pomodoro', { taskId: focusSession.taskId });
    }
  };

  const handleRequestReset = (type: 'reset' | 'restart') => {
    setMenuOpen(false);
    if (focusElapsedSeconds <= 0) {
      if (type === 'restart') {
        restartFocusRound('discard');
      } else {
        resetFocusSession('discard');
      }
      return;
    }
    wasRunningBeforeReset.current = focusSession?.state === 'running';
    if (focusSession?.state === 'running') {
      pauseFocusSession();
    }
    setIsRoundRestartDialog(type === 'restart');
    setResetDialogOpen(true);
  };

  const handleConfirmResetSave = () => {
    if (isRoundRestartDialog) {
      restartFocusRound('save');
    } else {
      resetFocusSession('save');
    }
    setResetDialogOpen(false);
  };

  const handleConfirmResetDiscard = () => {
    if (isRoundRestartDialog) {
      restartFocusRound('discard');
    } else {
      resetFocusSession('discard');
    }
    setResetDialogOpen(false);
  };

  const handleCancelReset = () => {
    setResetDialogOpen(false);
    if (wasRunningBeforeReset.current) {
      resumeFocusSession();
    }
  };

  // Mobile variant
  if (variant === 'mobile') {
    if (focusSession) {
      const isRunning = focusSession.state === 'running';
      const remaining = focusSession.targetDurationSec
        ? Math.max(0, focusSession.targetDurationSec - focusElapsedSeconds)
        : focusElapsedSeconds;

      return (
        <>
          {/* Mobile compact header pill */}
          <button
            type="button"
            onClick={handleOpenStudio}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 font-mono tabular-nums text-xs font-bold border border-amber-500/35 shrink-0 mr-1 active:scale-95"
            title={`Active ${focusSession.mode}: ${focusSession.taskTitle}`}
            aria-label={isRunning ? 'Open active focus studio' : 'Open paused focus studio'}
          >
            <span
              className={`w-2 h-2 rounded-full bg-amber-500 ${
                isRunning ? 'animate-pulse' : ''
              }`}
            />
            <span>{formatStopwatch(remaining)}</span>
          </button>

          <ResetConfirmationDialog
            isOpen={resetDialogOpen}
            onClose={handleCancelReset}
            onConfirmSave={handleConfirmResetSave}
            onConfirmDiscard={handleConfirmResetDiscard}
            elapsedSeconds={focusElapsedSeconds}
            taskTitle={focusSession.taskTitle}
            phase={focusSession.pomodoroPhase}
            isRoundRestart={isRoundRestartDialog}
          />
        </>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {totalFocusedTodaySeconds > 0 && (
          <button
            type="button"
            onClick={() => openModal('pomodoro')}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-mono tabular-nums text-[10px] font-bold shrink-0 active:scale-95"
            title={`Total focused today: ${formattedFocusedToday}`}
          >
            <span>🎯 {formattedFocusedToday}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => openModal('pomodoro')}
          title="Launch Focus Mode"
          aria-label="Launch Focus Mode"
          className="p-2 text-[var(--text-secondary)] hover:text-amber-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
        >
          <Timer size={18} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  // Desktop variant
  if (focusSession) {
    const isRunning = focusSession.state === 'running';
    const isReady = focusSession.state === 'ready';
    const remaining = focusSession.targetDurationSec
      ? (isReady
          ? focusSession.targetDurationSec
          : Math.max(0, focusSession.targetDurationSec - focusElapsedSeconds))
      : focusElapsedSeconds;

    return (
      <div className="relative flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-xs">
        {/* Status dot */}
        <span
          className={`w-2 h-2 rounded-full bg-amber-500 ${
            isRunning ? 'animate-pulse' : ''
          }`}
        />

        {/* Task Title -> Opens Studio */}
        <button
          type="button"
          onClick={handleOpenStudio}
          className="hover:underline truncate max-w-[160px] text-left cursor-pointer"
          title={`Focus session: "${focusSession.taskTitle}". Click to open Studio.`}
        >
          {focusSession.subtaskTitle
            ? `${focusSession.taskTitle} • ${focusSession.subtaskTitle}`
            : focusSession.taskTitle}
        </button>

        {/* Live Clock */}
        <span className="font-mono tabular-nums text-[11px] bg-amber-500/25 px-1.5 py-0.5 rounded font-bold text-amber-950 dark:text-amber-100">
          {formatStopwatch(remaining)}
        </span>

        {/* Pause / Resume button */}
        {isRunning ? (
          <button
            type="button"
            onClick={() => pauseFocusSession()}
            title="Pause Focus Session"
            aria-label="Pause Focus Session"
            className="p-1 hover:bg-amber-500/25 rounded-md transition-colors active:scale-90 cursor-pointer"
          >
            <Pause size={13} strokeWidth={2} className="fill-current text-amber-800 dark:text-amber-300" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => resumeFocusSession()}
            title={isReady ? "Start Focus Session" : "Resume Focus Session"}
            aria-label={isReady ? "Start Focus Session" : "Resume Focus Session"}
            className="p-1 hover:bg-amber-500/25 rounded-md transition-colors active:scale-90 cursor-pointer"
          >
            <Play size={13} strokeWidth={2} className="fill-current text-amber-800 dark:text-amber-300" />
          </button>
        )}

        {/* Floating HUD Window button */}
        {isDocumentPipSupported() && (
          <button
            type="button"
            onClick={() => {
              if (pictureInPictureService.isOpen()) {
                pictureInPictureService.closePipWindow();
              } else {
                void pictureInPictureService.requestPipWindow();
              }
            }}
            title="Open Floating HUD Window"
            aria-label="Open Floating HUD Window"
            className="p-1 hover:bg-amber-500/25 rounded-md transition-colors text-amber-800 dark:text-amber-300 active:scale-90 cursor-pointer"
          >
            <PictureInPicture2 size={13} strokeWidth={1.75} />
          </button>
        )}

        {/* More Actions Menu Button */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            title="More Focus Controls"
            aria-label="More Focus Controls"
            aria-expanded={menuOpen}
            className="p-1 hover:bg-amber-500/25 rounded-md transition-colors text-amber-800 dark:text-amber-300 active:scale-90 cursor-pointer"
          >
            <MoreHorizontal size={13} strokeWidth={2} />
          </button>

          {/* More Menu Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-stone-900/95 border border-white/10 shadow-xl p-1 text-stone-200 z-50 text-xs backdrop-blur-md">
              <button
                type="button"
                onClick={handleOpenStudio}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left cursor-pointer"
              >
                <ExternalLink size={13} className="text-amber-400" />
                <span>Open Studio</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestReset('reset')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left cursor-pointer"
              >
                <RotateCcw size={13} className="text-stone-400" />
                <span>Reset current timer</span>
              </button>

              {focusSession.mode === 'pomodoro' && ((focusSession.pomodoroCycle ?? 1) > 1 || focusSession.pomodoroPhase !== 'focus') && (
                <button
                  type="button"
                  onClick={() => handleRequestReset('restart')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <RotateCcw size={13} className="text-stone-400" />
                  <span>Restart round</span>
                </button>
              )}

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  stopFocusSession();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors text-left font-semibold cursor-pointer"
              >
                <Check size={13} />
                <span>Finish session</span>
              </button>
            </div>
          )}
        </div>

        <ResetConfirmationDialog
          isOpen={resetDialogOpen}
          onClose={handleCancelReset}
          onConfirmSave={handleConfirmResetSave}
          onConfirmDiscard={handleConfirmResetDiscard}
          elapsedSeconds={focusElapsedSeconds}
          taskTitle={focusSession.taskTitle}
          phase={focusSession.pomodoroPhase}
          isRoundRestart={isRoundRestartDialog}
        />
      </div>
    );
  }

  if (activeTimerTaskId && activeTimerTask) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-dashed border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold shadow-xs">
        <span className="w-2 h-2 rounded-full bg-amber-500/60" />
        <button
          type="button"
          onClick={() => setSelectedTaskId(activeTimerTaskId)}
          className="hover:underline truncate max-w-[150px]"
          title={`Focus timer paused for "${activeTimerTask.title}". Click to open.`}
        >
          {activeTimerTask.title}
        </button>
        <span className="font-mono tabular-nums text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded">
          {formatStopwatch(activeTimerSeconds)}
        </span>
        <span className="text-[9px] uppercase tracking-wider bg-amber-500/25 px-1 py-0.2 rounded text-amber-900 dark:text-amber-200">
          Paused
        </span>
        <button
          type="button"
          onClick={() => toggleTaskTimer(activeTimerTaskId)}
          title="Resume Timer"
          aria-label="Resume Timer"
          className="p-0.5 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white transition-colors active:scale-90 cursor-pointer"
        >
          <Play size={12} strokeWidth={1.75} className="fill-current" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {totalFocusedTodaySeconds > 0 && (
        <button
          type="button"
          onClick={() => openModal('pomodoro')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition-all shadow-2xs cursor-pointer"
          title={`Total focused today: ${formattedFocusedToday}. Click to open Focus Mode.`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="font-mono tabular-nums font-bold">🎯 {formattedFocusedToday} Focused</span>
        </button>
      )}
    </div>
  );
};
