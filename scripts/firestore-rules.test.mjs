import { test, before, after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-flowtask',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>env.clearFirestore());after(async()=>env?.cleanup());
const task={id:'t',title:'One small thing',status:'todo',priority:'p2',projectId:'inbox',subtasks:[],revision:1,updatedAt:1};
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

test('dashboard validation covers the 24-widget boundary, known types, private mobile layouts and revisions',async()=>{
  const db=env.authenticatedContext('a').firestore(), ref=doc(db,'users/a/dashboards/boundary');
  const dashboard={id:'boundary',name:'Boundary desk',order:0,createdAt:1,updatedAt:1,revision:1,widgets:Array.from({length:24},(_,i)=>({id:'w'+i,type:'quickNotes',config:{mode:'scratchpad'}})),layouts:{lg:[]}};
  await assertSucceeds(setDoc(ref,dashboard));
  await assertFails(setDoc(ref,{...dashboard,name:'Stale write'}));
  await assertSucceeds(setDoc(ref,{...dashboard,name:'Next revision',revision:2}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,widgets:[...dashboard.widgets,{id:'overflow',type:'taskList',config:{}}]}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,widgets:[{id:'bad',type:'script',config:{}}]}));
  await assertFails(setDoc(ref,{...dashboard,revision:3,layouts:{lg:[],sm:[]}}));
  await assertFails(getDoc(doc(env.authenticatedContext('b').firestore(),'users/a/dashboards/boundary')));
});
