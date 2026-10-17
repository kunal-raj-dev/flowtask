import { useEffect, useRef, useState } from "react";
import type { Task } from "../../types/task";
import { useTaskContext } from "../../context/TaskContext";

export function TaskExecutionDetails({ task }: { task: Task }) {
  const ctx = useTaskContext();
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      const save = pending.current;
      pending.current = null;
      save?.();
    },
    [task.id],
  );
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  if (prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setDraft(null);
  }
  const next = draft !== null ? draft : task.nextAction || "";
  const history = (ctx.focusLogs || [])
    .filter(
      (log) => log.taskId === task.id && (!log.phase || log.phase === "focus"),
    )
    .slice(-5)
    .reverse();
  return (
    <section className="v2-task-execution">
      <label>
        Next small action
        <input
          maxLength={500}
          value={next}
          onChange={(e) => {
            const value = e.target.value;
            setDraft(value);
            pending.current = () =>
              ctx.updateTask(task.id, { nextAction: value });
          }}
          onBlur={() => {
            const save = pending.current;
            pending.current = null;
            save?.();
            setDraft(null);
          }}
          placeholder="Make starting a little easier"
        />
      </label>
      <label className="v2-check">
        <input
          type="checkbox"
          checked={Boolean(task.scheduleLocked)}
          onChange={(e) =>
            ctx.updateTask(task.id, { scheduleLocked: e.target.checked })
          }
        />
        Lock this task's scheduled time
      </label>
      {history.length > 0 && (
        <details className="desk-inspector-details">
          <summary>Time spent with this task</summary>
          {history.map((log) => (
            <p key={log.id}>
              <span>{new Date(log.endedAt).toLocaleDateString()}</span>
              <span>
                {Math.floor(log.seconds / 60)} min · {log.outcome || "logged"}
              </span>
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
