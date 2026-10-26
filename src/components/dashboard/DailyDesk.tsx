import { useTaskAvailabilityClock } from '../../hooks/useTaskAvailabilityClock';
import { useStudioPreferences } from '../../hooks/useStudio';
import { DailyNoteButton } from '../notes/DailyNoteButton';
import { useEffect, useState } from "react";
import { Play, ArrowRight, CalendarDays, Check } from "lucide-react";
import { useTaskContext } from "../../context/TaskContext";
import { useTodayStr } from "../../hooks/useCurrentDate";
import { useTotalFocusedTodaySeconds } from "../../hooks/useTotalFocusedTodaySeconds";
import { calculateDayPlanSummary } from "../../utils/dayPlanSummary";
import { isFocusTask, isTodayTask } from "../../utils/taskSelectors";
import { normalizeDashboard } from "../../utils/dashboardModel";
import {
  getStarterDashboard,
  STARTER_DAILY_DESK_ID,
} from "../../services/starterDashboards";
import type {
  WorkspaceDashboard,
  WidgetComponentProps,
} from "../../types/dashboard";
import { Top3Widget } from "./widgets/Top3Widget";
import { TaskListWidget } from "./widgets/TaskListWidget";
import { DayAgendaWidget } from "./widgets/DayAgendaWidget";
import { QuickNotesWidget } from "./widgets/QuickNotesWidget";
import { StudyContinuationWidget } from "./widgets/StudyContinuationWidget";
import { Dialog } from "../ui/Dialog";
import { formatSecondsToHumanReadable } from "../../utils/focusTimeFormat";
import { findEstimateSuggestion } from "../../utils/planningSuggestions";

function DailyProgress({ completed }: { completed: number }) {
  const focused = useTotalFocusedTodaySeconds();
  return (
    <section className="daily-progress">
      <span>
        <Check size={15} />
        {completed} completed
      </span>
      <span>{formatSecondsToHumanReadable(focused)} focused</span>
    </section>
  );
}

