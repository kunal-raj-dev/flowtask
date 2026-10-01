import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, Project } from '../types/task';

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
   * Upsert a single task in Firestore
   */
  async saveTask(userId: string, task: Task): Promise<void> {
    if (!db) return;
    const taskDoc = doc(db, 'users', userId, 'tasks', task.id);
    const sanitized = sanitizeForFirestore(task);
    await setDoc(taskDoc, sanitized, { merge: true });
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
   * Batch migrate local tasks & projects to Firestore (e.g. on first signup or guest link)
   */
  async batchMigrate(userId: string, tasks: Task[], projects: Project[]): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);

    for (const task of tasks) {
      const taskDoc = doc(db, 'users', userId, 'tasks', task.id);
      batch.set(taskDoc, sanitizeForFirestore(task), { merge: true });
    }

    for (const project of projects) {
      const projDoc = doc(db, 'users', userId, 'projects', project.id);
      batch.set(projDoc, sanitizeForFirestore(project), { merge: true });
    }

    await batch.commit();
  },
};
