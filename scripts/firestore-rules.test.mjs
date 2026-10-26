import { test, before, after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-flowtask',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>env.clearFirestore());after(async()=>env?.cleanup());
const task={id:'t',title:'One small thing',status:'todo',priority:'p2',projectId:'inbox',subtasks:[],revision:1,updatedAt:1};

test('notes enforce ownership, revision, supported shape and bounded history', async () => {
  const owner = env.authenticatedContext('a').firestore();
  const note = { id:'n', title:'A private note', body:'Text', formatVersion:1, createdAt:1, updatedAt:1, revision:1, tags:[], favorite:false, versions:[], linkedTasks:[] };
  const ref = doc(owner, 'users/a/notes/n');
  await assertSucceeds(setDoc(ref, note));
  await assertFails(getDoc(doc(env.authenticatedContext('b').firestore(), 'users/a/notes/n')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/a/notes/n')));
  await assertFails(setDoc(ref, { ...note, body:'Stale revision' }));
  await assertSucceeds(setDoc(ref, { ...note, revision:2, body:'Next text', versions:[{ id:'v', title:note.title, body:note.body, savedAt:1 }] }));
  await assertFails(setDoc(ref, { ...note, revision:3, body:'x'.repeat(40001) }));
  await assertFails(setDoc(ref, { ...note, revision:3, versions:Array(5).fill({ id:'v', title:'Version', body:'Text', savedAt:1 }) }));
  await assertFails(setDoc(ref, { ...note, revision:3, versions:[{ body:123 }] }));
  await assertFails(setDoc(ref, { ...note, revision:3, extra:'unexpected' }));
});

test('preference hydration and listeners require the same allowed-ID query as the cloud adapter', async () => {
  const owner = env.authenticatedContext('a').firestore();
  const keys = ['settings', 'appearance', 'studio', 'templates', 'customViews', 'profile', 'workspace'];
  const ref = collection(owner, 'users/a/preferences');
  await assertFails(getDocs(ref));
  await assertSucceeds(getDocs(query(ref, where(documentId(), 'in', keys))));
  await assertSucceeds(setDoc(doc(ref, 'appearance'), { id: 'appearance', value: { theme: 'light' }, revision: 1, updatedAt: 1 }));
  const preferences = await assertSucceeds(getDocs(query(ref, where(documentId(), 'in', keys))));
  if (preferences.size !== 1) throw new Error('The supported account preference was not hydrated.');
  await assertFails(getDocs(query(collection(env.authenticatedContext('b').firestore(), 'users/a/preferences'), where(documentId(), 'in', keys))));
  await assertFails(getDocs(query(ref, where(documentId(), 'in', [...keys, 'privateDeviceData']))));
});
test('owner can write a task; another account and anonymous requests cannot read it',async()=>{
  const a=env.authenticatedContext('a').firestore();await assertSucceeds(setDoc(doc(a,'users/a/tasks/t'),task));
  await assertFails(getDoc(doc(env.authenticatedContext('b').firestore(),'users/a/tasks/t')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users/a/tasks/t')));
});
test('explicit validators cannot be bypassed by the former recursive allow',async()=>{
  const db=env.authenticatedContext('a').firestore();await assertFails(setDoc(doc(db,'users/a/tasks/t'),{...task,title:123}));
  await assertFails(setDoc(doc(db,'users/a/unknown/x'),{anything:true}));await assertFails(setDoc(doc(db,'users/a'),{deletionPending:false}));
});
test('history, recipes, dashboards and whitelisted preferences accept valid owner writes',async()=>{
  const db=env.authenticatedContext('a').firestore();
  await assertSucceeds(setDoc(doc(db,'users/a/focusLogs/f'),{id:'f',seconds:300,mode:'pomodoro',phase:'short_break',startedAt:1,endedAt:300001,revision:1,updatedAt:1}));
  await assertSucceeds(setDoc(doc(db,'users/a/recipes/r'),{id:'r',name:'Quiet',sceneId:'forest',layers:[],timer:{},revision:1,updatedAt:1}));
  await assertSucceeds(setDoc(doc(db,'users/a/dashboards/d'),{id:'d',name:'Personal',widgets:[],layouts:{lg:[]},order:0,createdAt:1,revision:1,updatedAt:1}));
  await assertSucceeds(setDoc(doc(db,'users/a/preferences/appearance'),{id:'appearance',value:{theme:'amoled'},revision:1,updatedAt:1}));
  await assertFails(setDoc(doc(db,'users/a/dashboards/d'),{id:'d',name:'',widgets:[],layouts:{lg:[]},order:0,createdAt:1,revision:1,updatedAt:1}));
  await assertFails(setDoc(doc(db,'users/a/preferences/calendarUrl'),{id:'calendarUrl',value:'private',revision:1,updatedAt:1}));
  await assertFails(setDoc(doc(db,'users/a/focusLogs/f'),{id:'f',seconds:-2,mode:'pomodoro',startedAt:1,endedAt:2,revision:1,updatedAt:1}));
});
test('a deletion barrier rejects existing sign-in tokens and cannot be removed by the client',async()=>{
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'users/a'),{deletionPending:true}));
  const db=env.authenticatedContext('a').firestore();await assertFails(setDoc(doc(db,'users/a/tasks/t'),task));await assertFails(setDoc(doc(db,'users/a'),{deletionPending:false}));
});
test('idempotency receipts cannot be silently overwritten',async()=>{
  const db=env.authenticatedContext('a').firestore();const ref=doc(db,'users/a/operations/op');await assertSucceeds(setDoc(ref,{createdAt:1,description:'Finished a session'}));await assertFails(setDoc(ref,{createdAt:2,description:'Different operation'}));
});

test('task revisions advance exactly once and fields and dependency arrays are bounded', async () => {
  const db = env.authenticatedContext('a').firestore(), ref = doc(db, 'users/a/tasks/t');
  await assertSucceeds(setDoc(ref, task));
  await assertFails(setDoc(ref, { ...task, title: 'Stale' }));
  await assertFails(setDoc(ref, { ...task, revision: 3 }));
  await assertSucceeds(setDoc(ref, { ...task, revision: 2 }));
  await assertFails(setDoc(ref, { ...task, revision: 3, unexpectedPrivateField: 'no' }));
  await assertFails(setDoc(ref, { ...task, revision: 3, blockedBy: Array(1001).fill('other') }));
});

test('server rate buckets are inaccessible to clients and project revisions are monotonic', async () => {
  const db = env.authenticatedContext('a').firestore();
  await assertFails(setDoc(doc(db, 'serviceRateLimits/private'), { count: 1 }));
  await assertFails(getDoc(doc(db, 'serviceRateLimits/private')));
  const ref = doc(db, 'users/a/projects/p');
  const project = { id: 'p', name: 'Release', color: '#a16207', revision: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(ref, project));
  await assertFails(setDoc(ref, project));
  await assertSucceeds(setDoc(ref, { ...project, revision: 2 }));
});

test('dashboard validation covers the 24-widget boundary, known types, private mobile layouts and revisions',async()=>{
  const db=env.authenticatedContext('a').firestore(), ref=doc(db,'users/a/dashboards/boundary');
  const dashboard={id:'boundary',name:'Boundary desk',order:0,createdAt:1,updatedAt:1,revision:1,coverImage:'ws-morning-library',coverFocalPoint:{x:52,y:42},widgets:Array.from({length:24},(_,i)=>({id:'w'+i,type:'quickNotes',config:{mode:'scratchpad'}})),layouts:{lg:[]}};
  await assertSucceeds(setDoc(ref,dashboard));
  await assertFails(setDoc(ref,{...dashboard,name:'Stale write'}));
  await assertSucceeds(setDoc(ref,{...dashboard,name:'Next revision',revision:2}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,widgets:[...dashboard.widgets,{id:'overflow',type:'taskList',config:{}}]}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,widgets:[{id:'bad',type:'script',config:{}}]}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,layouts:{lg:[],sm:[]}}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,coverFocalPoint:{x:101,y:50}}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,coverFocalPoint:{x:50,y:'center'}}));
  await assertFails(getDoc(doc(env.authenticatedContext('b').firestore(),'users/a/dashboards/boundary')));
});

