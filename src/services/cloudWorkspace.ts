import { SYNC_COLLECTIONS } from './workspaceEntities';
import type { SyncCollection, SyncedEntity } from '../types/workspace';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  deleteField,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CloudAdapter } from './workspaceStore';
import type { Task, Project } from '../types/task';

const OPTIONAL_TASK_FIELDS: (keyof Task)[] = [
  'plannedDate',
  'dueDate',
  'dueTime',
  'topThreeDate',
  'description',
  'recurrence',
  'customRecurrence',
  'scheduledStart',
  'scheduledEnd',
  'timezone',
  'sessionMetadata',
  'completedAt',
  'archivedAt',
  'deletedAt',
  'isSomeday',
  'isPinnedToday',
  'isEvening',
  'recurrenceSourceId',
  'tags',
  'contextTags',
  'blockedBy',
  'estimatedMinutes',
  'timeSpentMinutes',
  'scheduleLocked',
  'nextAction',
  'milestoneId',
];

/**
 * Removes undefined fields from an object so Firestore doesn't reject writes
 */
export function sanitizeForFirestore<T>(data: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!data || typeof data !== 'object') return result;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' ? sanitizeForFirestore(item) : item
      );
    } else if (value !== null && typeof value === 'object') {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Prepares task for Firestore merge write by assigning deleteField() to cleared optional fields.
 */
export function prepareTaskForFirestore(task: Task): Record<string, unknown> {
  const sanitized = sanitizeForFirestore(task);

  for (const field of OPTIONAL_TASK_FIELDS) {
    const val = (task as unknown as Record<string, unknown>)[field];
    if (val === undefined || val === null || val === '') {
      sanitized[field] = deleteField();
    }
  }

  return sanitized;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 7-day TTL cleanup for historical Firestore operation idempotency receipts.
 */
export async function cleanupExpiredOperationReceipts(uid: string): Promise<number> {
  if (!db) return 0;
  try {
    const opsCol = collection(db, 'users', uid, 'operations');
    const snap = await getDocs(opsCol);
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const expiredDocs = snap.docs.filter((docSnap) => {
      const data = docSnap.data();
      return typeof data.createdAt === 'number' && data.createdAt < cutoff;
    });

    if (expiredDocs.length === 0) return 0;

    for (let i = 0; i < expiredDocs.length; i += 400) {
      const batch = writeBatch(db);
      expiredDocs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    return expiredDocs.length;
  } catch (err) {
    console.warn('Failed to clean up expired operation receipts:', err);
    return 0;
  }
}

export function createCloudAdapter(uid: string): CloudAdapter {
  if (!db) throw new Error('Cloud connection is unavailable.');
  const database = db;
  return {
    async read() {
      // Background 7-day TTL cleanup of expired idempotency receipts
      void cleanupExpiredOperationReceipts(uid);

      const snapshots = await Promise.all(SYNC_COLLECTIONS.map(name => getDocs(collection(database, 'users', uid, name))));
      const [tasks, projects, dashboards, focusLogs, recipes, preferences] = snapshots;
      return {
        tasks: tasks.docs.map((d) => ({ ...d.data(), id: d.id })) as Task[],
        projects: projects.docs.map((d) => ({ ...d.data(), id: d.id })) as Project[],
        dashboards: dashboards.docs.map((d) => ({ ...d.data(), id: d.id })) as SyncedEntity[],
        focusLogs: focusLogs.docs.map(d => ({ ...d.data(), id: d.id })) as SyncedEntity[],
        recipes: recipes.docs.map(d => ({ ...d.data(), id: d.id })) as SyncedEntity[],
        preferences: preferences.docs.map(d => ({ ...d.data(), id: d.id })) as SyncedEntity[],
      };
    },
    async apply(operation) {
      await runTransaction(database, async (transaction) => {
        const receipt = doc(database, 'users', uid, 'operations', operation.id);
        if ((await transaction.get(receipt)).exists()) return;
        const refs = operation.changes.map((c) =>
          doc(database, 'users', uid, c.collection, c.id)
        );
        const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
        operation.changes.forEach((change, i) => {
          const remote = snapshots[i];
          const expected = change.before?.revision || 0;
          if (
            (remote.data()?.revision || 0) !== expected ||
            (remote.exists() && !change.before) ||
            (!remote.exists() && expected > 0)
          ) {
            const error = new Error('This record changed on another device.');
            error.name = 'SyncConflict';
            throw error;
          }
        });
        operation.changes.forEach((change, i) => {
          if (change.after) {
            let payload: Record<string, unknown>;
            if (change.collection === 'tasks') {
              const task = change.after as Task;
              payload = sanitizeForFirestore({
                ...task,
                subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
                status: ['todo', 'in_progress', 'done'].includes(task.status) ? task.status : 'todo',
                priority: ['p1', 'p2', 'p3', 'p4'].includes(task.priority) ? task.priority : 'p2',
                projectId: typeof task.projectId === 'string' && task.projectId ? task.projectId : 'inbox',
                revision: typeof task.revision === 'number' && task.revision >= 1 ? task.revision : 1,
                updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : Date.now(),
              });
            } else {
              payload = sanitizeForFirestore(change.after);
            }
            transaction.set(refs[i], payload);
          } else {
            transaction.delete(refs[i]);
          }
        });
        transaction.set(receipt, {
          createdAt: operation.createdAt,
          description: operation.description,
        });
      });
    },
  };
}

export function watchCloud(
  uid: string,
  receive: (kind: SyncCollection, values: SyncedEntity[]) => void,
  onError: (error: Error) => void
) {
  if (!db) throw new Error('Cloud connection is unavailable.');
  const stops = SYNC_COLLECTIONS.map((kind) =>
    onSnapshot(
      collection(db!, 'users', uid, kind),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        receive(
          kind,
          snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as SyncedEntity[]
        );
      },
      onError
    )
  );
  return () => stops.forEach((stop) => stop());
}
