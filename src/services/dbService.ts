import { openDB, type IDBPDatabase } from 'idb';
import type { Task, Project } from '../types/task';
import { DEFAULT_PROJECTS, getInitialTasks } from '../utils/storage';
import { formatLocalDate } from '../utils/nlpParser';

const DB_NAME = 'flowtask_storage_v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined';
}

function getDatabase(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'workspaceId' });
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const store = db.createObjectStore('snapshots', { keyPath: 'id' });
          store.createIndex('by_workspace', 'workspaceId');
        }
        if (!db.objectStoreNames.contains('legacy_backups')) {
          db.createObjectStore('legacy_backups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
          outbox.createIndex('by_workspace', 'workspaceId');
        }
      },
    });
  }
  return dbPromise;
}

export interface WorkspaceRecord {
  workspaceId: string;
  tasks: Task[];
  projects: Project[];
  customViews?: unknown[];
  updatedAt: number;
}

export const dbService = {
  /**
   * Migrate legacy localStorage tasks & projects to scoped v2 format with raw backup
   */
  async ensureLegacyMigrated(workspaceId: string = 'local'): Promise<WorkspaceRecord> {
    const rawLegacyTasks = localStorage.getItem('flowtask_tasks_v1');
    const rawLegacyProjects = localStorage.getItem('flowtask_projects_v1');
    const alreadyMigrated = localStorage.getItem(`flowtask_migrated_${workspaceId}`);

    // If already migrated, load existing workspace
    const existing = await this.loadWorkspace(workspaceId);
    if (existing && alreadyMigrated) {
      return existing;
    }

    let tasks: Task[] = [];
    let projects: Project[] = DEFAULT_PROJECTS;

    if (rawLegacyTasks) {
      try {
        // 1. Preserve raw legacy backup before ANY modifications
        const rawBackup = {
          id: `legacy_backup_${Date.now()}`,
          timestamp: Date.now(),
          rawTasks: rawLegacyTasks,
          rawProjects: rawLegacyProjects,
        };

        if (isIndexedDBSupported()) {
          try {
            const db = await getDatabase();
            await db.put('legacy_backups', rawBackup);
          } catch (e) {
            console.warn('Could not store raw backup in IndexedDB, saving to localStorage:', e);
            localStorage.setItem('flowtask_legacy_backup_raw', JSON.stringify(rawBackup));
          }
        } else {
          localStorage.setItem('flowtask_legacy_backup_raw', JSON.stringify(rawBackup));
        }

        const parsedTasks = JSON.parse(rawLegacyTasks) as Task[];
        const todayStr = formatLocalDate(new Date());

        // 2. Migrate legacy tasks: copy legacy dueDate into plannedDate, tag ideas as someday
        tasks = parsedTasks.map((t) => {
          const plannedDate = t.plannedDate || t.dueDate;
          const isSomeday = t.isSomeday || t.projectId === 'ideas';
          const topThreeDate = t.topThreeDate || (t.isPinnedToday ? todayStr : undefined);

          return {
            ...t,
            plannedDate,
            isSomeday,
            topThreeDate,
            isPinnedToday: Boolean(t.isPinnedToday || (topThreeDate && topThreeDate === todayStr)),
          };
        });
      } catch (err) {
        console.error('Failed to parse legacy tasks during migration:', err);
      }
    }

    if (rawLegacyProjects) {
      try {
        projects = JSON.parse(rawLegacyProjects) as Project[];
      } catch (err) {
        console.error('Failed to parse legacy projects:', err);
      }
    }

    if (tasks.length === 0) {
      tasks = getInitialTasks();
    }

    const record: WorkspaceRecord = {
      workspaceId,
      tasks,
      projects,
      updatedAt: Date.now(),
    };

    await this.saveWorkspace(workspaceId, record);
    localStorage.setItem(`flowtask_migrated_${workspaceId}`, 'true');
    return record;
  },

  /**
   * Load workspace data for a specific workspace/account
   */
  async loadWorkspace(workspaceId: string): Promise<WorkspaceRecord | null> {
    if (isIndexedDBSupported()) {
      try {
        const db = await getDatabase();
        const record = await db.get('workspaces', workspaceId);
        if (record) return record;
      } catch (err) {
        console.warn('IndexedDB load failed, trying localStorage fallback:', err);
      }
    }

    // LocalStorage fallback namespaced by workspaceId
    try {
      const raw = localStorage.getItem(`flowtask_ws_${workspaceId}`);
      if (raw) {
        return JSON.parse(raw) as WorkspaceRecord;
      }
    } catch (err) {
      console.error('Failed to load workspace from localStorage:', err);
    }

    return null;
  },

  /**
   * Save workspace data for a specific workspace/account
   */
  async saveWorkspace(workspaceId: string, data: { tasks: Task[]; projects: Project[]; customViews?: unknown[] }): Promise<void> {
    const record: WorkspaceRecord = {
      workspaceId,
      tasks: data.tasks,
      projects: data.projects,
      customViews: data.customViews,
      updatedAt: Date.now(),
    };

    // Save to localStorage as immediate sync / fallback
    try {
      localStorage.setItem(`flowtask_ws_${workspaceId}`, JSON.stringify(record));
      // For local workspace, also keep legacy keys updated for backwards compatibility
      if (workspaceId === 'local') {
        localStorage.setItem('flowtask_tasks_v1', JSON.stringify(data.tasks));
        localStorage.setItem('flowtask_projects_v1', JSON.stringify(data.projects));
      }
    } catch (err) {
      console.error('LocalStorage write error:', err);
    }

    if (isIndexedDBSupported()) {
      try {
        const db = await getDatabase();
        await db.put('workspaces', record);
      } catch (err) {
        console.warn('IndexedDB write error:', err);
      }
    }
  },

  /**
   * Delete a workspace (e.g. on complete reset)
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    localStorage.removeItem(`flowtask_ws_${workspaceId}`);
    if (isIndexedDBSupported()) {
      try {
        const db = await getDatabase();
        await db.delete('workspaces', workspaceId);
      } catch (err) {
        console.warn('IndexedDB delete error:', err);
      }
    }
  },
};
