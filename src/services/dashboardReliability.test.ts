import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStore } from './workspaceStore';
import { dbService, emptyWorkspace, getDatabase } from './dbService';
import { replaceEntities, workspaceEntities } from './workspaceEntities';
import { validateBackupExtras } from '../utils/workspaceBackup';

describe('dashboard reliability', () => {
  afterEach(()=>vi.unstubAllGlobals());
  it.each(['local','remote'] as const)('preserves both dashboard versions when choosing %s after a cloud conflict', async choice=>{
    const storage=new Map<string,string>();
    vi.stubGlobal('localStorage',{setItem:(key:string,value:string)=>storage.set(key,value),getItem:(key:string)=>storage.get(key)||null});
    const disk=emptyWorkspace('conflict-'+choice);
    disk.dashboards=[{...disk.dashboards[0],revision:1}];
    const store=new WorkspaceStore(disk.workspaceId,true,{...dbService,ensureLegacyMigrated:async()=>structuredClone(disk),saveWorkspace:async()=>{}});
    await store.load();
    store.run('Rename locally',r=>({...r,dashboards:r.dashboards.map(d=>({...d,name:'Device desk'}))}));
    const remote={...disk.dashboards[0],name:'Cloud desk',revision:2};
    store.connect({apply:async()=>{},read:async()=>({tasks:[],projects:disk.projects,dashboards:[remote],preferences:[],focusLogs:[],recipes:[]})});
    await store.resolveConflict(choice); await store.settled();
    const names=store.getSnapshot().record.dashboards.map(d=>d.name);
    expect(names).toEqual(choice==='local'?['Device desk','Cloud desk (Recovered)']:['Cloud desk','Device desk (Recovered)']);
    expect(localStorage.getItem('flowtask_conflict_backup_'+disk.workspaceId)).toContain('Device desk');
  });
  it('seeds migrated layouts once when the cloud collection is empty', async () => {
    let disk=emptyWorkspace('dash-test'); disk.preferences._v5DashboardSeedNeeded=true;
    const persistence={...dbService,ensureLegacyMigrated:async()=>structuredClone(disk),saveWorkspace:vi.fn(async(_id:string,data:typeof disk)=>{disk=structuredClone(data);})};
    const store=new WorkspaceStore('dash-test',true,persistence); await store.load();
    store.receive('dashboards',[]); await store.settled();
    expect(disk.dashboards).toHaveLength(4); expect(disk.pending).toHaveLength(1);
    expect(disk.pending[0].changes.every(c=>c.collection==='dashboards' && c.before===null && c.after?.revision===1)).toBe(true);
    store.receive('dashboards',[]); await store.settled(); expect(disk.pending).toHaveLength(1);
  });
  it('uses existing account layouts rather than restoring deleted starter desks', async () => {
    const disk=emptyWorkspace('existing');
    const store=new WorkspaceStore('existing',true,{...dbService,ensureLegacyMigrated:async()=>disk,saveWorkspace:async()=>{}}); await store.load();
    store.receive('dashboards',[{...disk.dashboards[0],name:'My saved layout',revision:5}]);
    expect(store.getSnapshot().record.dashboards).toHaveLength(1); expect(store.getSnapshot().record.dashboards[0].name).toBe('My saved layout');
  });
  it('keeps phone layout on this device while cloud records contain only shared layouts', () => {
    const disk=emptyWorkspace('mobile'); disk.dashboards[0].layouts.sm![0].h=12;
    const cloud=workspaceEntities(disk,'dashboards'); expect((cloud[0] as typeof disk.dashboards[0]).layouts.sm).toBeUndefined();
    const after=replaceEntities(disk,'dashboards',cloud); expect(after.dashboards[0].layouts.sm![0].h).toBe(12);
  });
  it('backs up invalid saved layouts before recovering a usable starter', async () => {
    const db=await getDatabase(), disk=emptyWorkspace('invalid-layout');
    (disk.dashboards[0] as unknown as { widgets:unknown }).widgets='corrupt'; await db.put('workspaces',disk);
    const recovered=await dbService.loadWorkspace(disk.workspaceId); expect(recovered?.preferences._dashboardRecovery).toBe(true);
    expect(recovered?.dashboards).toHaveLength(4); expect((await db.get('legacy_backups','dashboard-repair:invalid-layout')).record).toEqual(disk);
  });
  it('rejects a corrupted imported layout before replacing any task data', () => {
    const dashboard=emptyWorkspace('bad-import').dashboards[0];
    expect(()=>validateBackupExtras({dashboards:[{...dashboard,widgets:[{id:'w',type:'projects',config:{projectIds:3}}, {id:'w',type:'quietScene',config:{}}]}]})).toThrow(/duplicate/);
  });
});
