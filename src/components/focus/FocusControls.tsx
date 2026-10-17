import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { TimerConfiguration } from '../../types/studio';
import type { FinishedStudioSession } from '../../services/studioSessionEngine';

export type Phase = 'focus' | 'short_break' | 'long_break';

export interface FocusControlsProps {
  currentPhase: Phase;
  running: boolean;
  hasActiveSession: boolean;
  timer: TimerConfiguration;
  minutes: number;
  activeCycle?: number;
  lastFinishedSession?: FinishedStudioSession | null;
  onSelectPhase: (phase: Phase) => void;
  onTogglePlayPause: () => void;
  onReset: () => void;
}

export const FocusControls: React.FC<FocusControlsProps> = ({
  currentPhase,
  running,
  hasActiveSession,
  timer,
  minutes,
  activeCycle = 1,
  lastFinishedSession,
  onSelectPhase,
  onTogglePlayPause,
  onReset,
}) => {
  return (
    <>
      <div className="studio-mode-switch" aria-label="Session phase">
        {(['focus', 'short_break', 'long_break'] as Phase[]).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={currentPhase === mode}
            onClick={() => onSelectPhase(mode)}
          >
            {mode === 'focus'
              ? 'Focus'
              : mode === 'short_break'
              ? 'Short break'
              : 'Long break'}
          </button>
        ))}
      </div>

      <p className="studio-session-label">
        {timer.mode === 'stopwatch' && currentPhase === 'focus'
          ? 'Open-ended · your pace, your space'
          : `${minutes} minutes ${
              currentPhase === 'focus' ? 'of intention' : 'to recharge'
            } · ${
              timer.mode === 'pomodoro'
                ? `session ${activeCycle || lastFinishedSession?.nextCycle || 1} of ${timer.cyclesBeforeLongBreak}`
                : 'make it yours'
            }`}
      </p>

      <div className="studio-playback">
        <button
          type="button"
          className="studio-round"
          onClick={onReset}
          aria-label="Reset session"
        >
          <RotateCcw size={19} />
        </button>
        <button
          type="button"
          className="studio-start"
          onClick={onTogglePlayPause}
        >
          {running ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
          <span>{running ? 'Pause' : hasActiveSession ? 'Resume' : 'Start focus'}</span>
        </button>
      </div>
    </>
  );
};
