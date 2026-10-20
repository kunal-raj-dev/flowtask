import { createContext, useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import { SYNC_COLLECTIONS, workspaceEntities, replaceEntities, applyEntityChanges } from './workspaceEntities';
import type { Task, Project } from '../types/task';
import type { WorkspaceRecord, EntityChange, PendingOperation, SyncCollection, SyncedEntity } from '../types/workspace';
import { dbService, emptyWorkspace } from './dbService';
import { readFocusCheckpoint } from './focusCheckpoint';
import type { WorkspaceDashboard } from '../types/dashboard';

export interface StoreSnapshot {
  record: WorkspaceRecord;
  ready: boolean;
  saving: boolean;
  error: string | null;
  sync: 'local' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';
}
export interface CloudAdapter {
  apply: (operation: PendingOperation) => Promise<void>;
  read: () => Promise<{ tasks: Task[]; projects: Project[]; dashboards?: SyncedEntity[]; focusLogs?: SyncedEntity[]; recipes?: SyncedEntity[]; preferences?: SyncedEntity[] }>;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const semantic = (value: SyncedEntity | null) => { if (!value) return null; const { revision: _revision, updatedAt: _updatedAt, ...rest } = value; return rest; };
const uid = () => crypto.randomUUID();
export function changesBetween(before: WorkspaceRecord, after: WorkspaceRecord): EntityChange[] {
  const changes: EntityChange[] = [];
  for (const collection of SYNC_COLLECTIONS) {
    const old = new Map(workspaceEntities(before, collection).map(x => [x.id, x]));
    const next = new Map(workspaceEntities(after, collection).map(x => [x.id, x]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      if (!same(old.get(id), next.get(id))) changes.push({ collection, id, before: old.get(id) || null, after: next.get(id) || null });
    }
  }
  return changes;
}
export function applyChanges(record: WorkspaceRecord, changes: EntityChange[]): WorkspaceRecord {
  return applyEntityChanges(record, changes);
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
  private redoStack: PendingOperation[] = [];
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
      const checkpoint=readFocusCheckpoint(this.id);
      if(checkpoint && checkpoint.at > Number(record.preferences.focusCheckpointAt || 0)) {
        const logged=checkpoint.session && ((record.preferences.focusLogs || []) as {id:string}[]).some(log=>log.id===checkpoint.session!.id);
        this.run('Recover focus lifecycle checkpoint',r=>({...r,preferences:{...r.preferences,focusCheckpointAt:checkpoint.at,
          focusSession: logged ? null : checkpoint.finished && checkpoint.session ? {...checkpoint.session,recoverCompletion:true} : checkpoint.session}}),false);
      }
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
    if (!changes.length && same(before.preferences, after.preferences) && same(before.customViews, after.customViews)) return;
    after = applyChanges(after, changes);
    const operation: PendingOperation = { id: uid(), description, changes, createdAt: Date.now() };
    // Keep one local undo action, while each cloud transaction stays below its write limit.
    const deliveries = changes.length > 400
      ? Array.from({ length: Math.ceil(changes.length / 400) }, (_, index) => ({ ...operation, id: `${operation.id}-${index}`, changes: changes.slice(index * 400, (index + 1) * 400) }))
      : [operation];
    if (remember && changes.length) {
      this.redoStack = [];
    }
    after = { ...after, updatedAt: Date.now(),
      pending: this.connected && changes.length ? [...before.pending, ...deliveries] : before.pending,
      undo: remember && changes.length ? [...before.undo.slice(-19), operation] : after.undo,
    };
    this.publish({ record: after, sync: this.connected && changes.length ? 'syncing' : this.snapshot.sync });
    void this.persist().then(() => this.flush()).catch(() => {});
  }
  canUndo() { return (this.snapshot.record.undo?.length || 0) > 0; }
  canRedo() { return this.redoStack.length > 0; }
  undo() {
    const operation = this.snapshot.record.undo.at(-1);
    if (!operation) return;
    const record = this.snapshot.record;
    for (const change of operation.changes) {
      const current = workspaceEntities(record, change.collection).find(x => x.id === change.id) || null;
      if (!same(semantic(current), semantic(change.after))) throw new Error('This task changed after that action. Review its current details before undoing.');
    }
    this.redoStack.push(operation);
    this.run(`Undo: ${operation.description}`, current => ({ ...applyChanges(current, operation.changes.map(c => ({ ...c, before: c.after, after: c.before }))), undo: current.undo.slice(0, -1) }), false);
  }
  redo() {
    const operation = this.redoStack.at(-1);
    if (!operation) return;
    const record = this.snapshot.record;
    for (const change of operation.changes) {
      const current = workspaceEntities(record, change.collection).find(x => x.id === change.id) || null;
      if (!same(semantic(current), semantic(change.before))) throw new Error('This task changed after that action. Review its current details before redoing.');
    }
    this.redoStack.pop();
    this.run(`Redo: ${operation.description}`, current => ({ ...applyChanges(current, operation.changes), undo: [...current.undo.slice(-19), operation] }), false);
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
        console.error('[FlowTask Cloud Sync]:', error);
        const conflict = error instanceof Error && error.name === 'SyncConflict';
        const errDetail = error instanceof Error ? error.message : String(error);
        this.publish({
          sync: conflict ? 'conflict' : 'offline',
          error: conflict
            ? 'An account record changed on another device. Your local changes are preserved. Review the conflict in Account & sync.'
            : `Cloud sync paused: ${errDetail}. Changes are saved on this device and queued for retry.`,
        });
      }
    } finally { this.flushing = false; }
  }
  receive(collection: SyncCollection, remote: SyncedEntity[]) {
    if (!this.snapshot.ready || this.disposed) return;
    const before = this.snapshot.record;
    if (collection === 'dashboards' && !before.preferences._v5DashboardSeeded) {
      const local = before.dashboards || [];
      this.publish({ record: { ...before, dashboards: [], preferences: { ...before.preferences, _v5DashboardSeeded: true, _v5DashboardSeedNeeded: false } } });
      if (!remote.length && local.length) {
        this.run('Sync existing workspace dashboards', current => applyChanges(current, local.map(value => ({ collection: 'dashboards', id: value.id, before: null, after: { ...value, revision: 0 } }))), false);
        return;
      }
    }
    const current = this.snapshot.record;
    let record: WorkspaceRecord;
    try { record = replaceEntities(current, collection, collection === 'projects' && remote.length === 0 ? emptyWorkspace(this.id).projects : remote); }
    catch { this.publish({ record: before, error: 'A cloud dashboard could not be opened. Your local layout is preserved. Export a backup before resolving sync.', sync: 'conflict' }); return; }
    record = applyChanges(record, record.pending.flatMap(op => op.changes.filter(c => c.collection === collection)));
    const seeded = (before.preferences._v4CloudSeeded || []) as string[];
    if (before.preferences._v4CloudSeedNeeded && !['tasks', 'projects', 'dashboards'].includes(collection) && !seeded.includes(collection)) {
      const localOnly = workspaceEntities(before, collection).filter(entity => !remote.some(value => value.id === entity.id));
      record = { ...record, preferences: { ...record.preferences, _v4CloudSeeded: [...seeded, collection] } };
      this.publish({ record });
      if (localOnly.length) this.run('Migrate existing focus history and settings', current => applyChanges(current, localOnly.map(value => ({ collection, id: value.id, before: null, after: { ...value, revision: 0 } }))), false);
      else void this.persist().catch(() => {});
      return;
    }
    this.publish({ record });
    void this.persist().catch(() => {});
  }
  async resolveConflict(choice: 'local' | 'remote') {
    if (!this.adapter) return;
    const remote = await this.adapter.read();
    // Preserve both versions before a deliberate conflict choice.
    localStorage.setItem(`flowtask_conflict_backup_${this.id}`, JSON.stringify({ local: this.snapshot.record, remote, savedAt: Date.now() }));
    const original = this.snapshot.record;
    let base = { ...original, tasks: remote.tasks, projects: remote.projects, pending: [], undo: [] } as WorkspaceRecord;
    for (const key of ['dashboards', 'focusLogs', 'recipes', 'preferences'] as const) if (remote[key]) base = replaceEntities(base, key, remote[key]);
    const dashboardChanges = new Map(original.pending.flatMap(op => op.changes).filter(c => c.collection === 'dashboards').map(c => [c.id, c]));
    const copies: WorkspaceDashboard[] = [];
    for (const change of dashboardChanges.values()) {
      const remoteDashboard = base.dashboards.find(d => d.id === change.id);
      if (!change.after || !remoteDashboard || same(semantic(change.after), semantic(remoteDashboard))) continue;
      const preserved = (choice === 'local' ? remoteDashboard : change.after) as WorkspaceDashboard;
      copies.push({ ...structuredClone(preserved), id: uid(), name: `${preserved.name.slice(0, 80)} (Recovered)`, isDefault: false, order: base.dashboards.length + copies.length, revision: 0, createdAt: Date.now(), updatedAt: Date.now() });
    }
    if (base.dashboards.length + copies.length > 20) throw new Error('Both dashboard versions are backed up. Free a dashboard slot before resolving this conflict.');
    this.publish({ record: base, error: null, sync: 'syncing' });
    if (choice === 'local' || copies.length) this.run('Resolve conflict and preserve dashboard versions', record => {
      const next = choice === 'local' ? applyChanges(record, original.pending.flatMap(op => op.changes)) : record;
      return { ...next, dashboards: [...next.dashboards, ...copies] };
    });
    else await this.persist();
    await this.flush();
  }
}

