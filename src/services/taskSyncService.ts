import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  writeBatch,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  'tags',
  'contextTags',
  'blockedBy',
  'estimatedMinutes',
  'timeSpentMinutes',
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

export const taskSyncService = {
  /**
   * Subscribe to real-time task updates for a user
   */
  subscribeToTasks(
    userId: string,
    onUpdate: (tasks: Task[], hasPendingWrites: boolean) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!db) {
      return () => {};
    }

    const tasksCol = collection(db, 'users', userId, 'tasks');
    return onSnapshot(
      tasksCol,
      { includeMetadataChanges: true },
      (snapshot) => {
        const tasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          tasks.push(docSnap.data() as Task);
        });
        // Sort tasks descending by createdAt
        tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onUpdate(tasks, snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        console.error('Firestore tasks subscription error:', error);
        if (onError) onError(error);
      }
    );
  },

  /**
   * Subscribe to real-time project updates for a user
   */
  subscribeToProjects(
    userId: string,
    onUpdate: (projects: Project[], hasPendingWrites: boolean) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!db) {
      return () => {};
    }

    const projectsCol = collection(db, 'users', userId, 'projects');
    return onSnapshot(
      projectsCol,
      { includeMetadataChanges: true },
      (snapshot) => {
        const projects: Project[] = [];
        snapshot.forEach((docSnap) => {
          projects.push(docSnap.data() as Project);
        });
        onUpdate(projects, snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        console.error('Firestore projects subscription error:', error);
        if (onError) onError(error);
      }
    );
  },

  /**
   * Upsert a single task in Firestore with deleteField() for cleared attributes
   */
  async saveTask(userId: string, task: Task): Promise<void> {
    if (!db) return;
    const taskDoc = doc(db, 'users', userId, 'tasks', task.id);
    const payload = prepareTaskForFirestore(task);
    await setDoc(taskDoc, payload, { merge: true });
  },

  /**
   * Delete a task from Firestore
   */
  async deleteTask(userId: string, taskId: string): Promise<void> {
    if (!db) return;
    const taskDoc = doc(db, 'users', userId, 'tasks', taskId);
    await deleteDoc(taskDoc);
  },

  /**
   * Bulk delete tasks from Firestore
   */
  async batchDeleteTasks(userId: string, taskIds: string[]): Promise<void> {
    if (!db || taskIds.length === 0) return;
    const batch = writeBatch(db);
    for (const id of taskIds) {
      const taskDoc = doc(db, 'users', userId, 'tasks', id);
      batch.delete(taskDoc);
    }
    await batch.commit();
  },

  /**
   * Upsert a project in Firestore
   */
  async saveProject(userId: string, project: Project): Promise<void> {
    if (!db) return;
    const projDoc = doc(db, 'users', userId, 'projects', project.id);
    const sanitized = sanitizeForFirestore(project);
    await setDoc(projDoc, sanitized, { merge: true });
  },

  /**
   * Delete a project from Firestore
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    if (!db) return;
    const projDoc = doc(db, 'users', userId, 'projects', projectId);
    await deleteDoc(projDoc);
  },

  /**
   * Check if remote user collection has data
   */
  async checkHasRemoteData(userId: string): Promise<boolean> {
    if (!db) return false;
    const tasksCol = collection(db, 'users', userId, 'tasks');
    const snap = await getDocs(tasksCol);
    return !snap.empty;
  },

  /**
   * Batch migrate local tasks & projects to Firestore
   */
  async batchMigrate(userId: string, tasks: Task[], projects: Project[]): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);

    for (const task of tasks) {
      const taskDoc = doc(db, 'users', userId, 'tasks', task.id);
      batch.set(taskDoc, prepareTaskForFirestore(task), { merge: true });
    }

    for (const project of projects) {
      const projDoc = doc(db, 'users', userId, 'projects', project.id);
      batch.set(projDoc, sanitizeForFirestore(project), { merge: true });
    }

    await batch.commit();
  },

  /**
   * Replace all remote tasks & projects with replacement array, deleting remote records not present.
   */
  async batchReplace(userId: string, tasks: Task[], projects: Project[]): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);

    // Fetch existing docs to find any that should be deleted
    const tasksCol = collection(db, 'users', userId, 'tasks');
    const existingTasksSnap = await getDocs(tasksCol);
    const newTaskIds = new Set(tasks.map((t) => t.id));

    existingTasksSnap.forEach((docSnap) => {
      if (!newTaskIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    for (const task of tasks) {
      const taskDoc = doc(db, 'users', userId, 'tasks', task.id);
      batch.set(taskDoc, prepareTaskForFirestore(task), { merge: true });
    }

    for (const project of projects) {
      const projDoc = doc(db, 'users', userId, 'projects', project.id);
      batch.set(projDoc, sanitizeForFirestore(project), { merge: true });
    }

    await batch.commit();
  },
};

