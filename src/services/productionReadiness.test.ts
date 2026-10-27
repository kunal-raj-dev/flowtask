import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbService, emptyWorkspace, getDatabase } from './dbService';
import { recoveryService } from './recoveryService';
import { commandService } from './commandService';
import { WorkspaceStore } from './workspaceStore';
import { useTaskStore } from '../store/useTaskStore';
import { validateWorkspaceData } from '../utils/workspaceValidation';
import { createFocusSession, isFocusComplete, startWorkspaceFocus, finishWorkspaceFocus, changeWorkspaceFocusState } from './focusLifecycle';
import type { WorkspaceRecord } from '../types/workspace';

function task(id: string) { return { id, title: `Task ${id}`, status: 'todo' as const, priority: 'p2' as const, projectId: 'inbox', subtasks: [], createdAt: 1 }; }
async function harness(connected = false) {
  let disk = emptyWorkspace('a');
  const persistence = { ...dbService, ensureLegacyMigrated: vi.fn(async () => structuredClone(disk)), saveWorkspace: vi.fn(async (_id: string, value: WorkspaceRecord) => { disk = structuredClone(value); }) };
  const store = new WorkspaceStore('a', connected, persistence);
  await store.load();
  return { store, persistence, disk: () => disk };
}
beforeEach(async () => {
  localStorage.clear();
  const db = await getDatabase();
  for (const name of ['snapshots', 'workspaces', 'outbox', 'legacy_backups']) await db.clear(name);
});

describe('cloud connection failure classification', () => {
  it('preserves required built-in projects when an older account has only custom project documents', async () => {
    const { store } = await harness(true);
    store.receive('projects', [{ id: 'custom', name: 'Release', color: '#a16207', revision: 1 }]);
    store.receive('tasks', [{ ...task('legacy-work'), projectId: 'work', revision: 1 }, { ...task('inbox-task'), revision: 1 }]);
    await store.settled();
    expect(store.getSnapshot().record.tasks).toHaveLength(2);
    expect(store.getSnapshot().record.projects.map(project => project.id)).toEqual(expect.arrayContaining(['inbox', 'work', 'custom']));
    expect(() => store.run('Edit after hydration', record => ({ ...record, tasks: record.tasks.map(value => ({ ...value, title: 'Edited' })) }))).not.toThrow();
    await store.settled(); store.disconnect();
  });
  it('keeps a resolved account workspace editable when its built-in projects were implicit', async () => {
    const { store } = await harness(true);
    store.run('Pending task', record => ({ ...record, tasks: [task('one')] }));
    await store.settled();
    store.connect({ apply: async () => { const error = new Error('Conflicting revision'); error.name = 'SyncConflict'; throw error; }, read: async () => ({ tasks: [{ ...task('one'), title: 'Account version', revision: 2 }], projects: [] }) });
    await vi.waitFor(() => expect(store.getSnapshot().sync).toBe('conflict'));
    await store.resolveConflict('remote');
    expect(store.getSnapshot().record.projects.some(project => project.id === 'inbox')).toBe(true);
    expect(() => store.run('Edit resolved task', record => ({ ...record, tasks: record.tasks.map(value => ({ ...value, title: 'Next edit' })) }))).not.toThrow();
    await store.settled(); store.disconnect();
  });
  it('resumes a queued operation when an old connection finishes after reconnection', async () => {
    const { store } = await harness(true);
    store.run('Capture while disconnected', record => ({ ...record, tasks: [task('queued')] }));
    await store.settled();
    let finishOld!: () => void;
    const oldDelivery = new Promise<void>(resolve => { finishOld = resolve; });
    const oldApply = vi.fn(async () => oldDelivery);
    const nextApply = vi.fn(async () => {});
    const read = async () => ({ tasks: [], projects: [] });
    store.connect({ apply: oldApply, read });
    await vi.waitFor(() => expect(oldApply).toHaveBeenCalledOnce());
    store.prepareConnection();
    store.connect({ apply: nextApply, read });
    await store.retry();
    expect(nextApply).not.toHaveBeenCalled();
    finishOld();
    await vi.waitFor(() => expect(store.getSnapshot().record.pending).toHaveLength(0));
    expect(nextApply).toHaveBeenCalledOnce();
    expect(nextApply.mock.calls[0]).toEqual(oldApply.mock.calls[0]);
    expect(store.getSnapshot().sync).toBe('synced');
    store.disconnect();
  });
  it('pauses denied account access with an actionable error and preserves queued work', async () => {
    const { store } = await harness(true);
    store.run('Offline capture', record => ({ ...record, tasks: [task('queued')] }));
    await store.settled();
    store.connectionFailed({ code: 'permission-denied' });
    expect(store.getSnapshot().sync).toBe('error');
    expect(store.getSnapshot().error).toContain('Cloud access was denied');
    expect(store.getSnapshot().record.pending).toHaveLength(1);
    expect(store.getSnapshot().nextRetryAt).toBeUndefined();
    store.disconnect();
  });
  it('describes a transient connection failure as offline without losing saved data', async () => {
    const { store } = await harness(true);
    store.connectionFailed({ code: 'unavailable' });
    expect(store.getSnapshot().sync).toBe('offline');
    expect(store.getSnapshot().error).toContain('Retry the connection when online');
    store.disconnect();
  });
});

