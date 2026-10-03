import { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { Dialog } from '../ui/Dialog';
export function RecoveryView({ mode }: { mode: 'trash' | 'archive' }) {
  const { tasks, projects, restoreTask, permanentDeleteTask, updateProject, downloadWorkspaceBackup } = useTaskContext();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const items = tasks.filter(t => mode === 'trash' ? !!t.deletedAt : !!t.archivedAt && !t.deletedAt);
  return <section className="max-w-4xl mx-auto p-6 space-y-5"><header><h2 className="text-2xl font-semibold">{mode === 'trash' ? 'Trash' : 'Archive'}</h2><p className="text-sm text-[var(--text-secondary)] mt-2">{mode === 'trash' ? 'Deleted tasks stay here until you permanently remove them.' : 'Restore a task or project whenever you need it again.'}</p></header>
    <button className="underline text-sm" onClick={downloadWorkspaceBackup}>Download a full backup</button>
    {!items.length && <p className="py-10 text-[var(--text-secondary)]">No {mode === 'trash' ? 'deleted' : 'archived'} tasks.</p>}
    <ul className="space-y-2">{items.map(t => <li key={t.id} className="p-4 rounded-xl border border-[var(--border-hairline)] flex gap-4 items-center"><div className="flex-1 min-w-0"><p className="font-medium break-words">{t.title}</p><p className="text-xs text-[var(--text-secondary)]">{projects.find(p => p.id === t.projectId)?.name || 'Inbox'}</p></div><button className="px-3 py-2 rounded-lg border" onClick={() => restoreTask(t.id)}>Restore</button>{mode === 'trash' && <button className="text-red-600 px-3 py-2" onClick={() => setPendingDelete(t.id)}>Delete forever</button>}</li>)}</ul>
    {mode === 'archive' && projects.filter(p => p.isArchived).map(p => <div key={p.id} className="p-4 border rounded-xl flex justify-between"><span>{p.name} · Project</span><button onClick={() => updateProject(p.id, { isArchived: false, archivedAt: undefined })}>Restore project</button></div>)}
    <Dialog isOpen={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Permanently delete this task?" description="It will be removed from this workspace and connected devices. Download a backup first if you may need it later." footer={<><button onClick={() => setPendingDelete(null)}>Cancel</button><button className="text-red-600 px-3" onClick={() => { if (pendingDelete) permanentDeleteTask(pendingDelete); setPendingDelete(null); }}>Delete forever</button></>} />
  </section>;
}