test('tasks with reminders and workBlocks and projects with areaId pass schema validation', async () => {
  const db = env.authenticatedContext('a').firestore();
  const taskRef = doc(db, 'users/a/tasks/t_rem');
  const validTaskWithReminders = {
    ...task,
    id: 't_rem',
    reminders: [
      {
        id: 'rem1',
        taskId: 't_rem',
        remindAt: 1700000000000,
        channel: 'browser_notification',
        status: 'scheduled',
        createdAt: 1700000000000,
      },
    ],
    workBlocks: [
      {
        id: 'wb1',
        taskId: 't_rem',
        date: '2026-10-25',
        durationMinutes: 45,
      },
    ],
  };
  await assertSucceeds(setDoc(taskRef, validTaskWithReminders));

  // Over limit reminders (>50) fails
  const overReminders = {
    ...validTaskWithReminders,
    revision: 2,
    reminders: Array(51).fill({ id: 'rem', taskId: 't_rem', remindAt: 1, channel: 'sound', status: 'scheduled', createdAt: 1 }),
  };
  await assertFails(setDoc(taskRef, overReminders));

  // Over limit workBlocks (>100) fails
  const overWorkBlocks = {
    ...validTaskWithReminders,
    revision: 2,
    workBlocks: Array(101).fill({ id: 'wb', taskId: 't_rem', date: '2026-10-25', durationMinutes: 30 }),
  };
  await assertFails(setDoc(taskRef, overWorkBlocks));

  // Project with areaId succeeds
  const projRef = doc(db, 'users/a/projects/p_area');
  const validProj = { id: 'p_area', name: 'Work Project', color: '#10b981', areaId: 'area-work-123', revision: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(projRef, validProj));

  // Project with areaId exceeding 200 chars fails
  const overAreaIdProj = { ...validProj, id: 'p_area2', areaId: 'x'.repeat(201) };
  await assertFails(setDoc(doc(db, 'users/a/projects/p_area2'), overAreaIdProj));
});

