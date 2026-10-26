import { openDB, type IDBPDatabase } from 'idb';
import type { WorkspaceRecord } from '../types/workspace';
import { DEFAULT_PROJECTS } from '../utils/storage';
import { validateWorkspaceData, validateAreas, validateGoals, validateRoutines, validateRoutineRuns, validateWorkBlocks, validateReviews } from '../utils/workspaceValidation';
import { parseTimeToMinutes, minutesToTimeStr } from '../utils/timelineUtils';
import type { WorkBlock } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';
import { createStarterDashboards } from './starterDashboards';
import { validateDashboards } from '../utils/dashboardModel';
import { validateNotes } from '../utils/noteModel';
export type { WorkspaceRecord } from '../types/workspace';

/** Requests persistent storage only after an informed user action. */
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
    database = new Promise<IDBPDatabase>((resolve, reject) => {
      let wasBlocked = false;
      void openDB('flowtask_storage_v2', 2, {
      blocked() { wasBlocked = true; reject(new Error('An older FlowTask tab is holding device storage open. Close other FlowTask tabs, then retry opening. Your saved data has not been changed.')); },
      blocking() { const previous = database; database = undefined; void previous?.then(db => db.close()); },
      upgrade(db) {
      for (const name of ['workspaces', 'snapshots', 'legacy_backups', 'outbox', 'media']) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: name === 'workspaces' ? 'workspaceId' : 'id' });
          if (name === 'snapshots' || name === 'outbox') store.createIndex('by_workspace', 'workspaceId');
        }
      }
    }}).then(db => { if (wasBlocked) db.close(); else resolve(db); }, reject);
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}
export function emptyWorkspace(workspaceId: string): WorkspaceRecord {
  return {
    schemaVersion: 11,
    notes: [],
    areas: [],
    goals: [],
    routines: [],
    routineRuns: [],
    reviews: [],
    habits: [],
    workBlocks: [],
    reminders: [],
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
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > 11) throw new Error('This workspace requires a newer FlowTask version. Export the original data before updating.');
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

  // Migrate work blocks from older single-schedule fields & embedded task.workBlocks
  const existingWorkBlocks = validateWorkBlocks(raw.workBlocks || []);
  const blockIds = new Set(existingWorkBlocks.map(b => b.id));
  const migratedBlocks: WorkBlock[] = [...existingWorkBlocks];

  // 1. Migrate embedded task.workBlocks
  for (const t of data.tasks) {
    if (Array.isArray(t.workBlocks)) {
      for (const embedded of t.workBlocks) {
        if (!blockIds.has(embedded.id)) {
          const validated = validateWorkBlocks([embedded])[0];
          if (validated) {
            migratedBlocks.push(validated);
            blockIds.add(embedded.id);
          }
        }
      }
    }
  }

  // 2. Migrate single schedule fields into WorkBlocks if task is not already represented
  for (const t of data.tasks) {
    if (t.scheduledStart && (t.plannedDate || t.dueDate)) {
      const taskHasBlock = migratedBlocks.some(b => b.taskId === t.id);
      if (!taskHasBlock) {
        const targetDate = t.plannedDate || t.dueDate || date;
        const startMin = parseTimeToMinutes(t.scheduledStart) ?? 9 * 60;
        const explicitEnd = parseTimeToMinutes(t.scheduledEnd);
        const duration = explicitEnd && explicitEnd > startMin ? explicitEnd - startMin : t.estimatedMinutes || 30;
        const parsedStart = Date.parse(`${targetDate}T${t.scheduledStart}:00Z`);
        const startInstant = Number.isFinite(parsedStart) ? parsedStart : Date.now();
        const endInstant = startInstant + duration * 60000;
        const newBlock: WorkBlock = {
          id: `wb-migrated-${t.id}`,
          taskId: t.id,
          startInstant,
          endInstant,
          timezone: t.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC'),
          status: t.status === 'done' ? 'completed' : 'scheduled',
          durationMinutes: duration,
          date: targetDate,
          startTime: t.scheduledStart,
          endTime: t.scheduledEnd || minutesToTimeStr(startMin + duration),
          isLocked: Boolean(t.scheduleLocked),
          revision: 1,
          createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : Date.now(),
        };
        migratedBlocks.push(newBlock);
        blockIds.add(newBlock.id);
      }
    }
  }

  const tasksWithProjections = data.tasks.map(t => {
    const taskBlocks = migratedBlocks.filter(b => b.taskId === t.id && b.status !== 'cancelled');
    if (taskBlocks.length > 0) {
      const unfinished = taskBlocks.filter(b => b.status !== 'completed').sort((a, b) => a.startInstant - b.startInstant);
      const chosen = unfinished[0] || taskBlocks.sort((a, b) => b.startInstant - a.startInstant)[0];
      return {
        ...t,
        plannedDate: chosen.date || t.plannedDate,
        scheduledStart: chosen.startTime || t.scheduledStart,
        scheduledEnd: chosen.endTime || t.scheduledEnd,
        isSomeday: t.isSomeday || t.projectId === 'ideas',
        topThreeDate: t.topThreeDate || (t.isPinnedToday ? t.plannedDate || t.dueDate || date : undefined),
        rolloverCount: t.rolloverCount,
        lastRolledOverAt: t.lastRolledOverAt,
        bufferMinutes: t.bufferMinutes,
        isAutoTriaged: t.isAutoTriaged,
        deferUntil: (t as any).deferUntil,
        predecessorTaskId: (t as any).predecessorTaskId,
        cognitiveLoad: (t as any).cognitiveLoad,
      };
    }
    return {
      ...t,
      isSomeday: t.isSomeday || t.projectId === 'ideas',
      topThreeDate: t.topThreeDate || (t.isPinnedToday ? t.plannedDate || t.dueDate || date : undefined),
      rolloverCount: t.rolloverCount,
      lastRolledOverAt: t.lastRolledOverAt,
      bufferMinutes: t.bufferMinutes,
      isAutoTriaged: t.isAutoTriaged,
      deferUntil: (t as any).deferUntil,
      predecessorTaskId: (t as any).predecessorTaskId,
      cognitiveLoad: (t as any).cognitiveLoad,
    };
  });

  return {
    ...emptyWorkspace(id),
    ...raw,
    tasks: tasksWithProjections,
    projects: data.projects,
    dashboards,
    workspaceId: id,
    schemaVersion: 11,
    notes: validateNotes(raw.notes),
    areas: validateAreas(raw.areas),
    goals: validateGoals(raw.goals),
    routines: validateRoutines(raw.routines),
    routineRuns: validateRoutineRuns(raw.routineRuns),
    workBlocks: migratedBlocks,
    reviews: validateReviews(raw.reviews),
    habits: raw.habits || [],
    preferences: {
      ...raw.preferences,
      ...(dashboardRecovery ? { _dashboardRecovery: true } : {}),
      ...((raw.schemaVersion || 0) < 4 ? { _v4CloudSeedNeeded: true } : {}),
      ...((raw.schemaVersion || 0) < 5 ? { _v5DashboardSeedNeeded: true } : {}),
    },
  };
}
export const dbService = {
  async readRawWorkspace(id: string): Promise<unknown> {
    if (typeof indexedDB !== 'undefined') {
      const record = await (await getDatabase()).get('workspaces', id);
      if (record) return record;
    }
    return { workspace: localStorage.getItem(`flowtask_ws_${id}`), ...(id === 'local' ? { legacy: localStorage.getItem('flowtask_legacy_backup_raw') } : {}) };
  },
  async archiveRawWorkspace(id: string) {
    const record = await this.readRawWorkspace(id);
    const db = await getDatabase();
    await db.put('legacy_backups', { id: `recovery:${id}:${crypto.randomUUID()}`, workspaceId: id, savedAt: Date.now(), record });
  },
  async loadWorkspace(id: string): Promise<WorkspaceRecord | null> {
    if (typeof indexedDB !== 'undefined') {
      // A failed read must not be mistaken for an empty workspace.
      const db = await getDatabase();
      const record = await db.get('workspaces', id);
      if (record) {
        if ((record.schemaVersion || 0) < 9 && !await db.get('legacy_backups', `v8:${id}`)) await db.put('legacy_backups', { id: `v8:${id}`, workspaceId: id, savedAt: Date.now(), record });
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
        if ((record.schemaVersion || 0) < 7 && !await db.get('legacy_backups', `v6:${id}`)) {
          await db.put('legacy_backups', { id: `v6:${id}`, workspaceId: id, savedAt: Date.now(), record });
        }
        if ((record.schemaVersion || 0) < 8 && !await db.get('legacy_backups', `v7:${id}`)) await db.put('legacy_backups', { id: `v7:${id}`, workspaceId: id, savedAt: Date.now(), record });
        if ((record.schemaVersion || 0) < 10 && !await db.get('legacy_backups', `v9:${id}`)) await db.put('legacy_backups', { id: `v9:${id}`, workspaceId: id, savedAt: Date.now(), record });
        if ((record.schemaVersion || 0) < 11 && !await db.get('legacy_backups', `v10:${id}`)) await db.put('legacy_backups', { id: `v10:${id}`, workspaceId: id, savedAt: Date.now(), record });
        return normalize(record, id);
      }
    }
    const raw = localStorage.getItem(`flowtask_ws_${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed.schemaVersion || 0) < 9) {
      if (typeof indexedDB !== 'undefined') {
        const db = await getDatabase();
        if (!await db.get('legacy_backups', `v8:${id}`)) await db.put('legacy_backups', { id: `v8:${id}`, workspaceId: id, savedAt: Date.now(), record: parsed });
      } else if (!localStorage.getItem(`flowtask_pre_v9_${id}`)) localStorage.setItem(`flowtask_pre_v9_${id}`, raw);
    }
    if ((parsed.schemaVersion || 0) < 11) {
      if (typeof indexedDB !== 'undefined') {
        const db = await getDatabase();
        if (!await db.get('legacy_backups', `v10:${id}`)) await db.put('legacy_backups', { id: `v10:${id}`, workspaceId: id, savedAt: Date.now(), record: parsed });
      } else if (!localStorage.getItem(`flowtask_pre_v11_${id}`)) localStorage.setItem(`flowtask_pre_v11_${id}`, raw);
    }
    return normalize(parsed, id);
  },
  async ensureLegacyMigrated(id = 'local'): Promise<WorkspaceRecord> {
    const existing = await this.loadWorkspace(id);
    if (existing) {
      if (typeof indexedDB !== 'undefined' && !await (await getDatabase()).get('workspaces', id)) await this.saveWorkspace(id, existing);
      return existing;
    }
    const record = emptyWorkspace(id);
    // Unscoped legacy data belongs only to the local workspace, never a new account.
    if (id === 'local') {
      const tasks = localStorage.getItem('flowtask_tasks_v1') || localStorage.getItem('flowtask_tasks');
      const projects = localStorage.getItem('flowtask_projects_v1') || localStorage.getItem('flowtask_projects');
      if (tasks || projects) {
        localStorage.setItem('flowtask_legacy_backup_raw', JSON.stringify({ tasks, projects }));
        let parsedTasks = [];
        let parsedProjects = DEFAULT_PROJECTS;
        try { parsedTasks = tasks ? JSON.parse(tasks) : []; } catch { throw new Error('Older task data could not be read. Export the original data from recovery before making changes.'); }
        try { parsedProjects = projects ? JSON.parse(projects) : DEFAULT_PROJECTS; } catch { throw new Error('Older project data could not be read. Export the original data from recovery before making changes.'); }
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
  async saveWorkspace(id: string, data: Partial<WorkspaceRecord> & Pick<WorkspaceRecord, 'tasks' | 'projects'>, expectedWriteVersion?: number): Promise<void> {
    const record = { ...emptyWorkspace(id), ...data, workspaceId: id };
    if (typeof indexedDB !== 'undefined') {
      const db = await getDatabase();
      const tx = db.transaction(['workspaces', 'outbox'], 'readwrite');
      if (expectedWriteVersion !== undefined) {
        const previous = await tx.objectStore('workspaces').get(id);
        if (Number(previous?.writeVersion || 0) !== expectedWriteVersion) {
          tx.abort();
          await tx.done.catch(() => {});
          throw new Error('Another tab saved newer device data. Your edits remain here. Download a backup before reopening the workspace.');
        }
      }
      await tx.objectStore('workspaces').put(record);
      const pending = tx.objectStore('outbox');
      const old = await pending.index('by_workspace').getAllKeys(id);
      for (const key of old) await pending.delete(key);
      for (const operation of record.pending) await pending.put({ ...operation, workspaceId: id });
      await tx.done;
      return;
    }
    // One scoped fallback; errors are returned to the UI.
    if (expectedWriteVersion !== undefined) {
      const previous = JSON.parse(localStorage.getItem(`flowtask_ws_${id}`) || 'null');
      if (Number(previous?.writeVersion || 0) !== expectedWriteVersion) throw new Error('Another tab saved newer device data. Download a backup before reopening the workspace.');
    }
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
    localStorage.removeItem(`flowtask_pre_v9_${id}`);
    for (const key of Object.keys(localStorage)) if (key.startsWith(`flowtask-dashboard-draft:${id}:`) || key.startsWith(`flowtask-dashboard-mobile:${id}:`)) localStorage.removeItem(key);
    for (const key of [`flowtask_pre_import_${id}`,`flowtask_conflict_backup_${id}`,`flowtask-diagnostics:${id}`,`flowtask-telemetry-consent:${id}`,`flowtask-focus-checkpoint:${id}`,`flowtask_device_import_choice:${id}`,`flowtask_auto_migrated_v1_${id}`]) localStorage.removeItem(key);
  },
};
