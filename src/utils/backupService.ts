import type { Task, Project } from '../types/task';

export interface LocalSnapshot {
  id: string;
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
 * Persist the list of snapshots to localStorage.
 */
function saveStoredSnapshots(snapshots: LocalSnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(snapshots));
  } catch (err) {
    console.error('Failed to save local snapshots to storage:', err);
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
 * Delete a specific snapshot from local storage.
 */
export function deleteSnapshot(snapshotId: string): void {
  const current = getStoredSnapshots();
  const filtered = current.filter((s) => s.id !== snapshotId);
  saveStoredSnapshots(filtered);
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
