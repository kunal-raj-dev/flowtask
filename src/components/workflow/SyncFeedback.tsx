import { useState } from 'react';
import type { StoreSnapshot, WorkspaceStore } from '../../services/workspaceStore';
import { Dialog } from '../ui/Dialog';
import { downloadJson } from '../../utils/fileExporter';

interface Difference { collection: string; id: string; device: unknown; account: unknown }
export function SyncFeedback({ store, snapshot, download }: { store: WorkspaceStore; snapshot: StoreSnapshot; download: () => void }) {
  const [differences, setDifferences] = useState<Difference[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!snapshot.error && snapshot.sync !== 'offline' && !differences) return null;
  return <>
    <aside className="workspace-sync-notice" aria-label="Saving and sync notice" role="alert">
      <p>{snapshot.error || 'Cloud connection is unavailable. Your changes are saved on this device.'}</p>
      <div className="flex flex-wrap gap-2"><button className="desk-button" onClick={() => {
        void store.retry().catch(() => {}); window.dispatchEvent(new Event('flowtask:retry-cloud'));
      }}>Retry</button><button className="desk-button" onClick={download}>Download backup</button>
        {snapshot.sync === 'conflict' && <button className="desk-button primary" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { setDifferences(await store.previewConflict()); }
          catch { setError('Account changes could not be loaded. Your device changes are preserved. Retry when connected.'); }
          finally { setBusy(false); }
        }}>Review changes</button>}
      </div>{error && <p>{error}</p>}
    </aside>
    <Dialog isOpen={differences !== null} onClose={() => { if (!busy) setDifferences(null); }} title="Review device and account changes" description="Your pending operations are listed below. Choose which version to keep for these changes; unrelated account records are preserved." size="lg">
      <div className="p-5 space-y-4">
        {differences?.map(value => <section key={`${value.collection}:${value.id}`} className="sync-difference"><h4>{value.collection === 'tasks' ? 'Task' : value.collection === 'projects' ? 'Project' : 'Workspace record'}</h4><div className="sync-difference-columns"><div><strong>On this device</strong><pre>{JSON.stringify(value.device, null, 2)}</pre></div><div><strong>In your account</strong><pre>{JSON.stringify(value.account, null, 2)}</pre></div></div></section>)}
        <p>A recovery copy of both versions is saved on this device before your choice is applied. This choice applies to all listed pending changes.</p>
        <button className="desk-button" onClick={() => downloadJson(differences, 'flowtask-conflict-review.json')}>Download both versions</button>
        <div className="flex flex-wrap gap-3">{(['local', 'remote'] as const).map(choice => <button className="desk-button" key={choice} disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { await store.resolveConflict(choice); setDifferences(null); }
          catch (reason) { setError((reason as Error).message); }
          finally { setBusy(false); }
        }}>{choice === 'local' ? 'Keep device changes' : 'Use account changes'}</button>)}</div>
      </div>
    </Dialog>
  </>;
}
