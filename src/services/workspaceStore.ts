import type { Task, Project } from '../types/task';
import type { WorkspaceRecord, EntityChange, PendingOperation } from '../types/workspace';
import { dbService, emptyWorkspace } from './dbService';

export interface StoreSnapshot {
  record: WorkspaceRecord;
  ready: boolean;
  saving: boolean;
  error: string | null;
  sync: 'local' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';
}
export interface CloudAdapter {
  apply: (operation: PendingOperation) => Promise<void>;
  read: () => Promise<{ tasks: Task[]; projects: Project[] }>;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const semantic = (value: Task | Project | null) => { if (!value) return null; const { revision: _revision, updatedAt: _updatedAt, ...rest } = value; return rest; };
const uid = () => crypto.randomUUID();
export function changesBetween(before: WorkspaceRecord, after: WorkspaceRecord): EntityChange[] {
  const changes: EntityChange[] = [];
  for (const collection of ['tasks', 'projects'] as const) {
    const old = new Map<string, Task | Project>(before[collection].map(x => [x.id, x]));
    const next = new Map<string, Task | Project>(after[collection].map(x => [x.id, x]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      if (!same(old.get(id), next.get(id))) changes.push({ collection, id, before: old.get(id) || null, after: next.get(id) || null });
    }
  }
  return changes;
}
export function applyChanges(record: WorkspaceRecord, changes: EntityChange[]): WorkspaceRecord {
  const result = { ...record };
  for (const collection of ['tasks', 'projects'] as const) {
    const map = new Map<string, Task | Project>(record[collection].map(x => [x.id, x]));
    for (const change of changes.filter(c => c.collection === collection)) {
      if (change.after) map.set(change.id, change.after); else map.delete(change.id);
    }
    if (collection === 'tasks') result.tasks = [...map.values()] as Task[];
    else result.projects = [...map.values()] as Project[];
  }
  return result;
}

/** Synchronous command ordering; serialized durable commits; no effects in React updaters. */
export class WorkspaceStore {
  private snapshot: StoreSnapshot;
  private listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();
  private loadPromise?: Promise<void>;
  private adapter?: CloudAdapter;
  private flushing = false;
  private writes = 0;
  private disposed = false;
  private generation = 0;
  readonly id: string;
  readonly connected: boolean;
  private persistence: typeof dbService;
  constructor(id: string, connected = false, persistence = dbService) {
    this.id = id; this.connected = connected; this.persistence = persistence;
    this.snapshot = { record: emptyWorkspace(id), ready: false, saving: false, error: null, sync: connected ? 'syncing' : 'local' };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  private publish(patch: Partial<StoreSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(fn => fn()); }
  load() {
    if (!this.loadPromise) this.loadPromise = this.persistence.ensureLegacyMigrated(this.id).then(record => {
      this.publish({ record, ready: true, error: null });
    }).catch(error => { this.loadPromise = undefined; this.publish({ error: `Could not open this workspace: ${String(error.message || error)}`, sync: 'error' }); });
    return this.loadPromise;
  }
  private persist() {
    const record = structuredClone(this.snapshot.record);
    this.writes++;
    this.publish({ saving: true });
    const job = this.tail.then(() => this.persistence.saveWorkspace(this.id, record));
    this.tail = job.catch(error => {
      this.publish({ error: `Changes are not saved: ${String(error.message || error)}. Keep this tab open and retry or download a backup.`, sync: 'error' });
    }).finally(() => { this.writes--; this.publish({ saving: this.writes > 0 }); });
    return job;
  }
  async settled() { await this.tail; if (this.snapshot.error) throw new Error(this.snapshot.error); }
  run(description: string, transform: (record: WorkspaceRecord) => WorkspaceRecord, remember = true) {
    if (!this.snapshot.ready) throw new Error('Wait for the workspace to finish loading.');
    const before = this.snapshot.record;
    let after = transform(before);
    const changes = changesBetween(before, after).map(change => ({ ...change,
      after: change.after ? { ...change.after, revision: ((change.before as Task | null)?.revision || 0) + 1, updatedAt: Date.now() } : null,
    }));
    if (this.connected && changes.length > 400) throw new Error('This operation changes more than 400 records. Apply smaller batches, or restore this backup in a local workspace.');
    if (!changes.length && same(before.preferences, after.preferences) && same(before.customViews, after.customViews)) return;
    after = applyChanges(after, changes);
    const operation: PendingOperation = { id: uid(), description, changes, createdAt: Date.now() };
    after = { ...after, updatedAt: Date.now(),
      pending: this.connected && changes.length ? [...before.pending, operation] : before.pending,
      undo: remember && changes.length ? [...before.undo.slice(-19), operation] : after.undo,
    };
    this.publish({ record: after, sync: this.connected && changes.length ? 'syncing' : this.snapshot.sync });
    void this.persist().then(() => this.flush()).catch(() => {});
  }
  undo() {
    const operation = this.snapshot.record.undo.at(-1);
    if (!operation) return;
    const record = this.snapshot.record;
    for (const change of operation.changes) {
      const current = record[change.collection].find(x => x.id === change.id) || null;
      if (!same(semantic(current), semantic(change.after))) throw new Error('This task changed after that action. Review its current details before undoing.');
    }
    this.run(`Undo: ${operation.description}`, current => ({ ...applyChanges(current, operation.changes.map(c => ({ ...c, before: c.after, after: c.before }))), undo: current.undo.slice(0, -1) }), false);
  }
  connect(adapter: CloudAdapter) { this.adapter = adapter; this.disposed = false; void this.flush(); }
  disconnect() { this.disposed = true; this.generation++; this.adapter = undefined; }
  async retry() {
    this.publish({ error: null, sync: this.connected ? 'syncing' : 'local' });
    await this.persist();
    await this.flush();
  }
  async flush() {
    if (!this.adapter || this.flushing || this.disposed || !this.snapshot.ready || this.snapshot.error || this.snapshot.sync === 'conflict') return;
    this.flushing = true;
    const adapter = this.adapter;
    const generation = this.generation;
    try {
      await this.tail;
      if (this.snapshot.error) return;
      while (this.snapshot.record.pending.length && !this.disposed && generation === this.generation) {
        const operation = this.snapshot.record.pending[0];
        await adapter.apply(operation);
        if (this.disposed || generation !== this.generation) return;
        this.publish({ record: { ...this.snapshot.record, pending: this.snapshot.record.pending.filter(x => x.id !== operation.id) } });
        await this.persist();
      }
      if (!this.disposed && generation === this.generation) this.publish({ sync: 'synced', error: null });
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        const conflict = error instanceof Error && error.name === 'SyncConflict';
        this.publish({ sync: conflict ? 'conflict' : 'offline', error: conflict ? 'An account record changed on another device. Your local changes are preserved. Review the conflict in Account & sync.' : null });
      }
    } finally { this.flushing = false; }
  }
  receive(collection: 'tasks' | 'projects', remote: Task[] | Project[]) {
    if (!this.snapshot.ready || this.disposed) return;
    let record = { ...this.snapshot.record, [collection]: collection === 'projects' && remote.length === 0 ? emptyWorkspace(this.id).projects : remote } as WorkspaceRecord;
    record = applyChanges(record, record.pending.flatMap(op => op.changes.filter(c => c.collection === collection)));
    this.publish({ record });
    void this.persist().catch(() => {});
  }
  async resolveConflict(choice: 'local' | 'remote') {
    if (!this.adapter) return;
    const remote = await this.adapter.read();
    // Preserve both versions before a deliberate conflict choice.
    localStorage.setItem(`flowtask_conflict_backup_${this.id}`, JSON.stringify({ local: this.snapshot.record, remote, savedAt: Date.now() }));
    const original = this.snapshot.record;
    const base = { ...original, ...remote, pending: [], undo: [] };
    this.publish({ record: base, error: null, sync: 'syncing' });
    if (choice === 'local') this.run('Resolve conflict with device changes', record => applyChanges(record, original.pending.flatMap(op => op.changes)));
    else await this.persist();
    await this.flush();
  }
}
