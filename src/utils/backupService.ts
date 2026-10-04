import type { Task, Project } from '../types/task';
import { getDatabase } from '../services/dbService';

export interface LocalSnapshot {
  id: string;
  workspaceId?: string;
  timestamp: number;
  label: string;
  taskCount: number;
  projectCount: number;
  tasks: Task[];
  projects: Project[];
  trigger: 'auto_daily' | 'manual' | 'pre_batch';
}

const STORAGE_KEY_SNAPSHOTS = 'flowtask_snapshots_v1';
const MAX_SNAPSHOTS = 10;

/**
 * Persist a snapshot into IndexedDB 'snapshots' store.
 */
export async function persistSnapshotToIDB(snapshot: LocalSnapshot): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await getDatabase();
    await db.put('snapshots', { ...snapshot, workspaceId: snapshot.workspaceId || 'local' });
  } catch (err) {
    console.warn('Failed to persist snapshot to IndexedDB:', err);
  }
}

/**
 * Delete a snapshot from IndexedDB 'snapshots' store.
 */
export async function deleteSnapshotFromIDB(snapshotId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await getDatabase();
    await db.delete('snapshots', snapshotId);
  } catch (err) {
    console.warn('Failed to delete snapshot from IndexedDB:', err);
  }
}

/**
 * Load all snapshots from IndexedDB for a given workspace, falling back to localStorage.
 */
export async function loadSnapshotsFromIDB(workspaceId = 'local'): Promise<LocalSnapshot[]> {
  if (typeof indexedDB === 'undefined') return getStoredSnapshots();
  try {
    const db = await getDatabase();
    const index = db.transaction('snapshots').store.index('by_workspace');
    const list = await index.getAll(workspaceId);
    if (list && list.length > 0) {
      list.sort((a, b) => b.timestamp - a.timestamp);
      saveStoredSnapshots(list, false);
      return list;
    }
  } catch (err) {
    console.warn('Failed to load snapshots from IndexedDB:', err);
  }
  return getStoredSnapshots();
}

/**
 * Migrate existing localStorage snapshots to IndexedDB.
 */
export async function migrateLocalStorageSnapshotsToIDB(workspaceId = 'local'): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const current = getStoredSnapshots();
    if (current.length === 0) return;
    const db = await getDatabase();
    const tx = db.transaction('snapshots', 'readwrite');
    for (const snap of current) {
      await tx.store.put({ ...snap, workspaceId: snap.workspaceId || workspaceId });
    }
    await tx.done;
  } catch (err) {
    console.warn('Failed to migrate snapshots to IndexedDB:', err);
  }
}

/**
 * Retrieve all locally saved data snapshots, newest first.
 */
export function getStoredSnapshots(): LocalSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (!raw) return [];
    const list: LocalSnapshot[] = JSON.parse(raw);
    return Array.isArray(list) ? list.sort((a, b) => b.timestamp - a.timestamp) : [];
  } catch (err) {
    console.error('Failed to load local snapshots:', err);
    return [];
  }
}

/**
 * Persist the list of snapshots to localStorage and IndexedDB.
 */
function saveStoredSnapshots(snapshots: LocalSnapshot[], syncToIDB = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(snapshots));
  } catch (err) {
    console.warn('Failed to save local snapshots to storage (quota risk). Pruning older snapshots:', err);
    try {
      const pruned = snapshots.slice(0, 3);
      localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(pruned));
    } catch (e2) {
      console.error('Failed to save even pruned snapshots:', e2);
    }
  }

  if (syncToIDB && typeof indexedDB !== 'undefined') {
    void (async () => {
      try {
        const db = await getDatabase();
        const tx = db.transaction('snapshots', 'readwrite');
        for (const snap of snapshots) {
          await tx.store.put({ ...snap, workspaceId: snap.workspaceId || 'local' });
        }
        await tx.done;
      } catch (e) {
        console.warn('Background sync to IndexedDB failed:', e);
      }
    })();
  }
}

/**
 * Create a new point-in-time snapshot with automatic pruning.
 */
