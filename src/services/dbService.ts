import { openDB, type IDBPDatabase } from 'idb';
import type { WorkspaceRecord } from '../types/workspace';
import { DEFAULT_PROJECTS } from '../utils/storage';
import { validateWorkspaceData } from '../utils/workspaceValidation';
import { formatLocalDate } from '../utils/nlpParser';
export type { WorkspaceRecord } from '../types/workspace';
let database: Promise<IDBPDatabase> | undefined;
export function getDatabase() {
  if (!database) database = openDB('flowtask_storage_v2', 1, { upgrade(db) {
    for (const name of ['workspaces', 'snapshots', 'legacy_backups', 'outbox']) {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath: name === 'workspaces' ? 'workspaceId' : 'id' });
        if (name === 'snapshots' || name === 'outbox') store.createIndex('by_workspace', 'workspaceId');
      }
    }
  }}).catch(error => { database = undefined; throw error; });
  return database;
}
export function emptyWorkspace(workspaceId: string): WorkspaceRecord {
  return { schemaVersion: 3, workspaceId, tasks: [], projects: DEFAULT_PROJECTS.filter(p => p.id !== 'ideas'), customViews: [], preferences: {}, pending: [], undo: [], updatedAt: 0 };
}
function normalize(raw: Partial<WorkspaceRecord>, id: string): WorkspaceRecord {
  const data = validateWorkspaceData(raw.tasks || [], raw.projects || DEFAULT_PROJECTS);
  const date = formatLocalDate(new Date());
  return { ...emptyWorkspace(id), ...raw, ...data, workspaceId: id, schemaVersion: 3,
    tasks: data.tasks.map(t => ({ ...t, isSomeday: t.isSomeday || t.projectId === 'ideas', topThreeDate: t.topThreeDate || (t.isPinnedToday ? t.plannedDate || t.dueDate || date : undefined) })) };
}
export const dbService = {
  async loadWorkspace(id: string): Promise<WorkspaceRecord | null> {
    if (typeof indexedDB !== 'undefined') {
      // A failed read must not be mistaken for an empty workspace.
      const db = await getDatabase();
      const record = await db.get('workspaces', id);
      if (record) return normalize(record, id);
    }
    const raw = localStorage.getItem(`flowtask_ws_${id}`);
    return raw ? normalize(JSON.parse(raw), id) : null;
  },
  async ensureLegacyMigrated(id = 'local'): Promise<WorkspaceRecord> {
    const existing = await this.loadWorkspace(id);
    if (existing) return existing;
    const record = emptyWorkspace(id);
    // Unscoped legacy data belongs only to the local workspace, never a new account.
    if (id === 'local') {
      const tasks = localStorage.getItem('flowtask_tasks_v1');
      const projects = localStorage.getItem('flowtask_projects_v1');
      if (tasks || projects) {
        localStorage.setItem('flowtask_legacy_backup_raw', JSON.stringify({ tasks, projects }));
        Object.assign(record, normalize({ tasks: tasks ? JSON.parse(tasks) : [], projects: projects ? JSON.parse(projects) : DEFAULT_PROJECTS }, id));
      }
      const legacyKeys: Record<string, string> = { settings: 'flowtask_workflow_settings_v1', templates: 'flowtask_custom_templates', scratchpad: 'flowtask_scratchpad_v1', calendarUrl: 'flowtask_calendar_ics_url' };
      for (const [key, storageKey] of Object.entries(legacyKeys)) {
        const value = localStorage.getItem(storageKey);
        if (value) { try { record.preferences[key] = JSON.parse(value); } catch { record.preferences[key] = value; } }
      }
      const views = localStorage.getItem('flowtask_custom_smart_views');
      if (views) record.customViews = JSON.parse(views);
    }
    await this.saveWorkspace(id, record);
    return record;
  },
  async saveWorkspace(id: string, data: Partial<WorkspaceRecord> & Pick<WorkspaceRecord, 'tasks' | 'projects'>): Promise<void> {
    const record = { ...emptyWorkspace(id), ...data, workspaceId: id };
    if (typeof indexedDB !== 'undefined') {
      const db = await getDatabase();
      const tx = db.transaction(['workspaces', 'outbox'], 'readwrite');
      await tx.objectStore('workspaces').put(record);
      const pending = tx.objectStore('outbox');
      const old = await pending.index('by_workspace').getAllKeys(id);
      for (const key of old) await pending.delete(key);
      for (const operation of record.pending) await pending.put({ ...operation, workspaceId: id });
      await tx.done;
      return;
    }
    // One scoped fallback; errors are returned to the UI.
    localStorage.setItem(`flowtask_ws_${id}`, JSON.stringify(record));
  },
  async deleteWorkspace(id: string) {
    if (typeof indexedDB !== 'undefined') await (await getDatabase()).delete('workspaces', id);
    localStorage.removeItem(`flowtask_ws_${id}`);
  },
};
