import { isInboxTask } from '../../utils/taskSelectors';
import { appShortcutAllowed } from '../../services/shortcutRuntime';
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import { useTaskContext } from "../../context/TaskContext";
import { formatLocalDate } from "../../utils/nlpParser";
import { Dialog } from "../ui/Dialog";

export function InboxTriage() {
  const ctx = useTaskContext();
  const [open, setOpen] = useState(false),
    [project, setProject] = useState("");
  const [processed, setProcessed] = useState<string[]>([]);
  const actions = useRef<(action: string) => void>(() => {});
  const tasks = ctx.tasks
    .filter(
      (t) =>
        isInboxTask(t, undefined, { tasks: ctx.tasks, projects: ctx.projects }) &&
        !processed.includes(t.id),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  const task = tasks[0];
  const process = (action: string) => {
    if (!task) return;
    if (action === "today")
      ctx.updateTask(task.id, { plannedDate: formatLocalDate(new Date()) });
    else if (action === "project") {
      if (!project) return;
      ctx.updateTask(task.id, { projectId: project });
    } else if (action === "someday")
      ctx.updateTask(task.id, { isSomeday: true });
    else ctx.deleteTask(task.id);
    setProcessed((ids) => [...ids, task.id]);
    ctx.showToast("Inbox item processed.", "Undo", () => {
      ctx.undoLastAction();
      setProcessed((ids) => ids.filter((id) => id !== task.id));
    });
  };
  useEffect(() => {
    actions.current = process;
  });
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (!appShortcutAllowed(e)) return;
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const action = (
        {
          "1": "today",
          "2": "project",
          "3": "someday",
          Backspace: "delete",
        } as Record<string, string>
      )[e.key];
      if (action) {
        e.preventDefault();
        actions.current(action);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <>
      <section className="v2-planning-card v2-inbox-card">
        <div className="v2-planning-icon">
          <Inbox size={19} />
        </div>
        <div className="v2-planning-content">
          <strong>A thought captured. A little clarity next.</strong>
          <p>Process unscheduled ideas one at a time.</p>
        </div>
        <button
          onClick={() => {
            setProcessed([]);
            setOpen(true);
          }}
        >
          Triage inbox
          <ArrowRight size={15} />
        </button>
      </section>
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={task ? "Where does this belong?" : "A little lighter already."}
        description={
          task
            ? `${tasks.length} unscheduled thoughts left`
            : "Your unscheduled Inbox is clear."
        }
      >
        <div className="v2-triage">
          {task ? (
            <>
              <h3>{task.title}</h3>
              <div>
                <button onClick={() => process("today")}>1 · Today</button>
                <button onClick={() => process("someday")}>3 · Someday</button>
                <button onClick={() => process("delete")}>
                  Delete · Trash
                </button>
              </div>
              <label>
                Choose a project
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                >
                  <option value="">Select a project</option>
                  {ctx.projects
                    .filter((p) => p.id !== "inbox" && !p.isArchived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <button disabled={!project} onClick={() => process("project")}>
                2 · Move to project
              </button>
            </>
          ) : (
            <button className="v2-action" onClick={() => setOpen(false)}>
              Back to your day
            </button>
          )}
        </div>
      </Dialog>
    </>
  );
}
