import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput, formatLocalDate } from '../../utils/nlpParser';
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
  CornerDownLeft,
  Mic,
  MicOff,
  AlertCircle,
  Repeat,
  X,
  ListPlus,
} from 'lucide-react';

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

  const todayStr = formatLocalDate(new Date());

  // Default context resolution
  const defaultProjectId = activeView.startsWith('project:') ? activeView.split(':')[1] : 'inbox';
  const defaultPlannedDate = activeView === 'today' ? todayStr : undefined;

  // Sync draft change to parent
  const handleInputChange = (val: string) => {
    setInput(val);
    if (onDraftChange) onDraftChange(val);
  };

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

  const effectivePlannedDate = explicitPlannedDate !== null ? explicitPlannedDate : parsed.plannedDate || defaultPlannedDate;
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
        createdAt: Date.now(),
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
  }, [isSpeechSupported, isListening, showToast]);

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
        dueTime: parsed.dueTime,
        tags: parsed.tags,
        contextTags: parsed.contextTags,
        customRecurrence: parsed.customRecurrence,
        plannedDate: effectivePlannedDate,
        dueDate: effectiveDueDate,
        priority: effectivePriority,
        estimatedMinutes: effectiveDuration,
        recurrence: effectiveRecurrence,
      });
    }

    setInput('');
    if (onDraftChange) onDraftChange('');
    // Reset date/priority/duration/recurrence chips
    // Keep explicitProjectId sticky across submissions until user explicitly changes it
    setExplicitPlannedDate(null);
    setExplicitDueDate(null);
    setExplicitPriority(null);
    setExplicitDuration(null);
    setExplicitRecurrence(null);

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
        className={`relative rounded-2xl transition-all duration-150 border ${
          isFocused
            ? 'bg-[var(--bg-surface-l1)] border-amber-500/60 dark:border-amber-400/50 shadow-elevated ring-2 ring-amber-500/20'
            : 'bg-[var(--bg-surface-l1)] border-[var(--border-subtle)] shadow-subtle hover:border-[var(--border-hairline)]'
        }`}
      >
        <div className="p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
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

              <button type="button" className="mt-2 text-xs text-[var(--text-secondary)] underline" aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)}>{showDetails ? 'Hide details' : 'Task details'}</button>
              {/* Editable Chips Bar (Only in Single Task mode) */}
              {!isMultiline && showDetails && (
                <div className="flex items-center flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-[var(--border-hairline)] text-xs">
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
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px]"
                    title="Click to cycle recurrence"
                  >
                    <Repeat size={11} className="text-indigo-500" />
                    <span>{effectiveRecurrence !== 'none' ? effectiveRecurrence : 'Repeat'}</span>
                  </button>
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

            {/* Actions: Voice, Mode, Submit */}
            <div className="flex items-center gap-1.5 self-start">
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
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-35 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1"
              >
                <span>Add</span>
                <CornerDownLeft size={13} />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