test('tasks support deferUntil, areaId, goalId, cognitiveLoad, isLifeAdmin and dependencies under rules allowlist', async () => {
  const db = env.authenticatedContext('a').firestore();
  const taskRef = doc(db, 'users/a/tasks/t_full');
  const fullTask = {
    ...task,
    id: 't_full',
    deferUntil: '2026-11-01',
    areaId: 'area-1',
    goalId: 'goal-1',
    cognitiveLoad: 'deep_work',
    isLifeAdmin: false,
    cleanSlateQuarantinedAt: 1700000000000,
    predecessorTaskId: 't_prev',
    revision: 1,
    updatedAt: 1,
  };
  await assertSucceeds(setDoc(taskRef, fullTask));

  // Invalid cognitiveLoad fails
  await assertFails(setDoc(taskRef, { ...fullTask, revision: 2, cognitiveLoad: 'extreme' }));
  // Other user cannot read
  const otherDb = env.authenticatedContext('b').firestore();
  await assertFails(getDoc(doc(otherDb, 'users/a/tasks/t_full')));
});

test('canonical collections (areas, goals, routines, routineRuns, workBlocks, reviews) enforce ownership and valid schema', async () => {
  const db = env.authenticatedContext('a').firestore();
  const otherDb = env.authenticatedContext('b').firestore();

  // Area
  const areaRef = doc(db, 'users/a/areas/area1');
  const areaData = { id: 'area1', name: 'Health', sortOrder: 0, revision: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(areaRef, areaData));
  await assertFails(getDoc(doc(otherDb, 'users/a/areas/area1')));

  // Goal
  const goalRef = doc(db, 'users/a/goals/goal1');
  const goalData = { id: 'goal1', title: 'Marathon', projectIds: ['p1'], status: 'in_progress', revision: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(goalRef, goalData));
  await assertFails(setDoc(goalRef, { ...goalData, status: 'invalid_status' }));

  // Routine & RoutineRun
  const routineRef = doc(db, 'users/a/routines/rout1');
  const routineData = { id: 'rout1', title: 'Morning', cadence: 'morning', steps: [{ id: 's1', title: 'Water' }], revision: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(routineRef, routineData));

  const runRef = doc(db, 'users/a/routineRuns/run1');
  const runData = { id: 'run1', routineId: 'rout1', startedAt: 100, completedAt: 200, completedStepsCount: 1, totalStepsCount: 1, totalDurationSeconds: 100, revision: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(runRef, runData));

  // WorkBlock
  const wbRef = doc(db, 'users/a/workBlocks/wb1');
  const wbData = { id: 'wb1', taskId: 't', startInstant: 1000, endInstant: 2000, timezone: 'UTC', status: 'scheduled', durationMinutes: 16, revision: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(wbRef, wbData));

  // Review
  const revRef = doc(db, 'users/a/reviews/rev1');
  const revData = { id: 'rev1', periodStart: '2026-10-19', periodEnd: '2026-10-25', reviewedAt: 1000, reflection: 'Great week', nextPriorities: ['p1'], completedTasksCount: 5, totalEstimatedMinutes: 120, totalFocusSeconds: 6000, revision: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(revRef, revData));
});