describe('production mutation invariants', () => {
  it('permanent deletion removes dependency edges and undo restores them', () => {
    const tasks = [task('a'), { ...task('b'), blockedBy: ['a'] }];
    const result = commandService.permanentDeleteTask(tasks, 'a');
    expect(() => validateWorkspaceData(result.updatedTasks, emptyWorkspace('local').projects)).not.toThrow();
    expect(result.updatedTasks[0].blockedBy).toEqual([]);
    expect(result.inverse(result.updatedTasks).find(value => value.id === 'b')?.blockedBy).toEqual(['a']);
    expect(result.forward?.(result.inverse(result.updatedTasks))).toEqual(result.updatedTasks);
  });
  it('deleting a milestone project survives persistence/reload and undo restores its milestone', async () => {
    const { store, disk } = await harness();
    store.run('Seed', record => ({ ...record, projects: [...record.projects.filter(p => p.id !== 'work'), { id: 'work', name: 'Work', color: '#64748b', milestones: [{ id: 'm', title: 'Release', order: 0 }] }], tasks: [{ ...task('a'), projectId: 'work', milestoneId: 'm' }] }));
    useTaskStore.getState().setWorkspaceStore(store);
    useTaskStore.getState().deleteProject('work');
    await store.settled();
    expect(disk().tasks[0].milestoneId).toBeUndefined();
    expect(() => validateWorkspaceData(disk().tasks, disk().projects)).not.toThrow();
    store.undo(); await store.settled();
    expect(disk().tasks[0].milestoneId).toBe('m');
  });
  it('moving individual and batch tasks clears incompatible milestones and restores on undo', () => {
    const original = { ...task('a'), projectId: 'work', milestoneId: 'm' };
    for (const result of [commandService.updateTask([original], 'a', { projectId: 'inbox' }), commandService.batchUpdate([original], ['a'], { projectId: 'inbox' })]) {
      expect(result.updatedTasks[0].milestoneId).toBeUndefined();
      expect(result.inverse(result.updatedTasks)[0].milestoneId).toBe('m');
    }
  });
  it('rejects invalid graph mutations before optimistic publication', async () => {
    const { store } = await harness();
    const before = store.getSnapshot().record;
    expect(() => store.run('Invalid', record => ({ ...record, tasks: [{ ...task('a'), blockedBy: ['missing'] }] }))).toThrow(/missing dependency/);
    expect(store.getSnapshot().record).toBe(before);
  });
  it('returns a durable receipt and rejects the receipt on quota failure', async () => {
    const { store, persistence } = await harness();
    const receipt = store.run('Add', record => ({ ...record, tasks: [task('a')] }));
    expect(receipt?.operationId).toBeTruthy(); await receipt?.persisted;
    expect(store.getSnapshot().lastSavedAt).toBeGreaterThan(0);
    persistence.saveWorkspace.mockRejectedValueOnce(new Error('quota'));
    const failed = store.run('Add', record => ({ ...record, tasks: [...record.tasks, task('b')] }));
    await expect(failed?.persisted).rejects.toThrow('quota');
    expect(store.getSnapshot().record.tasks).toHaveLength(2);
  });
  it('does not permit follower mutations', async () => {
    const { store } = await harness(); store.setReadOnly(true);
    expect(() => store.run('Write', record => ({ ...record, tasks: [task('a')] }))).toThrow(/read-only/);
  });
});

