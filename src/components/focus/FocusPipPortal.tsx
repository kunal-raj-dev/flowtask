import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, Square, ExternalLink } from "lucide-react";
import { pictureInPictureService } from "../../services/pictureInPictureService";
import {
  useFocusStore,
  useFocusElapsedSeconds,
} from "../../store/useFocusStore";
import { formatTimerClock } from "../../utils/focusTimeFormat";
import { useTaskContext } from "../../context/TaskContext";

interface FocusPipHUDProps {
  onReturnToApp: () => void;
}

export const FocusPipHUD: React.FC<FocusPipHUDProps> = ({ onReturnToApp }) => {
  const { pauseFocusSession, resumeFocusSession, stopFocusSession } =
    useTaskContext();
  const focusSession = useFocusStore((s) => s.focusSession);
  const elapsed = useFocusElapsedSeconds();

  const isRunning = focusSession?.state === "running";

  const remainingSeconds = focusSession?.targetDurationSec
    ? Math.max(0, focusSession.targetDurationSec - elapsed)
    : elapsed;

  const clock = formatTimerClock(remainingSeconds);

  const phaseLabel =
    focusSession?.mode === "pomodoro"
      ? focusSession.pomodoroPhase === "short_break"
        ? "Short Break"
        : focusSession.pomodoroPhase === "long_break"
          ? "Long Break"
          : "Deep Focus"
      : focusSession?.mode === "sprint"
        ? "Study Sprint"
        : "Focus";

  const taskTitle = focusSession?.taskTitle || "Deep Focus Session";

  const handleToggle = () => {
    if (isRunning) {
      pauseFocusSession();
    } else {
      resumeFocusSession();
    }
  };

  const handleStop = () => {
    stopFocusSession();
  };

  if (!focusSession) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-[var(--bg-surface-l1,#12151D)] text-[var(--text-primary,#fff)] select-none text-center">
        <p className="text-sm font-semibold text-[var(--text-secondary,#94a3b8)] mb-3">
          No active focus session
        </p>
        <button
          type="button"
          onClick={onReturnToApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors cursor-pointer"
        >
          <ExternalLink size={14} />
          Return to FlowTask
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-screen p-3 bg-[var(--bg-surface-l1,#12151D)] text-[var(--text-primary,#fff)] select-none box-border">
      {/* Top Bar: Task info and return to app */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate">
              {phaseLabel}
            </span>
            {focusSession.subtaskTitle && (
              <span className="text-[10px] text-[var(--text-muted,#64748b)] truncate">
                • {focusSession.subtaskTitle}
              </span>
            )}
          </div>
          <h1
            className="text-xs font-semibold text-[var(--text-primary,#fff)] truncate m-0"
            title={taskTitle}
          >
            {taskTitle}
          </h1>
        </div>

        <button
          type="button"
          onClick={onReturnToApp}
          title="Return to FlowTask window"
          aria-label="Return to FlowTask window"
          className="p-1 rounded-md text-[var(--text-secondary,#94a3b8)] hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Center: Live Timer Clock */}
      <div className="flex items-center justify-center my-1">
        <span
          role="timer"
          aria-live="polite"
          className="font-mono text-4xl font-extrabold tracking-tight tabular-nums text-amber-500 drop-shadow-sm"
        >
          {clock}
        </span>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-[var(--border-hairline,#1e293b)]">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={
            isRunning ? "Pause focus session" : "Resume focus session"
          }
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            isRunning
              ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
              : "bg-amber-500 text-stone-950 hover:bg-amber-600"
          }`}
        >
          {isRunning ? (
            <>
              <Pause size={12} className="fill-current" />
              Pause
            </>
          ) : (
            <>
              <Play size={12} className="fill-current" />
              Resume
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleStop}
          aria-label="Stop focus session"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition-all cursor-pointer"
        >
          <Square size={12} className="fill-current" />
          Stop
        </button>
      </div>
    </div>
  );
};

export const FocusPipPortal: React.FC = () => {
  const [pipWindow, setPipWindow] = useState<Window | null>(() =>
    pictureInPictureService.getPipWindow(),
  );

  useEffect(() => {
    const unsubscribe = pictureInPictureService.subscribe(() => {
      setPipWindow(pictureInPictureService.getPipWindow());
    });
    return () => {
      unsubscribe();
      pictureInPictureService.closePipWindow();
    };
  }, []);

  if (!pipWindow) return null;

  return createPortal(
    <FocusPipHUD
      onReturnToApp={() => {
        window.focus();
        pictureInPictureService.closePipWindow();
      }}
    />,
    pipWindow.document.body,
  );
};
