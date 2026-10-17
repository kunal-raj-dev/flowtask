import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusSessionService as timer } from './focusSessionService';
import { BUILT_IN_RECIPES, parseRecipe, shareableRecipe } from './studioCatalog';
import { nextStudioPhase } from './studioSessionEngine';
import { emptyWorkspace } from './dbService';
import { workspaceEntities, applyEntityChanges, safePreference } from './workspaceEntities';
import { WorkspaceStore } from './workspaceStore';
import { validateBackupExtras, mergeBackupExtras } from '../utils/workspaceBackup';
import { dbService } from './dbService';
import { readFocusCheckpoint, writeFocusCheckpoint } from './focusCheckpoint';

afterEach(()=>vi.useRealTimers());
describe('durable studio timer',()=>{
  it('recovers an immediate pause checkpoint before the IndexedDB queue has drained',async()=>{
    const map=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>map.get(key)||null,setItem:(key:string,value:string)=>map.set(key,value)});
    const disk=emptyWorkspace('reload');const active={...timer.startSession('pomodoro'),workspaceId:'reload',state:'paused' as const,pausedAt:1000,accumulatedElapsedMs:12000};
    writeFocusCheckpoint('reload',active);const store=new WorkspaceStore('reload',false,{...dbService,ensureLegacyMigrated:vi.fn(async()=>disk),saveWorkspace:vi.fn(async()=>{})});await store.load();
    expect(store.getSnapshot().record.preferences.focusSession).toMatchObject({state:'paused',accumulatedElapsedMs:12000});expect(readFocusCheckpoint('other-account')).toBeNull();await store.settled();vi.unstubAllGlobals();
  });
  it('recovers a finished session once, while an already logged session stays finished',async()=>{
    const map=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>map.get(key)||null,setItem:(key:string,value:string)=>map.set(key,value)});
    const disk=emptyWorkspace('finished');const s={...timer.startSession('pomodoro'),workspaceId:'finished',state:'completed' as const,accumulatedElapsedMs:1500000};writeFocusCheckpoint('finished',s,true);
    const persistence={...dbService,ensureLegacyMigrated:vi.fn(async()=>disk),saveWorkspace:vi.fn(async()=>{})};const a=new WorkspaceStore('finished',false,persistence);await a.load();expect(a.getSnapshot().record.preferences.focusSession).toMatchObject({recoverCompletion:true});await a.settled();
    disk.preferences.focusLogs=[{id:s.id,seconds:1500}];const b=new WorkspaceStore('finished',false,persistence);await b.load();expect(b.getSnapshot().record.preferences.focusSession).toBeNull();await b.settled();vi.unstubAllGlobals();
  });
  it('keeps its original start and excludes paused time across resume and reload',()=>{
    vi.useFakeTimers(); vi.setSystemTime(100000); let s=timer.startSession('pomodoro',null,null,1500);
    vi.advanceTimersByTime(40000); s=timer.pauseSession(s); vi.advanceTimersByTime(120000); s=timer.resumeSession(s); vi.advanceTimersByTime(20000);
    expect(timer.getElapsedSeconds(JSON.parse(JSON.stringify(s)))).toBe(60); expect(s.originalStartedAt).toBe(100000);
    expect(timer.getElapsedSeconds(s,Date.now()+4*3600000)).toBe(1500);
  });
  it('offers the fourth long break and starts a new cycle after it',()=>{
    const s={...timer.startSession('pomodoro'),pomodoroCycle:4,timerConfiguration:BUILT_IN_RECIPES[0].timer};
    expect(nextStudioPhase(s)).toEqual({nextPhase:'long_break',nextCycle:1});
    expect(nextStudioPhase({...s,pomodoroPhase:'long_break',pomodoroCycle:1})).toEqual({nextPhase:'focus',nextCycle:1});
  });
});
describe('recipes and complete backups',()=>{
  it('rejects broken timer configuration and invalid mix levels',()=>{
    const r=BUILT_IN_RECIPES[0]; expect(()=>parseRecipe(JSON.stringify({...r,timer:{...r.timer,focusMinutes:-1}}))).toThrow();
    expect(()=>parseRecipe(JSON.stringify({...r,layers:[{id:'brown',volume:Infinity}]}))).toThrow();
  });
  it('shares no personal file references, queue or task text',()=>{
    const r={...BUILT_IN_RECIPES[0],sceneId:'local:secret',breakSceneId:'local:other',musicId:'local:music',queue:['private task']};
    const shared=shareableRecipe(r); expect(shared).not.toContain('local:'); expect(shared).not.toContain('private task'); expect(parseRecipe(shared).breakSceneId).toBe('');
  });
  it('restores history and safe preferences without reviving timers or the outbox',()=>{
    const extras=validateBackupExtras({preferences:{focusSession:{state:'running'},_syncRevisions:{},appearance:{theme:'amoled'},focusRecipes:[BUILT_IN_RECIPES[0]],focusLogs:[{id:'old',seconds:65,startedAt:1,endedAt:65001}]},customViews:[]})!;
    expect(extras.preferences.focusSession).toBeUndefined();expect(extras.preferences._syncRevisions).toBeUndefined();
    expect((extras.preferences.focusLogs as object[])).toHaveLength(1);
    const merged=mergeBackupExtras(extras,extras,false);expect(merged.preferences.focusLogs).toHaveLength(1);
    expect(()=>validateBackupExtras({preferences:{focusLogs:[{id:'a',seconds:-1}]}})).toThrow();
  });
});
describe('individual history and safe preference sync',()=>{
  it('keeps device-only content out of sync and preserves local media on a remote update',()=>{
    const before=emptyWorkspace('test'); before.preferences.studio={sceneId:'local:mine',musicId:'local:audio',queue:['task'],nextAction:'private next',projectId:'private',masterVolume:.4};before.preferences.calendarUrl='secret feed';before.preferences.scratchpad='secret note';
    const entities=workspaceEntities(before,'preferences'); const raw=JSON.stringify(entities);
    expect(raw).not.toMatch(/secret|private next|local:mine|local:audio/);
    const after=applyEntityChanges(before,[{collection:'preferences',id:'studio',before:null,after:{id:'studio',value:{sceneId:'',musicId:null,masterVolume:.7}}}]);
    expect(after.preferences.studio).toMatchObject({sceneId:'local:mine',musicId:'local:audio',queue:['task'],masterVolume:.7});expect(after.preferences.scratchpad).toBe('secret note');
    expect(safePreference('studio',{breakSceneId:'local:test'})).toMatchObject({breakSceneId:''});
  });
  it('queues an individual log once and survives failed delivery/retry',async()=>{
    let disk=emptyWorkspace('test');const persistence={...dbService,ensureLegacyMigrated:vi.fn(async()=>structuredClone(disk)),saveWorkspace:vi.fn(async(_id:string,r:typeof disk)=>{disk=structuredClone(r);})};
    const store=new WorkspaceStore('test',true,persistence);await store.load();
    const log={id:'session-a',seconds:1500,mode:'pomodoro',phase:'focus',startedAt:1,endedAt:1500001,taskId:null};
    store.run('Finish',r=>({...r,preferences:{...r.preferences,focusLogs:[log]}}),false); await store.settled();
    expect(disk.pending[0].changes.map(c=>[c.collection,c.id])).toEqual([['focusLogs','session-a']]);
    const apply=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);store.connect({apply,read:async()=>({tasks:[],projects:[]})});await vi.waitFor(()=>expect(store.getSnapshot().sync).toBe('offline'));await store.retry();
    expect(disk.pending).toHaveLength(0);expect(store.getSnapshot().record.preferences.focusLogs).toHaveLength(1);
  });
  it('restores a large history with bounded deliveries and one undo',async()=>{
    const disk=emptyWorkspace('large'); const persistence={...dbService,ensureLegacyMigrated:vi.fn(async()=>structuredClone(disk)),saveWorkspace:vi.fn(async()=>{})};
    const store=new WorkspaceStore('large',true,persistence);await store.load();
    store.run('Restore history',r=>({...r,preferences:{...r.preferences,focusLogs:Array.from({length:805},(_,i)=>({id:`history-${i}`,seconds:30,mode:'stopwatch',taskId:null,startedAt:1,endedAt:30001}))}}));
    expect(store.getSnapshot().record.pending.map(op=>op.changes.length)).toEqual([400,400,5]);store.undo();expect(store.getSnapshot().record.preferences.focusLogs).toHaveLength(0);await store.settled();
  });
});