describe('durable account-scoped recovery', () => {
  const record = () => ({ ...emptyWorkspace('a'), tasks: [task('one')], preferences: { scratchpad: 'private notes', focusLogs: [], focusSession: { id: 'never-restore' }, _calendarFile: { content: 'private calendar' } } });
  it('isolates local/A/B snapshots and rejects cross-account restore and deletion', async () => {
    const a = await recoveryService.create('a', record());
    await recoveryService.create('b', record()); await recoveryService.create('local', record());
    expect(await recoveryService.list('a')).toHaveLength(1);
    await expect(recoveryService.read('b', a.id)).rejects.toThrow(/does not belong/);
    await expect(recoveryService.remove('b', a.id)).rejects.toThrow(/does not belong/);
    expect(await recoveryService.list('a')).toHaveLength(1);
  });
  it('retains exactly the latest ten across a fresh IndexedDB read', async () => {
    for (let i = 0; i < 14; i++) await recoveryService.create('a', record(), 'manual', `Checkpoint ${i}`);
    expect(await recoveryService.list('a')).toHaveLength(10);
    expect((await (await getDatabase()).getAll('snapshots')).length).toBe(10);
  });
  it('deduplicates concurrent daily checkpoints transactionally', async () => {
    await Promise.all([recoveryService.create('a', record(), 'auto_daily'), recoveryService.create('a', record(), 'auto_daily')]);
    expect(await recoveryService.list('a')).toHaveLength(1);
  });
  it('writes and reads current schema checkpoints containing scheduled work blocks', async () => {
    const block = { id: 'focus-block', taskId: 'one', startInstant: Date.UTC(2026, 9, 27, 4), endInstant: Date.UTC(2026, 9, 27, 4, 25), timezone: 'Asia/Kolkata', status: 'scheduled' as const, durationMinutes: 25 };
    const snapshot = await recoveryService.create('a', { ...record(), workBlocks: [block] }, 'auto_daily');
    expect(snapshot.backup.schemaVersion).toBe(9);
    expect((await recoveryService.read('a', snapshot.id)).workBlocks).toMatchObject([block]);
  });
  it('contains a full portable workspace, without running timers, private calendar imports or queued operations', async () => {
    const snap = await recoveryService.create('a', record());
    const restored = await recoveryService.read('a', snap.id);
    expect(restored.dashboards.length).toBeGreaterThan(0);
    expect(restored.preferences.scratchpad).toBe('private notes');
    expect(restored.preferences.focusSession).toBeUndefined();
    expect(restored.preferences._calendarFile).toBeUndefined();
    expect('pending' in restored).toBe(false);
  });
  it('keeps older global snapshots unowned and export-only', async () => {
    localStorage.setItem('flowtask_snapshots_v1', JSON.stringify([{ id: 'old', tasks: [task('old')] }]));
    expect(await recoveryService.legacy()).toHaveLength(1);
    expect(await recoveryService.list('a')).toEqual([]);
    await expect(recoveryService.read('a', 'old')).rejects.toThrow();
  });
  it('rejects invalid recovery data without creating a checkpoint', async () => {
    await expect(recoveryService.create('a', { ...record(), tasks: [{ ...task('a'), blockedBy: ['absent'] }] })).rejects.toThrow();
    expect(await recoveryService.list('a')).toEqual([]);
  });
  it('migrates a scoped localStorage workspace into durable IndexedDB before rendering it', async () => {
    localStorage.setItem('flowtask_ws_migrating', JSON.stringify({ ...emptyWorkspace('migrating'), tasks: [task('persist-me')] }));
    await dbService.ensureLegacyMigrated('migrating');
    expect((await (await getDatabase()).get('workspaces', 'migrating')).tasks[0].id).toBe('persist-me');
  });
  it('rejects a stale writer without overwriting confirmed writes, including repeated retries', async () => {
    await dbService.saveWorkspace('local', emptyWorkspace('local'));
    const a = new WorkspaceStore('local'); const b = new WorkspaceStore('local'); await a.load(); await b.load();
    const first = a.run('First writer', record => ({ ...record, tasks: [task('first')] })); await first?.persisted;
    const stale = b.run('Stale writer', record => ({ ...record, tasks: [task('stale')] }));
    await expect(stale?.persisted).rejects.toThrow(/Another tab/);
    await expect(b.retry()).rejects.toThrow(/Another tab/);
    expect((await dbService.loadWorkspace('local'))?.tasks[0].id).toBe('first');
  });
  it('preserves future and corrupt saved records instead of replacing them with empty data', async () => {
    const db = await getDatabase();
    await db.put('workspaces', { ...emptyWorkspace('a'), schemaVersion: 99 });
    await expect(dbService.ensureLegacyMigrated('a')).rejects.toThrow(/newer/);
    expect((await db.get('workspaces', 'a')).schemaVersion).toBe(99);
    await db.put('workspaces', { ...emptyWorkspace('b'), tasks: [{ ...task('bad'), blockedBy: ['absent'] }] });
    await expect(dbService.ensureLegacyMigrated('b')).rejects.toThrow(/missing dependency/);
    expect((await db.get('workspaces', 'b')).tasks).toHaveLength(1);
  });
});

