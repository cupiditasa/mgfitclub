import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {handleAttendancePilot,normalizeTrialEvent,trialWindow} from '../attendance-pilot.js';
const digest=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['schema.sql','migrations/001-runtime.sql','migrations/003-club-access.sql','migrations/004-attendance-pilot.sql','migrations/005-attendance-review.sql']) sql.exec(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 sql.exec("INSERT INTO users(id,phone,role,status) VALUES ('support','09174922677','admin','active'),('athlete','09120000001','athlete','active'),('other','09120000002','athlete','active'); INSERT INTO clubs(id,name,manager_name,manager_user_id,created_by) VALUES ('club','Test','Test','support','support');");
 const db={prepare(q){return {args:[],bind(...args){this.args=args;return this},first(){return sql.prepare(q).get(...this.args)||null},all(){return {results:sql.prepare(q).all(...this.args)}},run(){const r=sql.prepare(q).run(...this.args);return {meta:{changes:Number(r.changes)}}}}},batch(statements){sql.exec('BEGIN');try{const r=statements.map(s=>s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB:db,ATTENDANCE_PILOT_ENABLED:'true'};
 const call=async (path,{who='support',method='GET',body,token}={})=>{
  const req=new Request('https://example.test/api/attendance-pilot'+path,{method,headers:token?{authorization:'Bearer '+token}:{},body:body?JSON.stringify(body):undefined});
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
  const ctx={path:new URL(req.url).pathname,headers:{},response,errorResponse:(error,status)=>response({error},status),jsonBody:r=>r.json(),hash:digest,currentUser:async()=>who?{id:who,role:who==='support'?'support':who.startsWith('manager')?'manager':'athlete',access_state:'approved',status:'active'}:null,userById:async(_env,id)=>{const u=sql.prepare('SELECT * FROM users WHERE id=?').get(id);return u?{...u,access_state:'approved'}:null},hasRole:(u,...roles)=>roles.includes(u.role),normalizePhone:s=>s,validPhone:s=>/^09\d{9}$/.test(s),makeId:p=>p+'_'+crypto.randomUUID(),token:()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};
  try {const r=await handleAttendancePilot(req,env,ctx);return {status:r.status,...await r.json()}}catch(e){if(!e.status)throw e;return {status:e.status,error:e.message}}
 };
 return {sql,env,call};
}
const grantBody={phone:'09120000001',clubId:'club',deviceSerial:'FAKE6602',deviceMemberId:'007',requestKey:'pilot-12345678'};
const wall=ms=>new Date(ms+210*60000).toISOString().slice(0,19);
function event(ms=Date.now()){return {deviceSerial:'FAKE6602',deviceMemberId:'007',deviceWallTime:wall(ms),verificationCode:15,punchCode:0,workCode:0,confirmedAdmission:true}}
test('pilot is disabled before migration/use unless explicitly enabled',async()=>{const f=setup();f.env.ATTENDANCE_PILOT_ENABLED='false';assert.equal((await f.call('/me')).status,503)});
test('only support grants; no account/payment fabricated',async()=>{
 const f=setup();assert.equal((await f.call('/grant',{who:'athlete',method:'POST',body:grantBody})).status,403);
 assert.equal((await f.call('/grant',{method:'POST',body:{...grantBody,phone:'09120000999'}})).status,409);
 const r=await f.call('/grant',{method:'POST',body:grantBody});assert.equal(r.status,201);assert.equal(r.trial.remainingSessions,30);assert.equal(r.bridgeToken.length,64);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM payments').get().n,0);assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,0);
 assert.notEqual(f.sql.prepare('SELECT token_hash FROM attendance_trials').get().token_hash,r.bridgeToken);
});
test('grant retry is idempotent; conflicting key or mapping does not duplicate',async()=>{
 const f=setup();await f.call('/grant',{method:'POST',body:grantBody});
 assert.equal((await f.call('/grant',{method:'POST',body:grantBody})).duplicate,true);
 assert.equal((await f.call('/grant',{method:'POST',body:{...grantBody,deviceMemberId:'008'}})).status,409);
 assert.equal((await f.call('/grant',{method:'POST',body:{...grantBody,requestKey:'pilot-87654321'}})).status,409);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM attendance_trials').get().n,1);
});
test('athlete only sees their own trial',async()=>{
 const f=setup();await f.call('/grant',{method:'POST',body:grantBody});
 assert.equal((await f.call('/me',{who:'athlete'})).trials.length,1);assert.equal((await f.call('/me',{who:'other'})).trials.length,0);
 assert.equal((await f.call('/me',{who:null})).status,401);
});
test('consume validates binding, confirmation and timestamp before decrement',async()=>{
 const f=setup(),g=await f.call('/grant',{method:'POST',body:grantBody});
 f.sql.exec("UPDATE attendance_trials SET starts_at='2026-01-01T00:00:00.000Z',expires_at='2099-01-01T00:00:00.000Z'");
 for(const invalid of [{...event(),confirmedAdmission:false},{...event(),deviceMemberId:'7'},{...event(),deviceSerial:'OTHER'},{...event(),deviceWallTime:'2026-02-30T12:00:00'},event(Date.now()+86400000)]) {
  const r=await f.call('/bridge/consume',{method:'POST',token:g.bridgeToken,body:invalid});assert.ok(r.status>=400);
 }
 assert.equal(f.sql.prepare('SELECT count(*) n FROM attendance_trial_consumptions').get().n,0);
});
test('retry, competing confirmations and same-day reentry consume only once',async()=>{
 const f=setup(),g=await f.call('/grant',{method:'POST',body:grantBody});
 f.sql.exec("UPDATE attendance_trials SET starts_at='2026-01-01T00:00:00.000Z',expires_at='2099-01-01T00:00:00.000Z'");
 const outcomes=await Promise.all([1,2,3].map(()=>f.call('/bridge/consume',{method:'POST',token:g.bridgeToken,body:event()})));
 for(const r of outcomes){assert.equal(r.status,200);assert.equal(r.trial.remainingSessions,29)}
 const retry=await f.call('/bridge/consume',{method:'POST',token:g.bridgeToken,body:{...event(),verificationCode:1}});assert.equal(retry.duplicate,true);assert.equal(retry.trial.remainingSessions,29);
});
test('revocation and blocked athlete invalidate device token',async()=>{
 const f=setup(),g=await f.call('/grant',{method:'POST',body:grantBody});
 assert.equal((await f.call('/bridge/config',{token:g.bridgeToken})).status,200);
 f.sql.exec("UPDATE users SET status='blocked' WHERE id='athlete'");assert.equal((await f.call('/bridge/config',{token:g.bridgeToken})).status,401);
 f.sql.exec("UPDATE users SET status='active' WHERE id='athlete'");await f.call('/'+g.trial.id+'/revoke',{method:'POST'});
 assert.equal((await f.call('/bridge/config',{token:g.bridgeToken})).status,401);
});
test('token rotation revokes old token; expired pilot stops',async()=>{
 const f=setup(),g=await f.call('/grant',{method:'POST',body:grantBody});
 const r=await f.call('/'+g.trial.id+'/rotate-token',{method:'POST'});assert.equal(r.status,200);
 assert.equal((await f.call('/bridge/config',{token:g.bridgeToken})).status,401);
 assert.equal((await f.call('/bridge/config',{token:r.bridgeToken})).status,200);
 f.sql.exec("UPDATE attendance_trials SET starts_at='2020-01-01T00:00:00.000Z',expires_at='2020-02-01T00:00:00.000Z'");
 assert.equal((await f.call('/bridge/config',{token:r.bridgeToken})).status,403);
});
test('database trigger prevents 31st session even outside API',async()=>{
 const f=setup(),g=await f.call('/grant',{method:'POST',body:grantBody});
 f.sql.exec("UPDATE attendance_trials SET starts_at='2026-01-01T00:00:00.000Z',expires_at='2099-01-01T00:00:00.000Z'");
 const insert=f.sql.prepare("INSERT INTO attendance_trial_consumptions VALUES (?,?,?,?,?,?,'operator_confirmed_device_pilot')");
 for(let i=1;i<=30;i++)insert.run('e'+i,g.trial.id,'h'+i,'2026-01-'+String(i).padStart(2,'0'),'2026-01-01T12:00:00.000Z','2026-01-01T12:00:00.000Z');
 assert.throws(()=>insert.run('extra',g.trial.id,'extra','2026-02-01','2026-02-01T12:00:00.000Z','2026-02-01T12:00:00.000Z'),/trial_inactive_or_exhausted/);
});
test('30-day explicit trial window and zero-preserving IDs',()=>{
 const w=trialWindow(Date.UTC(2026,8,28));assert.equal(Date.parse(w.expiresAt)-Date.parse(w.startsAt),30*86400000);
 const t={device_serial:'FAKE6602',device_member_id:'007',starts_at:'2026-01-01T00:00:00Z',expires_at:'2099-01-01T00:00:00Z'};
 assert.equal(normalizeTrialEvent(event(),t).businessDay,wall(Date.now()).slice(0,10));
});

async function reviewFixture(){
 const f=setup(),g=await f.call('/grant',{method:'POST',body:grantBody});
 f.sql.exec("INSERT INTO users(id,role,status) VALUES ('manager','manager','active'),('manager_other','manager','active'); UPDATE clubs SET manager_user_id='manager'; UPDATE attendance_trials SET starts_at='2026-01-01T00:00:00.000Z',expires_at='2099-01-01T00:00:00.000Z'");
 const body={...event(),confirmedAdmission:false};
 const observation=await f.call('/bridge/observe',{method:'POST',token:g.bridgeToken,body});
 return {...f,g,body,observation};
}
test('raw observation is retry safe and never charges; wrong member denied',async()=>{
 const f=await reviewFixture();assert.equal(f.observation.status,200);assert.equal(f.observation.charged,false);
 const again=await f.call('/bridge/observe',{method:'POST',token:f.g.bridgeToken,body:f.body});assert.equal(again.observationId,f.observation.observationId);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM attendance_trial_consumptions').get().n,0);
 assert.equal((await f.call('/bridge/observe',{method:'POST',token:f.g.bridgeToken,body:{...f.body,deviceMemberId:'008'}})).status,403);
});
test('reviewer access scoped by server club owner; athlete cannot view or approve',async()=>{
 const f=await reviewFixture(),path='/review/'+f.observation.observationId;
 assert.equal((await f.call('/review',{who:'athlete'})).status,403);
 assert.equal((await f.call('/review',{who:'manager_other'})).observations.length,0);
 assert.equal((await f.call('/review',{who:'manager'})).observations.length,1);
 assert.equal((await f.call(path,{who:'manager_other',method:'POST',body:{decision:'approve',confirmedAdmission:true}})).status,404);
 assert.equal((await f.call(path,{who:'athlete',method:'POST',body:{decision:'approve',confirmedAdmission:true}})).status,403);
 assert.equal((await f.call(path,{who:'manager',method:'POST',body:{decision:'approve'}})).status,400);
});
test('manager and support plus local confirmation consume just once',async()=>{
 const f=await reviewFixture(),path='/review/'+f.observation.observationId,body={decision:'approve',confirmedAdmission:true};
 const results=await Promise.all(['support','manager'].map(who=>f.call(path,{who,method:'POST',body})));
 assert.ok(results.every(r=>r.status===200));
 const local=await f.call('/bridge/consume',{method:'POST',token:f.g.bridgeToken,body:{...f.body,confirmedAdmission:true}});
 assert.equal(local.trial.remainingSessions,29);assert.equal(local.duplicate,true);
 assert.equal((await f.call(path,{method:'POST',body})).alreadyReviewed,true);
 assert.equal(f.sql.prepare('SELECT status FROM attendance_trial_observations').get().status,'approved');
});
test('rejected or revoked observations cannot later charge through review',async()=>{
 const f=await reviewFixture(),path='/review/'+f.observation.observationId;
 await f.call(path,{method:'POST',body:{decision:'reject'}});
 const r=await f.call(path,{method:'POST',body:{decision:'approve',confirmedAdmission:true}});assert.equal(r.alreadyReviewed,true);
 const next=await f.call('/bridge/observe',{method:'POST',token:f.g.bridgeToken,body:{...f.body,punchCode:1}});
 await f.call('/'+f.g.trial.id+'/revoke',{method:'POST'});
 assert.equal((await f.call('/review/'+next.observationId,{method:'POST',body:{decision:'approve',confirmedAdmission:true}})).status,409);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM attendance_trial_consumptions').get().n,0);
});
test('two trial accounts and their tokens cannot cross member mappings',async()=>{
 const f=await reviewFixture();
 const other=await f.call('/grant',{method:'POST',body:{...grantBody,phone:'09120000002',deviceMemberId:'008',requestKey:'pilot-other1234'}});
 assert.equal(other.status,201);
 assert.equal((await f.call('/bridge/observe',{method:'POST',token:other.bridgeToken,body:f.body})).status,403);
 assert.equal((await f.call('/me',{who:'other'})).trials[0].remainingSessions,30);
});