export function createLocalSnapshot(
  tasks: Task[],
  projects: Project[],
  customLabel?: string,
  trigger: 'auto_daily' | 'manual' | 'pre_batch' = 'manual'
): LocalSnapshot {
  const timestamp = Date.now();
  const dateFormatted = new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const defaultLabel =
    trigger === 'auto_daily'
      ? `Daily Auto-Snapshot (${dateFormatted})`
      : trigger === 'pre_batch'
      ? `Pre-Action Snapshot (${dateFormatted})`
      : `Manual Snapshot (${dateFormatted})`;

  const snapshot: LocalSnapshot = {
    id: `snap-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
    workspaceId: 'local',
    timestamp,
    label: customLabel?.trim() || defaultLabel,
    taskCount: tasks.length,
    projectCount: projects.length,
    tasks: JSON.parse(JSON.stringify(tasks)),
    projects: JSON.parse(JSON.stringify(projects)),
    trigger,
  };

  const current = getStoredSnapshots();
  let updated = [snapshot, ...current];

  // If over limit, prune oldest auto/pre_batch snapshots first, preserving manual ones
  if (updated.length > MAX_SNAPSHOTS) {
    const manualSnaps = updated.filter((s) => s.trigger === 'manual');
    const autoSnaps = updated.filter((s) => s.trigger !== 'manual');

    // Keep all manual snapshots up to MAX_SNAPSHOTS, fill remainder with latest autos
    const remainingSlots = Math.max(2, MAX_SNAPSHOTS - manualSnaps.length);
    const trimmedAuto = autoSnaps.slice(0, remainingSlots);

    updated = [...manualSnaps, ...trimmedAuto].sort((a, b) => b.timestamp - a.timestamp);
    // Hard cutoff if manual snaps alone exceed max
    if (updated.length > MAX_SNAPSHOTS) {
      updated = updated.slice(0, MAX_SNAPSHOTS);
    }
  }

  saveStoredSnapshots(updated);
  void persistSnapshotToIDB(snapshot);
  return snapshot;
}

/**
 * Restore data from a specific snapshot ID.
 */
export function restoreSnapshot(
  snapshotId: string
): { tasks: Task[]; projects: Project[] } | null {
  const list = getStoredSnapshots();
  const match = list.find((s) => s.id === snapshotId);
  if (!match) return null;

  return {
    tasks: JSON.parse(JSON.stringify(match.tasks)),
    projects: JSON.parse(JSON.stringify(match.projects)),
  };
}

/**
 * Delete a specific snapshot from local storage and IndexedDB.
 */
export function deleteSnapshot(snapshotId: string): void {
  const current = getStoredSnapshots();
  const filtered = current.filter((s) => s.id !== snapshotId);
  saveStoredSnapshots(filtered);
  void deleteSnapshotFromIDB(snapshotId);
}

/**
 * Check if a daily auto-snapshot should be taken (>20 hours since last auto-snapshot).
 */
export function checkAndTriggerDailyAutoSnapshot(
  tasks: Task[],
  projects: Project[]
): boolean {
  if (tasks.length === 0) return false;

  const current = getStoredSnapshots();
  const lastAuto = current.find((s) => s.trigger === 'auto_daily');

  const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;
  if (!lastAuto || Date.now() - lastAuto.timestamp > TWENTY_HOURS_MS) {
    createLocalSnapshot(tasks, projects, undefined, 'auto_daily');
    return true;
  }

  return false;
}

/**
 * Clear all snapshots from localStorage and IndexedDB.
 */
export function clearAllSnapshots(workspaceId = 'local'): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SNAPSHOTS);
  } catch (err) {
    console.warn('Failed to clear snapshots from localStorage:', err);
  }

  if (typeof indexedDB !== 'undefined') {
    void (async () => {
      try {
        const db = await getDatabase();
        const index = db.transaction('snapshots', 'readwrite').store.index('by_workspace');
        const keys = await index.getAllKeys(workspaceId);
        const tx = db.transaction('snapshots', 'readwrite');
        for (const k of keys) {
          await tx.store.delete(k);
        }
        await tx.done;
      } catch (err) {
        console.warn('Failed to clear snapshots from IndexedDB:', err);
      }
    })();
  }
}
