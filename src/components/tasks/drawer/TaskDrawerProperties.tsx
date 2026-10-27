import { getEffectiveTaskEstimate } from '../../../utils/taskTimeSummary';
import React, { useState, useContext, useRef } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { WorkspaceStoreContext, useWorkspaceSelector } from '../../../services/workspaceStore';
import { useModal } from '../../../context/ModalContext';
import { useTodayStr, useTomorrowStr } from '../../../hooks/useCurrentDate';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import type { Task, Priority, TaskReminder } from '../../../types/task';
import { Folder, Calendar, Clock, Flag, Timer, Plus, X, Pencil, Bell, BellRing, Check, Compass, Target, Sparkles, Hourglass, AlertTriangle, Lock } from 'lucide-react';
import {
  getReminderCapability,
  requestReminderPermission,
  addReminderToTask,
  snoozeReminder,
  removeReminder,
} from '../../../services/reminderService';
import { parseTimeToMinutes, findOverlappingCalendarEvent, findNextFreeGap, minutesToTimeStr } from '../../../utils/timelineUtils';
import { LazyTaskSessionEditor as TaskSessionEditor } from '../LazyTaskSessionEditor';
import type { SessionDraft } from '../TaskSessionEditor';

interface TaskDrawerPropertiesProps {
  task: Task;
}

