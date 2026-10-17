import { useTaskContext } from "../../context/TaskContext";
export function StudyContinuity({
  onResume,
}: {
  onResume?: (id: string) => void;
}) {
  const { tasks = [] } = useTaskContext();
  const sessions = tasks
    .filter(
      (t) =>
        t.subtasks?.length &&
        !t.deletedAt &&
        !t.archivedAt &&
        t.status !== "done" &&
        t.subtasks.some((s) => !s.completed),
    )
    .filter((t) => t.sessionMetadata?.isSession)
    .slice(0, 3);
  if (!sessions.length) return null;
  return (
    <section className="v2-settings-section">
      <h3>Pick up where you left off</h3>
      {sessions.map((t) => (
        <div key={t.id} className="v2-study-progress">
          <div>
            <strong>{t.title}</strong>
            <p>
              {t.subtasks.filter((s) => s.completed).length} /{" "}
              {t.subtasks.length} targets complete · Next:{" "}
              {t.subtasks.find((s) => !s.completed)?.title}
            </p>
          </div>
          <button disabled={!onResume} onClick={() => onResume?.(t.id)}>
            Continue sprint
          </button>
        </div>
      ))}
    </section>
  );
}
