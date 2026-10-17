import { useEffect, useRef } from "react";
import { useTaskContext } from "../../context/TaskContext";
import { recordDiagnostic } from "../../services/diagnostics";
export function DiagnosticsRuntime() {
  const ctx = useTaskContext();
  const enabled = Boolean(
    (ctx.workspacePreferences.profile as { diagnosticsEnabled?: boolean })
      ?.diagnosticsEnabled,
  );
  const seen = useRef(new Set(ctx.focusLogs.map((log) => log.id)));
  useEffect(() => {
    recordDiagnostic(ctx.workspaceId, enabled, "return_visit");
  }, [ctx.workspaceId, enabled]);
  useEffect(() => {
    if (ctx.focusSession?.state === "running")
      recordDiagnostic(ctx.workspaceId, enabled, "activation");
  }, [ctx.focusSession?.id, ctx.focusSession?.state, ctx.workspaceId, enabled]);
  useEffect(() => {
    for (const log of ctx.focusLogs) {
      if (!seen.current.has(log.id) && (!log.phase || log.phase === "focus"))
        recordDiagnostic(
          ctx.workspaceId,
          enabled,
          log.outcome === "completed"
            ? "session_completed"
            : "session_interrupted",
        );
      seen.current.add(log.id);
    }
  }, [ctx.focusLogs, ctx.workspaceId, enabled]);
  useEffect(() => {
    if (ctx.syncStatus === "offline")
      recordDiagnostic(ctx.workspaceId, enabled, "sync_failure");
  }, [ctx.syncStatus, ctx.workspaceId, enabled]);
  useEffect(() => {
    const failure = () =>
      recordDiagnostic(ctx.workspaceId, enabled, "media_failure");
    window.addEventListener("flowtask:audio-error", failure);
    window.addEventListener("flowtask:media-error", failure);
    return () => {
      window.removeEventListener("flowtask:audio-error", failure);
      window.removeEventListener("flowtask:media-error", failure);
    };
  }, [ctx.workspaceId, enabled]);
  return null;
}
