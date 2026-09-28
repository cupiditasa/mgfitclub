import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleDeviceVerification,deviceStatesForUsers} from '../device-verification.js';
const digest=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const p of ['schema.sql','migrations/001-runtime.sql','migrations/003-club-access.sql','migrations/006-device-verification.sql'])sql.exec(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
 sql.exec(`INSERT INTO users(id,phone,full_name,role) VALUES ('support','09120000000','Support','admin'),('alice','09120000001','Alice','athlete'),('bob','09120000002','Bob','athlete'),('secretary','09120000003','Secretary','athlete'),('coach','09120000004','Coach','coach'),('manager',NULL,'Shared club','manager'),('other_manager',NULL,'Other club','manager');
 INSERT INTO clubs(id,name,manager_name,manager_user_id,created_by) VALUES ('club','Club A','Shared','manager','support'),('other_club','Club B','Shared','other_manager','support');
 INSERT INTO account_access(user_id,role,club_id,state) VALUES ('support','support',NULL,'approved'),('alice','athlete','club','approved'),('bob','athlete','other_club','approved'),('secretary','secretary','club','approved'),('coach','coach','club','approved'),('manager','manager','club','approved'),('other_manager','manager','other_club','approved');`);
 const DB={prepare(q){return {args:[],bind(...args){this.args=args;return this},first(){return sql.prepare(q).get(...this.args)||null},all(){return {results:sql.prepare(q).all(...this.args)}},run(){return {meta:{changes:Number(sql.prepare(q).run(...this.args).changes)}}}}},batch(items){sql.exec('BEGIN');try{const r=items.map(i=>i.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB,DEVICE_VERIFICATION_ENABLED:'true'};
 const user=id=>sql.prepare('SELECT u.*,a.role AS effective_role,a.state AS access_state,a.club_id FROM users u JOIN account_access a ON a.user_id=u.id WHERE u.id=?').get(id)||null;
 const hasRole=(u,...roles)=>!!u&&roles.includes(u.effective_role||u.role);
 async function call(path,{who='alice',body,method=body===undefined?'GET':'POST',token}={}){
  const req=new Request('https://example.test/api/device-verification'+path,{method,headers:token?{authorization:'Bearer '+token}:{},body:body===undefined?undefined:JSON.stringify(body)});
  const response=(v,status=200)=>new Response(JSON.stringify(v),{status});
  try {const r=await handleDeviceVerification(req,env,{path:new URL(req.url).pathname,headers:{},response,errorResponse:(error,s)=>response({error},s),jsonBody:r=>r.json(),hash:digest,currentUser:()=>user(who),userById:(_,id)=>user(id),hasRole,makeId:p=>p+'_'+crypto.randomUUID(),token:()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')});return {status:r.status,data:await r.json()}}catch(e){if(!e.status)throw e;return {status:e.status,data:{error:e.message}}}
 }
 return {sql,env,user,hasRole,call};
}
async function ready(f,who='alice',serial='DEVICE1',clubId='club'){
 const issued=await f.call('/bridges',{who:'support',body:{clubId,deviceSerial:serial}});assert.equal(issued.status,201);
 const token=issued.data.bridgeToken;
 const request=await f.call('/request',{who,body:{clubId,consent:true}});assert.equal(request.status,200);
 const id=request.data.registration.id;
 const claim=await f.call('/bridge/'+id+'/claim',{token,body:{}});assert.equal(claim.status,200);
 const body={challenge:claim.data.challenge,deviceSerial:serial,memberId:'007',identityConfirmed:true,observedBiometric:true,deviceWallTime:new Date(Math.ceil(Date.now()/1000)*1000+210*60000).toISOString().slice(0,19),verificationCode:15,punchCode:0,workCode:0};
 return {token,id,body,claim:claim.data,bridgeId:issued.data.bridgeId};
}
test('device feature is disabled without touching DB',async()=>{const f=fixture();f.env.DEVICE_VERIFICATION_ENABLED='false';f.env.DB=null;assert.equal((await f.call('/me')).status,503)});
test('request requires login, approval, consent and real club; shared manager cannot enroll',async()=>{
 const f=fixture();assert.equal((await f.call('/me',{who:'missing'})).status,401);
 assert.equal((await f.call('/request',{body:{clubId:'club'}})).status,400);
 assert.equal((await f.call('/request',{body:{clubId:'missing',consent:true}})).status,404);
 assert.equal((await f.call('/request',{who:'manager',body:{clubId:'club',consent:true}})).status,409);
 f.sql.exec("UPDATE account_access SET state='pending' WHERE user_id='coach'");assert.equal((await f.call('/me',{who:'coach'})).status,403);
 for(const who of ['alice','secretary','support'])assert.equal((await f.call('/request',{who,body:{clubId:'club',consent:true}})).status,200);
});
test('request retry remains one pending request and self query does not leak other users',async()=>{
 const f=fixture();for(let i=0;i<3;i++)assert.equal((await f.call('/request',{body:{clubId:'club',consent:true}})).status,200);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM device_registrations').get().n,1);
 assert.equal((await f.call('/me',{who:'bob'})).data.registrations.length,0);
 assert.equal((await f.call('/me')).data.registrations[0].state,'pending');
});
test('bridge keys are scoped, hashed, support-only and revocable',async()=>{
 const f=fixture(),r=await ready(f);
 assert.equal((await f.call('/bridges',{who:'manager',body:{clubId:'club',deviceSerial:'OTHER'}})).status,403);
 assert.notEqual(f.sql.prepare('SELECT token_hash FROM device_verification_bridges').get().token_hash,r.token);
 assert.equal((await f.call('/bridges',{who:'support',body:{clubId:'other_club',deviceSerial:'DEVICE1'}})).status,409);
 assert.equal((await f.call('/bridge/pending',{token:r.token})).data.requests.length,1);
 await f.call('/bridges/'+r.bridgeId+'/revoke',{who:'support',body:{}});
 assert.equal((await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body})).status,401);
});
test('fresh device observation and explicit human confirmations are mandatory',async()=>{
 const f=fixture(),r=await ready(f);
 for(const body of [{...r.body,challenge:'a'.repeat(64)},{...r.body,identityConfirmed:false},{...r.body,observedBiometric:false},{...r.body,deviceSerial:'OTHER'},{...r.body,deviceWallTime:'2020-01-01T00:00:00'},{...r.body,deviceWallTime:'2026-02-30T12:00:00'}])assert.ok((await f.call('/bridge/'+r.id+'/complete',{token:r.token,body})).status>=400);
 assert.equal((await f.call('/me')).data.registrations[0].state,'pending');
 assert.equal((await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body})).status,200);
 assert.equal((await f.call('/me')).data.registrations[0].state,'verified');
 const retry=await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body});assert.equal(retry.data.duplicate,true);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM payments').get().n,0);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM entry_requests').get().n,0);
});
test('same device member cannot be linked to two accounts',async()=>{
 const f=fixture(),a=await ready(f);await f.call('/bridge/'+a.id+'/complete',{token:a.token,body:a.body});
 const b=await ready(f,'bob');assert.equal((await f.call('/bridge/'+b.id+'/complete',{token:b.token,body:b.body})).status,409);
 assert.equal((await f.call('/me',{who:'bob'})).data.registrations[0].state,'pending');
});
test('claim ownership and expiry prevent other bridge and stale confirmations',async()=>{
 const f=fixture(),r=await ready(f),other=await f.call('/bridges',{who:'support',body:{clubId:'club',deviceSerial:'DEVICE1'}});
 assert.equal((await f.call('/bridge/'+r.id+'/claim',{token:other.data.bridgeToken,body:{}})).status,409);
 assert.equal((await f.call('/bridge/'+r.id+'/complete',{token:other.data.bridgeToken,body:r.body})).status,403);
 f.sql.exec("UPDATE device_registrations SET claim_expires_at='2020-01-01T00:00:00.000Z'");
 assert.equal((await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body})).status,400);
});
test('secretary/manager see their club only; support sees unregistered users too',async()=>{
 const f=fixture(),r=await ready(f);await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body});
 const own=(await f.call('/roster',{who:'secretary'})).data.users;
 assert.equal(own.find(u=>u.id==='alice').device_state,'verified');assert.ok(!own.some(u=>u.id==='bob'));
 assert.ok(!(await f.call('/roster',{who:'other_manager'})).data.users.some(u=>u.id==='alice'));
 assert.ok((await f.call('/roster',{who:'support'})).data.users.some(u=>u.id==='bob'&&u.device_state==='unregistered'));
 assert.equal((await f.call('/roster',{who:'alice'})).status,403);
});
test('reset clears mapping, invalidates claim, permits re-request and is club-scoped',async()=>{
 const f=fixture(),r=await ready(f);await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body});
 const path='/registrations/'+r.id+'/reset';
 assert.equal((await f.call(path,{who:'other_manager',body:{reason:'cancelled'}})).status,404);
 assert.equal((await f.call(path,{who:'alice',body:{reason:'cancelled'}})).status,403);
 assert.equal((await f.call(path,{who:'secretary',body:{reason:'reenrollment_required'}})).status,200);
 assert.equal((await f.call('/me')).data.registrations[0].state,'unregistered');
 assert.equal((await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body})).status,403);
 assert.equal((await f.call('/request',{body:{clubId:'club',consent:true}})).data.registration.state,'pending');
});
test('blocked target cannot be verified and admin list status respects club scope',async()=>{
 const f=fixture(),r=await ready(f);f.sql.exec("UPDATE users SET status='blocked' WHERE id='alice'");
 assert.equal((await f.call('/bridge/'+r.id+'/complete',{token:r.token,body:r.body})).status,409);
 const users=[{id:'alice'}];
 assert.equal((await deviceStatesForUsers(f.env,f.user('manager'),f.hasRole,users))[0].device_registrations.length,1);
 assert.equal((await deviceStatesForUsers(f.env,f.user('other_manager'),f.hasRole,users))[0].device_registrations.length,0);
});
test('bridge cannot see other club requests and deactivated issuer disables credentials',async()=>{
 const f=fixture(),r=await ready(f);
 const other=await f.call('/bridges',{who:'support',body:{clubId:'other_club',deviceSerial:'DEVICE2'}});
 assert.equal((await f.call('/bridge/pending',{token:other.data.bridgeToken})).data.requests.length,0);
 assert.equal((await f.call('/bridge/'+r.id+'/claim',{token:other.data.bridgeToken,body:{}})).status,404);
 f.sql.exec("UPDATE users SET status='blocked' WHERE id='support'");
 assert.equal((await f.call('/bridge/config',{token:r.token})).status,403);
});
test('own-club unregistered users remain listed without leaking their other club mapping',async()=>{
 const f=fixture();await ready(f,'alice','DEVICE2','other_club');
 const own=(await f.call('/roster',{who:'manager'})).data.users.find(u=>u.id==='alice');
 assert.equal(own.device_state,'unregistered');assert.equal(own.club_name,'Club A');assert.equal(own.registration_id,null);
});
