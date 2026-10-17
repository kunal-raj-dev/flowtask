import React, { useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import {
  useFocusStore,
  useFocusElapsedSeconds,
  useActiveTimerSeconds,
} from '../../store/useFocusStore';
import { useTotalFocusedTodaySeconds } from '../../hooks/useTotalFocusedTodaySeconds';
import { Play, Pause, X, Timer, PictureInPicture2 } from 'lucide-react';
import {
  pictureInPictureService,
  isDocumentPipSupported,
} from '../../services/pictureInPictureService';

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
    toggleTaskTimer,
    setSelectedTaskId,
  } = useTaskContext();

  const { openModal } = useModal();

  // Granular subscriptions: Only FocusMiniPlayer re-renders on the 1s timer tick
  const focusSession = useFocusStore((s) => s.focusSession);
  const activeTimerTaskId = useFocusStore((s) => s.activeTimerTaskId);
  const focusElapsedSeconds = useFocusElapsedSeconds();
  const activeTimerSeconds = useActiveTimerSeconds();
  const totalFocusedTodaySeconds = useTotalFocusedTodaySeconds();

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

  if (variant === 'mobile') {
    if (focusSession) {
      return (
        <button
          type="button"
          onClick={() => {
            if (focusSession.mode === 'sprint') {
              openModal('studySprint', { taskId: focusSession.taskId });
            } else {
              openModal('pomodoro', { taskId: focusSession.taskId });
            }
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono tabular-nums text-[10px] font-bold border border-amber-500/30 shrink-0 mr-1 active:scale-95"
          title={`Active ${focusSession.mode}: ${focusSession.taskTitle}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full bg-amber-500 ${
              ''
            }`}
          />
          <span>
            {focusSession.targetDurationSec
              ? formatStopwatch(
                  Math.max(0, focusSession.targetDurationSec - focusElapsedSeconds)
                )
              : formatStopwatch(focusElapsedSeconds)}
          </span>
        </button>
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
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-xs">
        <span
          className={`w-2 h-2 rounded-full bg-amber-500 ${
            ''
          }`}
        />
        <button
          type="button"
          onClick={() => {
            if (focusSession.mode === 'sprint') {
              openModal('studySprint', { taskId: focusSession.taskId });
            } else if (focusSession.mode === 'pomodoro') {
              openModal('pomodoro', { taskId: focusSession.taskId });
            } else if (focusSession.taskId) {
              setSelectedTaskId(focusSession.taskId);
            } else {
              openModal('pomodoro');
            }
          }}
          className="hover:underline truncate max-w-[170px]"
          title={`Focus session: "${focusSession.taskTitle}". Click to view details.`}
        >
          {focusSession.subtaskTitle
            ? `${focusSession.taskTitle} • ${focusSession.subtaskTitle}`
            : focusSession.taskTitle}
        </button>
        <span className="font-mono tabular-nums text-[11px] bg-amber-500/25 px-1.5 py-0.5 rounded font-semibold text-amber-950 dark:text-amber-100">
          {focusSession.targetDurationSec
            ? formatStopwatch(
                Math.max(0, focusSession.targetDurationSec - focusElapsedSeconds)
              )
            : formatStopwatch(focusElapsedSeconds)}
        </span>
        {focusSession.state === 'running' ? (
          <button
            type="button"
            onClick={pauseFocusSession}
            title="Pause Focus Session"
            aria-label="Pause Focus Session"
            className="p-1 hover:bg-amber-500/20 rounded-md transition-colors active:scale-90"
          >
            <Pause size={12} strokeWidth={1.75} className="fill-current text-amber-700 dark:text-amber-300" />
          </button>
        ) : (
          <button
            type="button"
            onClick={resumeFocusSession}
            title="Resume Focus Session"
            aria-label="Resume Focus Session"
            className="p-1 hover:bg-amber-500/20 rounded-md transition-colors active:scale-90"
          >
            <Play size={12} strokeWidth={1.75} className="fill-current text-amber-700 dark:text-amber-300" />
          </button>
        )}
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
            title="Floating HUD Window"
            aria-label="Floating HUD Window"
            className="p-1 hover:bg-amber-500/20 rounded-md transition-colors text-amber-700 dark:text-amber-300 active:scale-90"
          >
            <PictureInPicture2 size={12} strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          onClick={stopFocusSession}
          title="Finish / Stop Session"
          aria-label="Finish / Stop Session"
          className="p-1 hover:bg-rose-500/20 hover:text-rose-500 rounded-md transition-colors text-amber-700 dark:text-amber-300 active:scale-90"
        >
          <X size={12} strokeWidth={1.75} />
        </button>
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
          className="p-0.5 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white transition-colors active:scale-90"
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
