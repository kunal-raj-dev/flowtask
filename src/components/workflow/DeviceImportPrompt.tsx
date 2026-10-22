import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTaskContext } from '../../context/TaskContext';
import { useTaskStore } from '../../store/useTaskStore';
import { dbService } from '../../services/dbService';
import type { WorkspaceRecord } from '../../types/workspace';
import { Dialog } from '../ui/Dialog';

export function DeviceImportPrompt() {
  const ctx = useTaskContext();
  const { user } = useAuth();
  const [preview, setPreview] = useState<WorkspaceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user || ctx.workspaceId === 'local' || ctx.syncStatus !== 'synced') return;
    let cancelled = false;
    const open = () => { void dbService.loadWorkspace('local').then(record => {
      if (!cancelled && record?.tasks.length) setPreview(record);
    }).catch(() => { if (!cancelled) setError('Device workspace could not be read. It has not been imported.'); }); };
    if (!ctx.workspacePreferences._deviceImportChoice) open();
    window.addEventListener('flowtask:preview-device-import', open);
    return () => { cancelled = true; window.removeEventListener('flowtask:preview-device-import', open); };
  }, [ctx.workspaceId, ctx.syncStatus, ctx.workspacePreferences._deviceImportChoice, user]);
  const choose = (choice: string) => { ctx.setWorkspacePreference('_deviceImportChoice', choice); setPreview(null); };
  return <Dialog isOpen={Boolean(preview)} onClose={() => { if (!busy) choose('separate'); }} title="Bring your device tasks into this account?"
    description="Your device workspace stays separate unless you choose to import it." closeOnBackdropClick={!busy}>
    <div className="space-y-4 p-5">
      <p>Destination: <strong>{user?.email || user?.displayName || 'Signed-in account'}</strong></p>
      <p>{preview?.tasks.length || 0} device tasks · {preview?.projects.filter(p => p.id !== 'inbox').length || 0} projects. Existing task IDs are skipped. Review the account above before importing.</p>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="desk-button primary" disabled={busy} onClick={async () => {
          if (!preview || useTaskStore.getState().workspaceId !== ctx.workspaceId) return;
          setBusy(true); setError('');
          try { await ctx.importTasks(preview.tasks, preview.projects); choose('imported'); }
          catch (reason) { setError((reason as Error).message); }
          finally { setBusy(false); }
        }}>{busy ? 'Importing…' : 'Import device tasks'}</button>
        <button className="desk-button" disabled={busy} onClick={() => choose('separate')}>Keep separate</button>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">Your original device workspace is preserved. You can review this choice later in Account & sync.</p>
    </div>
  </Dialog>;
}
