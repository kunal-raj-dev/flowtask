import React, { useState, useRef, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Priority, RecurrenceFrequency } from '../../types/task';
import {
  X,
  Calendar,
  Clock,
  Flag,
  Folder,
  Repeat,
  Star,
  Moon,
  Timer,
  Trash2,
  Plus,
  Check,
  Sparkles,
  Play,
  Pause,
  ArrowUpRight,
  Eye,
  Edit3,
  Zap,
  Lock,
  Unlock,
  GitMerge,
  AlertTriangle,
  Copy,
  ChevronUp,
  ChevronDown,
  Bookmark,
  Tag,
  History,
  ListTodo,
  ExternalLink,
  Archive,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { suggestSubtasks, suggestDuration } from '../../utils/aiCopilot';
import { generateStarterAction } from '../../utils/procrastinationSplitter';
import { getVelocityCalibration } from '../../utils/velocityCalibrator';
import { formatLocalDate } from '../../utils/nlpParser';
import { findPotentialDuplicates } from '../../utils/duplicateDetector';
import {
  isTaskBlocked,
  getPotentialBlockingCandidates,
  wouldCreateCycle,
  getMergePreview,
} from '../../utils/dependencyUtils';
import { saveCustomTemplate } from '../../utils/templateEngine';
import { RecurrenceModal } from '../modals/RecurrenceModal';

interface TaskDrawerProps {
  taskId: string;
  onClose: () => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  taskId,
  onClose,
  onStartFocus,
  onStartSprint,
}) => {
  const {
    tasks,
    projects,
    updateTask,
    deleteTask,
    archiveTask,
    mergeTasks,
    toggleTaskStatus,
    toggleTaskPinToday,
    toggleSubTask,
    addSubTask,
    addSubTasks,
    deleteSubTask,
    promoteSubTaskToTask,
    moveSubTask,
    duplicateTask,
    showToast,
    activeTimerTaskId,
    activeTimerSeconds,
    toggleTaskTimer,
  } = useTaskContext();

  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [isRecurrenceExpanded, setIsRecurrenceExpanded] = useState(false);
  const [isDependenciesExpanded, setIsDependenciesExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [isStudyExpanded, setIsStudyExpanded] = useState(false);
  const [isAuditExpanded, setIsAuditExpanded] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedSourceTaskId, setSelectedSourceTaskId] = useState<string>('');

  const task = tasks.find((t) => t.id === taskId);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskEstimate, setNewSubtaskEstimate] = useState<number | undefined>(undefined);

  const [isDecomposing, setIsDecomposing] = useState(false);
  const [dismissedDuplicateId, setDismissedDuplicateId] = useState<string | null>(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  // Refs for accessibility and menu management
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Mobile drag-to-dismiss gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);

  // Accessibility: store active element and bind Escape key
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isActionMenuOpen) {
          setIsActionMenuOpen(false);
          return;
        }
        if (isMergeModalOpen) {
          setIsMergeModalOpen(false);
          return;
        }
        if (isRecurrenceModalOpen) {
          setIsRecurrenceModalOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isActionMenuOpen, isMergeModalOpen, isRecurrenceModalOpen, onClose]);

  // Click outside to close action menu
  useEffect(() => {
    if (!isActionMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionMenuOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    setDragY(Math.max(0, diff));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 110) {
      onClose();
    }
    setDragY(0);
  };

  if (!task) return null;

  const isDone = task.status === 'done';

  const formatAuditDate = (timestamp?: number) => {
    if (!timestamp) return 'Not recorded';
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const calculateTurnaround = (startMs: number, endMs?: number) => {
    if (!endMs) return null;
    const diffMin = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));
    if (diffMin < 60) return `${diffMin}m`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  };

  const potentialDuplicates = findPotentialDuplicates(task, tasks).filter(
    (d) => d.task.id !== dismissedDuplicateId
  );
  const topDup = potentialDuplicates.length > 0 ? potentialDuplicates[0] : null;

  const blockedInfo = isTaskBlocked(task, tasks);
  const blockingCandidates = getPotentialBlockingCandidates(task.id, tasks);

  const handleMergeDuplicate = (duplicateTask: typeof task) => {
    mergeTasks(task.id, duplicateTask.id);
    setDismissedDuplicateId(duplicateTask.id);
    showToast(`Merged duplicate "${duplicateTask.title}"`);
  };

  const handleStarterStep = () => {
    const starter = generateStarterAction(task.title, task.description);
    addSubTask(task.id, starter.starterAction, starter.suggestedMinutes);
    showToast(`⚡ 5-min starter added: "${starter.starterAction}"`);
  };

  const handleMagicBreakdown = () => {
    setIsDecomposing(true);
    setTimeout(() => {
      const suggested = suggestSubtasks(task.title, task.description);
      const newItems = suggested
        .filter((sub) => !task.subtasks?.some((s) => s.title.toLowerCase() === sub.title.toLowerCase()))
        .map((sub) => ({ title: sub.title }));

      if (newItems.length > 0) {
        addSubTasks(task.id, newItems);
      }

      if (!task.estimatedMinutes) {
        updateTask(task.id, { estimatedMinutes: suggestDuration(task.title) });
      }
      setIsDecomposing(false);
    }, 200);
  };

  const handleAddSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      addSubTask(task.id, newSubtaskTitle.trim(), newSubtaskEstimate);
      setNewSubtaskTitle('');
      setNewSubtaskEstimate(undefined);
    }
  };

  const completedSubs = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubs = task.subtasks?.length || 0;
  const progressPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
  const totalSubMinutes = task.subtasks?.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;
  const completedSubMinutes =
    task.subtasks?.filter((s) => s.completed).reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;

  const isActiveTimer = activeTimerTaskId === task.id;
  const primaryTag = task.contextTags && task.contextTags.length > 0 ? task.contextTags[0] : undefined;
  const calibration = getVelocityCalibration(tasks, task.estimatedMinutes, task.projectId, primaryTag);

  const currentProject = projects.find((p) => p.id === task.projectId);
  const domainLabel =
    calibration?.scope === 'tag' && primaryTag
      ? `#${primaryTag.replace(/^#/, '')}`
      : currentProject && currentProject.id !== 'inbox'
      ? `#${currentProject.name}`
      : 'similar';

  const formatStopwatch = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderBoldCode = (text: string): React.ReactNode => {
    const tokenRegex = /(\*\*[^*]+\*\*)|(`[^`]+`)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-[var(--text-primary)]">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-white/[0.08] font-mono text-[11px] text-[var(--color-brand)] font-semibold"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const renderFormattedInline = (text: string): React.ReactNode => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderBoldCode(text.substring(lastIndex, match.index)));
      }
      if (match[1] && match[2]) {
        parts.push(
          <a
            key={match.index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-brand)] hover:underline inline-flex items-center gap-0.5 font-medium underline-offset-2"
          >
            {match[1]}
          </a>
        );
      } else if (match[3]) {
        parts.push(
          <a
            key={match.index}
            href={match[3]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-brand)] hover:underline inline-flex items-center gap-0.5 font-medium underline-offset-2"
          >
            {match[3]}
          </a>
        );
      }
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(renderBoldCode(text.substring(lastIndex)));
    }

    return parts;
  };

  const renderMarkdownNotes = (text: string) => {
    if (!text.trim()) {
      return (
        <p className="text-xs text-[var(--text-muted)] italic py-2">
          No notes added yet. Click &quot;Edit Notes&quot; to add details, checklists, or links...
        </p>
      );
    }

    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs text-[var(--text-primary)] leading-relaxed py-1">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-xs text-[var(--text-primary)] pt-1">
                {line.slice(4)}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="font-bold text-sm text-[var(--text-primary)] pt-1.5">
                {line.slice(3)}
              </h3>
            );
          }
          if (line.startsWith('# ')) {
            return (
              <h2 key={idx} className="font-bold text-base text-[var(--text-primary)] pt-2">
                {line.slice(2)}
              </h2>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>{renderFormattedInline(line.slice(2))}</span>
              </div>
            );
          }
          if (line.startsWith('- [ ] ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-[var(--text-secondary)]">
                <span className="w-3 h-3 rounded border border-stone-400 dark:border-stone-600 inline-block mt-0.5 shrink-0" />
                <span>{renderFormattedInline(line.slice(6))}</span>
              </div>
            );
          }
          if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-[var(--text-muted)] line-through">
                <span className="w-3 h-3 rounded bg-emerald-500 text-white flex items-center justify-center text-[9px] mt-0.5 shrink-0">
                  ✓
                </span>
                <span>{renderFormattedInline(line.slice(6))}</span>
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return <p key={idx}>{renderFormattedInline(line)}</p>;
        })}
      </div>
    );
  };

  const selectedSourceTask = tasks.find((t) => t.id === selectedSourceTaskId);
  const mergePreview = selectedSourceTask ? getMergePreview(task, selectedSourceTask, tasks) : null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50 backdrop-blur-[2px] flex items-end md:items-stretch md:justify-end transition-all"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task Details"
        className="w-full md:max-w-xl lg:max-w-2xl h-[100dvh] md:h-full max-h-[100dvh] md:max-h-full bg-[var(--bg-surface-l1)] rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-[var(--border-subtle)] shadow-modal flex flex-col overflow-hidden animate-slide-down md:animate-slide-left"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div
          className="w-full pt-3 pb-1 flex justify-center md:hidden cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600" />
        </div>

        {/* Drawer Header */}
        <div
          className="px-4 py-3 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l1)]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleTaskStatus(task.id)}
              className={`w-5 h-5 rounded-full flex items-center justify-center border active:scale-85 transition-all duration-150 ${
                isDone
                  ? 'bg-stone-900 dark:bg-white border-stone-900 dark:border-white text-white dark:text-stone-950 shadow-xs'
                  : 'border-stone-400/80 dark:border-stone-500/80 hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20 bg-transparent'
              }`}
              aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {isDone && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3 h-3 animate-check-spring"
                >
                  <polyline points="20 6 9 17 4 12" className="animate-check-draw" />
                </svg>
              )}
            </button>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {isDone ? 'Completed Task' : 'Active Task'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Top 3 Star Pin button */}
            <button
              type="button"
              onClick={() => toggleTaskPinToday(task.id)}
              title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
              className={`p-1.5 rounded-lg transition-all ${
                task.isPinnedToday
                  ? 'text-amber-500 bg-amber-500/15 border border-amber-500/30 shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--bg-surface-l2)]'
              }`}
            >
              <Star size={15} className={task.isPinnedToday ? 'fill-current' : ''} />
            </button>

            {/* Things 3-style This Evening Toggle button */}
            <button
              type="button"
              onClick={() => updateTask(task.id, { isEvening: !task.isEvening })}
              title={task.isEvening ? 'Move to Daytime' : 'Move to This Evening'}
              className={`p-1.5 rounded-lg transition-all ${
                task.isEvening
                  ? 'text-indigo-500 bg-indigo-500/15 border border-indigo-500/30 shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-indigo-500 hover:bg-[var(--bg-surface-l2)]'
              }`}
            >
              <Moon size={15} className={task.isEvening ? 'fill-indigo-500/30' : ''} />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartFocus(task.id);
              }}
              title="Start Focus Timer"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--bg-surface-l2)] rounded-lg transition-colors"
            >
              <Timer size={15} />
            </button>

            {/* Header Action Menu (...) to keep header compact on all screens */}
            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                onClick={() => setIsActionMenuOpen((prev) => !prev)}
                title="More task actions"
                aria-label="More task actions"
                aria-expanded={isActionMenuOpen}
                className={`p-1.5 rounded-lg transition-colors ${
                  isActionMenuOpen
                    ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)]'
                }`}
              >
                <MoreHorizontal size={16} />
              </button>

              {isActionMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-modal py-1 z-50 animate-fade-in text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      duplicateTask(task.id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <Copy size={14} className="text-[var(--text-muted)]" />
                    <span>Duplicate Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setIsMergeModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <GitMerge size={14} className="text-[var(--text-muted)]" />
                    <span>Merge with Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      archiveTask(task.id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <Archive size={14} className="text-[var(--text-muted)]" />
                    <span>Archive Task</span>
                  </button>

                  <div className="my-1 border-t border-[var(--border-hairline)]" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      deleteTask(task.id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <Trash2 size={14} />
                    <span>Delete Task</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close task details"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] rounded-lg transition-colors ml-1"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Top Section: Title Input */}
          <div className="space-y-1">
            <input
              id="task-drawer-title-input"
              name="taskTitle"
              aria-label="Task title"
              type="text"
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              className={`w-full bg-transparent text-lg font-bold outline-none transition-colors tracking-tight ${
                isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
              }`}
              placeholder="Task title..."
            />
          </div>

          {/* Top Section: 4-Column Responsive Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] text-xs card-surface">
            {/* Project Select */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-project-select"
                className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
              >
                <Folder size={13} /> Project
              </label>
              <select
                id="task-project-select"
                name="taskProject"
                aria-label="Assign to project"
                value={task.projectId}
                onChange={(e) => updateTask(task.id, { projectId: e.target.value })}
                className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Planned Date */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="task-planned-date-input"
                  className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
                >
                  <Calendar size={13} /> Planned Date
                </label>
                {task.plannedDate && (
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { plannedDate: undefined })}
                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                id="task-planned-date-input"
                name="taskPlannedDate"
                aria-label="Planned date"
                type="date"
                value={task.plannedDate || ''}
                onChange={(e) => updateTask(task.id, { plannedDate: e.target.value || undefined })}
                className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => updateTask(task.id, { plannedDate: formatLocalDate(new Date()) })}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    updateTask(task.id, { plannedDate: formatLocalDate(d) });
                  }}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Tomorrow
                </button>
                {task.plannedDate && (
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { plannedDate: undefined })}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-rose-500 border border-[var(--border-hairline)] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Deadline / Due Date */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="task-due-date-input"
                  className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
                >
                  <Clock size={13} /> Deadline
                </label>
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { dueDate: undefined })}
                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                id="task-due-date-input"
                name="taskDueDate"
                aria-label="Due date"
                type="date"
                value={task.dueDate || ''}
                onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
                className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => updateTask(task.id, { dueDate: formatLocalDate(new Date()) })}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    updateTask(task.id, { dueDate: formatLocalDate(d) });
                  }}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Tomorrow
                </button>
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { dueDate: undefined })}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-rose-500 border border-[var(--border-hairline)] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Priority Select */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-priority-select"
                className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
              >
                <Flag size={13} /> Priority
              </label>
              <select
                id="task-priority-select"
                name="taskPriority"
                aria-label="Set priority"
                value={task.priority}
                onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
              >
                <option value="p1">P1 Urgent</option>
                <option value="p2">P2 High</option>
                <option value="p3">P3 Medium</option>
                <option value="p4">P4 Normal / Low</option>
              </select>
            </div>
          </div>

          {/* Top Section: Subtasks */}
          <div className="p-4 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] space-y-3 card-surface">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <ListTodo size={13} className="text-[var(--color-brand)]" />
                <span>Subtasks {totalSubs > 0 && `(${completedSubs}/${totalSubs})`}</span>
              </label>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleStarterStep}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs transition-all active:scale-95"
                  title="Cognitive de-escalation: Generate a tailored 5-minute starter action to break inertia"
                >
                  <Zap size={11} className="text-amber-500 fill-current" />
                  <span>Break Inertia (5m)</span>
                </button>

                <button
                  type="button"
                  onClick={handleMagicBreakdown}
                  disabled={isDecomposing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/20 text-[var(--color-brand)] border border-[var(--color-brand)]/30 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  title="Suggested steps — generated locally"
                >
                  <Sparkles
                    size={11}
                    className={isDecomposing ? 'animate-spin text-[var(--color-brand)]' : 'text-[var(--color-brand)]'}
                  />
                  <span>{isDecomposing ? 'Suggesting...' : 'Suggest steps'}</span>
                </button>

                {totalSubs > 0 && (
                  <span className="text-xs font-mono text-[var(--text-muted)] font-semibold">{progressPercent}%</span>
                )}
              </div>
            </div>

            {/* Progress Bar and Rollup */}
            {totalSubs > 0 && (
              <div className="space-y-1.5 mb-2">
                <div className="w-full h-1.5 bg-stone-200/70 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-xs"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
                  <span>
                    {completedSubs} of {totalSubs} steps completed
                    {totalSubMinutes > 0 ? ` • ${completedSubMinutes}m / ${totalSubMinutes}m` : ''}
                  </span>
                  {totalSubMinutes > 0 && task.estimatedMinutes !== totalSubMinutes && (
                    <button
                      type="button"
                      onClick={() => updateTask(task.id, { estimatedMinutes: totalSubMinutes })}
                      className="text-[10px] font-bold text-[var(--color-brand)] hover:underline"
                      title={`Update parent task estimate to sum of subtasks (${totalSubMinutes}m)`}
                    >
                      Sync to Task ({totalSubMinutes}m)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Subtasks List */}
            <div className="space-y-1.5">
              {task.subtasks?.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-surface-l1)] group transition-colors border border-transparent hover:border-[var(--border-hairline)]"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSubTask(task.id, sub.id)}
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all active:scale-90 ${
                        sub.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-[var(--border-strong)] hover:border-amber-500'
                      }`}
                      aria-label={sub.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                    >
                      {sub.completed && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-2.5 h-2.5 animate-check-spring"
                        >
                          <polyline points="20 6 9 17 4 12" className="animate-check-draw" />
                        </svg>
                      )}
                    </button>

                    {sub.difficulty && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0 ${
                          sub.difficulty === 'HARD'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            : sub.difficulty === 'MEDIUM'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {sub.difficulty}
                      </span>
                    )}

                    {sub.problemNumber && (
                      <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] shrink-0">
                        #{sub.problemNumber}
                      </span>
                    )}

                    <span
                      className={`text-xs ${
                        sub.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {sub.title}
                    </span>

                    {sub.url && (
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[var(--color-brand)] hover:opacity-80 p-0.5 shrink-0"
                        title="Open Problem Link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}

                    {sub.tags && sub.tags.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1 shrink-0">
                        {sub.tags.map((tg) => (
                          <span
                            key={tg}
                            className="text-[9px] px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-stone-800 text-[var(--text-muted)] font-medium"
                          >
                            {tg}
                          </span>
                        ))}
                      </div>
                    )}

                    {sub.estimatedMinutes && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-l1)] text-[var(--text-muted)] font-semibold border border-[var(--border-hairline)] shrink-0">
                        {sub.estimatedMinutes}m
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      type="button"
                      onClick={() => moveSubTask(task.id, sub.id, 'up')}
                      title="Move step up"
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md transition-all"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSubTask(task.id, sub.id, 'down')}
                      title="Move step down"
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md transition-all"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => promoteSubTaskToTask(task.id, sub.id)}
                      title="Promote subtask to independent task"
                      className="text-[var(--text-muted)] hover:text-[var(--color-brand)] p-1 rounded-md transition-all"
                    >
                      <ArrowUpRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSubTask(task.id, sub.id)}
                      className="text-[var(--text-muted)] hover:text-rose-500 p-1 rounded-md transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Subtask Form */}
            <form onSubmit={handleAddSub} className="mt-2 flex items-center gap-2">
              <input
                id="new-subtask-title-input"
                name="newSubtaskTitle"
                aria-label="Add subtask"
                type="text"
                placeholder="Add subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-1.5 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface"
              />
              <input
                id="new-subtask-estimate-input"
                name="newSubtaskEstimate"
                aria-label="Subtask estimate in minutes"
                type="number"
                min="1"
                step="5"
                placeholder="min"
                value={newSubtaskEstimate || ''}
                onChange={(e) => setNewSubtaskEstimate(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="w-14 text-xs px-2 py-1.5 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface text-center font-mono"
                title="Optional step duration estimate in minutes"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim()}
                className="p-1.5 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] disabled:opacity-40 rounded-lg border border-[var(--border-hairline)] shadow-xs transition-colors"
              >
                <Plus size={14} />
              </button>
            </form>

            {/* Blueprint Template Save */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    saveCustomTemplate({
                      name: task.title,
                      description: task.description,
                      defaultPriority: task.priority,
                      defaultEstimatedMinutes: task.estimatedMinutes,
                      subtaskTitles: task.subtasks?.map((s) => s.title) || [],
                      contextTags: task.contextTags,
                    });
                    showToast(`Saved "${task.title}" as reusable template!`);
                  }}
                  title="Save current task and its subtasks as a reusable template"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/25 transition-all active:scale-95 shadow-xs"
                >
                  <Bookmark size={12} />
                  <span>Save as Template</span>
                </button>
              </div>
            )}
          </div>

          {/* Top Section: Notes & Description */}
          <div className="p-4 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] space-y-2 card-surface">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Notes & Description
              </label>
              <button
                type="button"
                onClick={() => setIsMarkdownPreview((prev) => !prev)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] transition-colors"
                title={isMarkdownPreview ? 'Switch to raw edit mode' : 'Switch to formatted markdown preview'}
              >
                {isMarkdownPreview ? (
                  <>
                    <Edit3 size={11} />
                    <span>Edit Notes</span>
                  </>
                ) : (
                  <>
                    <Eye size={11} />
                    <span>Preview</span>
                  </>
                )}
              </button>
            </div>

            {isMarkdownPreview ? (
              <div
                onClick={() => setIsMarkdownPreview(false)}
                className="w-full min-h-[100px] p-3.5 bg-[var(--bg-surface-l1)]/50 border border-[var(--border-hairline)] rounded-xl cursor-pointer hover:border-stone-400 dark:hover:border-stone-600 transition-colors card-surface"
                title="Click to edit notes"
              >
                {renderMarkdownNotes(task.description || '')}
              </div>
            ) : (
              <textarea
                id="task-notes-textarea"
                name="taskNotes"
                aria-label="Task notes and description"
                rows={5}
                value={task.description || ''}
                onChange={(e) => updateTask(task.id, { description: e.target.value })}
                placeholder="Add details, links, checklists (- [ ]), or code (`code`)..."
                className="w-full text-xs p-3.5 bg-[var(--bg-surface-l1)]/50 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-stone-400 dark:focus:border-stone-600 resize-none leading-relaxed card-surface font-mono"
              />
            )}
          </div>

          {/* ========================================================= */}
          {/* COLLAPSIBLE SECTIONS                                      */}
          {/* ========================================================= */}

          {/* SECTION 1: Recurrence & Schedule Blocks */}
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsRecurrenceExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Repeat size={14} className="text-sky-500" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Recurrence & Schedule Blocks
                </span>
                {task.recurrence && task.recurrence !== 'none' && (
                  <Badge variant="focus" size="xs">
                    {task.recurrence}
                  </Badge>
                )}
                {task.estimatedMinutes && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {task.estimatedMinutes}m est
                  </span>
                )}
              </div>
              {isRecurrenceExpanded ? (
                <ChevronUp size={15} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronDown size={15} className="text-[var(--text-muted)]" />
              )}
            </button>

            {isRecurrenceExpanded && (
              <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3.5 text-xs">
                {/* Recurrence Rule */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="task-recurrence-select"
                      className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Repeat size={13} className="text-sky-500" /> Recurrence Rule
                    </label>
                    {task.recurrence === 'custom' && task.customRecurrence && (
                      <button
                        type="button"
                        onClick={() => setIsRecurrenceModalOpen(true)}
                        className="text-[10px] font-semibold text-[var(--color-brand)] hover:underline"
                      >
                        Edit Rule
                      </button>
                    )}
                  </div>
                  <select
                    id="task-recurrence-select"
                    name="taskRecurrence"
                    aria-label="Recurrence rule"
                    value={task.recurrence || 'none'}
                    onChange={(e) => {
                      const val = e.target.value as RecurrenceFrequency;
                      if (val === 'custom') {
                        setIsRecurrenceModalOpen(true);
                      } else {
                        updateTask(task.id, { recurrence: val, customRecurrence: undefined });
                      }
                    }}
                    className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 outline-none card-surface cursor-pointer"
                  >
                    <option value="none">No Recurrence</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays (Mon-Fri)</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 Weeks (Biweekly)</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom Rule...</option>
                  </select>
                  {task.recurrence === 'custom' && task.customRecurrence && (
                    <div className="mt-1 text-[11px] text-[var(--color-brand)] font-medium">
                      Repeats every {task.customRecurrence.interval === 1 ? '' : task.customRecurrence.interval + ' '}
                      {task.customRecurrence.unit}
                      {task.customRecurrence.mode === 'completion' ? ' (after completion)' : ''}
                    </div>
                  )}
                </div>

                {/* Estimated Duration Presets & Stopwatch */}
                <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="task-estimated-minutes-input"
                      className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Clock size={13} className="text-amber-500" /> Estimated Duration (minutes)
                    </label>
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => toggleTaskTimer(task.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          isActiveTimer
                            ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                            : 'bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-amber-500 border border-[var(--border-hairline)]'
                        }`}
                      >
                        {isActiveTimer ? (
                          <Pause size={12} className="fill-current" />
                        ) : (
                          <Play size={12} className="fill-current" />
                        )}
                        <span>{isActiveTimer ? formatStopwatch(activeTimerSeconds) : 'Live Stopwatch'}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <input
                        id="task-estimated-minutes-input"
                        name="taskEstimatedMinutes"
                        aria-label="Estimated duration in minutes"
                        type="number"
                        min="0"
                        step="5"
                        placeholder="e.g. 25"
                        value={task.estimatedMinutes || ''}
                        onChange={(e) =>
                          updateTask(task.id, {
                            estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="w-24 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 outline-none card-surface"
                      />
                      <div className="flex items-center gap-1.5">
                        {[15, 25, 45, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => updateTask(task.id, { estimatedMinutes: mins })}
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] shadow-xs card-surface transition-colors"
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                    {task.timeSpentMinutes && task.timeSpentMinutes > 0 ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        {task.timeSpentMinutes}m spent
                      </span>
                    ) : null}
                  </div>

                  {/* Velocity Calibrator */}
                  {calibration && (
                    <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs shadow-xs">
                      <div className="min-w-0 pr-1 flex items-start gap-2">
                        <span className="text-amber-500 font-bold shrink-0 mt-0.5">🎯</span>
                        <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                          <span>
                            You usually take <strong>~{calibration.recommendedMinutes}m</strong> on{' '}
                            <strong>{domainLabel}</strong> tasks ({calibration.ratio}x variance across{' '}
                            {calibration.sampleCount} tasks).
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, { estimatedMinutes: calibration.recommendedMinutes })}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[11px] shrink-0 transition-all shadow-xs flex items-center gap-1"
                        title="Apply calibrated estimate based on historical performance"
                      >
                        <span>Adjust to {calibration.recommendedMinutes}m</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Dependencies & Blockers */}
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsDependenciesExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Lock
                  size={14}
                  className={blockedInfo.isBlocked ? 'text-rose-500' : 'text-[var(--text-secondary)]'}
                />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Dependencies & Blockers
                </span>
                {blockedInfo.isBlocked ? (
                  <Badge variant="danger" size="xs">
                    Blocked ({blockedInfo.blockingTasks.length})
                  </Badge>
                ) : task.blockedBy && task.blockedBy.length > 0 ? (
                  <Badge variant="success" size="xs">
                    Unblocked
                  </Badge>
                ) : (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
                )}
              </div>
              {isDependenciesExpanded ? (
                <ChevronUp size={15} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronDown size={15} className="text-[var(--text-muted)]" />
              )}
            </button>

            {isDependenciesExpanded && (
              <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3.5 text-xs">
                {/* Potential Duplicate Warning */}
                {topDup && !isDone && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-semibold text-amber-800 dark:text-amber-200">
                          Similar Task Detected ({Math.round(topDup.similarityScore * 100)}% match)
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 truncate font-mono text-[11px] mt-0.5 max-w-xs sm:max-w-sm">
                          "{topDup.task.title}"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMergeDuplicate(topDup.task)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                        title="Merge subtasks, tags, and notes into this task, and remove the duplicate"
                      >
                        <GitMerge size={12} />
                        <span>Merge Duplicate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedDuplicateId(topDup.task.id)}
                        className="px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Blocked Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-secondary)]">Blocking Status:</span>
                  {blockedInfo.isBlocked ? (
                    <Badge variant="danger" size="xs">
                      🔒 Blocked by {blockedInfo.blockingTasks.length} task{blockedInfo.blockingTasks.length > 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Unlock size={12} /> Ready to work
                    </span>
                  )}
                </div>

                {/* Current Blockers List */}
                {task.blockedBy && task.blockedBy.length > 0 && (
                  <div className="space-y-1.5">
                    {task.blockedBy.map((blockerId) => {
                      const blocker = tasks.find((t) => t.id === blockerId);
                      if (!blocker) return null;
                      const isBlockerDone = blocker.status === 'done';
                      return (
                        <div
                          key={blockerId}
                          className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isBlockerDone ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                              }`}
                            />
                            <span
                              className={`truncate font-medium ${
                                isBlockerDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {blocker.title}
                            </span>
                            {isBlockerDone && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                                (Completed)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (task.blockedBy || []).filter((id) => id !== blockerId);
                              updateTask(task.id, { blockedBy: updated });
                            }}
                            title="Remove blocker"
                            className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded-md transition-colors ml-2 shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Blocker Dropdown Selector with Cycle Detection Validation */}
                <div className="pt-0.5 space-y-1">
                  <select
                    id="task-blocker-select"
                    name="taskBlocker"
                    aria-label="Add blocking task dependency"
                    value=""
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const currentBlockedBy = task.blockedBy || [];
                      if (!currentBlockedBy.includes(selectedId)) {
                        if (wouldCreateCycle(task.id, selectedId, tasks)) {
                          showToast('Cannot add dependency: circular cycle detected!');
                          return;
                        }
                        updateTask(task.id, { blockedBy: [...currentBlockedBy, selectedId] });
                        showToast('Blocking dependency added');
                      }
                    }}
                    className="w-full bg-[var(--bg-surface-l1)] text-xs text-[var(--text-secondary)] border border-[var(--border-hairline)] rounded-lg px-3 py-2 outline-none card-surface cursor-pointer"
                  >
                    <option value="">+ Add blocking task dependency...</option>
                    {blockingCandidates
                      .filter((c) => !(task.blockedBy || []).includes(c.id))
                      .map((cand) => (
                        <option key={cand.id} value={cand.id}>
                          {cand.title} {cand.dueDate ? `(Due ${cand.dueDate})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Merge Helper Button */}
                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setIsMergeModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/25 transition-all shadow-xs"
                  >
                    <GitMerge size={12} />
                    <span>Open Merge Tool</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Tags & GTD Contexts */}
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsTagsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-[var(--color-brand)]" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Tags & Contexts
                </span>
                {((task.tags?.length || 0) + (task.contextTags?.length || 0)) > 0 && (
                  <Badge variant="neutral" size="xs">
                    {(task.tags?.length || 0) + (task.contextTags?.length || 0)}
                  </Badge>
                )}
              </div>
              {isTagsExpanded ? (
                <ChevronUp size={15} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronDown size={15} className="text-[var(--text-muted)]" />
              )}
            </button>

            {isTagsExpanded && (
              <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3 text-xs">
                {/* Current Tag Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.tags?.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--bg-surface-l1)] text-stone-700 dark:text-stone-300 border border-[var(--border-subtle)]"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (task.tags || []).filter((x) => x !== t);
                          updateTask(task.id, { tags: updated.length > 0 ? updated : undefined });
                        }}
                        className="hover:text-rose-500 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}

                  {task.contextTags?.map((ctx) => (
                    <span
                      key={ctx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                    >
                      <span>@{ctx}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (task.contextTags || []).filter((x) => x !== ctx);
                          updateTask(task.id, { contextTags: updated.length > 0 ? updated : undefined });
                        }}
                        className="hover:text-rose-500 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}

                  {(!task.tags || task.tags.length === 0) &&
                    (!task.contextTags || task.contextTags.length === 0) && (
                      <span className="text-[11px] text-[var(--text-muted)] italic">
                        No tags added yet.
                      </span>
                    )}
                </div>

                {/* Add Tag Form */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="task-tag-input"
                    name="taskTag"
                    aria-label="Add tag or context"
                    type="text"
                    placeholder="Add tag (e.g. #backend or @calls)..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newTagInput.trim();
                        if (!trimmed) return;
                        if (trimmed.startsWith('@')) {
                          const clean = trimmed.slice(1).toLowerCase();
                          const existing = task.contextTags || [];
                          if (!existing.includes(clean)) {
                            updateTask(task.id, { contextTags: [...existing, clean] });
                          }
                        } else {
                          const clean = trimmed.replace(/^#/, '').toLowerCase();
                          const existing = task.tags || [];
                          if (!existing.includes(clean)) {
                            updateTask(task.id, { tags: [...existing, clean] });
                          }
                        }
                        setNewTagInput('');
                      }
                    }}
                    className="flex-1 bg-[var(--bg-surface-l1)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 outline-none card-surface"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newTagInput.trim();
                      if (!trimmed) return;
                      if (trimmed.startsWith('@')) {
                        const clean = trimmed.slice(1).toLowerCase();
                        const existing = task.contextTags || [];
                        if (!existing.includes(clean)) {
                          updateTask(task.id, { contextTags: [...existing, clean] });
                        }
                      } else {
                        const clean = trimmed.replace(/^#/, '').toLowerCase();
                        const existing = task.tags || [];
                        if (!existing.includes(clean)) {
                          updateTask(task.id, { tags: [...existing, clean] });
                        }
                      }
                      setNewTagInput('');
                    }}
                    disabled={!newTagInput.trim()}
                    className="px-3 py-1.5 bg-stone-900 dark:bg-white text-white dark:text-stone-950 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all card-surface cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Quick Helper Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">Quick add:</span>
                  {['@computer', '@calls', '@errands', '@desk', '@focus'].map((chip) => {
                    const tagClean = chip.slice(1);
                    const isPresent = (task.contextTags || []).includes(tagClean);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          const existing = task.contextTags || [];
                          if (isPresent) {
                            updateTask(task.id, { contextTags: existing.filter((x) => x !== tagClean) });
                          } else {
                            updateTask(task.id, { contextTags: [...existing, tagClean] });
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border transition-colors ${
                          isPresent
                            ? 'bg-teal-600 text-white border-teal-600 font-bold'
                            : 'bg-[var(--bg-surface-l1)] text-teal-700 dark:text-teal-300 border-teal-500/20 hover:bg-teal-500/10'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Study Session Metadata */}
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsStudyExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Study Session Metadata
                </span>
                {task.sessionMetadata?.isSession && (
                  <Badge variant="success" size="xs">
                    Session #{task.sessionMetadata.sessionNumber || 1}
                  </Badge>
                )}
              </div>
              {isStudyExpanded ? (
                <ChevronUp size={15} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronDown size={15} className="text-[var(--text-muted)]" />
              )}
            </button>

            {isStudyExpanded && (
              <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3.5 text-xs">
                {task.sessionMetadata?.isSession ? (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          Study Session {task.sessionMetadata.sessionNumber ? `#${task.sessionMetadata.sessionNumber}` : ''}
                          {task.sessionMetadata.focusArea ? ` • ${task.sessionMetadata.focusArea}` : ''}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-2 mt-0.5">
                          {task.sessionMetadata.pacingMinutesPerQuestion && (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              ⚡ {task.sessionMetadata.pacingMinutesPerQuestion}m / question
                            </span>
                          )}
                          {task.sessionMetadata.targetCount && (
                            <span>• {completedSubs}/{task.sessionMetadata.targetCount} targets solved</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onStartSprint) {
                            onStartSprint(task.id);
                          } else {
                            onStartFocus(task.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
                      >
                        <Zap size={13} className="fill-current" />
                        <span>Launch Sprint</span>
                      </button>
                    </div>

                    {task.sessionMetadata.secondaryMilestone && (
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        <strong>Milestone:</strong> {task.sessionMetadata.secondaryMilestone}
                      </div>
                    )}
                    {task.sessionMetadata.contingencyGoal && (
                      <div className="text-[11px] text-[var(--text-muted)] italic">
                        <strong>Contingency:</strong> {task.sessionMetadata.contingencyGoal}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Standard task — study session tracking not activated.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        updateTask(task.id, {
                          sessionMetadata: {
                            isSession: true,
                            sessionTopic: task.title,
                            targetCount: task.subtasks?.length || 5,
                            pacingMinutesPerQuestion: 15,
                          },
                        });
                        showToast('Study session mode enabled');
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    >
                      Enable Study Mode
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 5: Activity & Audit Trail */}
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAuditExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <History size={14} className="text-amber-500" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Task details
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {task.status === 'done' ? 'Completed' : 'Active'}
                </span>
              </div>
              {isAuditExpanded ? (
                <ChevronUp size={15} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronDown size={15} className="text-[var(--text-muted)]" />
              )}
            </button>

            {isAuditExpanded && (
              <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                  <span className="text-[var(--text-muted)]">Status</span>
                  <Badge variant={task.status === 'done' ? 'success' : 'focus'} size="xs">
                    {task.status === 'done' ? 'Completed' : 'Active'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Created</span>
                  <span className="font-mono text-[var(--text-primary)] text-[11px]">
                    {formatAuditDate(task.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Progress</span>
                  <span className="inline-flex items-center gap-1 font-medium capitalize">
                    {task.status === 'done' ? (
                      <span className="text-emerald-500 flex items-center gap-1">
                        <Check size={12} strokeWidth={3} /> Done
                      </span>
                    ) : (
                      <span className="text-amber-500">In Progress</span>
                    )}
                  </span>
                </div>

                {task.completedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Completed At</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                      {formatAuditDate(task.completedAt)}
                    </span>
                  </div>
                )}

                {task.completedAt && task.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Turnaround Time</span>
                    <span className="font-mono text-[var(--text-primary)] text-[11px] font-semibold">
                      {calculateTurnaround(task.createdAt, task.completedAt)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)]">
                  <span className="text-[var(--text-muted)]">Time Logged vs Est.</span>
                  <span className="font-mono text-[11px]">
                    <span className="text-amber-500 font-semibold">{task.timeSpentMinutes || 0}m</span>
                    <span className="text-[var(--text-muted)]">
                      {' '}
                      / {task.estimatedMinutes ? `${task.estimatedMinutes}m` : 'none'}
                    </span>
                  </span>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Subtask Progress</span>
                    <span className="font-mono text-[11px] text-[var(--text-primary)]">
                      {task.subtasks.filter((s) => s.completed).length} / {task.subtasks.length} (
                      {Math.round(
                        (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                      )}
                      %)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Custom Recurrence Modal */}
        <RecurrenceModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          currentRule={task.customRecurrence}
          onSave={(rule) => {
            updateTask(task.id, {
              recurrence: 'custom',
              customRecurrence: rule,
            });
          }}
        />

        {/* Merge Task Preview Modal */}
        {isMergeModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => {
              setIsMergeModalOpen(false);
              setSelectedSourceTaskId('');
            }}
          >
            <div
              className="w-full max-w-lg bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] rounded-2xl shadow-modal overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l2)]/40">
                <div className="flex items-center gap-2">
                  <GitMerge size={16} className="text-[var(--color-brand)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Merge Tasks</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMergeModalOpen(false);
                    setSelectedSourceTaskId('');
                  }}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">Target Task (Retained):</p>
                  <p className="font-medium text-xs text-[var(--text-primary)] truncate">"{task.title}"</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="merge-source-select" className="font-semibold text-[var(--text-secondary)]">
                    Select source task to merge into this task:
                  </label>
                  <select
                    id="merge-source-select"
                    value={selectedSourceTaskId}
                    onChange={(e) => setSelectedSourceTaskId(e.target.value)}
                    className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-2 outline-none text-xs cursor-pointer"
                  >
                    <option value="">-- Choose a task to merge --</option>
                    {tasks
                      .filter((t) => t.id !== task.id && !t.deletedAt && !t.archivedAt)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.dueDate ? `(Due ${t.dueDate})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Merge Preview Details */}
                {selectedSourceTask && mergePreview && (
                  <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
                    <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <span>Merge Preview & Resolution</span>
                    </h4>

                    {/* Field Conflicts */}
                    {mergePreview.conflicts.length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="font-medium text-[var(--text-secondary)] text-[11px]">Field Resolution:</span>
                        <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-hairline)]">
                          {mergePreview.conflicts.map((c) => (
                            <div
                              key={c.field}
                              className="p-2 bg-[var(--bg-surface-l2)]/30 flex items-center justify-between text-[11px]"
                            >
                              <span className="font-semibold text-[var(--text-primary)]">{c.field}</span>
                              <div className="flex items-center gap-1.5 text-right font-mono">
                                <span className="text-[var(--text-muted)] line-through">{String(c.sourceValue)}</span>
                                <span>→</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {String(c.resolvedValue)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px]">
                        No field conflicts detected. Attributes cleanly merge.
                      </div>
                    )}

                    {/* Subtasks and Notes Rollup */}
                    <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l2)]/40 border border-[var(--border-hairline)] space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Subtasks to append:</span>
                        <span className="font-semibold font-mono">
                          {selectedSourceTask.subtasks?.length || 0} subtasks
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Notes:</span>
                        <span className="font-semibold">Concatenated with divider</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Dependency redirects:</span>
                        <span className="font-semibold font-mono">
                          {mergePreview.redirectedTasks.length} task(s) redirected
                        </span>
                      </div>
                    </div>

                    {mergePreview.redirectedTasks.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-800 dark:text-sky-300">
                        <span className="font-semibold">Dependent tasks updated:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {mergePreview.redirectedTasks.map((rt) => (
                            <li key={rt.taskId} className="truncate">
                              {rt.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-[11px] text-[var(--text-muted)] italic">
                      Note: "{selectedSourceTask.title}" will be marked as merged and archived.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2 bg-[var(--bg-surface-l2)]/40">
                <button
                  type="button"
                  onClick={() => {
                    setIsMergeModalOpen(false);
                    setSelectedSourceTaskId('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedSourceTaskId}
                  onClick={() => {
                    if (!selectedSourceTaskId) return;
                    const srcTitle = selectedSourceTask?.title || 'task';
                    mergeTasks(task.id, selectedSourceTaskId);
                    showToast(`Merged "${srcTitle}" into "${task.title}"`);
                    setIsMergeModalOpen(false);
                    setSelectedSourceTaskId('');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Confirm Merge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
