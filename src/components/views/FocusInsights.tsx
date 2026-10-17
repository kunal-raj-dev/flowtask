import { useTaskContext } from "../../context/TaskContext";

export function FocusInsights() {
  const { focusLogs, projects, tasks } = useTaskContext();
  const logs = focusLogs.filter((log) => log.phase === "focus" || !log.phase);
  const total = logs.reduce((n, log) => n + log.seconds, 0);
  const breaks = focusLogs
    .filter((log) => log.phase && log.phase !== "focus")
    .reduce((n, log) => n + log.seconds, 0);
  const interrupted = logs.filter(
    (log) => log.outcome === "interrupted",
  ).length;
  return (
    <section className="v2-focus-insights">
      <div>
        <p className="v2-kicker">YOUR WORK, WITH CONTEXT</p>
        <h2>Time well spent.</h2>
        <p>Recorded sessions and outcomes. A reflection, at your own pace.</p>
      </div>
      <div className="v2-insight-stats">
        <div>
          <strong>{(total / 3600).toFixed(1)}h</strong>
          <span>Focused time</span>
        </div>
        <div>
          <strong>{Math.round(breaks / 60)}m</strong>
          <span>Time to recharge</span>
        </div>
        <div>
          <strong>
            {logs.filter((l) => l.outcome === "completed").length}
          </strong>
          <span>Sessions completed</span>
        </div>
        <div>
          <strong>{interrupted}</strong>
          <span>Sessions interrupted</span>
        </div>
      </div>
      <div className="v2-project-breakdown">
        {projects
          .filter((p) =>
            logs.some(
              (log) =>
                tasks.find((t) => t.id === log.taskId)?.projectId === p.id,
            ),
          )
          .map((project) => {
            const seconds = logs
              .filter(
                (log) =>
                  tasks.find((t) => t.id === log.taskId)?.projectId ===
                  project.id,
              )
              .reduce((n, log) => n + log.seconds, 0);
            return (
              <div key={project.id}>
                <span style={{ borderLeftColor: project.color }}>
                  {project.name}
                </span>
                <meter
                  min={0}
                  max={Math.max(1, total)}
                  value={seconds}
                  aria-label={`${project.name} focus time`}
                />
                <strong>{Math.round(seconds / 60)} min</strong>
              </div>
            );
          })}
      </div>
      <p className="v2-insight-note">
        Breaks are excluded from focused time. Older records keep their original
        classification.
      </p>
    </section>
  );
}
