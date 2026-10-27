import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { useTodayStr } from '../../hooks/useCurrentDate';
import {
  parseTimeToMinutes,
  analyzeCognitiveTopology,
  TIMELINE_HOUR_HEIGHT_PX,
} from '../../utils/timelineUtils';
import { SchedulePlannerDialog } from '../workflow/SchedulePlannerDialog';
import { calculateDayPlanSummary } from '../../utils/dayPlanSummary';
import { getTaskEligibility } from '../../utils/taskEligibility';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  TimelineHeader,
  TimelineUnscheduledSidebar,
  TimelineCanvas,
  TimelineCalendarModal,
} from './timeline';
import { CalendarTimeGrid } from './CalendarTimeGrid';

interface TimelineViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
  onOpenStudySession?: () => void;
  selectedDateStr?: string;
  onSelectedDateChange?: (date: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onOpenStudySession,
  selectedDateStr,
  onSelectedDateChange,
}) => {
  const {
    tasks,
    updateTask,
    applyTaskChanges,
    undoLastAction,
    toggleTaskStatus,
    projects,
    addTask,
    calendarEvents: allCalendarEvents,
    calendarIcsUrl,
    setCalendarIcsUrl,
    refreshCalendarEvents,
    settings,
    showToast,
  } = useTaskContext();

  const [slotPlannerOpen, setSlotPlannerOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

  const todayStr = useTodayStr();
  const [planDate, setPlanDate] = useState(todayStr);
  const effectiveDateStr = selectedDateStr || planDate;
  const updatePlanDate = (date: string) => { setPlanDate(date); onSelectedDateChange?.(date); };

  const calendarEvents = useMemo(
    () => allCalendarEvents.filter(event => event.date === effectiveDateStr || (!event.date && effectiveDateStr===todayStr)),
    [allCalendarEvents, effectiveDateStr,todayStr]
  );

  useEffect(() => {
    void refreshCalendarEvents(effectiveDateStr);
  }, [effectiveDateStr, refreshCalendarEvents]);

  const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('canvas');

  const {
    todayTasks,
    scheduledTasks,
    unscheduledTasks,
    meetingMinutes,
    totalMeetingHours,
    taskMinutes,
    combinedPlannedHours,
    combinedCapacityPercent,
    cognitiveTopology,
    taskEffortHours,
    scheduledHours,
    conflictMinutes,
  } = useMemo(() => {
    const START_HOUR = settings.timelineStartHour ?? 7;
    const END_HOUR = Math.max(START_HOUR + 1, settings.timelineEndHour ?? 22);

    const filteredTodayTasks = tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt) return false;
      const matchesPlanned = t.plannedDate === effectiveDateStr;
      const matchesDue = !t.plannedDate && t.dueDate === effectiveDateStr;
      const matchesTopThree =
        t.isPinnedToday &&
        (t.topThreeDate === effectiveDateStr || (!t.topThreeDate && effectiveDateStr === todayStr));
      return matchesPlanned || matchesDue || matchesTopThree;
    });

    const scheduled: { task: Task; startMin: number; duration: number }[] = [];
    const unscheduled: Task[] = [];

    filteredTodayTasks.forEach((task) => {
      const effectiveTimeStr = task.scheduledStart;
      const startMin = parseTimeToMinutes(effectiveTimeStr);
      const explicitEnd = parseTimeToMinutes(task.scheduledEnd);
      const duration = startMin!==null && explicitEnd!==null && explicitEnd>startMin ? explicitEnd-startMin : task.estimatedMinutes || settings.defaultTaskDuration || 30;

      if (startMin !== null && startMin >= START_HOUR * 60 && startMin < END_HOUR * 60) {
        scheduled.push({ task, startMin, duration });
      } else if (getTaskEligibility(task, { tasks, projects, date: effectiveDateStr }).actionable) {
        unscheduled.push(task);
      }
    });

    const summary = calculateDayPlanSummary({date:effectiveDateStr,todayStr,tasks,projects,calendarEvents,settings});
    const meetingMins = summary.timedCalendarMinutes;
    const meetingHours = (meetingMins / 60).toFixed(1);

    const targetWorkCapacityHours = settings?.targetWorkCapacityHours ?? 6.0;
    const taskMins = summary.totalDemandMinutes;
    const combinedMins = taskMins + meetingMins;
    const plannedHours = (combinedMins / 60).toFixed(1);
    const capacityPct = Math.min(
      150,
      Math.round((combinedMins / (targetWorkCapacityHours * 60)) * 100)
    );

    const topology = analyzeCognitiveTopology(filteredTodayTasks, calendarEvents);

    const taskEffortHours = (summary.totalDemandMinutes / 60).toFixed(1);
    const scheduledHours = (summary.scheduledTaskMinutes / 60).toFixed(1);
    const conflictMinutes = summary.conflictMinutes ?? 0;

    return {
      todayTasks: filteredTodayTasks,
      scheduledTasks: scheduled,
      unscheduledTasks: unscheduled,
      meetingMinutes: meetingMins,
      totalMeetingHours: meetingHours,
      taskMinutes: taskMins,
      combinedPlannedHours: plannedHours,
      combinedCapacityPercent: capacityPct,
      cognitiveTopology: topology,
      taskEffortHours,
      scheduledHours,
      conflictMinutes,
    };
  }, [tasks, projects, effectiveDateStr, todayStr, settings, calendarEvents]);

  const START_HOUR = settings.timelineStartHour ?? 7;
  const END_HOUR = Math.max(START_HOUR + 1, settings.timelineEndHour ?? 22);
  const TOTAL_HOURS = Math.max(1, END_HOUR - START_HOUR);
  const HOUR_HEIGHT_PX = TIMELINE_HOUR_HEIGHT_PX;
  const targetWorkCapacityHours = settings?.targetWorkCapacityHours ?? 6.0;

  const handleQuickAdd = useCallback((title: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    addTask(title, {
      plannedDate: effectiveDateStr,
      scheduledStart: timeStr,
      estimatedMinutes: 45,
    });
  }, [addTask, effectiveDateStr]);

  const handleScheduleUnscheduled = useCallback((task: Task, hour: number) => {
    if (task.scheduleLocked) { showToast('Unlock this task in its details before moving it.'); return; }
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    updateTask(task.id, {
      scheduledStart: timeStr,
    });
  }, [updateTask, showToast]);

  const handleAutoSlotDay = useCallback(() => {
    if (effectiveDateStr < todayStr) { showToast('Choose today or a future date to automatically schedule tasks.'); return; }
    setSlotPlannerOpen(true);
  }, [effectiveDateStr, todayStr, showToast]);

  const handleClearAllScheduledTimes = useCallback(() => {
    if (scheduledTasks.length === 0) return;
    applyTaskChanges(scheduledTasks.filter(({ task }) => !task.scheduleLocked).map(({ task }) => ({ id: task.id, updates: { scheduledStart: undefined, scheduledEnd: undefined } })), 'Clear unlocked timeline slots');
    showToast('Unlocked timeline slots cleared.', 'Undo', undoLastAction);
  }, [scheduledTasks, applyTaskChanges, showToast, undoLastAction]);

  const handleRefreshCalendar = useCallback(async () => {
    setIsRefreshingFeed(true);
    await refreshCalendarEvents();
    setTimeout(() => setIsRefreshingFeed(false), 600);
  }, [refreshCalendarEvents]);

  const handleSaveCalendar = useCallback(async (url: string) => {
    setCalendarIcsUrl(url);
    if (url) {
      await refreshCalendarEvents();
    }
  }, [setCalendarIcsUrl, refreshCalendarEvents]);

  const handleDisconnectCalendar = useCallback(() => {
    setCalendarIcsUrl('');
  }, [setCalendarIcsUrl]);

  return (
    <div className={`${onSelectedDateChange ? 'planning-embedded' : 'max-w-5xl mx-auto px-4 py-4'} space-y-6`}>
      <SchedulePlannerDialog isOpen={slotPlannerOpen} onClose={() => setSlotPlannerOpen(false)} date={effectiveDateStr} />
      {/* Executive Workload Capacity Gauge Header */}
      <TimelineHeader
        embedded={Boolean(onSelectedDateChange)}
        scheduledCount={scheduledTasks.length}
        calendarEventCount={calendarEvents.length}
        calendarIcsUrl={calendarIcsUrl}
        combinedPlannedHours={combinedPlannedHours}
        targetWorkCapacityHours={targetWorkCapacityHours}
        cognitiveTopology={cognitiveTopology}
        meetingMinutes={meetingMinutes}
        totalMeetingHours={totalMeetingHours}
        taskMinutes={taskMinutes}
        combinedCapacityPercent={combinedCapacityPercent}
        isRefreshingFeed={isRefreshingFeed}
        taskEffortHours={taskEffortHours}
        scheduledHours={scheduledHours}
        conflictMinutes={conflictMinutes}
        onOpenStudySession={onOpenStudySession}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onRefreshCalendar={handleRefreshCalendar}
      />

      {/* Mode switcher and planning date */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {(!selectedDateStr || onSelectedDateChange) && viewMode === 'canvas' && (
          <div className="desk-plan-date">
            <button className="desk-button" aria-label="Previous day" onClick={()=>{const d=new Date(effectiveDateStr+'T12:00:00');d.setDate(d.getDate()-1);updatePlanDate(formatLocalDate(d));}}>←</button>
            <label>Planning date<input aria-label="Planning date" type="date" value={effectiveDateStr} onChange={e=>{if(e.target.value)updatePlanDate(e.target.value);}}/></label>
            <button className="desk-button" aria-label="Next day" onClick={()=>{const d=new Date(effectiveDateStr+'T12:00:00');d.setDate(d.getDate()+1);updatePlanDate(formatLocalDate(d));}}>→</button>
            <button className="desk-button" onClick={()=>updatePlanDate(todayStr)}>Today</button>
          </div>
        )}
        <div className="flex items-center rounded-lg border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface-l2)] text-xs ml-auto">
          <button
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1 rounded font-medium ${viewMode === 'canvas' ? 'bg-[var(--color-brand)] text-[var(--text-on-brand)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            Canvas
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded font-medium ${viewMode === 'grid' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            Multi-Day Grid
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <CalendarTimeGrid
          initialDate={effectiveDateStr}
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onDateChange={(d) => updatePlanDate(d)}
        />
      ) : (
        <div className="timeline-planning-layout grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <button type="button" className="desk-button timeline-tray-toggle" aria-expanded={backlogOpen} aria-controls="timeline-staged-tasks" onClick={() => setBacklogOpen(!backlogOpen)}>
            {backlogOpen ? 'Hide' : 'Show'} unscheduled tasks ({unscheduledTasks.length})
          </button>
          {/* Left: Unscheduled Tasks Tray */}
          <div id="timeline-staged-tasks" className="timeline-backlog-slot lg:col-span-4" data-open={backlogOpen || undefined}>
          <TimelineUnscheduledSidebar
            unscheduledTasks={unscheduledTasks}
            scheduledTasksCount={scheduledTasks.length}
            projects={projects}
            startHour={START_HOUR}
            totalHours={TOTAL_HOURS}
            onSelectTask={onSelectTask}
            onAutoSlotDay={handleAutoSlotDay}
            autoSlotDisabled={effectiveDateStr < todayStr}
            onClearAllScheduledTimes={handleClearAllScheduledTimes}
            onScheduleUnscheduled={handleScheduleUnscheduled}
          />
          </div>

          {/* Right: Hourly Timeline Canvas */}
          <TimelineCanvas
            startHour={START_HOUR}
            endHour={END_HOUR}
            hourHeightPx={HOUR_HEIGHT_PX}
            isToday={effectiveDateStr === todayStr}
            calendarEvents={calendarEvents}
            scheduledTasks={scheduledTasks}
            todayTasks={todayTasks}
            projects={projects}
            onSelectTask={onSelectTask}
            onToggleTaskStatus={toggleTaskStatus}
            onUpdateTask={updateTask}
            onApplyBatchChanges={applyTaskChanges}
            onStartFocus={onStartFocus}
            onStartSprint={onStartSprint}
            onQuickAdd={handleQuickAdd}
          />
        </div>
      )}

      {/* External Calendar Overlay Modal */}
      <TimelineCalendarModal
        isOpen={isCalendarModalOpen}
        calendarIcsUrl={calendarIcsUrl}
        onClose={() => setIsCalendarModalOpen(false)}
        onSave={handleSaveCalendar}
        onDisconnect={handleDisconnectCalendar}
      />
    </div>
  );
};
import '../../styles/plan.css';