describe('cloud delivery safety', () => {
  it('persists bounded retry metadata and permits an explicit immediate retry', async () => {
    const { store, disk } = await harness(true);
    store.run('Create', record => ({ ...record, tasks: [task('a')] })); await store.settled();
    const apply = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Offline'), { code: 'unavailable' })).mockResolvedValue(undefined);
    store.connect({ apply, read: async () => ({ tasks: [], projects: [] }) });
    await vi.waitFor(() => expect(store.getSnapshot().sync).toBe('offline'));
    await vi.waitFor(() => expect(disk().pending[0].attempts).toBe(1));
    expect(disk().pending[0].nextAttemptAt).toBeGreaterThan(Date.now());
    await store.retry();
    expect(disk().pending).toEqual([]); expect(apply).toHaveBeenCalledTimes(2);
    store.disconnect();
  });
  it('restores the persisted backoff instead of hammering the cloud on reload', async () => {
    const { store, persistence } = await harness(true);
    store.run('Create', record => ({ ...record, tasks: [task('a')] })); await store.settled();
    const saved = store.getSnapshot().record;
    persistence.ensureLegacyMigrated.mockResolvedValue({ ...saved, pending: saved.pending.map(operation => ({ ...operation, attempts: 4, nextAttemptAt: Date.now() + 30000 })) });
    const reopened = new WorkspaceStore('a', true, persistence); await reopened.load();
    const apply = vi.fn().mockResolvedValue(undefined);
    reopened.connect({ apply, read: async () => ({ tasks: [], projects: [] }) });
    expect(apply).not.toHaveBeenCalled(); expect(reopened.getSnapshot().nextRetryAt).toBeGreaterThan(Date.now());
    await reopened.retry(); expect(apply).toHaveBeenCalledOnce(); reopened.disconnect();
  });
  it('does not endlessly retry permissions errors', async () => {
    const { store, disk } = await harness(true);
    store.run('Create', record => ({ ...record, tasks: [task('a')] })); await store.settled();
    const apply = vi.fn().mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'permission-denied' }));
    store.connect({ apply, read: async () => ({ tasks: [], projects: [] }) });
    await vi.waitFor(() => expect(store.getSnapshot().sync).toBe('error'));
    expect(store.getSnapshot().nextRetryAt).toBeUndefined(); expect(disk().pending).toHaveLength(1);
    store.disconnect();
  });
  it('ignores an account delivery acknowledgement arriving after disconnect', async () => {
    const { store } = await harness(true);
    store.run('Create', record => ({ ...record, tasks: [task('a')] })); await store.settled();
    let finish!: () => void;
    const apply = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    store.connect({ apply, read: async () => ({ tasks: [], projects: [] }) });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
    store.disconnect(); finish(); await Promise.resolve(); await Promise.resolve();
    expect(store.getSnapshot().record.pending).toHaveLength(1); expect(store.getSnapshot().lastSyncedAt).toBeUndefined();
  });
  it('stages incomplete cloud references until the matching project arrives', async () => {
    const { store } = await harness(true);
    const previous = store.getSnapshot().record;
    store.receive('tasks', [{ ...task('remote'), projectId: 'remote-project' }]);
    expect(store.getSnapshot().record).toBe(previous);
    expect(store.getSnapshot().recoveryError).toContain('incomplete');
    store.receive('projects', [...previous.projects, { id: 'remote-project', name: 'Remote project', color: '#64748b' }]);
    expect(store.getSnapshot().record.tasks[0].id).toBe('remote');
    expect(store.getSnapshot().recoveryError).toBeNull(); await store.settled(); store.disconnect();
  });
});

