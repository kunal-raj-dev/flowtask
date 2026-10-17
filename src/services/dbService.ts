import { openDB, type IDBPDatabase } from 'idb';
import type { WorkspaceRecord } from '../types/workspace';
import { DEFAULT_PROJECTS } from '../utils/storage';
import { validateWorkspaceData } from '../utils/workspaceValidation';
import { formatLocalDate } from '../utils/nlpParser';
import { createStarterDashboards } from './starterDashboards';
import { validateDashboards } from '../utils/dashboardModel';
export type { WorkspaceRecord } from '../types/workspace';

/**
 * Proactively requests browser storage persistence to safeguard IndexedDB
 * against automatic disk quota eviction.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.persist !== 'function'
  ) {
    return false;
  }

  try {
    if (typeof navigator.storage.persisted === 'function') {
      const isAlreadyPersisted = await navigator.storage.persisted();
      if (isAlreadyPersisted) {
        console.debug('[Storage] IndexedDB storage is already persistent.');
        return true;
      }
    }

    const granted = await navigator.storage.persist();
    if (granted) {
      console.info('[Storage] Browser granted persistent storage.');
    } else {
      console.warn('[Storage] Persistent storage request was not granted.');
    }
    return granted;
  } catch (error) {
    console.warn('[Storage] Failed to request persistent storage:', error);
    return false;
  }
}

let database: Promise<IDBPDatabase> | undefined;
export function getDatabase() {
  if (!database) {
    if (typeof indexedDB !== 'undefined') {
      void requestPersistentStorage();
    }
    database = openDB('flowtask_storage_v2', 2, { upgrade(db) {
      for (const name of ['workspaces', 'snapshots', 'legacy_backups', 'outbox', 'media']) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: name === 'workspaces' ? 'workspaceId' : 'id' });
          if (name === 'snapshots' || name === 'outbox') store.createIndex('by_workspace', 'workspaceId');
        }
      }
    }}).catch(error => { database = undefined; throw error; });
  }
  return database;
}
export function emptyWorkspace(workspaceId: string): WorkspaceRecord {
  return {
    schemaVersion: 6,
    workspaceId,
    tasks: [],
    projects: DEFAULT_PROJECTS.filter(p => p.id !== 'ideas'),
    dashboards: createStarterDashboards(),
    customViews: [],
    preferences: {},
    pending: [],
    undo: [],
    updatedAt: 0,
  };
}
function normalize(raw: Partial<WorkspaceRecord>, id: string): WorkspaceRecord {
  const data = validateWorkspaceData(raw.tasks || [], raw.projects || DEFAULT_PROJECTS);
  const date = formatLocalDate(new Date());
  const starters = createStarterDashboards();
  let dashboards = starters;
  let dashboardRecovery = false;
  try { if (Array.isArray(raw.dashboards) && raw.dashboards.length) dashboards = validateDashboards(raw.dashboards); }
  catch { dashboardRecovery = true; }
  if (!dashboards.some(d => d.isDefault) && dashboards.length > 0) {
    dashboards = dashboards.map((d, i) => i === 0 ? { ...d, isDefault: true } : d);
  }
  return {
    ...emptyWorkspace(id),
    ...raw,
    ...data,
    dashboards,
    workspaceId: id,
    schemaVersion: 6,
    preferences: {
      ...raw.preferences,
      ...(dashboardRecovery ? { _dashboardRecovery: true } : {}),
      ...((raw.schemaVersion || 0) < 4 ? { _v4CloudSeedNeeded: true } : {}),
      ...((raw.schemaVersion || 0) < 5 ? { _v5DashboardSeedNeeded: true } : {}),
    },
    tasks: data.tasks.map(t => ({
      ...t,
      isSomeday: t.isSomeday || t.projectId === 'ideas',
      topThreeDate: t.topThreeDate || (t.isPinnedToday ? t.plannedDate || t.dueDate || date : undefined),
      rolloverCount: t.rolloverCount,
      lastRolledOverAt: t.lastRolledOverAt,
      bufferMinutes: t.bufferMinutes,
      isAutoTriaged: t.isAutoTriaged,
    })),
  };
}
export const dbService = {
  async loadWorkspace(id: string): Promise<WorkspaceRecord | null> {
    if (typeof indexedDB !== 'undefined') {
      // A failed read must not be mistaken for an empty workspace.
      const db = await getDatabase();
      const record = await db.get('workspaces', id);
      if (record) {
        try { if (record.dashboards) validateDashboards(record.dashboards); }
        catch { if (!await db.get('legacy_backups', `dashboard-repair:${id}`)) await db.put('legacy_backups', { id: `dashboard-repair:${id}`, workspaceId: id, savedAt: Date.now(), record }); }
        if ((record.schemaVersion || 0) < 4 && !await db.get('legacy_backups', `v3:${id}`)) {
          await db.put('legacy_backups', { id: `v3:${id}`, workspaceId: id, savedAt: Date.now(), record });
        }
        if ((record.schemaVersion || 0) < 5 && !await db.get('legacy_backups', `v4:${id}`)) {
          await db.put('legacy_backups', { id: `v4:${id}`, workspaceId: id, savedAt: Date.now(), record });
        }
        if ((record.schemaVersion || 0) < 6 && !await db.get('legacy_backups', `v5:${id}`)) {
          await db.put('legacy_backups', { id: `v5:${id}`, workspaceId: id, savedAt: Date.now(), record });
        }
        return normalize(record, id);
      }
    }
    const raw = localStorage.getItem(`flowtask_ws_${id}`);
    if (!raw) return null;
    try {
      return normalize(JSON.parse(raw), id);
    } catch (e) {
      console.warn(`Failed to parse cached workspace flowtask_ws_${id}:`, e);
      return null;
    }
  },
  async ensureLegacyMigrated(id = 'local'): Promise<WorkspaceRecord> {
    const existing = await this.loadWorkspace(id);
    if (existing) return existing;
    const record = emptyWorkspace(id);
    // Unscoped legacy data belongs only to the local workspace, never a new account.
    if (id === 'local') {
      const tasks = localStorage.getItem('flowtask_tasks_v1') || localStorage.getItem('flowtask_tasks');
      const projects = localStorage.getItem('flowtask_projects_v1') || localStorage.getItem('flowtask_projects');
      if (tasks || projects) {
        localStorage.setItem('flowtask_legacy_backup_raw', JSON.stringify({ tasks, projects }));
        let parsedTasks = [];
        let parsedProjects = DEFAULT_PROJECTS;
        try { parsedTasks = tasks ? JSON.parse(tasks) : []; } catch { /* ignore */ }
        try { parsedProjects = projects ? JSON.parse(projects) : DEFAULT_PROJECTS; } catch { /* ignore */ }
        Object.assign(record, normalize({ tasks: parsedTasks, projects: parsedProjects }, id));
      }
      const legacyKeys: Record<string, string> = { settings: 'flowtask_workflow_settings_v1', templates: 'flowtask_custom_templates', scratchpad: 'flowtask_scratchpad_v1', calendarUrl: 'flowtask_calendar_ics_url' };
      for (const [key, storageKey] of Object.entries(legacyKeys)) {
        const value = localStorage.getItem(storageKey);
        if (value) { try { record.preferences[key] = JSON.parse(value); } catch { record.preferences[key] = value; } }
      }
      const views = localStorage.getItem('flowtask_custom_smart_views');
      if (views) {
        try { record.customViews = JSON.parse(views); } catch { /* ignore */ }
      }
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
    if (typeof indexedDB !== 'undefined') {
      const db = await getDatabase();
      const tx = db.transaction(['workspaces','outbox','snapshots','legacy_backups','media'], 'readwrite');
      await tx.objectStore('workspaces').delete(id);
      for (const name of ['outbox','snapshots','legacy_backups','media']) {
        const store = tx.objectStore(name);
        for (const record of await store.getAll()) if (record.workspaceId === id) await store.delete(record.id);
      }
      await tx.done;
    }
    localStorage.removeItem(`flowtask_ws_${id}`);
    for (const key of Object.keys(localStorage)) if (key.startsWith(`flowtask-dashboard-draft:${id}:`) || key.startsWith(`flowtask-dashboard-mobile:${id}:`)) localStorage.removeItem(key);
    for (const key of [`flowtask_pre_import_${id}`,`flowtask_conflict_backup_${id}`,`flowtask-diagnostics:${id}`,`flowtask-focus-checkpoint:${id}`]) localStorage.removeItem(key);
  },
};
