import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { useTodayStr } from '../../hooks/useCurrentDate';
import {
  parseTimeToMinutes,
  analyzeCognitiveTopology,
  TIMELINE_HOUR_HEIGHT_PX,
} from '../../utils/timelineUtils';
import { computeAutoSlotSchedule } from '../../utils/autoSlotAlgorithm';
import {
  TimelineHeader,
  TimelineUnscheduledSidebar,
  TimelineCanvas,
  TimelineCalendarModal,
} from './timeline';

interface TimelineViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
  onOpenStudySession?: () => void;
  selectedDateStr?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onOpenStudySession,
  selectedDateStr,
}) => {
  const {
    tasks,
    updateTask,
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

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

  const todayStr = useTodayStr();
  const effectiveDateStr = selectedDateStr || todayStr;

  const calendarEvents = useMemo(
    () => allCalendarEvents.filter(event => !event.date || event.date === effectiveDateStr),
    [allCalendarEvents, effectiveDateStr]
  );

  useEffect(() => {
    void refreshCalendarEvents(effectiveDateStr);
  }, [effectiveDateStr, refreshCalendarEvents]);

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
  } = useMemo(() => {
    const START_HOUR = settings.timelineStartHour;
    const END_HOUR = settings.timelineEndHour;

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
      const duration = task.estimatedMinutes || 30;

      if (startMin !== null && startMin >= START_HOUR * 60 && startMin < END_HOUR * 60) {
        scheduled.push({ task, startMin, duration });
      } else {
        unscheduled.push(task);
      }
    });

    const meetingMins = calendarEvents.reduce((acc, ev) => {
      if (ev.isAllDay) return acc;
      const startMin = parseTimeToMinutes(ev.startTime);
      const endMin = parseTimeToMinutes(ev.endTime);
      if (startMin === null) return acc;
      const duration = endMin ? Math.max(15, endMin - startMin) : 30;
      return acc + duration;
    }, 0);
    const meetingHours = (meetingMins / 60).toFixed(1);

    const targetWorkCapacityHours = settings?.targetWorkCapacityHours ?? 6.0;
    const taskMins = filteredTodayTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const combinedMins = taskMins + meetingMins;
    const plannedHours = (combinedMins / 60).toFixed(1);
    const capacityPct = Math.min(
      150,
      Math.round((combinedMins / (targetWorkCapacityHours * 60)) * 100)
    );

    const topology = analyzeCognitiveTopology(filteredTodayTasks, calendarEvents);

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
    };
  }, [tasks, effectiveDateStr, todayStr, settings, calendarEvents]);

  const START_HOUR = settings.timelineStartHour;
  const END_HOUR = settings.timelineEndHour;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
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
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    updateTask(task.id, {
      scheduledStart: timeStr,
    });
  }, [updateTask]);

  const handleAutoSlotDay = useCallback(() => {
    if (unscheduledTasks.length === 0) return;
    const result = computeAutoSlotSchedule(
      unscheduledTasks,
      scheduledTasks,
      calendarEvents,
      {
        startHour: START_HOUR,
        endHour: END_HOUR,
        bufferMinutes: settings.autoSlotBufferMinutes,
        maxCapacityMinutes: Math.round(targetWorkCapacityHours * 60),
      }
    );

    result.slotted.forEach(({ taskId, scheduledStart }) => {
      updateTask(taskId, { scheduledStart, plannedDate: effectiveDateStr });
    });

    showToast(result.message);
  }, [unscheduledTasks, scheduledTasks, calendarEvents, START_HOUR, END_HOUR, settings.autoSlotBufferMinutes, targetWorkCapacityHours, updateTask, effectiveDateStr, showToast]);

  const handleClearAllScheduledTimes = useCallback(() => {
    if (scheduledTasks.length === 0) return;
    scheduledTasks.forEach(({ task }) => {
      updateTask(task.id, {
        scheduledStart: undefined,
      });
    });
    showToast(`Cleared timeline slots for ${scheduledTasks.length} tasks`);
  }, [scheduledTasks, updateTask, showToast]);

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
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">
      {/* Executive Workload Capacity Gauge Header */}
      <TimelineHeader
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
        onOpenStudySession={onOpenStudySession}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onRefreshCalendar={handleRefreshCalendar}
      />

      {/* Main Grid: Unscheduled Sidebar + Hourly Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Unscheduled Tasks Tray */}
        <TimelineUnscheduledSidebar
          unscheduledTasks={unscheduledTasks}
          scheduledTasksCount={scheduledTasks.length}
          projects={projects}
          startHour={START_HOUR}
          totalHours={TOTAL_HOURS}
          onSelectTask={onSelectTask}
          onAutoSlotDay={handleAutoSlotDay}
          onClearAllScheduledTimes={handleClearAllScheduledTimes}
          onScheduleUnscheduled={handleScheduleUnscheduled}
        />

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
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onQuickAdd={handleQuickAdd}
        />
      </div>

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
