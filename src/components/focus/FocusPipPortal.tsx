import { appShortcutAllowed } from '../../services/shortcutRuntime';
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, Check, ExternalLink, MoreHorizontal, RotateCcw, Sparkles } from "lucide-react";
import { pictureInPictureService } from "../../services/pictureInPictureService";
import {
  useFocusStore,
  useFocusElapsedSeconds,
} from "../../store/useFocusStore";
import { formatTimerClock, formatSecondsToHumanReadable } from "../../utils/focusTimeFormat";
import { useTaskContext } from "../../context/TaskContext";
import { useModal } from "../../context/ModalContext";

interface FocusPipHUDProps {
  onReturnToApp: () => void;
}

export const FocusPipHUD: React.FC<FocusPipHUDProps> = ({ onReturnToApp }) => {
  const {
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    resetFocusSession,
    restartFocusRound,
  } = useTaskContext();

  const focusSession = useFocusStore((s) => s.focusSession);
  const elapsed = useFocusElapsedSeconds();

  const [menuOpen, setMenuOpen] = useState(false);
  const [resetConfirming, setResetConfirming] = useState<'reset' | 'restart' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isRunning = focusSession?.state === "running";
  const isReady = focusSession?.state === "ready";

  const remainingSeconds = focusSession?.targetDurationSec
    ? (isReady
        ? focusSession.targetDurationSec
        : Math.max(0, focusSession.targetDurationSec - elapsed))
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
        : focusSession?.mode === "countdown"
          ? "Countdown"
          : "Stopwatch";

  const taskTitle = focusSession?.taskTitle || "Deep Focus Session";

  const handleToggle = () => {
    if (isRunning) {
      pauseFocusSession();
    } else {
      resumeFocusSession();
    }
  };

  const handleFinish = () => {
    stopFocusSession();
  };

  const handleTriggerReset = (type: 'reset' | 'restart') => {
    setMenuOpen(false);
    if (elapsed <= 0) {
      if (type === 'restart') {
        restartFocusRound('discard');
      } else {
        resetFocusSession('discard');
      }
      return;
    }
    // Non-zero elapsed: pause and show confirmation inside PiP
    if (isRunning) pauseFocusSession();
    setResetConfirming(type);
  };

  const handleExecuteResetChoice = (choice: 'save' | 'discard') => {
    if (resetConfirming === 'restart') {
      restartFocusRound(choice);
    } else {
      resetFocusSession(choice);
    }
    setResetConfirming(null);
  };

  const handleCancelReset = () => {
    setResetConfirming(null);
  };

  // Keyboard controls in floating window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && appShortcutAllowed(e)) {
        e.preventDefault();
        handleToggle();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (resetConfirming) {
          handleCancelReset();
        } else if (menuOpen) {
          setMenuOpen(false);
        } else {
          onReturnToApp();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Empty state
  if (!focusSession) {
    return (
      <div className="pip-container">
        <div className="pip-completion">
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pip-text-secondary)' }}>
            No active focus session
          </p>
          <button
            type="button"
            onClick={onReturnToApp}
            className="pip-btn pip-btn-primary"
            style={{ width: '100%', maxWidth: '220px' }}
          >
            <ExternalLink size={16} />
            Return to FlowTask
          </button>
        </div>
      </div>
    );
  }

  // Completed state
  if (focusSession.state === 'completed') {
    const timeSummary = formatSecondsToHumanReadable(elapsed) || `${elapsed}s`;
    return (
      <div className="pip-container">
        <div className="pip-completion">
          <div style={{ color: 'var(--pip-amber)' }}>
            <Sparkles size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--pip-text-primary)' }}>
              Session Finished!
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--pip-text-secondary)', marginTop: '4px' }}>
              {timeSummary} focused on {taskTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onReturnToApp}
            className="pip-btn pip-btn-primary"
            style={{ width: '100%', maxWidth: '220px', marginTop: '4px' }}
          >
            <ExternalLink size={16} />
            Return to FlowTask
          </button>
        </div>
      </div>
    );
  }

  // In-PiP Reset Confirmation View
  if (resetConfirming) {
    const timeFormatted = formatSecondsToHumanReadable(elapsed) || `${elapsed}s`;
    const isRestart = resetConfirming === 'restart';
    return (
      <div className="pip-container" style={{ justifyContent: 'center', textAlign: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pip-text-primary)' }}>
            {isRestart ? 'Restart Pomodoro Round?' : 'Reset Current Timer?'}
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--pip-text-secondary)' }}>
            Recorded focus: <strong style={{ color: 'var(--pip-amber)' }}>{timeFormatted}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <button
            type="button"
            onClick={() => handleExecuteResetChoice('save')}
            className="pip-btn pip-btn-primary"
            style={{ width: '100%', minHeight: '44px' }}
          >
            <RotateCcw size={15} />
            {isRestart ? 'Save time & restart' : 'Save time & reset'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleExecuteResetChoice('discard')}
              className="pip-btn pip-btn-secondary"
              style={{ flex: 1, minHeight: '44px', color: 'var(--pip-rose)' }}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleCancelReset}
              className="pip-btn pip-btn-secondary"
              style={{ flex: 1, minHeight: '44px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pip-container">
      {/* Top Header: Phase, Cycle, Task Title, Return */}
      <div className="pip-header">
        <div className="pip-header-info">
          <div className="pip-badge-row">
            <span className={`pip-status-dot ${isRunning ? 'running' : ''}`} />
            <span className="pip-phase-badge">
              {phaseLabel}
            </span>
            {focusSession.mode === 'pomodoro' && (
              <span className="pip-cycle-badge">
                · {focusSession.pomodoroCycle || 1}/{focusSession.timerConfiguration?.cyclesBeforeLongBreak || 4}
              </span>
            )}
            {focusSession.subtaskTitle && (
              <span className="pip-cycle-badge" style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                · {focusSession.subtaskTitle}
              </span>
            )}
          </div>
          <h1 className="pip-task-title" title={taskTitle}>
            {taskTitle}
          </h1>
        </div>

        <button
          type="button"
          onClick={onReturnToApp}
          title="Return to FlowTask Studio"
          aria-label="Return to FlowTask Studio"
          className="pip-icon-button"
        >
          <ExternalLink size={18} />
        </button>
      </div>

      {/* Center: Live Timer Clock */}
      <div className="pip-clock-area">
        <span
          role="timer"
          aria-live="off"
          className={`pip-clock ${isRunning ? 'running' : ''}`}
        >
          {clock}
        </span>
      </div>

      {/* Bottom Controls */}
      <div className="pip-controls">
        {/* Play / Pause Button (min 44px) */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isRunning ? "Pause focus timer" : isReady ? "Start focus timer" : "Resume focus timer"}
          className={`pip-btn pip-btn-primary ${isRunning ? 'running' : ''}`}
        >
          {isRunning ? (
            <>
              <Pause size={16} fill="currentColor" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>{isReady ? "Start" : "Resume"}</span>
            </>
          )}
        </button>

        {/* Finish Button (min 44px) */}
        <button
          type="button"
          onClick={handleFinish}
          aria-label="Finish focus session"
          title="Finish session and save time"
          className="pip-btn pip-btn-secondary"
        >
          <Check size={16} strokeWidth={2.5} />
          <span>Finish</span>
        </button>

        {/* More Menu Button (min 44px) */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More session actions"
          title="More actions"
          className="pip-icon-button"
        >
          <MoreHorizontal size={18} />
        </button>

        {/* More Menu Popover */}
        {menuOpen && (
          <div ref={menuRef} className="pip-menu-popover">
            <button
              type="button"
              onClick={() => handleTriggerReset('reset')}
              className="pip-menu-item"
            >
              <RotateCcw size={14} />
              Reset current timer
            </button>
            {focusSession.mode === 'pomodoro' && ((focusSession.pomodoroCycle ?? 1) > 1 || focusSession.pomodoroPhase !== 'focus') && (
              <button
                type="button"
                onClick={() => handleTriggerReset('restart')}
                className="pip-menu-item"
              >
                <RotateCcw size={14} />
                Restart Pomodoro round
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleFinish();
              }}
              className="pip-menu-item"
              style={{ color: 'var(--pip-amber)' }}
            >
              <Check size={14} />
              Finish session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const FocusPipPortal: React.FC = () => {
  const { openModal } = useModal();
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
        const session = useFocusStore.getState().focusSession;
        if (session?.mode === 'sprint') {
          openModal('studySprint', { taskId: session.taskId, initialMode: 'sprint' });
        } else {
          openModal('pomodoro', { taskId: session?.taskId || null });
        }
        pictureInPictureService.closePipWindow();
      }}
    />,
    pipWindow.document.body,
  );
};
