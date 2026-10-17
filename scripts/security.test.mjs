import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../api/account/delete.mjs';
import worker from '../workers/calendar-proxy.js';

function harness(overrides={}) {
  const events=[]; const auth={verifyIdToken:async()=>({uid:'owner',auth_time:1000,exp:4600}),deleteUser:async()=>events.push('auth-deleted')};
  const root={set:async value=>{events.push(value.deletionPending?'barrier':'write');},listCollections:async()=>['tasks','focusLogs','recipes']};
  const database={doc:path=>{assert.equal(path,'users/owner');return root;},recursiveDelete:async col=>events.push(col)};
  const res={code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  const request={method:'POST',headers:{origin:'https://flow.test',authorization:'Bearer token'},body:{confirmation:'DELETE'}};
  return {auth,database,res,request,events,handler:createDeleteAccountHandler({auth,database,origin:'https://flow.test',now:()=>1000000,...overrides})};
}
test('account deletion checks origin, confirmation, authentication and recent re-authentication',async()=>{
  for(const change of [r=>r.method='GET',r=>r.headers.origin='https://bad.test',r=>r.body.confirmation='no',r=>delete r.headers.authorization]){
    const h=harness();change(h.request);await h.handler(h.request,h.res);assert.ok(h.res.code>=400);assert.equal(h.events.length,0);
  }
  const h=harness({auth:{verifyIdToken:async()=>({uid:'owner',auth_time:1})}});await h.handler(h.request,h.res);assert.equal(h.res.code,401);
});
test('all cloud collections are deleted before identity, with a token write barrier',async()=>{
  const h=harness();await h.handler(h.request,h.res);assert.equal(h.res.code,200);assert.deepEqual(h.events,['barrier','tasks','focusLogs','recipes','barrier','auth-deleted']);
});
test('partial cloud deletion remains retryable and does not remove authentication',async()=>{
  const h=harness();h.database.recursiveDelete=async()=>{throw Error('temporary');};await h.handler(h.request,h.res);assert.equal(h.res.code,503);assert.deepEqual(h.events,['barrier']);
});
const env={ALLOWED_ORIGINS:'https://flow.test'};
const request=(url,origin='https://flow.test')=>new Request('https://proxy.test',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({url})});
test('calendar proxy rejects other origins, private hosts, credentials and insecure ports',async()=>{
  assert.equal((await worker.fetch(request('https://calendar.google.com/a','https://bad.test'),env)).status,403);
  for(const url of ['http://calendar.google.com/a','https://127.0.0.1/a','https://calendar.google.com.evil.test/a','https://x:y@calendar.google.com/a','https://calendar.google.com:8080/a']) assert.equal((await worker.fetch(request(url),env)).status,400);
});
test('private calendar URL stays in a POST body and response is never cacheable',async()=>{
  const saved=global.fetch;let called;
  global.fetch=async(url,options)=>{called={url,options};return new Response('BEGIN:VCALENDAR\nEND:VCALENDAR');};
  try { const response=await worker.fetch(request('https://calendar.google.com/private/secret.ics'),env);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(called.options.redirect,'error');assert.equal(called.url,'https://calendar.google.com/private/secret.ics'); }
  finally {global.fetch=saved;}
});
test('calendar provider response is bounded and malformed content is rejected',async()=>{
  const saved=global.fetch;
  try {global.fetch=async()=>new Response('x'.repeat(2*1024*1024+1));assert.equal((await worker.fetch(request('https://calendar.google.com/a'),env)).status,413);global.fetch=async()=>new Response('<html>login</html>');assert.equal((await worker.fetch(request('https://calendar.google.com/a'),env)).status,422);}
  finally {global.fetch=saved;}
});
