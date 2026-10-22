import { useEffect, useState } from 'react';
import { recoveryService, type RecoverySnapshot } from '../../services/recoveryService';
import { dbService, emptyWorkspace } from '../../services/dbService';
import type { WorkspaceStore } from '../../services/workspaceStore';
import { validateBackupExtras, mergeBackupExtras } from '../../utils/workspaceBackup';
import { downloadJson } from '../../utils/fileExporter';

export function WorkspaceRecovery({ store, error }: { store: WorkspaceStore; error: string | null }) {
  const [checkpoints, setCheckpoints] = useState<RecoverySnapshot[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void recoveryService.list(store.id).then(setCheckpoints).catch(() => {}); }, [store]);
  return <main className="workspace-recovery" aria-labelledby="recovery-heading">
    <p className="desk-eyebrow">FLOWTASK · RECOVERY</p><h1 id="recovery-heading">Let’s reopen your workspace.</h1>
    <p role="status">{error || 'Opening your saved workspace…'}</p>
    {error && <><p>The original saved data is preserved. Export it before trying a recovery checkpoint.</p>
      <div className="flex flex-wrap gap-3"><button className="desk-button" onClick={() => void dbService.readRawWorkspace(store.id).then(raw => downloadJson(raw, 'flowtask-original-workspace.json')).catch(() => setMessage('Original data could not be read. Keep this browser profile intact.'))}>Export original data</button>
        <button className="desk-button" onClick={() => void store.reload()}>Retry opening</button></div>
      {checkpoints.length > 0 && <section><h2>Available recovery checkpoints</h2>{checkpoints.map(value => <div className="recovery-checkpoint" key={value.id}><span>{value.label} · {new Date(value.timestamp).toLocaleString()} · {value.taskCount} tasks</span>
        <button className="desk-button" disabled={busy} onClick={async () => {
          setBusy(true); setMessage('');
          try {
            const backup = await recoveryService.read(store.id, value.id);
            const record = emptyWorkspace(store.id);
            const extras = validateBackupExtras(backup);
            await dbService.archiveRawWorkspace(store.id);
            await dbService.saveWorkspace(store.id, { ...record, tasks: backup.tasks, projects: backup.projects, ...(extras ? mergeBackupExtras(record, extras, true) : {}), updatedAt: Date.now() });
            await store.reload();
          } catch { setMessage('Recovery could not be completed. The original data remains preserved. Export it and contact support.'); }
          finally { setBusy(false); }
        }}>Restore this checkpoint</button></div>)}</section>}
      {message && <p role="alert">{message}</p>}</>}
  </main>;
}