/** Only untouched starter geometry is guided; customized layouts keep their grid. */
export function isGuidedDailyDesk(dashboard: WorkspaceDashboard) {
  const starter = normalizeDashboard(
    getStarterDashboard(STARTER_DAILY_DESK_ID),
  );
  const actual = normalizeDashboard(dashboard);
  const signature = (d: WorkspaceDashboard) =>
    JSON.stringify({
      widgets: d.widgets.map((w) => `${w.id}:${w.type}`).sort(),
      layouts: ["lg", "md", "sm"].map((bp) =>
        (d.layouts[bp as "lg" | "md" | "sm"] || [])
          .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
          .sort((a, b) => a.i.localeCompare(b.i)),
      ),
    });
  // Portable dashboards omit the device-local mobile layout. Accept its regenerated default too.
  const portable = normalizeDashboard({
    ...starter,
    layouts: { ...starter.layouts, sm: undefined },
  });
  return (
    signature(starter) === signature(actual) ||
    signature(portable) === signature(actual)
  );
}
interface Props {
  dashboard: WorkspaceDashboard;
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onPlanMyDay: () => void;
}
export function DailyDesk({
  dashboard,
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onPlanMyDay,
}: Props) {
  const { tasks, projects = [], focusSession, calendarEvents = [], settings, setIsEveningShutdownOpen, updateTask, showToast, undoLastAction } = useTaskContext();
  const today = useTodayStr();
  const availabilityNow = useTaskAvailabilityClock(tasks);
  const { preferences: studio } = useStudioPreferences();
  const summary = calculateDayPlanSummary({
    date: today,
    todayStr: today,
    tasks,
    projects,
    calendarEvents,
    settings,
  });
  const focusedSeconds = useTotalFocusedTodaySeconds();
  const candidates = tasks.filter((t) => isTodayTask(t, today, { tasks, projects, now: availabilityNow }));
  const priorities = candidates.filter((t) => isFocusTask(t, today, { tasks, projects, now: availabilityNow }));
  const [chosen, setChosen] = useState(""),
    [contextOpen, setContextOpen] = useState(false);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia?.("(max-width: 1023px)").matches ?? false,
  );
  useEffect(() => {
    const m = window.matchMedia?.("(max-width: 1023px)");
    if (!m) return;
    const change = () => setNarrow(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, []);
  const task =
    tasks.find((t) => t.id === focusSession?.taskId) || candidates.find((t) => t.id === chosen) || priorities[0] || candidates[0];
  const suggestion = findEstimateSuggestion(candidates);
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
  const hours = (minutes: number) => `${Math.round(minutes / 6) / 10}h`;
  const propsFor = (type: string): WidgetComponentProps => ({
    widget: dashboard.widgets.find((w) => w.type === type)!,
    onSelectTask,
    onStartFocus,
    onStartSprint,
  });
  const context = (
    <>
      <section className="daily-agenda" aria-label="Day Agenda">
        <div className="daily-section-heading">
          <h2>Your agenda</h2>
          <CalendarDays size={16} />
        </div>
        <DayAgendaWidget {...propsFor("dayAgenda")} />
      </section>
      <DailyProgress completed={summary.completedTaskCount} />
      <details className="daily-context-detail">
        <summary>Quick notes</summary>
        <QuickNotesWidget {...propsFor("quickNotes")} />
      </details>
      <details
        className="daily-context-detail"
        data-widget-type="studyContinuation"
      >
        <summary>Continue studying</summary>
        <StudyContinuationWidget {...propsFor("studyContinuation")} />
      </details>
      <p className="daily-rail-note">
        Leave a little breathing room.
        <br />A realistic day is a good day.
      </p>
    </>
  );
  const prioritiesSection = (
    <section className="daily-priorities" aria-label="Top 3 Priorities">
      <div className="daily-section-heading">
        <h2>Your Top 3</h2>
        <span>{priorities.length}/3 · Keep it intentional</span>
      </div>
      <Top3Widget {...propsFor("top3")} />
    </section>
  );
  const tasksSection = (
    <section className="daily-tasks" aria-label="Today's Tasks">
      <div className="daily-section-heading">
        <h2>Today's tasks</h2>
        <span>
          {candidates.filter((t) => !isFocusTask(t, today, { tasks, projects, now: availabilityNow })).length} to do
        </span>
      </div>
      <TaskListWidget {...propsFor("taskList")} hideCapture />
    </section>
  );
  return (
    <div className="daily-desk">
      <section className="daily-capture" aria-label="Add a task"><TaskListWidget {...propsFor("taskList")} captureOnly /></section>
      <div className="daily-planning-summary">
        <div>
          <span className="daily-summary-label">A DAY THAT FITS</span>
          <p>
            <strong>{hours(summary.totalDemandMinutes)}</strong> planned{" "}
            <span>·</span>{" "}
            <strong>
              {hours(
                Math.max(
                  0,
                  summary.availableTaskBudgetMinutes -
                    summary.totalDemandMinutes,
                ),
              )}
            </strong>{" "}
            available
          </p>
        </div>
        <div className="daily-summary-actions">
          <DailyNoteButton/>
          {narrow && <button className="desk-button" onClick={() => setContextOpen(true)}><CalendarDays size={15} />Day context</button>}
        </div>
      </div>
      <section className="daily-flow-path" aria-label="Daily flow">
        <button type="button" className="daily-flow-action" aria-label="Plan my day" onClick={onPlanMyDay}>
          <span className="daily-flow-number">01</span>
          <span><strong>Plan</strong><small>{candidates.length} tasks · {priorities.length}/3 priorities</small></span>
        </button>
        <span className="daily-flow-connector" aria-hidden="true" />
        <div className="daily-flow-current" aria-current="step">
          <span className="daily-flow-number">02</span>
          <span><strong>Focus</strong><small>{task ? "Next action below" : "Choose a task below"}</small></span>
        </div>
        <span className="daily-flow-connector" aria-hidden="true" />
        <button type="button" className="daily-flow-action" onClick={() => setIsEveningShutdownOpen(true)}>
          <span className="daily-flow-number">03</span>
          <span><strong>Reflect</strong><small>{summary.completedTaskCount} done · {formatSecondsToHumanReadable(focusedSeconds)} focused</small></span>
        </button>
      </section>
      {summary.overbooked && (
        <p className="daily-overload" role="status">
          Overbooked by {summary.overbookedMinutes} minutes. Move a task or
          adjust your plan.
        </p>
      )}
      {suggestion && dismissedSuggestion !== suggestion.taskId && (
        <aside className="daily-planning-suggestion" aria-label="Planning suggestion">
          <div><strong>Review this estimate</strong><p>{tasks.find((item) => item.id === suggestion.taskId)?.title} is estimated at {suggestion.currentMinutes} min and has {suggestion.observedMinutes} min of work time recorded. Consider planning closer to {suggestion.suggestedMinutes} min.</p></div>
          <button type="button" onClick={() => { updateTask(suggestion.taskId, { estimatedMinutes: suggestion.suggestedMinutes }); showToast("Estimate updated from recorded focus time.", "Undo", undoLastAction); }}>Use {suggestion.suggestedMinutes} min</button>
          <button type="button" aria-label="Dismiss planning suggestion" onClick={() => setDismissedSuggestion(suggestion.taskId)}>Dismiss</button>
        </aside>
      )}
      <div className="daily-columns">
        <div className="daily-main" data-empty={candidates.length === 0}>
          {candidates.length > 0 && <section className="daily-next">
            <span className="daily-summary-label">UP NEXT · YOUR CHOICE</span>
            <div className="daily-next-heading">
              <h2>{task?.title || "Make room for one good next step."}</h2>
              {task && (
                <details className="daily-change-task">
                <summary>Change task</summary>
                <select
                  aria-label="Choose your next focus task"
                  value={task.id}
                  onChange={(e) => setChosen(e.target.value)}
                >
                  {candidates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                </details>
              )}
            </div>
            <p>
              {task?.nextAction ||
                (task
                  ? "Choose a small next step. Give it your full attention."
                  : "Capture a task below. Your focus session starts there.")}
            </p>
            <div className="daily-next-actions">
              <button
                className="desk-button primary"
                disabled={!task}
                onClick={() =>
                  task &&
                  (task.sessionMetadata?.isSession && onStartSprint
                    ? onStartSprint(task.id)
                    : onStartFocus?.(task.id))
                }
              >
                <Play size={14} fill="currentColor" />
                {focusSession ? focusSession.state === 'paused' ? 'Resume focus' : 'Return to focus' : task?.sessionMetadata?.isSession ? 'Start study sprint' : 'Start focus'}
                {!focusSession && !task?.sessionMetadata?.isSession && studio.timer.mode !== 'stopwatch' && <span> · {studio.timer.focusMinutes}m</span>}
              </button>
              {task && (
                <button
                  className="desk-text-action"
                  onClick={() => onSelectTask?.(task.id)}
                >
                  View task
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </section>}
          {candidates.length === 0 ? (
            <>
              {tasksSection}
              {prioritiesSection}
            </>
          ) : (
            <>
              {prioritiesSection}
              {tasksSection}
            </>
          )}
        </div>
        {!narrow && (
          <aside className="daily-context" aria-label="Day context">
            {context}
          </aside>
        )}
      </div>
      <Dialog
        isOpen={contextOpen && narrow}
        onClose={() => setContextOpen(false)}
        title="Day context"
        size="md"
      >
        {context}
      </Dialog>
    </div>
  );
}
