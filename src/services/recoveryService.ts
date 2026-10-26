import { getDatabase } from './dbService';
import type { WorkspaceRecord } from '../types/workspace';
import { createWorkspaceBackup, validateBackupExtras } from '../utils/workspaceBackup';
import { validateWorkspaceData } from '../utils/workspaceValidation';

export type PortableWorkspace = ReturnType<typeof createWorkspaceBackup>;
export interface RecoverySnapshot {
  version: 2;
  id: string;
  workspaceId: string;
  timestamp: number;
  day: string;
  label: string;
  taskCount: number;
  noteCount?: number;
  projectCount: number;
  trigger: 'manual' | 'auto_daily' | 'pre_batch';
  backup: PortableWorkspace;
}
const dayKey = (at: number) => {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};
function scope(workspaceId: string) {
  if (!workspaceId || typeof workspaceId !== 'string') throw new Error('Choose a workspace before managing recovery checkpoints.');
}
function validate(backup: PortableWorkspace) {
  if (backup.schemaVersion > 8) throw new Error('This backup requires a newer FlowTask version.');
  validateWorkspaceData(backup.tasks, backup.projects);
  validateBackupExtras(backup);
}

/** Durable, device-local recovery. Checkpoints never imply a separate-device backup. */
export const recoveryService = {
  async list(workspaceId: string): Promise<RecoverySnapshot[]> {
    scope(workspaceId);
    const db = await getDatabase();
    const records = await db.getAllFromIndex('snapshots', 'by_workspace', workspaceId);
    return records.filter((value): value is RecoverySnapshot => value.version === 2 && value.workspaceId === workspaceId)
      .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
  },
  async create(workspaceId: string, record: Pick<WorkspaceRecord, 'tasks' | 'projects' | 'preferences' | 'customViews' | 'dashboards' | 'notes'>,
    trigger: RecoverySnapshot['trigger'] = 'manual', label?: string): Promise<RecoverySnapshot> {
    scope(workspaceId);
    const backup = structuredClone(createWorkspaceBackup(record));
    validate(backup);
    const timestamp = Date.now();
    const snapshot: RecoverySnapshot = {
      version: 2, id: crypto.randomUUID(), workspaceId, timestamp, day: dayKey(timestamp),
      label: label || (trigger === 'auto_daily' ? 'Daily checkpoint' : trigger === 'pre_batch' ? 'Before changes' : 'Manual checkpoint'),
      taskCount: backup.tasks.length, noteCount: backup.notes.length, projectCount: backup.projects.length, trigger, backup,
    };
    const db = await getDatabase();
    const tx = db.transaction('snapshots', 'readwrite');
    const existing = (await tx.store.index('by_workspace').getAll(workspaceId)) as RecoverySnapshot[];
    const owned = existing.filter(value => value.version === 2);
    // Deduplicate in the same transaction, including concurrent tabs.
    const daily = trigger === 'auto_daily' && owned.find(value => value.trigger === trigger && value.day === snapshot.day);
    if (daily) { await tx.done; return daily; }
    await tx.store.put(snapshot);
    const sorted = [snapshot, ...owned].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
    for (const old of sorted.slice(10)) await tx.store.delete(old.id);
    await tx.done;
    return snapshot;
  },
  async read(workspaceId: string, id: string): Promise<PortableWorkspace> {
    scope(workspaceId);
    const db = await getDatabase();
    const snapshot = await db.get('snapshots', id) as RecoverySnapshot | undefined;
    if (snapshot?.version !== 2 || snapshot.workspaceId !== workspaceId) throw new Error('This checkpoint does not belong to the current workspace.');
    validate(snapshot.backup);
    return structuredClone(snapshot.backup);
  },
  async remove(workspaceId: string, id: string): Promise<void> {
    scope(workspaceId);
    const db = await getDatabase();
    const tx = db.transaction('snapshots', 'readwrite');
    const value = await tx.store.get(id);
    if (value?.version !== 2 || value.workspaceId !== workspaceId) { await tx.done; throw new Error('This checkpoint does not belong to the current workspace.'); }
    await tx.store.delete(id);
    await tx.done;
  },
  async legacy(): Promise<unknown[]> {
    // Ownership of old snapshots cannot be proven. Export only; never auto-assign.
    const db = await getDatabase();
    const old = (await db.getAll('snapshots')).filter(value => value.version !== 2);
    let local: unknown = [];
    try { local = JSON.parse(localStorage.getItem('flowtask_snapshots_v1') || '[]'); } catch { /* preserve raw source */ }
    return [...old, ...(Array.isArray(local) ? local : [])];
  },
};
