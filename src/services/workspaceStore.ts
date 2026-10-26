import { createContext, useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import { SYNC_COLLECTIONS, workspaceEntities, replaceEntities, applyEntityChanges } from './workspaceEntities';
import type { Task, Project } from '../types/task';
import type { WorkspaceRecord, EntityChange, PendingOperation, SyncCollection, SyncedEntity } from '../types/workspace';
import { dbService, emptyWorkspace } from './dbService';
import { readFocusCheckpoint } from './focusCheckpoint';
import type { WorkspaceDashboard } from '../types/dashboard';
import { validateWorkspaceData, validateAreas, validateGoals, validateRoutines, validateRoutineRuns, validateWorkBlocks, validateReviews } from '../utils/workspaceValidation';
import { recoveryService } from './recoveryService';
import { formatLocalDate } from '../utils/nlpParser';
import { validateBackupExtras } from '../utils/workspaceBackup';
import { DEFAULT_PROJECTS } from '../utils/storage';
import type { Note } from '../types/note';
import { validateNotes, recoveredNote } from '../utils/noteModel';

// Older accounts may reference built-in projects without having stored a
// project document. Keep Inbox available and recover only referenced built-ins;
// missing custom projects still fail graph validation and wait for cloud data.
function completeBuiltinProjects(projects: Project[], tasks: Task[]) {
  const existing = new Set(projects.map(project => project.id));
  const needed = new Set(['inbox', ...tasks.map(task => task.projectId)]);
  const missing = DEFAULT_PROJECTS.filter(project => project.id !== 'ideas' && needed.has(project.id) && !existing.has(project.id));
  return missing.length ? [...projects, ...missing.map(project => ({ ...project }))] : projects;
}

export interface StoreSnapshot {
  record: WorkspaceRecord;
  ready: boolean;
  saving: boolean;
  error: string | null;
  sync: 'local' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';
  readOnly?: boolean;
  lastSavedAt?: number;
  lastSyncedAt?: number;
  nextRetryAt?: number;
  recoveryError?: string | null;
}
export interface MutationReceipt { operationId: string; persisted: Promise<void> }
export interface CloudAdapter {
  apply: (operation: PendingOperation) => Promise<void>;
  read: () => Promise<{ tasks: Task[]; projects: Project[]; dashboards?: SyncedEntity[]; focusLogs?: SyncedEntity[]; recipes?: SyncedEntity[]; preferences?: SyncedEntity[]; notes?: SyncedEntity[]; areas?: SyncedEntity[]; goals?: SyncedEntity[]; routines?: SyncedEntity[]; routineRuns?: SyncedEntity[]; workBlocks?: SyncedEntity[]; reviews?: SyncedEntity[] }>;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const semantic = (value: SyncedEntity | null) => { if (!value) return null; const { revision: _revision, updatedAt: _updatedAt, ...rest } = value; return rest; };
const uid = () => crypto.randomUUID();
export function changesBetween(before: WorkspaceRecord, after: WorkspaceRecord): EntityChange[] {
  const changes: EntityChange[] = [];
  for (const collection of SYNC_COLLECTIONS) {
    if ((collection === 'tasks' || collection === 'projects' || collection === 'dashboards' || collection === 'notes' || collection === 'areas' || collection === 'goals' || collection === 'routines' || collection === 'routineRuns' || collection === 'workBlocks' || collection === 'reviews') && before[collection] === after[collection]) continue;
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
  private retryTimer?: ReturnType<typeof setTimeout>;
  private checkpointDay = '';
  private remoteGraph = new Map<SyncCollection, SyncedEntity[]>();
  private durableVersion = 0;
  private blockedCheckpoint?: WorkspaceRecord;
  readonly id: string;
  readonly connected: boolean;
  private persistence: typeof dbService;
  constructor(id: string, connected = false, persistence = dbService) {
    this.id = id; this.connected = connected; this.persistence = persistence;
    this.snapshot = { record: emptyWorkspace(id), ready: false, saving: false, error: null, sync: connected ? 'syncing' : 'local' };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  setReadOnly(readOnly: boolean) { this.publish({ readOnly }); }
  follow(record: WorkspaceRecord) {
    if (!this.snapshot.readOnly || record.workspaceId !== this.id) return;
    validateWorkspaceData(record.tasks, record.projects);
    validateNotes(record.notes);
    this.publish({ record, ready: true, saving: false, error: null });
  }
  async reload() { this.loadPromise = undefined; await this.load(); }
  private publish(patch: Partial<StoreSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(fn => fn()); }
  load() {
    if (!this.loadPromise) this.loadPromise = (this.snapshot.readOnly ? this.persistence.loadWorkspace(this.id).then(record => record || emptyWorkspace(this.id)) : this.persistence.ensureLegacyMigrated(this.id)).then(record => {
      this.durableVersion = record.writeVersion || 0;
      this.publish({ record, ready: true, error: null });
      const checkpoint=readFocusCheckpoint(this.id);
      if(!this.snapshot.readOnly && checkpoint && checkpoint.at > Number(record.preferences.focusCheckpointAt || 0)) {
        const logged=checkpoint.session && ((record.preferences.focusLogs || []) as {id:string}[]).some(log=>log.id===checkpoint.session!.id);
        this.run('Recover focus lifecycle checkpoint',r=>({...r,preferences:{...r.preferences,focusCheckpointAt:checkpoint.at,
          focusSession: logged ? null : checkpoint.finished && checkpoint.session ? {...checkpoint.session,recoverCompletion:true} : checkpoint.session}}),false);
      }
    }).catch(error => { this.loadPromise = undefined; this.publish({ error: `Could not open this workspace: ${String(error.message || error)}`, sync: 'error' }); });
    return this.loadPromise;
  }
  private persist(checkpoint?: WorkspaceRecord) {
    const record = structuredClone(this.snapshot.record);
    this.writes++;
    this.publish({ saving: true });
    const job = this.tail.then(async () => {
      if (this.persistence === dbService && typeof indexedDB !== 'undefined' && (checkpoint || this.blockedCheckpoint)) {
        this.blockedCheckpoint ??= checkpoint;
        await recoveryService.create(this.id, this.blockedCheckpoint!, 'pre_batch', 'Before destructive changes');
        this.blockedCheckpoint = undefined;
      }
      await this.persistence.saveWorkspace(this.id, { ...record, writeVersion: this.durableVersion + 1 }, this.durableVersion);
      this.durableVersion++;
      this.publish({ lastSavedAt: Date.now() });
      const day = formatLocalDate(new Date());
      if (this.persistence === dbService && typeof indexedDB !== 'undefined' && (record.tasks.length || record.notes?.length) && record.updatedAt && this.checkpointDay !== day) {
        try {
          await recoveryService.create(this.id, record, 'auto_daily');
          this.checkpointDay = day;
          this.publish({ recoveryError: null });
        } catch { this.publish({ recoveryError: 'Your work is saved, but the recovery checkpoint could not be written. Download a backup and check device storage.' }); }
      }
    });
    this.tail = job.catch(error => {
      this.publish({ error: `Changes are not saved: ${String(error.message || error)}. Keep this tab open and retry or download a backup.`, sync: 'error' });
    }).finally(() => { this.writes--; this.publish({ saving: this.writes > 0 }); });
    return job;
  }
  async settled() { await this.tail; if (this.snapshot.error) throw new Error(this.snapshot.error); }
  run(description: string, transform: (record: WorkspaceRecord) => WorkspaceRecord, remember = true, options: { checkpoint?: boolean } = {}): MutationReceipt | undefined {
    if (!this.snapshot.ready) throw new Error('Wait for the workspace to finish loading.');
    if (this.snapshot.readOnly) throw new Error('This tab is a read-only preview. Choose Use this tab to make changes.');
    const before = this.snapshot.record;
    let after = transform(before);
    if (before.notes !== after.notes) validateNotes(after.notes);
    if (before.areas !== after.areas && after.areas) validateAreas(after.areas);
    if (before.goals !== after.goals && after.goals) validateGoals(after.goals);
    if (before.routines !== after.routines && after.routines) validateRoutines(after.routines);
    if (before.routineRuns !== after.routineRuns && after.routineRuns) validateRoutineRuns(after.routineRuns);
    if (before.workBlocks !== after.workBlocks && after.workBlocks) validateWorkBlocks(after.workBlocks);
    if (before.reviews !== after.reviews && after.reviews) validateReviews(after.reviews);
    if (before.tasks !== after.tasks || before.projects !== after.projects) {
      validateWorkspaceData(after.tasks, after.projects);
      const projectIds = new Set(after.projects.map(project => project.id));
      if (after.tasks.some(task => !projectIds.has(task.projectId))) throw new Error('Choose an available project before saving this task.');
    }
    const changes = changesBetween(before, after).map(change => ({ ...change,
      after: change.after ? { ...change.after, revision: ((change.before as Task | null)?.revision || 0) + 1, updatedAt: Date.now() } : null,
    }));
    const hasOtherChanges =
      !same(before.preferences, after.preferences) ||
      !same(before.customViews, after.customViews) ||
      !same(before.areas, after.areas) ||
      !same(before.goals, after.goals) ||
      !same(before.routines, after.routines) ||
      !same(before.routineRuns, after.routineRuns) ||
      !same(before.reviews, after.reviews) ||
      !same(before.habits, after.habits) ||
      !same(before.workBlocks, after.workBlocks) ||
      !same(before.reminders, after.reminders);
    if (!changes.length && !hasOtherChanges) return;
    const applied = applyChanges(after, changes);
    after = {
      ...applied,
      areas: after.areas,
      goals: after.goals,
      routines: after.routines,
      routineRuns: after.routineRuns,
      reviews: after.reviews,
      habits: after.habits,
      workBlocks: after.workBlocks,
      reminders: after.reminders,
    };
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
    this.publish({ record: after, sync: this.connected && changes.length && !['offline', 'error', 'conflict'].includes(this.snapshot.sync) ? 'syncing' : this.snapshot.sync });
    const persisted = this.persist(options.checkpoint ? before : undefined);
    void persisted.then(() => this.flush()).catch(() => {});
    return { operationId: operation.id, persisted };
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
  prepareConnection() { this.disposed = false; this.generation++; this.adapter = undefined; clearTimeout(this.retryTimer); }
  disconnect() { this.disposed = true; this.generation++; this.adapter = undefined; clearTimeout(this.retryTimer); this.remoteGraph.clear(); }
  async retry() {
    clearTimeout(this.retryTimer);
    this.publish({ error: null, nextRetryAt: undefined, sync: this.connected ? 'syncing' : 'local', record: {
      ...this.snapshot.record,
      pending: this.snapshot.record.pending.map((operation, index) => index === 0 ? { ...operation, nextAttemptAt: undefined } : operation),
    } });
    await this.persist();
    await this.flush();
  }
  async flush() {
    if (!this.adapter || this.flushing || this.disposed || this.snapshot.readOnly || !this.snapshot.ready || this.snapshot.error || this.snapshot.sync === 'conflict') return;
    const nextAttemptAt = this.snapshot.record.pending[0]?.nextAttemptAt;
    if (nextAttemptAt && nextAttemptAt > Date.now()) {
      this.publish({ sync: 'offline', nextRetryAt: nextAttemptAt });
      clearTimeout(this.retryTimer);
      const generation = this.generation;
      this.retryTimer = setTimeout(() => { if (!this.disposed && generation === this.generation) void this.retry().catch(() => {}); }, nextAttemptAt - Date.now());
      return;
    }
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
        this.publish({ record: { ...this.snapshot.record, pending: this.snapshot.record.pending.filter(x => x.id !== operation.id) }, lastSyncedAt: Date.now(), nextRetryAt: undefined });
        await this.persist();
      }
      if (!this.disposed && generation === this.generation) this.publish({ sync: 'synced', error: null });
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        const conflict = error instanceof Error && error.name === 'SyncConflict';
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unavailable';
        const permanent = /permission-denied|unauthenticated|invalid-argument|failed-precondition/.test(code);
        const errDetail = error instanceof Error ? error.message : String(error);
        this.publish({
          sync: conflict ? 'conflict' : permanent ? 'error' : 'offline',
          error: conflict
            ? 'An account record changed on another device. Your local changes are preserved. Review the conflict in Account & sync.'
            : `Cloud sync paused: ${errDetail}. Changes are saved on this device and queued for retry.`,
        });
        if (!conflict && !permanent && this.snapshot.record.pending.length) {
          const head = this.snapshot.record.pending[0];
          const attempts = (head.attempts || 0) + 1;
          const nextRetryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(attempts, 6)) * (0.8 + Math.random() * 0.4);
          this.publish({ nextRetryAt, record: { ...this.snapshot.record, pending: [{ ...head, attempts, nextAttemptAt: nextRetryAt }, ...this.snapshot.record.pending.slice(1)] } });
          await this.persist();
          clearTimeout(this.retryTimer);
          this.retryTimer = setTimeout(() => { if (!this.disposed && generation === this.generation) void this.retry().catch(() => {}); }, Math.max(0, nextRetryAt - Date.now()));

        }
      }
    } finally {
      this.flushing = false;
      // A replaced connection may have tried to flush while this delivery still
      // held the lock. Retry the same operation ID so its durable receipt can
      // acknowledge a delivery that already reached the server.
      if (!this.disposed && generation !== this.generation) void this.flush();
    }
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
    if (collection === 'tasks' || collection === 'projects') {
      this.remoteGraph.set(collection, collection === 'projects' && !remote.length ? emptyWorkspace(this.id).projects : remote);
      for (const [kind, values] of this.remoteGraph) record = replaceEntities(record, kind, values);
    }
    record = applyChanges(record, record.pending.flatMap(op => op.changes));
    record = { ...record, projects: completeBuiltinProjects(record.projects, record.tasks) };
    try {
      const projects = new Set(record.projects.map(project => project.id));
      if (record.tasks.some(task => !projects.has(task.projectId))) throw new Error('Incomplete cloud project relationships.');
      validateWorkspaceData(record.tasks, record.projects);
      validateBackupExtras({ preferences: record.preferences, customViews: record.customViews, dashboards: record.dashboards, notes: record.notes });
    }
    catch {
      this.publish({ recoveryError: 'A cloud update has incomplete task relationships. Your last valid workspace is preserved. Retry sync or download a backup.' });
      return;
    }
    this.remoteGraph.clear();
    const seeded = (before.preferences._v4CloudSeeded || []) as string[];
    if (before.preferences._v4CloudSeedNeeded && !['tasks', 'projects', 'dashboards'].includes(collection) && !seeded.includes(collection)) {
      const localOnly = workspaceEntities(before, collection).filter(entity => !remote.some(value => value.id === entity.id));
      record = { ...record, preferences: { ...record.preferences, _v4CloudSeeded: [...seeded, collection] } };
      this.publish({ record });
      if (localOnly.length) this.run('Migrate existing focus history and settings', current => applyChanges(current, localOnly.map(value => ({ collection, id: value.id, before: null, after: { ...value, revision: 0 } }))), false);
      else void this.persist().catch(() => {});
      return;
    }
    this.publish({ record, recoveryError: this.snapshot.recoveryError?.startsWith('A cloud update') ? null : this.snapshot.recoveryError });
    void this.persist().catch(() => {});
  }
  async resolveConflict(choice: 'local' | 'remote') {
    if (!this.adapter) return;
    const generation = this.generation;
    const original = this.snapshot.record;
    const remote = await this.adapter.read();
    if (this.disposed || this.snapshot.readOnly || generation !== this.generation || this.snapshot.record !== original) throw new Error('The workspace changed during review. Reopen the conflict review before choosing a version.');
    validateWorkspaceData(remote.tasks, remote.projects);
    // Preserve both versions before a deliberate conflict choice.
    localStorage.setItem(`flowtask_conflict_backup_${this.id}`, JSON.stringify({ local: this.snapshot.record, remote, savedAt: Date.now() }));
    let base = { ...original, tasks: remote.tasks, projects: completeBuiltinProjects(remote.projects.length ? remote.projects : emptyWorkspace(this.id).projects, remote.tasks), pending: [], undo: [] } as WorkspaceRecord;
    for (const key of ['dashboards', 'focusLogs', 'recipes', 'preferences', 'notes'] as const) if (remote[key]) base = replaceEntities(base, key, remote[key]);
    const noteCopies: Note[] = [];
    const noteChanges = new Map(original.pending.flatMap(op => op.changes).filter(c => c.collection === 'notes').map(c => [c.id, c]));
    for (const change of noteChanges.values()) {
      const account = base.notes?.find(note => note.id === change.id);
      const local = original.notes?.find(note => note.id === change.id);
      const losing = choice === 'local' ? account : local;
      const winning = choice === 'local' ? local : account;
      if (losing && (!winning || losing.body !== winning.body || losing.title !== winning.title)) noteCopies.push(recoveredNote(losing));
    }
    const dashboardChanges = new Map(original.pending.flatMap(op => op.changes).filter(c => c.collection === 'dashboards').map(c => [c.id, c]));
    const copies: WorkspaceDashboard[] = [];
    for (const change of dashboardChanges.values()) {
      const remoteDashboard = base.dashboards.find(d => d.id === change.id);
      if (!change.after || !remoteDashboard || same(semantic(change.after), semantic(remoteDashboard))) continue;
      const preserved = (choice === 'local' ? remoteDashboard : change.after) as WorkspaceDashboard;
      copies.push({ ...structuredClone(preserved), id: uid(), name: `${preserved.name.slice(0, 80)} (Recovered)`, isDefault: false, order: base.dashboards.length + copies.length, revision: 0, createdAt: Date.now(), updatedAt: Date.now() });
    }
    if (base.dashboards.length + copies.length > 20) throw new Error('Both dashboard versions are backed up. Free a dashboard slot before resolving this conflict.');
    const chosen = choice === 'local' ? applyChanges(base, original.pending.flatMap(operation => operation.changes)) : base;
    const candidate = { ...chosen, dashboards: [...chosen.dashboards, ...copies], notes: [...(chosen.notes || []), ...noteCopies] };
    validateWorkspaceData(candidate.tasks, candidate.projects);
    validateBackupExtras({ preferences: candidate.preferences, dashboards: candidate.dashboards, customViews: candidate.customViews, notes: candidate.notes });
    if (this.persistence === dbService && typeof indexedDB !== 'undefined') await recoveryService.create(this.id, original, 'pre_batch', 'Before resolving account changes');
    if (this.disposed || this.snapshot.readOnly || this.snapshot.record !== original) throw new Error('The workspace changed during review. Reopen the conflict review before choosing a version.');
    this.publish({ record: base, error: null, sync: 'syncing' });
    if (choice === 'local' || copies.length || noteCopies.length) this.run('Resolve conflict and preserve versions', record => {
      const next = choice === 'local' ? applyChanges(record, original.pending.flatMap(op => op.changes)) : record;
      return { ...next, dashboards: [...next.dashboards, ...copies], notes: [...(next.notes || []), ...noteCopies] };
    });
    else await this.persist();
    await this.flush();
  }

  async previewConflict() {
    if (!this.adapter) throw new Error('Connect your account before reviewing conflicts.');
    const generation = this.generation;
    const remote = await this.adapter.read();
    if (this.disposed || generation !== this.generation) throw new Error('The account changed. Reopen the review.');
    let account = { ...this.snapshot.record, tasks: remote.tasks, projects: completeBuiltinProjects(remote.projects.length ? remote.projects : emptyWorkspace(this.id).projects, remote.tasks) };
    for (const key of ['dashboards', 'focusLogs', 'recipes', 'preferences', 'notes'] as const) if (remote[key]) account = replaceEntities(account, key, remote[key]);
    const affected = new Map<string, EntityChange>();
    for (const operation of this.snapshot.record.pending) for (const change of operation.changes) affected.set(`${change.collection}:${change.id}`, change);
    return [...affected.values()].map(change => ({ collection: change.collection, id: change.id, device: workspaceEntities(this.snapshot.record, change.collection).find(value => value.id === change.id) || null, account: workspaceEntities(account, change.collection).find(value => value.id === change.id) || null }));
  }

  connectionFailed(error?: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    const permanent = /permission-denied|unauthenticated|invalid-argument|failed-precondition/.test(code);
    const action = /unauthenticated/.test(code) ? 'Your sign-in expired. Sign in again to reconnect.'
      : /permission-denied/.test(code) ? 'Cloud access was denied. Sign in again or contact the site operator.'
      : permanent ? 'Cloud configuration needs attention. Contact the site operator before retrying.'
      : 'Your account could not be reached. Retry the connection when online.';
    clearTimeout(this.retryTimer);
    this.publish({ sync: permanent ? 'error' : 'offline', nextRetryAt: undefined, error: `${action} Device changes are preserved; you can download a backup.` });
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

