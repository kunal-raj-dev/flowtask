import { describe, expect, it, vi } from 'vitest';
import { WorkspaceStore } from './workspaceStore';
import { dbService, emptyWorkspace } from './dbService';
import { commandService } from './commandService';
function harness(connected = false) {
  let disk = emptyWorkspace('test');
  const persistence = { ...dbService, ensureLegacyMigrated: vi.fn(async () => structuredClone(disk)), saveWorkspace: vi.fn(async (_id: string, data: typeof disk) => { disk = structuredClone(data); }) };
  const store = new WorkspaceStore('test', connected, persistence);
  return { store, persistence, disk: () => disk };
}
const create = (store: WorkspaceStore, title: string) => store.run('Create', r => ({ ...r, tasks: commandService.createTask(r.tasks, title).updatedTasks }));
describe('ordered workspace commands', () => {
  it('does not permit writes before hydration and preserves an empty workspace', async () => {
    const { store } = harness(); expect(() => create(store, 'early')).toThrow(/loading/); await store.load(); expect(store.getSnapshot().record.tasks).toEqual([]);
  });
  it('keeps every rapid create and repeated subtask update', async () => {
    const { store, disk } = harness(); await store.load();
    for (let i = 0; i < 20; i++) create(store, `Task ${i}`);
    for (let i = 0; i < 3; i++) store.run('Subtask', r => ({ ...r, tasks: r.tasks.map((t, index) => index === 0 ? { ...t, subtasks: [...t.subtasks, { id: `s${i}`, title: 'Step', completed: false }] } : t) }));
    await store.settled(); expect(disk().tasks).toHaveLength(20); expect(disk().tasks[0].subtasks).toHaveLength(3);
  });
  it('persists exact deletion operations when undoing creation', async () => {
    const { store, disk } = harness(true); await store.load(); create(store, 'new'); store.undo(); await store.settled();
    expect(disk().tasks).toHaveLength(0); expect(disk().pending).toHaveLength(2); expect(disk().pending[1].changes[0].after).toBeNull();
  });
  it('allows multiple consecutive undos despite revision changes', async () => {
    const { store } = harness(); await store.load(); create(store, 'original');
    store.run('Rename', r => ({ ...r, tasks: r.tasks.map(t => ({ ...t, title: 'renamed' })) }));
    store.undo(); store.undo(); expect(store.getSnapshot().record.tasks).toEqual([]); await store.settled();
  });
  it('retains queued changes on network failure and replays on retry', async () => {
    const { store, disk } = harness(true); await store.load(); create(store, 'offline'); await store.settled();
    const apply = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    store.connect({ apply, read: async () => ({ tasks: [], projects: [] }) });
    await vi.waitFor(() => expect(store.getSnapshot().sync).toBe('offline'));
    expect(disk().pending).toHaveLength(1); await store.retry(); expect(disk().pending).toHaveLength(0); expect(apply).toHaveBeenCalledTimes(2);
  });
  it('does not overwrite pending local edits with snapshots', async () => {
    const { store } = harness(true); await store.load(); create(store, 'local'); store.receive('tasks', []); expect(store.getSnapshot().record.tasks[0].title).toBe('local'); await store.settled();
  });
  it('keeps unsaved data visible and reports persistence failure', async () => {
    const { store, persistence } = harness(); await store.load(); persistence.saveWorkspace.mockRejectedValueOnce(new Error('quota'));
    create(store, 'unsaved'); await expect(store.settled()).rejects.toThrow(/not saved/); expect(store.getSnapshot().record.tasks).toHaveLength(1);
    await store.retry(); expect(store.getSnapshot().error).toBeNull();
  });
});
