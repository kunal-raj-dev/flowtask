import { useState } from "react";
import { ArrowRight, Check, Sun } from "lucide-react";
import { useTaskContext } from "../../context/TaskContext";
import { useTodayStr } from "../../hooks/useCurrentDate";
import { Dialog } from "../ui/Dialog";
import { calculateDayPlanSummary } from "../../utils/dayPlanSummary";
import { isTodayTask, isTaskActionable } from "../../utils/taskSelectors";

interface DailyPlanningProps {
  showCard?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DailyPlanning({
  showCard = true,
  isOpen: controlledOpen,
  onOpenChange,
}: DailyPlanningProps = {}) {
  const ctx = useTaskContext();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    onOpenChange?.(val);
  };
  const today = useTodayStr();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>(() =>
      ctx.tasks.filter((t) => isTodayTask(t, today, { tasks: ctx.tasks, projects: ctx.projects })).map((t) => t.id),
    ),
    [pinned, setPinned] = useState<string[]>(() =>
      ctx.tasks
        .filter((t) => isTodayTask(t, today, { tasks: ctx.tasks, projects: ctx.projects }) && t.topThreeDate === today)
        .slice(0, 3)
        .map((t) => t.id),
    );
  const active = ctx.tasks.filter(
    (t) => isTaskActionable(t, today, { tasks: ctx.tasks, projects: ctx.projects }),
  );
  const summary = calculateDayPlanSummary({
    date: today,
    todayStr: today,
    tasks: ctx.tasks,
    calendarEvents: ctx.calendarEvents,
    settings: ctx.settings,
  });
  const meetings = summary.timedCalendarMinutes,
    capacity = summary.availableTaskBudgetMinutes,
    planned = summary.totalDemandMinutes;
  const chosenSummary = calculateDayPlanSummary({
    date: today,
    todayStr: today,
    tasks: active
      .filter((t) => selected.includes(t.id))
      .map((t) => ({ ...t, plannedDate: today })),
    calendarEvents: ctx.calendarEvents,
    settings: ctx.settings,
  });
  const chosenMinutes = chosenSummary.totalDemandMinutes;
  const chosenScheduledMinutes = chosenSummary.scheduledTaskMinutes;
  const chosenUniqueOccupied = chosenSummary.uniqueOccupiedMinutes ?? chosenScheduledMinutes;
  const start = () => {
    setSelected(active.filter((t) => isTodayTask(t, today, { tasks: ctx.tasks, projects: ctx.projects })).map((t) => t.id));
    setPinned(
      active
        .filter((t) => t.topThreeDate === today)
        .slice(0, 3)
        .map((t) => t.id),
    );
    setStep(1);
    setOpen(true);
  };
  const apply = () => {
    const updates = active
      .filter((t) => selected.includes(t.id) || isTodayTask(t, today, { tasks: ctx.tasks, projects: ctx.projects }))
      .map((t) => ({
        id: t.id,
        updates: {
          plannedDate: selected.includes(t.id) ? today : undefined,
          topThreeDate:
            pinned.includes(t.id) && selected.includes(t.id)
              ? today
              : undefined,
          isPinnedToday: pinned.includes(t.id) && selected.includes(t.id),
          ...(!selected.includes(t.id) && !t.scheduleLocked
            ? { scheduledStart: undefined, scheduledEnd: undefined }
            : {}),
        },
      }));
    ctx.applyTaskChanges(updates, "Plan your day");
    ctx.showToast(
      "A day with room for what matters.",
      "Undo",
      ctx.undoLastAction,
    );
    setOpen(false);
  };
  return (
    <>
      {showCard && (
        <section className="v2-planning-card">
          <div className="v2-planning-icon">
            <Sun size={19} />
          </div>
          <div className="v2-planning-content">
            <strong>A day that fits your life.</strong>
            <p>
              {Math.max(0, capacity - planned)} min of room · {planned} min
              planned{meetings ? ` · ${meetings} min in meetings` : ""}
            </p>
          </div>
          <button onClick={start}>
            Plan my day
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={
          step === 1
            ? "Make room for today"
            : step === 2
              ? "Choose what matters most"
              : "A realistic day, ready"
        }
        description={`Step ${step} of 3 · ${step === 1 ? "Choose what deserves a place today." : step === 2 ? "Pick up to three priorities. Everything else can wait its turn." : "Your capacity includes space for meetings."}`}
        size="lg"
        footer={
          <div className="flex justify-between gap-3">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : setOpen(false))}
            >
              {step > 1 ? "Back" : "Cancel"}
            </button>
            <button
              className="v2-action"
              onClick={() => (step < 3 ? setStep(step + 1) : apply())}
            >
              {step < 3 ? "Continue" : "Save my plan"}
              <ArrowRight size={15} />
            </button>
          </div>
        }
      >
        <div className="v2-planning-list">
          {step < 3 ? (
            (step === 1
              ? active
              : active.filter((t) => selected.includes(t.id))
            ).map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={
                    step === 1 ? selected.includes(t.id) : pinned.includes(t.id)
                  }
                  disabled={
                    (step === 1 && t.scheduleLocked) ||
                    (step === 2 && !pinned.includes(t.id) && pinned.length >= 3)
                  }
                  onChange={(e) => {
                    if (step === 1) {
                      setSelected(
                        e.target.checked
                          ? [...selected, t.id]
                          : selected.filter((id) => id !== t.id),
                      );
                      if (!e.target.checked)
                        setPinned(pinned.filter((id) => id !== t.id));
                    } else
                      setPinned(
                        e.target.checked
                          ? [...pinned, t.id]
                          : pinned.filter((id) => id !== t.id),
                      );
                  }}
                />
                <span>
                  {t.title}
                  <small>
                    {ctx.projects.find((p) => p.id === t.projectId)?.name}
                    {t.dueDate ? ` · Deadline ${t.dueDate}` : ""}
                  </small>
                </span>
                <em>
                  {t.estimatedMinutes ||
                    ctx.settings?.defaultTaskDuration ||
                    30}{" "}
                  min
                </em>
              </label>
            ))
          ) : (
            <div className="v2-plan-summary">
              <span>
                {selected.length} tasks · {pinned.length} priorities
              </span>
              <strong>
                {chosenMinutes}m task effort · {chosenScheduledMinutes}m reserved
              </strong>
              <p>
                {chosenSummary.overbooked || chosenUniqueOccupied > capacity
                  ? `Your plan is ${Math.max(chosenSummary.overbookedMinutes, chosenUniqueOccupied - capacity)} minutes over capacity (${chosenMinutes}m task effort, ${chosenUniqueOccupied}m reserved against ${capacity}m capacity). Go back to make room, or save it as an intentional exception.`
                  : chosenUniqueOccupied >= capacity
                  ? `Calendar is fully reserved (${chosenUniqueOccupied}m reserved against ${capacity}m capacity).`
                  : `${Math.max(0, Math.min(chosenSummary.availableTaskBudgetMinutes - chosenMinutes, chosenSummary.freeCalendarMinutes ?? (capacity - chosenUniqueOccupied)))} minutes of available window. Your deadlines stay intact.`}
              </p>
              {pinned.map((id) => (
                <p key={id}>
                  <Check size={14} />
                  {active.find((t) => t.id === id)?.title}
                </p>
              ))}
            </div>
          )}
          {!active.length && (
            <p className="p-6 text-sm">
              Capture a task first, then build a day around it.
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
