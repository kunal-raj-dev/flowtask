import { appShortcutAllowed } from '../../services/shortcutRuntime';
import React, { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, Check, ExternalLink, MoreHorizontal, RotateCcw, Sparkles, Palette, X } from "lucide-react";
import { pictureInPictureService } from "../../services/pictureInPictureService";
import {
  useFocusStore,
  useFocusElapsedSeconds,
} from "../../store/useFocusStore";
import { formatTimerClock, formatSecondsToHumanReadable } from "../../utils/focusTimeFormat";
import { useTaskContext } from "../../context/TaskContext";
import { useModal } from "../../context/ModalContext";
import { useStudioPreferences, useMediaCatalog } from '../../hooks/useStudio';
import { resolveAsset } from '../../services/studioCatalog';
import { STUDIO_THEME_IDS, studioThemeId, floatingThemeTokens } from '../../utils/studioAppearance';
import { THEMES } from '../../utils/themeRegistry';
import type { AppearancePreferences } from '../../types/studio';

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
    workspacePreferences = {},
  } = useTaskContext();
  const { preferences, update } = useStudioPreferences();
  const media = useMediaCatalog();

  const focusSession = useFocusStore((s) => s.focusSession);
  const elapsed = useFocusElapsedSeconds();

  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [resetConfirming, setResetConfirming] = useState<'reset' | 'restart' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const appearanceRef = useRef<HTMLDivElement | null>(null);
  const themeId = preferences.pipTheme === 'studio' ? preferences.interfaceTheme : studioThemeId(preferences.pipTheme);
  const isBreak = focusSession?.pomodoroPhase === 'short_break' || focusSession?.pomodoroPhase === 'long_break';
  const selectedScene = resolveAsset(isBreak ? preferences.breakSceneId || preferences.sceneId : preferences.sceneId, media.scenes);
  const highContrast = Boolean((workspacePreferences.appearance as Partial<AppearancePreferences> | undefined)?.highContrast);
  const sceneSource = (preferences.pipBackground && !highContrast && selectedScene ? selectedScene.poster || (selectedScene.kind === 'video' ? selectedScene.thumbnail : selectedScene.variants?.find(variant => variant.width >= 640)?.src || selectedScene.src) : '') || '';
  const [failedScene, setFailedScene] = useState('');
  const showScene = Boolean(sceneSource && failedScene !== sceneSource);
  const surfaceProps = {
    className: 'pip-container',
    'data-pip-theme': themeId,
    'data-pip-background': showScene ? selectedScene?.id : 'off',
    style: {
      ...floatingThemeTokens(themeId, highContrast),
      colorScheme: THEMES[themeId].scheme,
    } as CSSProperties,
  };
  const sceneBackdrop = showScene && <img className="pip-scene" src={sceneSource} alt="" aria-hidden="true" style={{ objectPosition: `${preferences.focalX}% ${preferences.focalY}%` }} onError={() => setFailedScene(sceneSource)} />;

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
    setAppearanceOpen(false);
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
        } else if (appearanceOpen) {
          setAppearanceOpen(false);
        } else {
          onReturnToApp();
        }
      }
    };
    const ownerWindow = surfaceRef.current?.ownerDocument.defaultView || window;
    ownerWindow.addEventListener('keydown', handleKeyDown);
    return () => ownerWindow.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (!menuOpen && !appearanceOpen) return;
    const ownerDocument = surfaceRef.current?.ownerDocument || document;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !appearanceRef.current?.contains(target) && !(target as Element).closest?.('[data-pip-menu-toggle]')) {
        setMenuOpen(false); setAppearanceOpen(false);
      }
    };
    ownerDocument.addEventListener('pointerdown', dismiss);
    return () => ownerDocument.removeEventListener('pointerdown', dismiss);
  }, [menuOpen, appearanceOpen]);

  // Empty state
  if (!focusSession) {
    return (
      <div ref={surfaceRef} {...surfaceProps}>
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
      <div ref={surfaceRef} {...surfaceProps}>
        {sceneBackdrop}
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
      <div ref={surfaceRef} {...surfaceProps} style={{ ...surfaceProps.style, justifyContent: 'center', textAlign: 'center', gap: '10px' }}>
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
    <div ref={surfaceRef} {...surfaceProps}>
      {sceneBackdrop}
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

        <div className="pip-header-actions">
        <button type="button" data-pip-menu-toggle aria-label="Floating timer appearance" aria-expanded={appearanceOpen} onClick={() => { setAppearanceOpen(!appearanceOpen); setMenuOpen(false); }} className="pip-icon-button" title="Theme and background"><Palette size={17} /></button>
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
      </div>

      {appearanceOpen && <div ref={appearanceRef} className="pip-appearance" role="region" aria-label="Floating timer appearance options">
        <div className="pip-appearance-heading"><strong>Make it yours</strong><button type="button" aria-label="Close floating timer appearance" onClick={() => setAppearanceOpen(false)} className="pip-icon-button"><X size={15} /></button></div>
        <button type="button" className="pip-match-studio" aria-pressed={preferences.pipTheme === 'studio'} onClick={() => update({ pipTheme: 'studio' })}>Match Studio{preferences.pipTheme === 'studio' && <Check size={13} />}</button>
        <div className="pip-theme-grid" role="group" aria-label="Floating timer themes">{STUDIO_THEME_IDS.map(id => <button type="button" key={id} aria-label={`Use ${THEMES[id].label} floating theme`} aria-pressed={preferences.pipTheme === id} onClick={() => update({ pipTheme: id })}>
          <i style={{ background: THEMES[id].tokens['--bg-main'], borderColor: THEMES[id].tokens['--color-brand'] }} aria-hidden="true" />{THEMES[id].label}
        </button>)}</div>
        <label className="pip-background-toggle"><input type="checkbox" checked={preferences.pipBackground} onChange={e => update({ pipBackground: e.target.checked })} />Studio background</label>
      </div>}

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
          aria-label={isRunning ? "Pause focus session" : isReady ? "Start focus session" : "Resume focus session"}
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
          aria-label="Stop focus session"
          title="Finish session and save time"
          className="pip-btn pip-btn-secondary"
        >
          <Check size={16} strokeWidth={2.5} />
          <span>Finish</span>
        </button>

        {/* More Menu Button (min 44px) */}
        <button
          type="button"
          onClick={() => { setMenuOpen(!menuOpen); setAppearanceOpen(false); }}
          data-pip-menu-toggle
          aria-expanded={menuOpen}
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
