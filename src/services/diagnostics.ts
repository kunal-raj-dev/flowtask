const ALLOWED = new Set(['activation','session_completed','session_interrupted','sync_failure','media_failure','return_visit']);
/** Opt-in, device-local counters. No payloads, URLs, IDs or user content are accepted. */
export function recordDiagnostic(workspaceId: string, enabled: boolean, event: string) {
  if(!enabled || !ALLOWED.has(event)) return;
  try { const key=`flowtask-diagnostics:${workspaceId}`; const counts=JSON.parse(localStorage.getItem(key)||'{}'); if(event==='activation' && counts.activation) return; counts[event]=Math.min(100000,(Number(counts[event])||0)+1); localStorage.setItem(key,JSON.stringify(counts)); } catch { /* diagnostics never block work */ }
}
