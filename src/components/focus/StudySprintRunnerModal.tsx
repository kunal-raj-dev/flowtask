import React, { useState, useEffect, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { audioEngine, type AmbientSoundType } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Waves,
  Maximize2,
  Minimize2,
  BookOpen,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { SubTask, TargetDifficulty } from '../../types/task';

interface StudySprintRunnerModalProps {
  isOpen: boolean;
  taskId: string | null;
  onClose: () => void;
}

export const StudySprintRunnerModal: React.FC<StudySprintRunnerModalProps> = ({
  isOpen,
  taskId,
  onClose,
}) => {
  const { tasks, toggleSubTask, updateTask } = useTaskContext();
  const task = taskId ? tasks.find((t) => t.id === taskId) : null;

  // Subtasks list
  const subtasks = useMemo(() => task?.subtasks || [], [task?.subtasks]);

  // Find first uncompleted subtask or default to 0
  const initialIndex = useMemo(() => {
    const firstUncompleted = subtasks.findIndex((s) => !s.completed);
    return firstUncompleted >= 0 ? firstUncompleted : 0;
  }, [subtasks]);

  const [activeSubtaskIndex, setActiveSubtaskIndex] = useState(initialIndex);
  const currentSubtask: SubTask | undefined = subtasks[activeSubtaskIndex];

  // Pacing calculations
  const targetBudgetMins = useMemo(() => {
    if (currentSubtask?.estimatedMinutes && currentSubtask.estimatedMinutes > 0) {
      return currentSubtask.estimatedMinutes;
    }
    if (task?.sessionMetadata?.targetPacingMinutes) {
      return task.sessionMetadata.targetPacingMinutes;
    }
    return 30; // fallback default: 30 mins
  }, [currentSubtask, task]);

  // Question-level timer state
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(targetBudgetMins * 60);
  const [isQuestionTimerRunning, setIsQuestionTimerRunning] = useState(false);
  const [questionElapsedSeconds, setQuestionElapsedSeconds] = useState(0);

  // Session-level timer state
  const totalSessionSeconds = useMemo(() => {
    return (task?.estimatedMinutes || 180) * 60;
  }, [task?.estimatedMinutes]);

  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(totalSessionSeconds);
  const [isSessionRunning, setIsSessionRunning] = useState(false);

  // Banked time (in seconds)
  const [bankedSeconds, setBankedSeconds] = useState(0);

  // Ambient sound state
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('none');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset question timer when switching active question
  useEffect(() => {
    setQuestionSecondsLeft(targetBudgetMins * 60);
    setQuestionElapsedSeconds(0);
    setIsQuestionTimerRunning(false);
  }, [activeSubtaskIndex, targetBudgetMins]);

  // Question timer ticker
  useEffect(() => {
    let interval: number | null = null;
    if (isQuestionTimerRunning) {
      interval = window.setInterval(() => {
        setQuestionSecondsLeft((prev) => Math.max(0, prev - 1));
        setQuestionElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval !== null) clearInterval(interval);
    };
  }, [isQuestionTimerRunning]);

  // Session timer ticker
  useEffect(() => {
    let interval: number | null = null;
    if (isSessionRunning) {
      interval = window.setInterval(() => {
        setSessionSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (interval !== null) clearInterval(interval);
    };
  }, [isSessionRunning]);

  // Fullscreen keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  if (!isOpen || !task) return null;

  const completedCount = subtasks.filter((s) => s.completed).length;
  const progressPercent = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Format Banked time
  const formatBankedTime = (seconds: number) => {
    const m = Math.round(seconds / 60);
    if (m >= 0) return `+${m}m banked`;
    return `${m}m behind pace`;
  };

  const handleToggleTimer = () => {
    const next = !isQuestionTimerRunning;
    setIsQuestionTimerRunning(next);
    setIsSessionRunning(next);
    audioEngine.playClickSound();
  };

  const handleResetTimer = () => {
    setQuestionSecondsLeft(targetBudgetMins * 60);
    setQuestionElapsedSeconds(0);
    setIsQuestionTimerRunning(false);
    audioEngine.playClickSound();
  };

  // Mark solved and advance
  const handleMarkSolvedAndNext = () => {
    if (!currentSubtask) return;

    // 1. Calculate time delta for banked budget
    const budgetSeconds = targetBudgetMins * 60;
    const surplusSeconds = budgetSeconds - questionElapsedSeconds;
    setBankedSeconds((prev) => prev + surplusSeconds);

    // 2. Mark current question completed
    if (!currentSubtask.completed) {
      toggleSubTask(task.id, currentSubtask.id);
    }

    // 3. Audio & Confetti
    audioEngine.playRuleOf3Fanfare();
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
    });

    // 4. Update task total time spent
    const minutesSpentSoFar = Math.ceil(questionElapsedSeconds / 60);
    if (minutesSpentSoFar > 0) {
      updateTask(task.id, {
        timeSpentMinutes: (task.timeSpentMinutes || 0) + minutesSpentSoFar,
      });
    }

    // 5. Advance to next uncompleted question
    const nextUncompleted = subtasks.findIndex((s, idx) => idx > activeSubtaskIndex && !s.completed);
    if (nextUncompleted >= 0) {
      setActiveSubtaskIndex(nextUncompleted);
    } else if (activeSubtaskIndex < subtasks.length - 1) {
      setActiveSubtaskIndex((prev) => prev + 1);
    }
  };

  const handleAmbientChange = (type: AmbientSoundType) => {
    setAmbientSound(type);
    audioEngine.startAmbientSound(type);
  };

  const getDifficultyBadge = (diff?: TargetDifficulty) => {
    if (diff === 'HARD') {
      return (
        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
          HARD
        </span>
      );
    }
    if (diff === 'MEDIUM') {
      return (
        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
          MEDIUM
        </span>
      );
    }
    if (diff === 'EASY') {
      return (
        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          EASY
        </span>
      );
    }
    return null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div
        className={`relative w-full bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-modal rounded-xl overflow-hidden flex flex-col transition-all ${
          isFullscreen
            ? 'h-full max-w-none rounded-none'
            : 'max-w-4xl max-h-[92vh] card-surface'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 font-mono">
                  SPRINT COCKPIT
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)] truncate max-w-md">
                  {task.title}
                </h3>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {task.scheduledStart && task.scheduledEnd
                  ? `${task.scheduledStart} – ${task.scheduledEnd} (${task.estimatedMinutes}m block)`
                  : `${task.estimatedMinutes || 180}m Focus Block`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 transition-colors"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.stopAmbientSound();
                onClose();
              }}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 transition-colors"
              title="Close Cockpit"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sprint Cockpit Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Focus Spotlight (2 cols) */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
            {/* Active Question Card */}
            {currentSubtask ? (
              <div className="p-6 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-elevated space-y-4">
                {/* Question Metadata Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Question {activeSubtaskIndex + 1} of {subtasks.length}
                      </span>
                      {getDifficultyBadge(currentSubtask.difficulty)}
                      {currentSubtask.completed && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          Solved
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight leading-snug">
                      {currentSubtask.title}
                    </h2>
                  </div>

                  {currentSubtask.url && (
                    <a
                      href={currentSubtask.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <span>Open on LeetCode</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {/* Topic Tags */}
                {currentSubtask.tags && currentSubtask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentSubtask.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Question Live Pacer Timer */}
                <div className="p-6 rounded-lg bg-stone-900 text-stone-100 dark:bg-black/50 border border-stone-800 flex flex-col items-center justify-center space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Question Target Budget ({targetBudgetMins}m)
                  </span>

                  <div className="text-5xl font-mono font-bold tracking-tight text-amber-400">
                    {formatTime(questionSecondsLeft)}
                  </div>

                  {/* Timer Controls */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      variant={isQuestionTimerRunning ? 'destructive' : 'primary'}
                      size="sm"
                      onClick={handleToggleTimer}
                      leftIcon={isQuestionTimerRunning ? <Pause size={14} /> : <Play size={14} />}
                    >
                      {isQuestionTimerRunning ? 'Pause Pacer' : 'Start Pacer'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetTimer}
                      leftIcon={<RotateCcw size={14} />}
                      className="text-stone-300 hover:text-white"
                    >
                      Reset
                    </Button>
                  </div>

                  {/* Elapsed / Pace Note */}
                  <div className="text-[11px] text-stone-400 pt-1">
                    Elapsed on this problem: {Math.floor(questionElapsedSeconds / 60)}m {questionElapsedSeconds % 60}s
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeSubtaskIndex === 0}
                      onClick={() => setActiveSubtaskIndex((prev) => Math.max(0, prev - 1))}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 disabled:opacity-40"
                      title="Previous Question"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      disabled={activeSubtaskIndex >= subtasks.length - 1}
                      onClick={() => setActiveSubtaskIndex((prev) => Math.min(subtasks.length - 1, prev + 1))}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 disabled:opacity-40"
                      title="Next Question"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <Button
                    variant="brand"
                    size="md"
                    onClick={handleMarkSolvedAndNext}
                    leftIcon={<CheckCircle2 size={16} />}
                  >
                    Mark Solved & Next Question
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No questions found in this study session.
              </div>
            )}

            {/* Ambient Noise Selector */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Waves size={15} className="text-amber-500" />
                <span className="font-semibold">Focus Soundscapes:</span>
              </div>

              <div className="flex items-center gap-1.5">
                {(['none', 'rain', 'pink', 'brown', 'white'] as AmbientSoundType[]).map((snd) => (
                  <button
                    key={snd}
                    type="button"
                    onClick={() => handleAmbientChange(snd)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                      ambientSound === snd
                        ? 'bg-[var(--color-brand)] text-white shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10'
                    }`}
                  >
                    {snd === 'none' ? 'Mute' : snd}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Session Overview & Question Queue (1 col) */}
          <div className="space-y-4">
            {/* Session Stats Card */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Session Performance
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Remaining: <strong className="text-[var(--text-primary)]">{formatTime(sessionSecondsLeft)}</strong>
                </span>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span>Progress</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    {completedCount} / {subtasks.length} solved ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Banked Time & Pacing */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-hairline)] text-center">
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Target Pace
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                    ⚡ {targetBudgetMins}m / Q
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Pace Budget
                  </span>
                  <span
                    className={`text-sm font-bold font-mono ${
                      bankedSeconds >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatBankedTime(bankedSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Questions Queue */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex-1 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Questions Queue ({subtasks.length})
              </span>

              <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
                {subtasks.map((sub, idx) => {
                  const isActive = idx === activeSubtaskIndex;
                  return (
                    <div
                      key={sub.id}
                      onClick={() => setActiveSubtaskIndex(idx)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isActive
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubTask(task.id, sub.id);
                          }}
                          className={`w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors shrink-0 ${
                            sub.completed
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'border-stone-400 dark:border-stone-600 hover:border-amber-500'
                          }`}
                        >
                          {sub.completed && <CheckCircle2 size={12} />}
                        </button>

                        <span
                          className={`text-xs truncate ${
                            sub.completed
                              ? 'line-through text-[var(--text-muted)]'
                              : isActive
                              ? 'font-bold text-[var(--text-primary)]'
                              : 'font-medium text-[var(--text-primary)]'
                          }`}
                        >
                          {sub.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getDifficultyBadge(sub.difficulty)}
                        {sub.url && (
                          <a
                            href={sub.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
