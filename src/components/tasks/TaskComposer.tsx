import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput } from '../../utils/nlpParser';
import { useTodayStr } from '../../hooks/useCurrentDate';
import type { Priority, RecurrenceFrequency } from '../../types/task';
import { findPotentialDuplicates } from '../../utils/duplicateDetector';
import {
  createVoiceDictationSession,
  isVoiceDictationSupported,
  type VoiceDictationSession,
} from '../../utils/voiceDictationService';
import { audioEngine } from '../../utils/audioEngine';
import {
  Plus,
  Calendar,
  Clock,
  Flag,
  Folder,
  Sparkles,
  Mic,
  MicOff,
  AlertCircle,
  Repeat,
  X,
  ListPlus,
  Timer,
} from 'lucide-react';
import { parseTimeToMinutes, minutesToTimeStr } from '../../utils/timelineUtils';
import { Kbd } from '../ui';

interface TaskComposerProps {
  initialDraft?: string;
  onDraftChange?: (val: string) => void;
  onSuccess?: () => void;
  isModal?: boolean;
  autoFocus?: boolean;
}

export const TaskComposer: React.FC<TaskComposerProps> = ({
  initialDraft = '',
  onDraftChange,
  onSuccess,
  isModal = false,
  autoFocus = false,
}) => {
  const {
    tasks,
    projects,
    activeView,
    addTask,
    addMultipleTasks,
    showToast,
    setIsTemplatePickerOpen,
  } = useTaskContext();

  const [input, setInput] = useState(initialDraft);
  const [showDetails, setShowDetails] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Manual Chip Overrides (Explicit selection overrides parsed values)
  const [explicitProjectId, setExplicitProjectId] = useState<string | null>(null);
  const [explicitPlannedDate, setExplicitPlannedDate] = useState<string | null>(null);
  const [explicitDueDate, setExplicitDueDate] = useState<string | null>(null);
  const [explicitPriority, setExplicitPriority] = useState<Priority | null>(null);
  const [explicitDuration, setExplicitDuration] = useState<number | null>(null);
  const [explicitRecurrence, setExplicitRecurrence] = useState<RecurrenceFrequency | null>(null);

  // Voice dictation
  const [isListening, setIsListening] = useState(false);
  const sessionRef = useRef<VoiceDictationSession | null>(null);
  const isSpeechSupported = isVoiceDictationSupported();

  const todayStr = useTodayStr();

  // Session Generator State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState('08:00');
  const [sessionEndTime, setSessionEndTime] = useState('11:00');
  const [customSessionNumber, setCustomSessionNumber] = useState<number | null>(null);

  // Compute next available session number for today
  const defaultSessionNum = React.useMemo(() => {
    const todaySessions = tasks.filter(
      (t) => (t.plannedDate === todayStr || t.dueDate === todayStr) && t.sessionMetadata?.isSession
    );
    const nums = todaySessions.map((t) => t.sessionMetadata?.sessionNumber || 1);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [tasks, todayStr]);

  const activeSessionNum = customSessionNumber ?? defaultSessionNum;

  // Compute live duration
  const sessionDuration = React.useMemo(() => {
    const startMin = parseTimeToMinutes(sessionStartTime);
    const endMin = parseTimeToMinutes(sessionEndTime);
    if (startMin === null || endMin === null) return { minutes: 180, formatted: '3h (180m)' };
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const formatted = h > 0 ? (m > 0 ? `${h}h ${m}m (${diff}m)` : `${h}h (${diff}m)`) : `${m}m`;
    return { minutes: diff, formatted };
  }, [sessionStartTime, sessionEndTime]);

  // Default context resolution
  const defaultProjectId = activeView.startsWith('project:') ? activeView.split(':')[1] : 'inbox';
  const defaultPlannedDate = activeView === 'today' ? todayStr : undefined;

  // Sync draft change to parent
  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (onDraftChange) onDraftChange(val);
  }, [onDraftChange]);

  useEffect(() => {
    if (autoFocus) {
      if (isMultiline) textareaRef.current?.focus();
      else inputRef.current?.focus();
    }
  }, [autoFocus, isMultiline]);

  // NLP Parse
  const parsed = parseTaskInput(input);

  // Effective values: Explicit override > Parsed token > Context default
  const effectiveProjectId = explicitProjectId || parsed.projectTag || defaultProjectId;
  const projectObj = projects.find((p) => p.id === effectiveProjectId || p.name.toLowerCase() === effectiveProjectId.toLowerCase()) || projects.find(p => p.id === 'inbox') || { id: 'inbox', name: 'Inbox', color: '#64748B' };

  // If user didn't specify explicit plannedDate, but specified a dueDate that is not today,
  // do not fallback plannedDate to todayStr so the task isn't forced into today's list.
  const resolvedDefaultPlannedDate = (parsed.dueDate && parsed.dueDate !== todayStr) ? undefined : defaultPlannedDate;
  const effectivePlannedDate = explicitPlannedDate !== null ? explicitPlannedDate : (parsed.plannedDate || resolvedDefaultPlannedDate);
  const effectiveDueDate = explicitDueDate !== null ? explicitDueDate : parsed.dueDate;
  const effectivePriority = explicitPriority || parsed.priority || 'p4';
  const effectiveDuration = explicitDuration !== null ? explicitDuration : parsed.estimatedMinutes;
  const effectiveRecurrence = explicitRecurrence || parsed.recurrence || 'none';

  // Duplicate detection preview
  const duplicateCandidates = React.useMemo(() => {
    if (!input.trim() || input.trim().length < 3 || isMultiline) return [];
    return findPotentialDuplicates(
      {
        id: 'draft',
        title: parsed.cleanTitle || input,
        status: 'todo',
        priority: effectivePriority,
        projectId: projectObj.id,
        createdAt: 0,
        subtasks: [],
      },
      tasks
    );
  }, [input, parsed.cleanTitle, effectivePriority, projectObj.id, tasks, isMultiline]);

  const hasDuplicateWarning = duplicateCandidates.length > 0;

  // Toggle Voice Input
  const toggleVoiceInput = useCallback(() => {
    if (!isSpeechSupported) {
      showToast('Voice dictation is not supported in this browser.');
      return;
    }

    if (isListening) {
      sessionRef.current?.stop();
      setIsListening(false);
      audioEngine.playClickSound();
      return;
    }

    const session = createVoiceDictationSession({
      onStart: () => {
        setIsListening(true);
        audioEngine.playClickSound();
      },
      onTranscript: (transcript) => {
        handleInputChange(transcript);
      },
      onError: (msg) => {
        setIsListening(false);
        showToast(msg);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    sessionRef.current = session;
    const started = session.start();
    if (!started) {
      setIsListening(false);
      showToast('Could not access microphone.');
    }
  }, [isSpeechSupported, isListening, showToast, handleInputChange]);

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
    };
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    if (isMultiline) {
      const lines = input.split('\n').filter((l) => l.trim().length > 0);
      addMultipleTasks(lines);
    } else {
      addTask(parsed.cleanTitle || input, {
        projectId: projectObj.id,
        dueTime: isSessionActive ? sessionEndTime : parsed.dueTime,
        scheduledStart: isSessionActive ? sessionStartTime : undefined,
        scheduledEnd: isSessionActive ? sessionEndTime : undefined,
        tags: parsed.tags,
        contextTags: parsed.contextTags,
        customRecurrence: parsed.customRecurrence,
        plannedDate: isSessionActive ? (effectivePlannedDate || todayStr) : effectivePlannedDate,
        dueDate: effectiveDueDate,
        priority: effectivePriority,
        estimatedMinutes: isSessionActive ? sessionDuration.minutes : effectiveDuration,
        recurrence: effectiveRecurrence,
        sessionMetadata: isSessionActive
          ? {
              isSession: true,
              sessionNumber: activeSessionNum,
              sessionTopic: parsed.cleanTitle || input,
            }
          : undefined,
      });
    }

    setInput('');
    if (onDraftChange) onDraftChange('');
    // Reset date/priority/duration/recurrence/session chips
    // Keep explicitProjectId sticky across submissions until user explicitly changes it
    setExplicitPlannedDate(null);
    setExplicitDueDate(null);
    setExplicitPriority(null);
    setExplicitDuration(null);
    setExplicitRecurrence(null);
    setIsSessionActive(false);
    setCustomSessionNumber(null);

    if (onSuccess) onSuccess();
  };

  const getPriorityStyle = (p: Priority) => {
    switch (p) {
      case 'p1': return 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-400/40';
      case 'p2': return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/40';
      case 'p3': return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-400/40';
      case 'p4': return 'bg-stone-500/15 text-stone-800 dark:text-stone-300 border-stone-400/40';
    }
  };

  return (
    <div className={`w-full ${isModal ? '' : 'mb-6'}`}>
      <form
        onSubmit={handleSubmit}
        className={`relative rounded-2xl transition-all duration-200 border ${
          isFocused
            ? 'bg-[var(--bg-surface-l2)] border-amber-500/70 shadow-elevated ring-2 ring-amber-500/20'
            : 'bg-[var(--bg-surface-l1)] border-[var(--border-subtle)] shadow-subtle hover:border-[var(--border-hairline)]'
        }`}
      >
        <div className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3">
            <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
              <div className="text-[var(--text-muted)] mt-1 flex-shrink-0">
                <Plus size={18} className={isFocused ? 'text-amber-500 dark:text-amber-400' : ''} />
              </div>

              <div className="flex-1 min-w-0">
                {isMultiline ? (
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    rows={4}
                    placeholder="Paste multi-line notes, meeting takeaways, or study topics..."
                    className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus-visible:outline-none outline-none resize-none font-sans"
                  />
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="What needs to be done? (e.g. 'Draft report tomorrow #work p1 ~30m')"
                    className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus-visible:outline-none outline-none font-sans"
                  />
                )}
              </div>
            </div>

            {/* Actions: on mobile sits as an ergonomic bottom dock; on desktop sits inline */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t border-[var(--border-hairline)] sm:border-t-0 shrink-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title={isListening ? 'Stop Voice Input' : 'Voice Dictation'}
                    className={`p-2 rounded-xl transition-colors ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsMultiline((prev) => !prev)}
                  title={isMultiline ? 'Switch to Single Task mode' : 'Switch to Multi-line Brain Dump'}
                  className={`p-2 rounded-xl transition-colors ${
                    isMultiline
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <ListPlus size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsTemplatePickerOpen(true)}
                  title="Browse Templates"
                  className="p-2 text-[var(--text-muted)] hover:text-indigo-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Sparkles size={16} />
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-l2)] cursor-pointer"
                  aria-expanded={showDetails}
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <span>{showDetails ? '▾ Hide properties' : '▸ Set properties'}</span>
                  {!showDetails && (parsed.dueDate || parsed.priority || parsed.estimatedMinutes || parsed.projectTag) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Parsed tags available" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                aria-label="Add"
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-35 disabled:active:scale-100 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500/50 outline-none"
              >
                <span>Add</span>
                <Kbd size="xs" className="hidden sm:inline-block text-[10px] py-0 px-1 border-white/20 bg-black/20 text-white shadow-none">↵</Kbd>
              </button>
            </div>
          </div>

          {/* Editable Chips Bar (Only in Single Task mode) */}
          {!isMultiline && showDetails && (
            <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 mt-3 pt-2.5 border-t border-[var(--border-hairline)] text-xs py-1">
                  {/* Project Chip */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    <Folder size={12} style={{ color: projectObj.color }} />
                    <select aria-label="Project"
                      value={projectObj.id}
                      onChange={(e) => setExplicitProjectId(e.target.value)}
                      className="bg-transparent font-medium cursor-pointer focus:outline-none focus-visible:outline-none outline-none text-[11px]"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[var(--bg-surface-l1)] text-[var(--text-primary)]">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Planned Date Chip */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    <Calendar size={12} className="text-amber-500" />
                    <span className="text-[11px]">Plan:</span>
                    <input
                      aria-label="Planned date"
                      type="date"
                      value={effectivePlannedDate || ''}
                      onChange={(e) => setExplicitPlannedDate(e.target.value || null)}
                      className="bg-transparent font-medium cursor-pointer focus:outline-none focus-visible:outline-none outline-none text-[11px]"
                    />
                    {effectivePlannedDate && (
                      <button
                        type="button"
                        onClick={() => setExplicitPlannedDate('')}
                        className="hover:text-rose-500 ml-0.5"
                        title="Clear planned date"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Due Date (Deadline) Chip */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    <Clock size={12} className="text-purple-500" />
                    <span className="text-[11px]">Due:</span>
                    <input
                      aria-label="Deadline"
                      type="date"
                      value={effectiveDueDate || ''}
                      onChange={(e) => setExplicitDueDate(e.target.value || null)}
                      className="bg-transparent font-medium cursor-pointer focus:outline-none focus-visible:outline-none outline-none text-[11px]"
                    />
                    {effectiveDueDate && (
                      <button
                        type="button"
                        onClick={() => setExplicitDueDate('')}
                        className="hover:text-rose-500 ml-0.5"
                        title="Clear deadline"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Priority Chip */}
                  <button
                    type="button"
                    onClick={() => {
                      const cycle: Priority[] = ['p4', 'p3', 'p2', 'p1'];
                      const next = cycle[(cycle.indexOf(effectivePriority) + 1) % cycle.length];
                      setExplicitPriority(next);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-[11px] transition-colors ${getPriorityStyle(
                      effectivePriority
                    )}`}
                    title="Click to cycle priority"
                  >
                    <Flag size={11} />
                    <span>{effectivePriority.toUpperCase()}</span>
                  </button>

                  {/* Duration Chip */}
                  <button
                    type="button"
                    onClick={() => {
                      const times = [15, 30, 45, 60, 90, null];
                      const next = times[(times.indexOf(effectiveDuration ?? null) + 1) % times.length];
                      setExplicitDuration(next);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px]"
                    title="Click to cycle estimated duration"
                  >
                    <Sparkles size={11} className="text-teal-500" />
                    <span>{effectiveDuration ? `~${effectiveDuration}m` : 'Estimate'}</span>
                  </button>

                  {/* Recurrence Chip */}
                  <button
                    type="button"
                    onClick={() => {
                      const freqs: RecurrenceFrequency[] = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];
                      const next = freqs[(freqs.indexOf(effectiveRecurrence) + 1) % freqs.length];
                      setExplicitRecurrence(next);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] cursor-pointer"
                    title="Click to cycle recurrence"
                  >
                    <Repeat size={11} className="text-indigo-500" />
                    <span>{effectiveRecurrence !== 'none' ? effectiveRecurrence : 'Repeat'}</span>
                  </button>

                  {/* Session Chip */}
                  <button
                    type="button"
                    onClick={() => setIsSessionActive((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                      isSessionActive
                        ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30 font-semibold'
                        : 'bg-[var(--bg-surface-l2)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={isSessionActive ? 'Click to toggle session off' : 'Click to configure custom session duration & timeline block'}
                  >
                    <Timer size={11} className={isSessionActive ? 'text-teal-500' : ''} />
                    <span>
                      {isSessionActive
                        ? `Session ${activeSessionNum} (${sessionStartTime}–${sessionEndTime})`
                        : '+ Session'}
                    </span>
                    {isSessionActive && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSessionActive(false);
                        }}
                        className="ml-0.5 hover:text-rose-500 cursor-pointer"
                        title="Remove session"
                      >
                        <X size={10} />
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Session Duration Generator Card */}
              {!isMultiline && showDetails && isSessionActive && (
                <div className="mt-2.5 p-3 rounded-xl bg-teal-500/[0.07] dark:bg-teal-500/[0.1] border border-teal-500/25 space-y-2.5 animate-slide-down">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                      <Timer size={14} className="text-teal-600 dark:text-teal-400" />
                      <span>Session Duration Generator</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30">
                        Session #{activeSessionNum}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 dark:text-teal-200 border border-teal-500/30">
                        {sessionDuration.formatted}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSessionActive(false)}
                        className="text-[11px] text-[var(--text-muted)] hover:text-rose-500 p-0.5 rounded cursor-pointer"
                        title="Remove session"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {/* Session Number */}
                    <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
                      <span className="text-[11px] text-[var(--text-secondary)]">Session:</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        aria-label="Session number"
                        value={activeSessionNum}
                        onChange={(e) => setCustomSessionNumber(parseInt(e.target.value, 10) || 1)}
                        className="w-12 bg-transparent text-[var(--text-primary)] font-bold outline-none text-center"
                      />
                    </div>

                    {/* Start Time */}
                    <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
                      <span className="text-[11px] text-[var(--text-secondary)]">Start:</span>
                      <input
                        type="time"
                        aria-label="Session start time"
                        value={sessionStartTime}
                        onChange={(e) => setSessionStartTime(e.target.value)}
                        className="bg-transparent text-[var(--text-primary)] font-mono font-medium outline-none cursor-pointer"
                      />
                    </div>

                    {/* End Time */}
                    <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
                      <span className="text-[11px] text-[var(--text-secondary)]">End:</span>
                      <input
                        type="time"
                        aria-label="Session end time"
                        value={sessionEndTime}
                        onChange={(e) => setSessionEndTime(e.target.value)}
                        className="bg-transparent text-[var(--text-primary)] font-mono font-medium outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Presets Row */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-teal-500/15">
                    <span className="text-[10px] font-semibold text-teal-800 dark:text-teal-300 mr-1">Quick Slots:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionStartTime('08:00');
                        setSessionEndTime('11:00');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      Morning 08:00–11:00 (3h)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionStartTime('11:30');
                        setSessionEndTime('14:00');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      Midday 11:30–14:00 (2.5h)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionStartTime('14:30');
                        setSessionEndTime('17:30');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      Afternoon 14:30–17:30 (3h)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionStartTime('18:00');
                        setSessionEndTime('21:00');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      Evening 18:00–21:00 (3h)
                    </button>
                    <span className="text-[10px] text-teal-800/60 dark:text-teal-300/60 mx-1">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const startMin = parseTimeToMinutes(sessionStartTime) || 480;
                        setSessionEndTime(minutesToTimeStr((startMin + 60) % 1440));
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      +1h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const startMin = parseTimeToMinutes(sessionStartTime) || 480;
                        setSessionEndTime(minutesToTimeStr((startMin + 120) % 1440));
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      +2h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const startMin = parseTimeToMinutes(sessionStartTime) || 480;
                        setSessionEndTime(minutesToTimeStr((startMin + 180) % 1440));
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
                    >
                      +3h
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate Warning Prompt */}
              {hasDuplicateWarning && (
                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs animate-fade-in">
                  <AlertCircle size={13} className="shrink-0 text-amber-500" />
                  <span className="truncate">
                    Similar task exists: <strong>"{duplicateCandidates[0].task.title}"</strong> (Press Add to create anyway)
                  </span>
                </div>
              )}
        </div>
      </form>
    </div>
  );
};