export const WorkspaceStoreContext = createContext<WorkspaceStore | null>(null);

export function useWorkspaceSelector<T>(
  selector: (snapshot: StoreSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T | undefined {
  const store = useContext(WorkspaceStoreContext);
  const lastSelectedRef = useRef<{ hasValue: boolean; value: T | undefined }>({ hasValue: false, value: undefined });

  const getSelection = useCallback(() => {
    if (!store) return undefined as unknown as T;
    const next = selector(store.getSnapshot());
    if (lastSelectedRef.current.hasValue && isEqual(lastSelectedRef.current.value as T, next)) {
      return lastSelectedRef.current.value as T;
    }
    lastSelectedRef.current = { hasValue: true, value: next };
    return next;
  }, [store, selector, isEqual]);

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!store) return () => {};
      return store.subscribe(notify);
    },
    [store]
  );

  return useSyncExternalStore(subscribe, getSelection, getSelection);
}

export function useWorkspaceTasks(): Task[] {
  const store = useContext(WorkspaceStoreContext);
  const tasks = useWorkspaceSelector(useCallback((s) => s.record.tasks, []));
  return store ? (tasks || []) : [];
}

export function useWorkspaceProjects(): Project[] {
  const store = useContext(WorkspaceStoreContext);
  const projects = useWorkspaceSelector(useCallback((s) => s.record.projects, []));
  return store ? (projects || []) : [];
}

export function useActiveTask(taskId: string | null): Task | null {
  const store = useContext(WorkspaceStoreContext);
  const activeTask = useWorkspaceSelector(useCallback((s) => (taskId ? s.record.tasks.find((t) => t.id === taskId) || null : null), [taskId]));
  return store ? (activeTask || null) : null;
}