describe('headless focus lifecycle', () => {
  it('pauses, resumes and finishes through one idempotent contract without a mounted surface', async () => {
    const { store } = await harness();
    store.run('Seed', record => ({ ...record, tasks: [task('a')] }));
    const session = startWorkspaceFocus(store, { mode: 'countdown', taskId: 'a', targetDurationSec: 60 });
    changeWorkspaceFocusState(store, 'paused', session.startedAt + 20000);
    changeWorkspaceFocusState(store, 'running', session.startedAt + 120000);
    expect(finishWorkspaceFocus(store, { now: session.startedAt + 160000 })).toBe(60);
    expect(finishWorkspaceFocus(store)).toBe(0);
    expect(store.getSnapshot().record.preferences.focusLogs).toHaveLength(1);
    expect(store.getSnapshot().record.tasks[0].timeSpentMinutes).toBe(1);
    await store.settled();
  });
  it('break completion logs its phase without adding work to the task', async () => {
    const { store } = await harness();
    store.run('Seed', record => ({ ...record, tasks: [task('a')] }));
    const session = startWorkspaceFocus(store, { mode: 'pomodoro', taskId: 'a', targetDurationSec: 60 });
    store.run('Choose break', record => ({ ...record, preferences: { ...record.preferences, focusSession: { ...session, pomodoroPhase: 'short_break' } } }), false);
    expect(finishWorkspaceFocus(store, { now: session.startedAt + 90000 })).toBe(60);
    expect(store.getSnapshot().record.tasks[0].timeSpentMinutes).toBe(0);
    expect((store.getSnapshot().record.preferences.focusLogs as { phase: string }[])[0].phase).toBe('short_break');
    await store.settled();
  });
  it('provides complete defaults for all timed entry points', async () => {
    const { store } = await harness();
    const session = startWorkspaceFocus(store, { mode: 'countdown', targetDurationSec: 60 });
    expect(session.timerConfiguration?.focusMinutes).toBe(1);
    expect(session.timerConfiguration?.autoStart).toBe(false);
    expect(isFocusComplete(session, session.startedAt + 60000)).toBe(true);
    expect(isFocusComplete({ ...session, state: 'paused' }, session.startedAt + 60000)).toBe(false);
    expect(() => startWorkspaceFocus(store, { mode: 'pomodoro' })).toThrow(/current focus/);
    await store.settled();
  });
  it('uses elapsed timestamps across sleep/wake and validates durations', () => {
    const session = createFocusSession({ mode: 'pomodoro', targetDurationSec: 30 }, 'a', 1000);
    expect(isFocusComplete(session, 30999)).toBe(false);
    expect(isFocusComplete(session, 31000)).toBe(true);
    expect(() => createFocusSession({ mode: 'pomodoro', targetDurationSec: NaN })).toThrow();
    expect(isFocusComplete(createFocusSession({ mode: 'stopwatch' }), Date.now() + 1000000)).toBe(false);
    expect(isFocusComplete(createFocusSession({ mode: 'sprint', targetDurationSec: 30 }), Date.now() + 1000000)).toBe(false);
  });
  it('does not write a lifecycle checkpoint when a follower attempts to start focus', async () => {
    const { store } = await harness(); store.setReadOnly(true);
    const before = localStorage.getItem('flowtask-focus-checkpoint:a');
    expect(() => startWorkspaceFocus(store, { mode: 'countdown' })).toThrow(/read-only/);
    expect(localStorage.getItem('flowtask-focus-checkpoint:a')).toBe(before);
  });
});
