import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { dbService, emptyWorkspace, getDatabase } from './dbService';
it('upgrades v3 repeatedly without rewriting historical phases or replacing its backup',async()=>{
  const db=await getDatabase();const original={...emptyWorkspace('migration-test'),schemaVersion:3,preferences:{focusLogs:[{id:'old',seconds:20,mode:'stopwatch',taskId:null,startedAt:1,endedAt:20001}],scratchpad:'keep'}};
  await db.put('workspaces',original);const migrated=await dbService.loadWorkspace('migration-test');
  expect(migrated?.schemaVersion).toBe(5);expect(migrated?.preferences._v4CloudSeedNeeded).toBe(true);expect(migrated?.preferences._v5DashboardSeedNeeded).toBe(true);expect(migrated?.preferences.focusLogs).toEqual(original.preferences.focusLogs);
  const backup=await db.get('legacy_backups','v3:migration-test');expect(backup.record).toEqual(original);
  const backupV4=await db.get('legacy_backups','v4:migration-test');expect(backupV4.record).toEqual(original);
  await dbService.saveWorkspace('migration-test',migrated!);await dbService.loadWorkspace('migration-test');expect((await db.get('legacy_backups','v3:migration-test')).savedAt).toBe(backup.savedAt);
  expect(db.objectStoreNames.contains('media')).toBe(true);
});
