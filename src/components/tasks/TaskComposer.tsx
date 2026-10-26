import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING_TACTILE } from '../../utils/springPhysics';
import { useTaskContext } from '../../context/TaskContext';
import { WorkspaceStoreContext } from '../../services/workspaceStore';
import { createNote, appendDailyNote } from '../../services/notesService';

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
  FileText,
} from 'lucide-react';
import { parseTimeToMinutes } from '../../utils/timelineUtils';
import { LazyTaskSessionEditor as TaskSessionEditor } from './LazyTaskSessionEditor';
import type { SessionDraft } from './TaskSessionEditor';
import { getVelocityCalibration } from '../../utils/velocityCalibrator';
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
    settings,
  } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);

  const [captureMode, setCaptureMode] = useState<'task' | 'note'>('task');
  const [noteDestination, setNoteDestination] = useState<'standalone' | 'daily'>('standalone');
  const [noteTitle, setNoteTitle] = useState('');

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
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState('08:00');
  const [sessionEndTime, setSessionEndTime] = useState('11:00');
  const [customSessionNumber, setCustomSessionNumber] = useState<number | null>(null);

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
  const parsed = settings?.enableSmartSyntaxParsing === false ? { cleanTitle: input.trim() } : parseTaskInput(input);

  // Effective values: Explicit override > Parsed token > Context default
  const effectiveProjectId = explicitProjectId || parsed.projectTag || defaultProjectId;
  const projectObj = projects.find((p) => p.id === effectiveProjectId || p.name.toLowerCase() === effectiveProjectId.toLowerCase()) || projects.find(p => p.id === 'inbox') || { id: 'inbox', name: 'Inbox', color: '#64748B' };

  // If user didn't specify explicit plannedDate, but specified a dueDate that is not today,
  // do not fallback plannedDate to todayStr so the task isn't forced into today's list.
  const resolvedDefaultPlannedDate = (parsed.dueDate && parsed.dueDate !== todayStr) ? undefined : defaultPlannedDate;
  const effectivePlannedDate = explicitPlannedDate !== null ? explicitPlannedDate : (parsed.plannedDate || resolvedDefaultPlannedDate);
  const effectiveDueDate = explicitDueDate !== null ? explicitDueDate : parsed.dueDate;
  const effectivePriority = explicitPriority || parsed.priority || settings?.defaultTaskPriority || 'p3';
  const effectiveDuration = explicitDuration !== null ? explicitDuration : parsed.estimatedMinutes;
  const effectiveRecurrence = explicitRecurrence || parsed.recurrence || 'none';

  // Compute next available session number dynamically for effective planned date
  const defaultSessionNum = React.useMemo(() => {
    const targetDate = effectivePlannedDate || todayStr;
    const targetSessions = tasks.filter(
      (t) => !t.deletedAt && !t.archivedAt && (t.plannedDate || t.dueDate) === targetDate && t.sessionMetadata?.isSession
    );
    const nums = targetSessions.map((t) => t.sessionMetadata?.sessionNumber || 1);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [tasks, effectivePlannedDate, todayStr]);

  const activeSessionNum = customSessionNumber ?? defaultSessionNum;

  const handleSessionChange = (draft: SessionDraft) => {
    setSessionStartTime(draft.startTime);
    setSessionEndTime(draft.endTime);
    setCustomSessionNumber(draft.sessionNumber);
    if (draft.plannedDate) {
      setExplicitPlannedDate(draft.plannedDate);
    }
  };

  const handleApplySessionDraft = (draft: SessionDraft) => {
    handleSessionChange(draft);
    setIsSessionActive(true);
    setIsEditingSession(false);
  };

  const handleCancelSessionDraft = () => {
    setIsEditingSession(false);
  };

  // NLP Progressive Auto-Disclosure flags (BUG-18)
  const hasParsedProject = explicitProjectId === 'inbox' && !parsed.projectTag ? false : Boolean(parsed.projectTag || (explicitProjectId && explicitProjectId !== defaultProjectId));
  const hasParsedPlannedDate = explicitPlannedDate === '' ? false : Boolean(parsed.plannedDate || (explicitPlannedDate && explicitPlannedDate !== ''));
  const hasParsedDueDate = explicitDueDate === '' ? false : Boolean(parsed.dueDate || (explicitDueDate && explicitDueDate !== ''));
  const hasParsedPriority = explicitPriority === 'p4' && !parsed.priority ? false : Boolean((parsed.priority && parsed.priority !== 'p4') || (explicitPriority && explicitPriority !== 'p4'));
  const hasParsedDuration = explicitDuration === null && !parsed.estimatedMinutes ? false : Boolean(parsed.estimatedMinutes || explicitDuration);
  const hasParsedRecurrence = explicitRecurrence === 'none' && !parsed.recurrence ? false : Boolean((parsed.recurrence && parsed.recurrence !== 'none') || (explicitRecurrence && explicitRecurrence !== 'none'));

  const velocityCalibration = React.useMemo(() => {
    if (!effectiveDuration) return null;
    const firstTag = parsed.tags?.[0] || parsed.contextTags?.[0];
    return getVelocityCalibration(tasks, effectiveDuration, projectObj.id, firstTag);
  }, [tasks, effectiveDuration, projectObj.id, parsed.tags, parsed.contextTags]);

  const hasAnyParsedTokens = hasParsedProject || hasParsedPlannedDate || hasParsedDueDate || hasParsedPriority || hasParsedDuration || hasParsedRecurrence || isSessionActive || Boolean(velocityCalibration);

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
    if (captureMode === 'note') {
      if (!input.trim() && !noteTitle.trim()) return;
      if (store) {
        if (noteDestination === 'daily') {
          const contentToAppend = noteTitle.trim() ? `**${noteTitle.trim()}**\n${input.trim()}` : input.trim();
          appendDailyNote(store, todayStr, contentToAppend);
          showToast?.("Appended to Today's Daily Note.");
        } else {
          const title = noteTitle.trim() || input.trim().split('\n')[0].slice(0, 80) || 'Untitled Note';
          const body = noteTitle.trim() ? input.trim() : input.trim();
          const note = createNote(store, {
            title,
            body,
            projectId: projectObj.id !== 'inbox' ? projectObj.id : undefined,
          });
          showToast?.('Note created in library.');
          import('../../hooks/useNotes').then(({ openNote }) => openNote(note.id));
        }
      }
      setInput('');
      setNoteTitle('');
      if (onDraftChange) onDraftChange('');
      if (onSuccess) onSuccess();
      return;
    }

    if (!input.trim()) return;


    if (isMultiline) {
      const lines = input.split('\n').filter((l) => l.trim().length > 0);
      addMultipleTasks(lines);
    } else {
      const isSessionIncluded = isSessionActive;
      addTask(parsed.cleanTitle || input, {
        projectId: projectObj.id,
        dueTime: isSessionIncluded ? sessionEndTime : parsed.dueTime,
        scheduledStart: isSessionIncluded ? sessionStartTime : undefined,
        scheduledEnd: isSessionIncluded ? sessionEndTime : undefined,
        tags: parsed.tags,
        contextTags: parsed.contextTags,
        customRecurrence: parsed.customRecurrence,
        plannedDate: isSessionIncluded ? (effectivePlannedDate || todayStr) : (effectivePlannedDate || undefined),
        dueDate: effectiveDueDate || undefined,
        priority: effectivePriority,
        estimatedMinutes: effectiveDuration,
        recurrence: effectiveRecurrence,
        sessionMetadata: isSessionIncluded
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
    setIsEditingSession(false);
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
          {/* Mode Switcher: Task / Note */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]" role="tablist" aria-label="Capture mode">
              <button
                type="button"
                role="tab"
                aria-selected={captureMode === 'task'}
                onClick={() => setCaptureMode('task')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  captureMode === 'task'
                    ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Task
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={captureMode === 'note'}
                onClick={() => setCaptureMode('note')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  captureMode === 'note'
                    ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Note
              </button>
            </div>

            {captureMode === 'note' && (
              <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs">
                <button
                  type="button"
                  onClick={() => setNoteDestination('standalone')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                    noteDestination === 'standalone'
                      ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] font-semibold shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Standalone
                </button>
                <button
                  type="button"
                  onClick={() => setNoteDestination('daily')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                    noteDestination === 'daily'
                      ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] font-semibold shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Daily Note
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3">
            <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
              <div className="text-[var(--text-muted)] mt-1 flex-shrink-0">
                {captureMode === 'note' ? (
                  <FileText size={18} strokeWidth={1.75} className={isFocused ? 'text-amber-500 dark:text-amber-400' : ''} />
                ) : (
                  <Plus size={18} strokeWidth={1.75} className={isFocused ? 'text-amber-500 dark:text-amber-400' : ''} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {captureMode === 'note' ? (
                  <div className="space-y-1.5">
                    {noteDestination === 'standalone' && (
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Note title (optional, auto-extracts from body)"
                        className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm font-semibold focus:outline-none focus-visible:outline-none outline-none font-sans"
                      />
                    )}
                    <textarea
                      ref={textareaRef} aria-label="Note body"
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
                      rows={3}
                      placeholder={
                        noteDestination === 'daily'
                          ? "Write a reflection or thought to append to Today's Daily Note..."
                          : "Write note content, thoughts, markdown, or meeting takeaways..."
                      }
                      className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus-visible:outline-none outline-none resize-none font-sans"
                    />
                  </div>
                ) : isMultiline ? (
                  <textarea
                    ref={textareaRef} aria-label="Tasks to capture"
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
                    ref={inputRef} aria-label="Task title"
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
                    className={`p-2 rounded-xl transition-colors active:scale-95 ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {isListening ? <MicOff size={16} strokeWidth={1.75} /> : <Mic size={16} strokeWidth={1.75} />}
                  </button>
                )}

                {captureMode === 'task' && (
                  <button
                    type="button"
                    onClick={() => setIsMultiline((prev) => !prev)}
                    title={isMultiline ? 'Switch to Single Task mode' : 'Switch to Multi-line Brain Dump'}
                    className={`p-2 rounded-xl transition-colors active:scale-95 ${
                      isMultiline
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <ListPlus size={16} strokeWidth={1.75} />
                  </button>
                )}

                {captureMode === 'task' && (
                  <button
                    type="button"
                    onClick={() => setIsTemplatePickerOpen(true)}
                    title="Browse Templates"
                    className="p-2 text-[var(--text-muted)] hover:text-indigo-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
                  >
                    <Sparkles size={16} strokeWidth={1.75} />
                  </button>
                )}

                {captureMode === 'task' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-l2)] cursor-pointer"
                    aria-expanded={showDetails}
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <span>{showDetails ? '▾ Hide properties' : '▸ More details'}</span>
                    {!showDetails && hasAnyParsedTokens && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30" title="Parsed parameters active">
                        Parsed
                      </span>
                    )}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={captureMode === 'note' ? (!input.trim() && !noteTitle.trim()) : !input.trim()}
                aria-label={captureMode === 'note' ? (noteDestination === 'daily' ? 'Append note' : 'Save note') : 'Add'}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-35 disabled:active:scale-100 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500/50 outline-none"
              >
                <span>{captureMode === 'note' ? (noteDestination === 'daily' ? 'Append' : 'Save Note') : 'Add'}</span>
                <Kbd size="xs" className="hidden sm:inline-block text-[10px] py-0 px-1 border-white/20 bg-black/20 text-white shadow-none">↵</Kbd>
              </button>
            </div>
          </div>

          {/* Editable Chips Bar (Only in Task mode: auto-reveals on parsed NLP tokens or manual toggle) */}
          {captureMode === 'task' && !isMultiline && (showDetails || hasAnyParsedTokens) && (

            <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 mt-3 pt-2.5 border-t border-[var(--border-hairline)] text-xs py-1">
              <AnimatePresence mode="popLayout">
                {/* Project Chip */}
                {(showDetails || hasParsedProject) && (
                  <motion.div
                    key="chip-project"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0"
                  >
                    <Folder size={12} strokeWidth={1.75} style={{ color: projectObj.color }} />
                    <select
                      aria-label="Project"
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
                    {(explicitProjectId || parsed.projectTag) && (
                      <button
                        type="button"
                        onClick={() => setExplicitProjectId('inbox')}
                        className="hover:text-rose-500 ml-0.5 active:scale-90"
                        title="Reset project to Inbox"
                      >
                        <X size={11} strokeWidth={1.75} />
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Planned Date Chip */}
                {(showDetails || hasParsedPlannedDate) && (
                  <motion.div
                    key="chip-planned-date"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0"
                  >
                    <Calendar size={12} strokeWidth={1.75} className="text-amber-500" />
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
                        className="hover:text-rose-500 ml-0.5 active:scale-90"
                        title="Clear planned date"
                      >
                        <X size={11} strokeWidth={1.75} />
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Due Date (Deadline) Chip */}
                {(showDetails || hasParsedDueDate) && (
                  <motion.div
                    key="chip-due-date"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0"
                  >
                    <Clock size={12} strokeWidth={1.75} className="text-purple-500" />
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
                        className="hover:text-rose-500 ml-0.5 active:scale-90"
                        title="Clear deadline"
                      >
                        <X size={11} strokeWidth={1.75} />
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Priority Chip */}
                {(showDetails || hasParsedPriority) && (
                  <motion.div
                    key="chip-priority"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const cycle: Priority[] = ['p4', 'p3', 'p2', 'p1'];
                        const next = cycle[(cycle.indexOf(effectivePriority) + 1) % cycle.length];
                        setExplicitPriority(next);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-[11px] transition-colors active:scale-95 ${getPriorityStyle(
                        effectivePriority
                      )}`}
                      title="Click to cycle priority"
                    >
                      <Flag size={11} strokeWidth={1.75} />
                      <span>{effectivePriority.toUpperCase()}</span>
                      {effectivePriority !== 'p4' && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setExplicitPriority('p4');
                          }}
                          className="hover:text-rose-500 ml-0.5 cursor-pointer active:scale-90"
                          title="Reset priority to P4"
                        >
                          <X size={10} strokeWidth={1.75} />
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}

                {/* Duration Chip */}
                {(showDetails || hasParsedDuration) && (
                  <motion.div
                    key="chip-duration"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const times = [15, 30, 45, 60, 90, null];
                        const next = times[(times.indexOf(effectiveDuration ?? null) + 1) % times.length];
                        setExplicitDuration(next);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] active:scale-95"
                      title="Click to cycle estimated duration"
                    >
                      <Sparkles size={11} strokeWidth={1.75} className="text-teal-500" />
                      <span className="tabular-nums">{effectiveDuration ? `~${effectiveDuration}m` : 'Estimate'}</span>
                      {effectiveDuration && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setExplicitDuration(null);
                          }}
                          className="hover:text-rose-500 ml-0.5 cursor-pointer active:scale-90"
                          title="Clear duration"
                        >
                          <X size={10} strokeWidth={1.75} />
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}

                {/* Anti-Planning Fallacy Velocity Calibration Chip */}
                {velocityCalibration && (
                  <motion.div
                    key="chip-calibration"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="shrink-0"
                  >
                    <button
                      type="button"
                      data-testid="chip-velocity-calibration"
                      onClick={() => setExplicitDuration(velocityCalibration.recommendedMinutes)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[11px] font-medium transition-colors active:scale-95"
                      title={`Historical velocity suggests ~${velocityCalibration.recommendedMinutes}m (based on ${velocityCalibration.sampleCount} tasks in ${velocityCalibration.scope}). Click to calibrate.`}
                    >
                      <Sparkles size={11} strokeWidth={2} className="text-amber-500" />
                      <span>Calibrated: ~{velocityCalibration.recommendedMinutes}m</span>
                    </button>
                  </motion.div>
                )}

                {/* Recurrence Chip */}
                {(showDetails || hasParsedRecurrence) && (
                  <motion.div
                    key="chip-recurrence"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const freqs: RecurrenceFrequency[] = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];
                        const next = freqs[(freqs.indexOf(effectiveRecurrence) + 1) % freqs.length];
                        setExplicitRecurrence(next);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] cursor-pointer active:scale-95"
                      title="Click to cycle recurrence"
                    >
                      <Repeat size={11} strokeWidth={1.75} className="text-indigo-500" />
                      <span>{effectiveRecurrence !== 'none' ? effectiveRecurrence : 'Repeat'}</span>
                      {effectiveRecurrence !== 'none' && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setExplicitRecurrence('none');
                          }}
                          className="hover:text-rose-500 ml-0.5 cursor-pointer active:scale-90"
                          title="Clear recurrence"
                        >
                          <X size={10} strokeWidth={1.75} />
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}

                {/* Session Chip */}
                {(showDetails || isSessionActive || isEditingSession) && (
                  <motion.div
                    key="chip-session"
                    layout="position"
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={SPRING_TACTILE}
                    className="shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isSessionActive) {
                          setIsEditingSession((prev) => !prev);
                        } else {
                          setIsEditingSession(true);
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer active:scale-95 ${
                        isSessionActive || isEditingSession
                          ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30 font-semibold'
                          : 'bg-[var(--bg-surface-l2)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      title={isSessionActive ? 'Click to configure session' : 'Click to configure custom session duration & timeline block'}
                    >
                      <Timer size={11} strokeWidth={1.75} className={isSessionActive || isEditingSession ? 'text-teal-500' : ''} />
                      <span className="tabular-nums">
                        {isSessionActive
                          ? `Session ${activeSessionNum} (${sessionStartTime}–${sessionEndTime})`
                          : isEditingSession
                          ? 'Configuring Session…'
                          : '+ Session'}
                      </span>
                      {isSessionActive && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSessionActive(false);
                            setIsEditingSession(false);
                            setCustomSessionNumber(null);
                          }}
                          className="ml-0.5 hover:text-rose-500 cursor-pointer active:scale-90"
                          title="Remove session"
                        >
                          <X size={10} strokeWidth={1.75} />
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Active Session Summary Card */}
          {!isMultiline && isSessionActive && !isEditingSession && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-teal-500/[0.08] dark:bg-teal-500/[0.12] border border-teal-500/25 flex items-center justify-between text-xs animate-slide-down">
              <div className="flex items-center gap-2">
                <Timer size={14} className="text-teal-600 dark:text-teal-400" />
                <span className="font-semibold text-teal-900 dark:text-teal-200">
                  🎯 Session #{activeSessionNum}
                </span>
                <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                  {sessionStartTime} – {sessionEndTime}
                </span>
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold bg-teal-500/20 text-teal-800 dark:text-teal-300">
                  {sessionDuration.formatted}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingSession(true)}
                  className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold hover:underline cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSessionActive(false);
                    setCustomSessionNumber(null);
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-600 cursor-pointer p-0.5"
                  title="Remove session"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Reusable TaskSessionEditor in Draft Mode */}
          {!isMultiline && isEditingSession && (
            <div className="mt-2.5">
              <TaskSessionEditor
                initialSessionNumber={isSessionActive ? activeSessionNum : undefined}
                initialPlannedDate={effectivePlannedDate || todayStr}
                initialStartTime={sessionStartTime}
                initialEndTime={sessionEndTime}
                suggestedSessionNumber={defaultSessionNum}
                tasks={tasks}
                title="Session Duration Generator"
                onApply={handleApplySessionDraft}
                onCancel={handleCancelSessionDraft}
              />
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
