import { collection, doc, getDocs, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sanitizeForFirestore } from './taskSyncService';
import type { CloudAdapter } from './workspaceStore';
import type { Task, Project } from '../types/task';

export function createCloudAdapter(uid: string): CloudAdapter {
  if (!db) throw new Error('Cloud connection is unavailable.');
  const database = db;
  return {
    async read() {
      const [tasks, projects] = await Promise.all(['tasks', 'projects'].map(name => getDocs(collection(database, 'users', uid, name))));
      return { tasks: tasks.docs.map(d => ({ ...d.data(), id: d.id })) as Task[], projects: projects.docs.map(d => ({ ...d.data(), id: d.id })) as Project[] };
    },
    async apply(operation) {
      await runTransaction(database, async transaction => {
        const receipt = doc(database, 'users', uid, 'operations', operation.id);
        if ((await transaction.get(receipt)).exists()) return;
        const refs = operation.changes.map(c => doc(database, 'users', uid, c.collection, c.id));
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        operation.changes.forEach((change, i) => {
          const remote = snapshots[i];
          const expected = change.before?.revision || 0;
          if ((remote.data()?.revision || 0) !== expected || (remote.exists() && !change.before) || (!remote.exists() && expected > 0)) {
            const error = new Error('This record changed on another device.');
            error.name = 'SyncConflict';
            throw error;
          }
        });
        operation.changes.forEach((change, i) => {
          if (change.after) transaction.set(refs[i], sanitizeForFirestore(change.after));
          else transaction.delete(refs[i]);
        });
        transaction.set(receipt, { createdAt: operation.createdAt, description: operation.description });
      });
    },
  };
}

export function watchCloud(uid: string, receive: (kind: 'tasks' | 'projects', values: Task[] | Project[]) => void, onError: (error: Error) => void) {
  if (!db) throw new Error('Cloud connection is unavailable.');
  const stops = (['tasks', 'projects'] as const).map(kind => onSnapshot(collection(db!, 'users', uid, kind), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    receive(kind, snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Task[] | Project[]);
  }, onError));
  return () => stops.forEach(stop => stop());
}
