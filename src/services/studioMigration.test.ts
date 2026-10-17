import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { dbService, emptyWorkspace, getDatabase } from './dbService';
it('upgrades v3 repeatedly without rewriting historical phases or replacing its backup',async()=>{
  const db=await getDatabase();const original={...emptyWorkspace('migration-test'),schemaVersion:3,preferences:{focusLogs:[{id:'old',seconds:20,mode:'stopwatch',taskId:null,startedAt:1,endedAt:20001}],scratchpad:'keep'}};
  await db.put('workspaces',original);const migrated=await dbService.loadWorkspace('migration-test');
  expect(migrated?.schemaVersion).toBe(6);expect(migrated?.preferences._v4CloudSeedNeeded).toBe(true);expect(migrated?.preferences._v5DashboardSeedNeeded).toBe(true);expect(migrated?.preferences.focusLogs).toEqual(original.preferences.focusLogs);
  const backup=await db.get('legacy_backups','v3:migration-test');expect(backup.record).toEqual(original);
  const backupV4=await db.get('legacy_backups','v4:migration-test');expect(backupV4.record).toEqual(original);
  const backupV5=await db.get('legacy_backups','v5:migration-test');expect(backupV5.record).toEqual(original);
  await dbService.saveWorkspace('migration-test',migrated!);await dbService.loadWorkspace('migration-test');expect((await db.get('legacy_backups','v3:migration-test')).savedAt).toBe(backup.savedAt);
  expect(db.objectStoreNames.contains('media')).toBe(true);
});

it('upgrades v5 workspace to schemaVersion 6 writing v5 snapshot to legacy_backups', async () => {
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
  expect(migrated?.schemaVersion).toBe(6);
  expect(migrated?.tasks[0].id).toBe('task-1');
  const backup = await db.get('legacy_backups', 'v5:v5-migration-test');
  expect(backup).toBeDefined();
  expect(backup.record.schemaVersion).toBe(5);
});