export const TaskDrawerProperties: React.FC<TaskDrawerPropertiesProps> = ({ task }) => {
  const { projects, updateTask, tasks, calendarEvents, showToast } = useTaskContext();
  const areas = useWorkspaceSelector((s) => s?.record?.areas) || [];
  const goals = useWorkspaceSelector((s) => s?.record?.goals) || [];
  const { openModal } = useModal();
  const store = useContext(WorkspaceStoreContext);
  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [capability, setCapability] = useState(getReminderCapability());
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  const [reminderTimeStr, setReminderTimeStr] = useState('09:00');
  const [reminderDateStr, setReminderDateStr] = useState(task.plannedDate || task.dueDate || todayStr);

  if (task.id !== prevTaskId) {
    setPrevTaskId(task.id);
    setReminderDateStr(task.plannedDate || task.dueDate || todayStr);
  }


  // Compute next available session number for target date
  const workloadEstimate = getEffectiveTaskEstimate(task);
  const targetDate = task.plannedDate || task.dueDate || todayStr;
  const nextSessionNum = React.useMemo(() => {
    const targetDateSessions = tasks.filter(
      (t) => t.id !== task.id && !t.deletedAt && !t.archivedAt && (t.plannedDate || t.dueDate) === targetDate && t.sessionMetadata?.isSession
    );
    const nums = targetDateSessions.map((t) => t.sessionMetadata?.sessionNumber || 1);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [tasks, targetDate, task.id]);

  const calendarDurationMinutes = React.useMemo(() => {
    const startMin = parseTimeToMinutes(task.scheduledStart);
    const endMin = parseTimeToMinutes(task.scheduledEnd);
    if (startMin === null || endMin === null) return null;
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    return diff;
  }, [task.scheduledStart, task.scheduledEnd]);

  const currentDuration = React.useMemo(() => {
    const startMin = parseTimeToMinutes(task.scheduledStart);
    const endMin = parseTimeToMinutes(task.scheduledEnd);
    if (startMin === null || endMin === null) {
      return workloadEstimate ? `${workloadEstimate}m` : null;
    }
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m (${diff}m)` : `${h}h (${diff}m)`) : `${m}m`;
  }, [task.scheduledStart, task.scheduledEnd, workloadEstimate]);

  const [pendingConflict, setPendingConflict] = useState<{
    draft: SessionDraft;
    conflictingTitle: string;
    conflictingTime: string;
    suggestedSlot?: { startTime: string; endTime: string };
  } | null>(null);

  const conflictDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(conflictDialogRef, () => setPendingConflict(null), Boolean(pendingConflict));

  const handlePlannedDateChange = (newDate: string | undefined) => {
    if (task.scheduleLocked) {
      showToast?.('This task is locked. Unlock it before changing its scheduled date.');
      return;
    }
    updateTask(task.id, { plannedDate: newDate });
  };

  const commitSession = (draftToApply: SessionDraft) => {
    const isStudy = Boolean(task.isStudy || task.projectId === 'study' || task.sessionMetadata?.targetPacingMinutes);
    updateTask(task.id, {
      scheduledStart: draftToApply.startTime,
      scheduledEnd: draftToApply.endTime,
      plannedDate: draftToApply.plannedDate || task.plannedDate || todayStr,
      sessionMetadata: {
        ...(task.sessionMetadata || {}),
        ...(isStudy ? { isSession: true } : { isSession: false }),
        sessionNumber: draftToApply.sessionNumber,
        sessionTopic: task.title,
      },
    });
    setIsEditingSession(false);
  };

  const handleApplySession = (draft: SessionDraft) => {
    if (task.scheduleLocked) {
      showToast?.('This task is locked. Unlock it before changing its scheduled time.');
      return;
    }

    const schedDate = draft.plannedDate || task.plannedDate || todayStr;
    const startMin = parseTimeToMinutes(draft.startTime);
    const endMin = parseTimeToMinutes(draft.endTime);

    if (startMin !== null && endMin !== null) {
      const conflictingTask = (tasks || []).find((t) => {
        if (t.id === task.id || t.deletedAt || t.archivedAt) return false;
        const taskDate = t.plannedDate || t.dueDate;
        if (taskDate !== schedDate) return false;
        if (!t.scheduledStart || !t.scheduledEnd) return false;
        const tStart = parseTimeToMinutes(t.scheduledStart);
        const tEnd = parseTimeToMinutes(t.scheduledEnd);
        if (tStart === null || tEnd === null) return false;
        return startMin < tEnd && endMin > tStart;
      });

      const dayEvents = (calendarEvents || []).filter(
        (ev) => !ev.date || ev.date === schedDate
      );
      const conflictingEvent = findOverlappingCalendarEvent(startMin, endMin - startMin, dayEvents);

      if (conflictingTask || conflictingEvent) {
        const durationMin = draft.durationMinutes || (endMin - startMin);
        const dayTasks = (tasks || []).filter((t) => {
          if (t.id === task.id || t.deletedAt || t.archivedAt) return false;
          return (t.plannedDate || t.dueDate) === schedDate;
        });
        let freeMin = findNextFreeGap(durationMin, dayTasks, dayEvents, endMin);
        if (freeMin === null) {
          freeMin = findNextFreeGap(durationMin, dayTasks, dayEvents, 7 * 60);
        }
        const suggestedSlot = freeMin !== null ? {
          startTime: minutesToTimeStr(freeMin),
          endTime: minutesToTimeStr(freeMin + durationMin),
        } : undefined;

        setPendingConflict({
          draft,
          conflictingTitle: conflictingTask ? conflictingTask.title : conflictingEvent!.title || 'Calendar event',
          conflictingTime: conflictingTask ? `${conflictingTask.scheduledStart}–${conflictingTask.scheduledEnd}` : `${conflictingEvent!.startTime}–${conflictingEvent!.endTime}`,
          suggestedSlot,
        });
        return;
      }
    }

    commitSession(draft);
  };

  const handleRemoveSession = () => {
    if (task.scheduleLocked) {
      showToast?.('This task is locked. Unlock it before removing its scheduled time.');
      return;
    }
    updateTask(task.id, {
      scheduledStart: undefined,
      scheduledEnd: undefined,
      sessionMetadata: task.sessionMetadata ? { ...task.sessionMetadata, isSession: false } : undefined,
    });
    setIsEditingSession(false);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] text-xs card-surface">
      {/* Project Select */}
      <div className="space-y-1.5 min-w-0">
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
          onChange={(e) => updateTask(task.id, { projectId: e.target.value, milestoneId: undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
        >
          {projects.filter(p => !p.isArchived || p.id === task.projectId).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {!!projects.find(project => project.id === task.projectId)?.milestones?.length && (<div className="space-y-1.5 min-w-0">
        <label htmlFor="task-milestone-select" className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
          Project milestone
        </label>
        <select
          id="task-milestone-select"
          aria-label="Assign to project milestone"
          value={task.milestoneId || ''}
          disabled={!(projects.find(project => project.id === task.projectId)?.milestones?.length)}
          onChange={event => updateTask(task.id, { milestoneId: event.target.value || undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer disabled:opacity-60"
        >
          <option value="">No milestone</option>
          {(projects.find(project => project.id === task.projectId)?.milestones || []).map(milestone => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
        </select>
        {!(projects.find(project => project.id === task.projectId)?.milestones?.length) && <p className="text-[10px] text-[var(--text-muted)]">Add a milestone to this project to link the task.</p>}
      </div>)}

      {/* Priority Select */}
      <div className="space-y-1.5 min-w-0">
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

      {/* Planned Date */}
      <div className="space-y-1.5 min-w-0">
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
              onClick={() => handlePlannedDateChange(undefined)}
              className="text-[10px] text-[var(--color-brand)] dark:text-[var(--color-brand)] hover:underline cursor-pointer"
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
          onChange={(e) => handlePlannedDateChange(e.target.value || undefined)}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface"
        />
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5 min-w-0">
          <button
            type="button"
            onClick={() => handlePlannedDateChange(todayStr)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.plannedDate === todayStr
                ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] border-[var(--color-brand-border)] font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l3)] dark:hover:bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handlePlannedDateChange(tomorrowStr)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.plannedDate === tomorrowStr
                ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] border-[var(--color-brand-border)] font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l3)] dark:hover:bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Life Area Select */}
      {(() => {
        const currentProject = projects.find((p) => p.id === task.projectId);
        const inheritedArea = areas.find((a: any) => a.id === currentProject?.areaId);
        const isOverridden = Boolean(task.areaId && inheritedArea && task.areaId !== inheritedArea.id);
        const isInherited = Boolean(!task.areaId && inheritedArea);

        return (
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center justify-between">
              <label
                htmlFor="task-area-select"
                className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
              >
                <Compass size={13} className="text-[var(--pastel-lavender)]" /> Life Area
              </label>
              {isOverridden ? (
                <span className="text-[10px] text-[var(--color-brand)] dark:text-[var(--color-brand)] font-mono">(Override)</span>
              ) : isInherited ? (
                <span className="text-[10px] text-[var(--text-muted)] font-mono">(Inherited from {currentProject?.name})</span>
              ) : null}
            </div>
            <select
              id="task-area-select"
              name="taskArea"
              aria-label="Assign to Life Area"
              value={task.areaId || ''}
              onChange={(e) => updateTask(task.id, { areaId: e.target.value || undefined })}
              className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
            >
              <option value="">
                {inheritedArea ? `Inherit from project (${inheritedArea.name})` : 'No Life Area'}
              </option>
              {areas.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.icon ? `${a.icon} ` : ''}{a.name}
                </option>
              ))}
            </select>
          </div>
        );
      })()}

      {/* Vision & Quarterly Goal */}
      <div className="space-y-1.5 min-w-0">
        <label
          htmlFor="task-goal-select"
          className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
        >
          <Target size={13} className="text-[var(--pastel-sage)]" /> Vision Goal
        </label>
        <select
          id="task-goal-select"
          name="taskGoal"
          aria-label="Link to Vision Goal"
          value={task.goalId || ''}
          onChange={(e) => updateTask(task.id, { goalId: e.target.value || undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
        >
          <option value="">No Linked Goal</option>
          {goals.map((g: any) => (
            <option key={g.id} value={g.id}>
              {g.title} ({g.quarter || 'Ongoing'})
            </option>
          ))}
        </select>
      </div>

      {/* GTD Defer Until (Tickler) */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center justify-between">
          <label
            htmlFor="task-defer-until-input"
            className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
          >
            <Hourglass size={13} className="text-[var(--pastel-sky)]" /> Defer Until (Tickler)
          </label>
          {task.deferUntil && (
            <button
              type="button"
              onClick={() => updateTask(task.id, { deferUntil: undefined })}
              className="text-[10px] text-[var(--pastel-sky)] dark:text-[var(--pastel-sky)] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <input
          id="task-defer-until-input"
          name="taskDeferUntil"
          aria-label="Defer until date"
          type="date"
          value={task.deferUntil || ''}
          onChange={(e) => updateTask(task.id, { deferUntil: e.target.value || undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface"
        />
        <p className="text-[10px] text-[var(--text-muted)]">Hides task from Today until this date arrives.</p>
      </div>

      {/* Life Admin & Procrastination Wizard Row */}
      <div className="space-y-1.5 min-w-0 flex flex-col justify-end">
        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)] transition">
          <input
            type="checkbox"
            checked={Boolean(task.isLifeAdmin)}
            onChange={(e) => updateTask(task.id, { isLifeAdmin: e.target.checked })}
            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
          />
          <div className="text-[11px]">
            <span className="font-semibold text-[var(--text-primary)]">Life Admin Task</span>
            <p className="text-[10px] text-[var(--text-secondary)]">Low cognitive friction (errands, emails, billing)</p>
          </div>
        </label>
      </div>

      {/* Overcome Resistance (Procrastination Diagnostic Wizard Banner) */}
      <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-[var(--color-brand-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] flex items-center justify-center font-bold">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">Stuck or feeling friction?</p>
            <p className="text-[10px] text-[var(--text-secondary)]">Diagnose why, start "Just 10 Mins", or break into micro-steps.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openModal('procrastinationWizard', { taskId: task.id, task })}
          className="px-3.5 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--text-on-brand)] font-medium text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Sparkles size={13} />
          <span>Break Down</span>
        </button>
      </div>

      {/* Deadline / Due Date */}
      <div className="space-y-1.5 min-w-0">
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
              className="text-[10px] text-[var(--color-brand)] dark:text-[var(--color-brand)] hover:underline cursor-pointer"
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
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5 min-w-0">
          <button
            type="button"
            onClick={() => updateTask(task.id, { dueDate: todayStr })}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.dueDate === todayStr
                ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] border-[var(--color-brand-border)] font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l3)] dark:hover:bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => updateTask(task.id, { dueDate: tomorrowStr })}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.dueDate === tomorrowStr
                ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] border-[var(--color-brand-border)] font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l3)] dark:hover:bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Session & Timeline Schedule Section */}
      <div className="sm:col-span-2 min-w-0 pt-2.5 border-t border-[var(--border-hairline)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
            <Timer size={13} className="text-[var(--pastel-sage)]" />
            <span>Session & Timeline Schedule</span>
            {task.scheduleLocked && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] border border-[var(--color-brand-border)] flex items-center gap-1">
                <Lock size={9} /> Locked
              </span>
            )}
            {task.sessionMetadata?.isSession && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)] border border-[var(--border-color)]">
                🎯 Session {task.sessionMetadata.sessionNumber || 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.scheduledStart || task.sessionMetadata?.isSession ? (
              <>
                {!isEditingSession && (
                  <button
                    type="button"
                    onClick={() => {
                      if (task.scheduleLocked) {
                        showToast?.('This task is locked. Unlock it before changing its scheduled time.');
                        return;
                      }
                      setIsEditingSession(true);
                    }}
                    className="text-[10px] font-semibold text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Pencil size={10} />
                    <span>Edit Session</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (task.scheduleLocked) {
                      showToast?.('This task is locked. Unlock it before changing its scheduled time.');
                      return;
                    }
                    handleRemoveSession();
                  }}
                  className="text-[10px] font-medium text-[var(--pastel-coral)] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <X size={10} />
                  <span>Remove Session</span>
                </button>
              </>
            ) : (
              !isEditingSession && (
                <button
                  type="button"
                  onClick={() => {
                    if (task.scheduleLocked) {
                      showToast?.('This task is locked. Unlock it before changing its scheduled time.');
                      return;
                    }
                    setIsEditingSession(true);
                  }}
                  className="text-[10px] font-semibold text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus size={11} />
                  <span>+ Add Session</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Schedule Lock Guard Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none">
            <input
              type="checkbox"
              aria-label="Lock this task's scheduled time"
              checked={Boolean(task.scheduleLocked)}
              onChange={(e) => updateTask(task.id, { scheduleLocked: e.target.checked })}
              className="rounded text-[var(--color-brand)] focus:ring-[var(--color-focus-ring)]"
            />
            <span className="flex items-center gap-1">
              <Lock size={11} className={task.scheduleLocked ? 'text-[var(--color-brand)]' : 'text-[var(--text-muted)]'} />
              Lock this task's scheduled time
            </span>
          </label>
        </div>

        {/* Existing Session summary banner when not editing */}
        {(task.scheduledStart || task.sessionMetadata?.isSession) && !isEditingSession && (
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Calendar block:</span>
                <span className="font-mono text-[11px] text-[var(--text-primary)] font-bold">
                  {task.scheduledStart || '08:00'} – {task.scheduledEnd || '11:00'}
                </span>
                {currentDuration && (
                  <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)]">
                    {currentDuration}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (task.scheduleLocked) {
                    showToast?.('This task is locked. Unlock it before changing its scheduled time.');
                    return;
                  }
                  setIsEditingSession(true);
                }}
                className="text-[11px] text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)] font-semibold hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Separate Workload Estimate & Mismatch Explanation */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-[var(--border-hairline)] text-[var(--text-secondary)]">
              <span>Workload estimate: <strong className="text-[var(--text-primary)] font-mono">{workloadEstimate ? `${workloadEstimate}m` : 'None'}</strong></span>
              {calendarDurationMinutes !== null && workloadEstimate > 0 && calendarDurationMinutes !== workloadEstimate && (
                <span className="text-[10px] text-[var(--color-brand)] dark:text-[var(--color-brand)] font-medium">
                  Note: Calendar slot ({calendarDurationMinutes}m) differs from workload ({workloadEstimate}m)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Draft Editor */}
        {isEditingSession && (
          <TaskSessionEditor
            initialSessionNumber={task.sessionMetadata?.sessionNumber}
            initialPlannedDate={targetDate}
            initialStartTime={task.scheduledStart || '08:00'}
            initialEndTime={
              task.scheduledEnd || (
                workloadEstimate && workloadEstimate > 0
                  ? minutesToTimeStr(parseTimeToMinutes(task.scheduledStart || '08:00')! + workloadEstimate)
                  : '11:00'
              )
            }
            suggestedSessionNumber={nextSessionNum}
            tasks={tasks}
            excludeTaskId={task.id}
            taskEstimatedMinutes={workloadEstimate > 0 ? workloadEstimate : undefined}
            onApply={handleApplySession}
            onCancel={() => setIsEditingSession(false)}
          />
        )}
      </div>

      {/* Task Reminders Section */}
      <div className="sm:col-span-2 min-w-0 pt-2.5 border-t border-[var(--border-hairline)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
            <Bell size={13} className="text-[var(--color-brand)]" />
            <span>Task Reminders & Alerts</span>
            {task.reminders && task.reminders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)]">
                {task.reminders.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isAddingReminder && (
              <button
                type="button"
                onClick={() => setIsAddingReminder(true)}
                className="text-[10px] font-semibold text-[var(--color-brand)] dark:text-[var(--color-brand)] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={11} />
                <span>+ Add Reminder</span>
              </button>
            )}
          </div>
        </div>

        {/* Capability disclosure */}
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface-l1)] px-2.5 py-1 rounded-md border border-[var(--border-hairline)]">
          {capability === 'granted' ? (
            <span className="text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)] flex items-center gap-1">
              <Check size={11} /> Browser notifications active on this device
            </span>
          ) : capability === 'denied' ? (
            <span className="text-[var(--color-brand)] dark:text-[var(--color-brand)]">
              Browser notifications blocked (sound alerts will play when tab is open)
            </span>
          ) : capability === 'unsupported' ? (
            <span>Notifications not supported in this browser (in-app alerts will play)</span>
          ) : (
            <button
              type="button"
              onClick={async () => {
                const granted = await requestReminderPermission();
                setCapability(granted ? 'granted' : 'denied');
              }}
              className="text-[var(--color-brand)] dark:text-[var(--color-brand)] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <BellRing size={11} /> Enable browser notification alerts
            </button>
          )}
        </div>

        {/* Existing reminders list */}
        {task.reminders && task.reminders.length > 0 && (
          <div className="space-y-1.5">
            {task.reminders.map((rem) => {
              const dateObj = new Date(rem.status === 'snoozed' && rem.snoozedUntil ? rem.snoozedUntil : rem.remindAt);
              const formatted = dateObj.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={rem.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--text-primary)] font-medium">
                      {formatted}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        rem.status === 'snoozed'
                          ? 'bg-[var(--pastel-sky-subtle)] text-[var(--pastel-sky)] dark:text-[var(--pastel-sky)]'
                          : rem.status === 'dismissed'
                            ? 'bg-[var(--bg-surface-l3)] text-[var(--text-muted)] dark:text-[var(--text-muted)]'
                            : 'bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)]'
                      }`}
                    >
                      {rem.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {rem.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (store) snoozeReminder(store, task.id, rem.id, '15m');
                        }}
                        className="text-[10px] text-[var(--color-brand)] dark:text-[var(--color-brand)] hover:underline cursor-pointer"
                      >
                        Snooze 15m
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Remove reminder"
                      onClick={() => {
                        if (store) removeReminder(store, task.id, rem.id);
                        else {
                          updateTask(task.id, {
                            reminders: (task.reminders || []).filter((r) => r.id !== rem.id),
                          });
                        }
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--pastel-coral)] rounded hover:bg-[var(--bg-surface-l3)] dark:hover:bg-white/5 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Reminder Form */}
        {isAddingReminder && (
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--color-brand-border)] space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={reminderDateStr}
                onChange={(e) => setReminderDateStr(e.target.value)}
                className="bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none"
              />
              <input
                type="time"
                value={reminderTimeStr}
                onChange={(e) => setReminderTimeStr(e.target.value)}
                className="bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingReminder(false)}
                className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetTs = new Date(`${reminderDateStr}T${reminderTimeStr}`).getTime();
                  if (!Number.isFinite(targetTs)) {
                    return;
                  }
                  if (store) {
                    addReminderToTask(store, task.id, targetTs);
                  } else {
                    const newRem: TaskReminder = {
                      id: crypto.randomUUID(),
                      taskId: task.id,
                      remindAt: targetTs,
                      offsetMinutes: 0,
                      channel: 'browser_notification',
                      status: 'scheduled',
                      createdAt: Date.now(),
                    };
                    updateTask(task.id, { reminders: [...(task.reminders || []), newRem] });
                  }
                  setIsAddingReminder(false);
                }}
                className="px-2.5 py-1 rounded bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--text-on-brand)] font-bold text-[11px] transition-colors"
              >
                Set Reminder
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingConflict && (
        <div
          ref={conflictDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-conflict-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPendingConflict(null)}
          data-testid="schedule-conflict-dialog"
        >
          <div
            className="w-full max-w-md bg-[var(--bg-surface-l1)] border border-[var(--border-color)] rounded-xl shadow-2xl p-5 space-y-4 animate-scaleUp card-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 id="schedule-conflict-title" className="text-sm font-bold text-[var(--text-primary)]">
                  Schedule Conflict Detected
                </h4>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  This reservation ({pendingConflict.draft.startTime} – {pendingConflict.draft.endTime}) collides with{' '}
                  <strong className="text-[var(--text-primary)]">{pendingConflict.conflictingTitle}</strong> ({pendingConflict.conflictingTime}).
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {pendingConflict.suggestedSlot && (
                <button
                  type="button"
                  onClick={() => {
                    const slot = pendingConflict.suggestedSlot!;
                    commitSession({
                      ...pendingConflict.draft,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                    });
                    setPendingConflict(null);
                    showToast?.(`Adjusted to free slot: ${slot.startTime} – ${slot.endTime}`);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[var(--color-brand)] hover:opacity-90 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Adjust to free slot ({pendingConflict.suggestedSlot.startTime} – {pendingConflict.suggestedSlot.endTime})
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  commitSession(pendingConflict.draft);
                  setPendingConflict(null);
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] font-medium text-xs transition cursor-pointer flex items-center justify-center"
              >
                Keep overlapping reservation
              </button>

              <button
                type="button"
                onClick={() => setPendingConflict(null)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium text-xs transition cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

