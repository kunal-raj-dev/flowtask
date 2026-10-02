import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { suggestSubtasks, suggestDuration } from '../../utils/aiCopilot';
import { generateStarterAction } from '../../utils/procrastinationSplitter';
import { getVelocityCalibration } from '../../utils/velocityCalibrator';
import { formatLocalDate } from '../../utils/nlpParser';
import { findPotentialDuplicates } from '../../utils/duplicateDetector';
import {
  isTaskBlocked,
  getPotentialBlockingCandidates,
  mergeTaskData,
} from '../../utils/dependencyUtils';
import { saveCustomTemplate } from '../../utils/templateEngine';
import { RecurrenceModal } from '../modals/RecurrenceModal';

interface TaskDrawerProps {
  taskId: string;
  onClose: () => void;
  onStartFocus: (taskId: string) => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  taskId,
  onClose,
  onStartFocus,
}) => {
  const {
    tasks,
    projects,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleTaskPinToday,
    toggleSubTask,
    addSubTask,
    deleteSubTask,
    promoteSubTaskToTask,
    moveSubTask,
    duplicateTask,
    showToast,
    activeTimerTaskId,
    activeTimerSeconds,
    toggleTaskTimer,
  } = useTaskContext();

  const [isMarkdownPreview, setIsMarkdownPreview] = useState(true);

  const task = tasks.find((t) => t.id === taskId);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskEstimate, setNewSubtaskEstimate] = useState<number | undefined>(undefined);

  const [isDecomposing, setIsDecomposing] = useState(false);
  const [dismissedDuplicateId, setDismissedDuplicateId] = useState<string | null>(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);

  // Mobile drag-to-dismiss gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      setDragY(diff);
    }
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
    const merged = mergeTaskData(task, duplicateTask);
    updateTask(task.id, merged);
    deleteTask(duplicateTask.id);
    setDismissedDuplicateId(duplicateTask.id);
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
      suggested.forEach((sub) => {
        const exists = task.subtasks?.some((s) => s.title.toLowerCase() === sub.title.toLowerCase());
        if (!exists) {
          addSubTask(task.id, sub.title);
        }
      });

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
  const completedSubMinutes = task.subtasks?.filter((s) => s.completed).reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;

  const isActiveTimer = activeTimerTaskId === task.id;
  const primaryTag = task.contextTags && task.contextTags.length > 0 ? task.contextTags[0] : undefined;
  const calibration = getVelocityCalibration(tasks, task.estimatedMinutes, task.projectId, primaryTag);

  const currentProject = projects.find((p) => p.id === task.projectId);
  const domainLabel = calibration?.scope === 'tag' && primaryTag
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
            className="px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-white/[0.08] font-mono text-[11px] text-indigo-700 dark:text-indigo-300"
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
            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium underline-offset-2"
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
            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium underline-offset-2"
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

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-end md:items-stretch md:justify-end"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg max-h-[92vh] md:max-h-full h-auto md:h-full bg-[var(--bg-surface-l2)] rounded-t-3xl md:rounded-none border-t md:border-t-0 md:border-l border-[var(--border-hairline)] shadow-modal flex flex-col overflow-hidden card-surface animate-slide-down"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Pill Handle */}
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
          className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleTaskStatus(task.id)}
              className={`w-5 h-5 rounded-[7px] flex items-center justify-center border active:scale-90 transition-all duration-150 ${
                isDone
                  ? 'bg-gradient-to-br from-stone-900 to-stone-800 dark:from-white dark:to-stone-200 border-stone-800 dark:border-white text-white dark:text-stone-950 shadow-xs'
                  : 'border-stone-300 dark:border-stone-600 hover:border-amber-500 hover:ring-4 hover:ring-amber-500/15'
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
                  <polyline
                    points="20 6 9 17 4 12"
                    className="animate-check-draw"
                  />
                </svg>
              )}
            </button>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {isDone ? 'Completed' : 'Active Task'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleTaskPinToday(task.id)}
              title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
              className={`p-1.5 rounded-xl transition-all ${
                task.isPinnedToday
                  ? 'text-amber-500 bg-amber-500/15 border border-amber-500/30 shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Star size={16} className={task.isPinnedToday ? 'fill-current' : ''} />
            </button>

            <button
              onClick={() => {
                onClose();
                onStartFocus(task.id);
              }}
              title="Start Focus Timer"
              className="p-1.5 text-[var(--text-muted)] hover:text-indigo-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <Timer size={16} />
            </button>

            <button
              onClick={() => {
                duplicateTask(task.id);
                onClose();
              }}
              title="Duplicate task (Clone)"
              className="p-1.5 text-[var(--text-muted)] hover:text-indigo-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <Copy size={16} />
            </button>

            <button
              onClick={() => {
                deleteTask(task.id);
                onClose();
              }}
              title="Delete task"
              className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <Trash2 size={16} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Potential Duplicate Warning Banner */}
          {topDup && !isDone && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
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
                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                  title="Merge subtasks, tags, and notes into this task, and remove the duplicate"
                >
                  <GitMerge size={12} />
                  <span>Merge Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedDuplicateId(topDup.task.id)}
                  className="px-2 py-1 rounded-xl text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Title Editor */}
          <div>
            <input
              type="text"
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              className={`w-full bg-transparent text-xl font-bold outline-none transition-colors tracking-tight ${
                isDone
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]'
              }`}
              placeholder="Task title..."
            />
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 gap-3.5 p-4 bg-[var(--bg-surface-l1)]/60 rounded-2xl border border-[var(--border-hairline)] text-xs card-surface">
            {/* Project Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Folder size={13} /> Project
              </label>
              <select
                value={task.projectId}
                onChange={(e) => updateTask(task.id, { projectId: e.target.value })}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Flag size={13} /> Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface cursor-pointer"
              >
                <option value="p1">P1 Urgent</option>
                <option value="p2">P2 High</option>
                <option value="p3">P3 Medium</option>
                <option value="p4">P4 Normal / Low</option>
              </select>
            </div>

            {/* Due Date Picker & Quick Scrubber */}
            <div className="space-y-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Calendar size={13} /> Due Date
                </label>
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { dueDate: undefined })}
                    className="text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Clear (Someday)
                  </button>
                )}
              </div>
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface"
              />
              {/* Quick Date Scrubber */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => updateTask(task.id, { dueDate: formatLocalDate(new Date()) })}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
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
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const day = d.getDay();
                    const diff = (6 - day + 7) % 7 || 7;
                    d.setDate(d.getDate() + diff);
                    updateTask(task.id, { dueDate: formatLocalDate(d) });
                  }}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  This Weekend
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const day = d.getDay();
                    const diff = (1 - day + 7) % 7 || 7;
                    d.setDate(d.getDate() + diff);
                    updateTask(task.id, { dueDate: formatLocalDate(d) });
                  }}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Next Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
                    base.setDate(base.getDate() + 1);
                    updateTask(task.id, { dueDate: formatLocalDate(base) });
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                  title="Postpone 1 day"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
                    base.setDate(base.getDate() + 7);
                    updateTask(task.id, { dueDate: formatLocalDate(base) });
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                  title="Postpone 1 week"
                >
                  +1w
                </button>
              </div>
            </div>

            {/* Recurrence Picker */}
            <div className="space-y-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Repeat size={13} /> Recurrence
                </label>
                {task.recurrence === 'custom' && task.customRecurrence && (
                  <button
                    type="button"
                    onClick={() => setIsRecurrenceModalOpen(true)}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Edit Rule
                  </button>
                )}
              </div>
              <select
                value={task.recurrence || 'none'}
                onChange={(e) => {
                  const val = e.target.value as RecurrenceFrequency;
                  if (val === 'custom') {
                    setIsRecurrenceModalOpen(true);
                  } else {
                    updateTask(task.id, { recurrence: val, customRecurrence: undefined });
                  }
                }}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface cursor-pointer"
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
                <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Repeats every {task.customRecurrence.interval === 1 ? '' : task.customRecurrence.interval + ' '}
                  {task.customRecurrence.unit}
                  {task.customRecurrence.mode === 'completion' ? ' (after completion)' : ''}
                </div>
              )}
            </div>

            {/* Estimated Duration & Live Stopwatch */}
            <div className="space-y-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Clock size={13} /> Estimated Time (minutes)
                </label>
                {/* Live Stopwatch Trigger */}
                {!isDone && (
                  <button
                    type="button"
                    onClick={() => toggleTaskTimer(task.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                      isActiveTimer
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 animate-pulse'
                        : 'bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-amber-500 border border-[var(--border-hairline)]'
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
                    className="w-24 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface"
                  />
                  <div className="flex items-center gap-1.5">
                    {[15, 25, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateTask(task.id, { estimatedMinutes: mins })}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] shadow-xs card-surface transition-colors"
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
                {task.timeSpentMinutes && task.timeSpentMinutes > 0 ? (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                    {task.timeSpentMinutes}m spent
                  </span>
                ) : null}
              </div>

              {/* Historical Velocity Calibrator (Anti-Planning Fallacy) */}
              {calibration && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-3 text-xs animate-slide-down shadow-xs">
                  <div className="min-w-0 pr-1 flex items-start gap-2">
                    <span className="text-amber-500 font-bold shrink-0 mt-0.5">🎯</span>
                    <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                      <span>You usually take <strong>~{calibration.recommendedMinutes}m</strong> on <strong>{domainLabel}</strong> tasks ({calibration.ratio}x variance across {calibration.sampleCount} tasks).</span>
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

          {/* Tags & GTD Context Manager */}
          <div className="p-4 bg-[var(--bg-surface-l1)]/60 rounded-2xl border border-[var(--border-hairline)] space-y-2.5 text-xs card-surface">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                <Tag size={13} className="text-indigo-500" />
                <span>Tags & Context Labels</span>
              </label>
              <div className="text-[10px] text-[var(--text-muted)]">
                Use #tag or @context
              </div>
            </div>

            {/* Existing Tags / Context Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {task.tags?.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-stone-500/10 text-stone-700 dark:text-stone-300 border border-stone-500/20"
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

              {(!task.tags || task.tags.length === 0) && (!task.contextTags || task.contextTags.length === 0) && (
                <span className="text-[11px] text-[var(--text-muted)] italic">
                  No tags added yet.
                </span>
              )}
            </div>

            {/* Add tag form */}
            <div className="flex items-center gap-2 pt-1">
              <input
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
                className="flex-1 bg-[var(--bg-surface-l2)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface"
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
                className="px-3 py-1.5 bg-stone-900 dark:bg-white text-white dark:text-stone-950 text-xs font-semibold rounded-xl disabled:opacity-40 transition-all card-surface cursor-pointer"
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
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium border transition-colors ${
                      isPresent
                        ? 'bg-teal-600 text-white border-teal-600 font-bold'
                        : 'bg-[var(--bg-surface-l2)] text-teal-700 dark:text-teal-300 border-teal-500/20 hover:bg-teal-500/10'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Dependencies & Blockers */}
          <div className="p-4 bg-[var(--bg-surface-l1)]/60 rounded-2xl border border-[var(--border-hairline)] space-y-3 card-surface">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                <Lock size={13} className={blockedInfo.isBlocked ? 'text-rose-500' : 'text-[var(--text-secondary)]'} />
                <span>Dependencies & Blockers</span>
              </label>
              {blockedInfo.isBlocked ? (
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                  🔒 Blocked by {blockedInfo.blockingTasks.length} task{blockedInfo.blockingTasks.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Unlock size={12} /> Ready to work
                </span>
              )}
            </div>

            {/* Existing Blockers List */}
            {task.blockedBy && task.blockedBy.length > 0 && (
              <div className="space-y-1.5">
                {task.blockedBy.map((blockerId) => {
                  const blocker = tasks.find((t) => t.id === blockerId);
                  if (!blocker) return null;
                  const isBlockerDone = blocker.status === 'done';
                  return (
                    <div
                      key={blockerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isBlockerDone ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                          }`}
                        />
                        <span
                          className={`truncate font-medium ${
                            isBlockerDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {blocker.title}
                        </span>
                        {isBlockerDone && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                            (Completed - Unblocked)
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
                        className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded-lg transition-colors ml-2 shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Blocker Dropdown Selector */}
            <div className="pt-0.5">
              <select
                value=""
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (!selectedId) return;
                  const currentBlockedBy = task.blockedBy || [];
                  if (!currentBlockedBy.includes(selectedId)) {
                    updateTask(task.id, { blockedBy: [...currentBlockedBy, selectedId] });
                  }
                }}
                className="w-full bg-[var(--bg-surface-l2)] text-xs text-[var(--text-secondary)] border border-[var(--border-hairline)] rounded-xl px-3 py-2 outline-none card-surface cursor-pointer"
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
          </div>

          {/* Subtasks Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Subtasks {totalSubs > 0 && `(${completedSubs}/${totalSubs})`}
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleStarterStep}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs transition-all active:scale-95 card-surface"
                  title="Cognitive de-escalation: Generate a tailored 5-minute starter action to break inertia"
                >
                  <Zap size={11} className="text-amber-500 fill-current" />
                  <span>Break Inertia (5m)</span>
                </button>

                <button
                  type="button"
                  onClick={handleMagicBreakdown}
                  disabled={isDecomposing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-pink-500/10 hover:from-purple-500/25 hover:to-pink-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs transition-all active:scale-95 disabled:opacity-50 card-surface"
                  title="Automatically generate action steps with AI"
                >
                  <Sparkles size={11} className={isDecomposing ? 'animate-spin text-purple-500' : 'text-purple-500'} />
                  <span>{isDecomposing ? 'Decomposing...' : 'Magic Breakdown'}</span>
                </button>

                {totalSubs > 0 && (
                  <span className="text-xs font-mono text-[var(--text-muted)] font-semibold">{progressPercent}%</span>
                )}
              </div>
            </div>

            {/* Progress bar and Subtask Rollup */}
            {totalSubs > 0 && (
              <div className="space-y-1.5 mb-3">
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
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      title={`Update parent task estimate to sum of subtasks (${totalSubMinutes}m)`}
                    >
                      Sync to Task ({totalSubMinutes}m)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Subtask list */}
            <div className="space-y-1.5">
              {task.subtasks?.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-200/40 dark:hover:bg-white/[0.04] group transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSubTask(task.id, sub.id)}
                      className={`w-4 h-4 rounded-[5px] flex items-center justify-center border transition-all active:scale-90 ${
                        sub.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-stone-300 dark:border-stone-600 hover:border-amber-500'
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
                    <span
                      className={`text-xs ${
                        sub.completed
                          ? 'line-through text-[var(--text-muted)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {sub.title}
                    </span>
                    {sub.estimatedMinutes && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200/70 dark:bg-stone-800 text-[var(--text-muted)] font-semibold border border-[var(--border-hairline)] shrink-0">
                        {sub.estimatedMinutes}m
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      type="button"
                      onClick={() => moveSubTask(task.id, sub.id, 'up')}
                      title="Move step up"
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition-all"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSubTask(task.id, sub.id, 'down')}
                      title="Move step down"
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition-all"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => promoteSubTaskToTask(task.id, sub.id)}
                      title="Promote subtask to independent task"
                      className="text-[var(--text-muted)] hover:text-indigo-500 p-1 rounded-lg transition-all"
                    >
                      <ArrowUpRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSubTask(task.id, sub.id)}
                      className="text-[var(--text-muted)] hover:text-rose-500 p-1 rounded-lg transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add subtask input */}
            <form onSubmit={handleAddSub} className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                placeholder="Add subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-1.5 bg-[var(--bg-surface-l1)]/60 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface"
              />
              <input
                type="number"
                min="1"
                step="5"
                placeholder="min"
                value={newSubtaskEstimate || ''}
                onChange={(e) =>
                  setNewSubtaskEstimate(e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                className="w-14 text-xs px-2 py-1.5 bg-[var(--bg-surface-l1)]/60 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface text-center font-mono"
                title="Optional step duration estimate in minutes"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim()}
                className="p-1.5 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 rounded-xl border border-[var(--border-hairline)] shadow-xs transition-colors card-surface"
              >
                <Plus size={14} />
              </button>
            </form>

            {/* Save as Blueprint Template */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    saveCustomTemplate({
                      name: task.title,
                      description: task.description,
                      defaultPriority: task.priority,
                      defaultEstimatedMinutes: task.estimatedMinutes,
                      subtaskTitles: task.subtasks.map((s) => s.title),
                      contextTags: task.contextTags,
                    });
                    showToast(`Saved "${task.title}" as reusable workflow blueprint!`);
                  }}
                  title="Save current task and its subtasks as a reusable template"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/25 transition-all active:scale-95 shadow-xs"
                >
                  <Bookmark size={12} />
                  <span>Save as Blueprint</span>
                </button>
              </div>
            )}
          </div>

          {/* Description & Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
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
                className="w-full min-h-[110px] p-3.5 bg-[var(--bg-surface-l1)]/50 border border-[var(--border-hairline)] rounded-2xl cursor-pointer hover:border-stone-400 dark:hover:border-stone-600 transition-colors card-surface"
                title="Click to edit notes"
              >
                {renderMarkdownNotes(task.description || '')}
              </div>
            ) : (
              <textarea
                rows={5}
                autoFocus
                value={task.description || ''}
                onChange={(e) => updateTask(task.id, { description: e.target.value })}
                onBlur={() => setIsMarkdownPreview(true)}
                placeholder="Add details, links, checklists (- [ ]), or code (`code`)..."
                className="w-full text-xs p-3.5 bg-[var(--bg-surface-l1)]/50 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-2xl outline-none focus:border-stone-400 dark:focus:border-stone-600 resize-none leading-relaxed card-surface font-mono"
              />
            )}
          </div>

          {/* Activity Audit & Completion History */}
          <div className="pt-2 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setIsAuditTrailOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1"
            >
              <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <History size={13} className="text-amber-500" />
                <span>Audit & Activity Trail</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-normal text-[var(--text-muted)]">
                <span>{task.completedAt ? 'Completed' : 'Active'}</span>
                {isAuditTrailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {isAuditTrailOpen && (
              <div className="mt-2.5 p-3.5 bg-[var(--bg-surface-l1)]/50 rounded-2xl border border-[var(--border-hairline)] text-xs space-y-2.5 card-surface animate-slide-down">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Created</span>
                  <span className="font-mono text-[var(--text-primary)] text-[11px]">
                    {formatAuditDate(task.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Status</span>
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

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)]">Time Logged vs Est.</span>
                  <span className="font-mono text-[11px]">
                    <span className="text-amber-500 font-semibold">{task.timeSpentMinutes || 0}m</span>
                    <span className="text-[var(--text-muted)]"> / {task.estimatedMinutes ? `${task.estimatedMinutes}m` : 'none'}</span>
                  </span>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Subtask Progress</span>
                    <span className="font-mono text-[11px] text-[var(--text-primary)]">
                      {task.subtasks.filter((s) => s.completed).length} / {task.subtasks.length} ({Math.round((task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100)}%)
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
      </div>
    </div>
  );
};
