import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { dbService, emptyWorkspace, getDatabase } from './dbService';

it('also checkpoints a v8 workspace loaded from the localStorage fallback', async () => {
  const raw = { ...emptyWorkspace('notes-fallback'), schemaVersion: 8, notes: undefined, preferences: { scratchpad: 'Fallback thought' } };
  localStorage.setItem('flowtask_ws_notes-fallback', JSON.stringify(raw));
  const current = await dbService.loadWorkspace('notes-fallback');
  expect(current?.notes).toEqual([]);
  expect(current?.preferences.scratchpad).toBe('Fallback thought');
  expect((await (await getDatabase()).get('legacy_backups', 'v8:notes-fallback')).record).toEqual(JSON.parse(JSON.stringify(raw)));
});

it('preserves the raw v8 workspace and its private scratchpad before adding notes', async () => {
  const db = await getDatabase();
  const raw = { ...emptyWorkspace('notes-v8'), schemaVersion: 8 as const, notes: undefined, preferences: { scratchpad: 'Still private' } };
  await db.put('workspaces', raw);
  const current = await dbService.loadWorkspace('notes-v8');
  expect(current?.schemaVersion).toBe(9);
  expect(current?.notes).toEqual([]);
  expect(current?.preferences.scratchpad).toBe('Still private');
  const checkpoint = await db.get('legacy_backups', 'v8:notes-v8');
  expect(checkpoint.record).toEqual(raw);
  await dbService.saveWorkspace('notes-v8', current!);
  await dbService.loadWorkspace('notes-v8');
  expect((await db.get('legacy_backups', 'v8:notes-v8')).savedAt).toBe(checkpoint.savedAt);
});
it('upgrades v3 repeatedly without rewriting historical phases or replacing its backup',async()=>{
  const db=await getDatabase();const original={...emptyWorkspace('migration-test'),schemaVersion:3,preferences:{focusLogs:[{id:'old',seconds:20,mode:'stopwatch',taskId:null,startedAt:1,endedAt:20001}],scratchpad:'keep'}};
  await db.put('workspaces',original);const migrated=await dbService.loadWorkspace('migration-test');
  expect(migrated?.schemaVersion).toBe(9);expect(migrated?.preferences._v4CloudSeedNeeded).toBe(true);expect(migrated?.preferences._v5DashboardSeedNeeded).toBe(true);expect(migrated?.preferences.focusLogs).toEqual(original.preferences.focusLogs);
  const backup=await db.get('legacy_backups','v3:migration-test');expect(backup.record).toEqual(original);
  const backupV4=await db.get('legacy_backups','v4:migration-test');expect(backupV4.record).toEqual(original);
  const backupV5=await db.get('legacy_backups','v5:migration-test');expect(backupV5.record).toEqual(original);
  const backupV6=await db.get('legacy_backups','v6:migration-test');expect(backupV6.record).toEqual(original);
  await dbService.saveWorkspace('migration-test',migrated!);await dbService.loadWorkspace('migration-test');expect((await db.get('legacy_backups','v3:migration-test')).savedAt).toBe(backup.savedAt);
  expect(db.objectStoreNames.contains('media')).toBe(true);
});

it('upgrades v5 workspace to the current schema writing v5 snapshot to legacy_backups', async () => {
  const db = await getDatabase();
  const v5Original = {
    ...emptyWorkspace('v5-migration-test'),
    schemaVersion: 5 as const,
    tasks: [{
      id: 'task-1',
      title: 'Deep Focus Work',
      status: 'todo' as const,
      priority: 'p1' as const,
      projectId: 'inbox',
      estimatedMinutes: 60,
      createdAt: Date.now(),
      subtasks: [],
    }],
  };
  await db.put('workspaces', v5Original);
  const migrated = await dbService.loadWorkspace('v5-migration-test');
  expect(migrated?.schemaVersion).toBe(9);
  expect(migrated?.tasks[0].id).toBe('task-1');
  const backup = await db.get('legacy_backups', 'v5:v5-migration-test');
  expect(backup).toBeDefined();
  expect(backup.record.schemaVersion).toBe(5);
});

it('upgrades a v6 project without milestones and preserves a repeat-safe v6 backup', async () => {
  const db = await getDatabase();
  const original = { ...emptyWorkspace('v6-path-test'), schemaVersion: 6 as const, projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }, { id: 'course', name: 'Course', color: '#3B82F6' }] };
  await db.put('workspaces', original);
  const migrated = await dbService.loadWorkspace('v6-path-test');
  expect(migrated?.schemaVersion).toBe(9);
  expect(migrated?.projects.find(project => project.id === 'course')?.milestones).toBeUndefined();
  const snapshot = await db.get('legacy_backups', 'v6:v6-path-test');
  expect(snapshot.record).toEqual(original);
  await dbService.saveWorkspace('v6-path-test', migrated!);
  await dbService.loadWorkspace('v6-path-test');
  expect((await db.get('legacy_backups', 'v6:v6-path-test')).savedAt).toBe(snapshot.savedAt);
});
