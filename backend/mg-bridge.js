// One station, one credential. Device observations are NOT automatic admission proof.
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{status});};
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
export function privateAddress(x){
 if(typeof x!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(x))return false;
 const p=x.split('.').map(Number);return p.every(n=>n<=255)&&(p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168));
}
export function normalizeBridgeEvent(e,bridge,now=Date.now()){
 if(!e||!validId(e.memberId)||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(e.wallTime||''))fail('invalid_event');
 const ms=Date.parse(e.wallTime+'+03:30');
 if(!Number.isFinite(ms)||new Date(ms+210*60000).toISOString().slice(0,19)!==e.wallTime||ms>now+60000||ms<Date.parse(bridge.capture_since))fail('event_clock_or_history');
 for(const k of ['verify','punch','work'])if(!Number.isInteger(e[k])||e[k]<0||e[k]>65535)fail('invalid_event');
 return {memberId:e.memberId,at:new Date(ms).toISOString(),day:e.wallTime.slice(0,10),raw:JSON.stringify([e.verify,e.punch,e.work])};
}
export async function handleMgBridge(request,env,c){
 const {path,response,errorResponse,headers,jsonBody,hash,currentUser,userById,hasRole,makeId,normalizePhone}=c;
 if(!path.startsWith('/api/mg-bridge/'))return null;
 if(env.MG_BRIDGE_ENABLED!=='true')return errorResponse('mg_bridge_disabled',503,headers);
 const db=env.DB,now=new Date().toISOString(),out=(x,s=200)=>response(x,s,headers);
 const audit=(actor,action,id,meta={})=>db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'mg_bridge',?,?)").bind(makeId('audit'),actor,action,id,JSON.stringify(meta));
 const active=u=>u?.status==='active'&&u.access_state==='approved';
 const snapshot=async b=>{
  const rows=(await db.prepare('SELECT m.member_id,m.user_id,t.id AS trial_id,t.starts_at,t.expires_at,t.sessions,(SELECT count(*) FROM mg_bridge_visits v WHERE v.trial_id=t.id) AS used FROM mg_bridge_members m LEFT JOIN mg_bridge_trials t ON t.bridge_id=m.bridge_id AND t.user_id=m.user_id WHERE m.bridge_id=?').bind(b.id).all()).results;
  const members=[];
  for(const r of rows){const u=await userById(env,r.user_id);const membership=await db.prepare("SELECT s.id,p.title AS plan_title,s.starts_at,s.expires_at,s.sessions_total,(SELECT count(*) FROM membership_visits v WHERE v.membership_id=s.id) AS sessions_used FROM memberships s JOIN membership_plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.club_id=? AND s.status='active' AND julianday(s.starts_at)<=julianday('now') AND julianday(s.expires_at)>julianday('now') ORDER BY s.expires_at LIMIT 1").bind(r.user_id,b.club_id).first();members.push({...r,active:active(u),name:u?.full_name||'',role:u?.effective_role||u?.role,membership:membership?{...membership,sessions_remaining:Math.max(0,membership.sessions_total-membership.sessions_used)}:null});}
  const days=(await db.prepare('SELECT t.user_id,v.business_day FROM mg_bridge_visits v JOIN mg_bridge_trials t ON t.id=v.trial_id WHERE t.bridge_id=? AND v.business_day>=?').bind(b.id,new Date(Date.now()-35*86400000).toISOString().slice(0,10)).all()).results;
  return {bridgeId:b.id,serial:b.serial,address:b.address,captureSince:b.capture_since,serverTime:now,cacheExpiresAt:new Date(Date.now()+24*3600000).toISOString(),members,days,mode:'operator_review'};
 };
 if(path==='/api/mg-bridge/agent/sync'&&request.method==='POST'){
  const secret=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!/^[a-f0-9]{64}$/.test(secret))fail('invalid_bridge_token',401);
  const digest=await hash(secret),code=digest.slice(0,16).toUpperCase();
  let b=await db.prepare('SELECT * FROM mg_bridges WHERE pairing_code=? AND revoked_at IS NULL').bind(code).first();
  if(!b||b.token_hash&&b.token_hash!==digest||!b.token_hash&&b.pairing_expires<now)fail('bridge_not_paired',401);
  const issuer=await userById(env,b.created_by);if(!active(issuer)||!hasRole(issuer,'support'))fail('bridge_revoked',403);
  if(!b.token_hash)await db.prepare('UPDATE mg_bridges SET token_hash=? WHERE id=? AND token_hash IS NULL').bind(digest,b.id).run();
  const body=await jsonBody(request,65536);if(!body||!Array.isArray(body.events)||body.events.length>100)fail('invalid_batch');
  const receipts=[];
  for(const raw of body.events){
   // Invalid rows are explicit permanent rejections, not silently acknowledged.
   let e;try{e=normalizeBridgeEvent(raw,b)}catch(err){receipts.push({clientId:raw?.clientId,status:'rejected',reason:err.message});continue;}
   const id=await hash(JSON.stringify([b.serial,e.memberId,e.at,e.raw]));
   await db.prepare("INSERT INTO mg_bridge_events(id,bridge_id,member_id,occurred_at,business_day,raw_json,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING").bind(id,b.id,e.memberId,e.at,e.day,e.raw,now).run();
   receipts.push({clientId:raw.clientId,id,status:'stored'});
  }
  const statuses=['connected','connection_failed','sdk_missing','serial_mismatch','read_failed','timeout','starting','capture_partial','device_busy'];
  await db.prepare('UPDATE mg_bridges SET last_seen=?,device_status=? WHERE id=?').bind(now,statuses.includes(body.deviceStatus)?body.deviceStatus:'starting',b.id).run();
  return out({receipts,snapshot:await snapshot(b)});
 }
 const user=await currentUser(request,env);if(!user)fail('unauthorized',401);if(!active(user))fail('approval_required',403);
 const support=hasRole(user,'support'),staff=hasRole(user,'support','manager','secretary');
 if(path==='/api/mg-bridge/mine'&&request.method==='GET'){
  const trials=(await db.prepare('SELECT t.starts_at,t.expires_at,t.sessions,(SELECT count(*) FROM mg_bridge_visits v WHERE v.trial_id=t.id) AS used,c.name AS club_name FROM mg_bridge_trials t JOIN mg_bridges b ON b.id=t.bridge_id JOIN clubs c ON c.id=b.club_id WHERE t.user_id=?').bind(user.id).all()).results;
  const registrations=(await db.prepare('SELECT m.member_id,m.confirmed_at,c.name AS club_name FROM mg_bridge_members m JOIN mg_bridges b ON b.id=m.bridge_id JOIN clubs c ON c.id=b.club_id WHERE m.user_id=? AND b.revoked_at IS NULL').bind(user.id).all()).results;
  return out({trials,registrations});
 }
 if(!staff)fail('staff_only',403);
 const allowed=async b=>support||!!await db.prepare('SELECT c.id FROM clubs c LEFT JOIN account_access a ON a.club_id=c.id AND a.user_id=? WHERE c.id=? AND (c.manager_user_id=? OR (a.role=\'secretary\' AND a.state=\'approved\'))').bind(user.id,b.club_id,user.id).first();
 if(path==='/api/mg-bridge/stations'&&request.method==='GET'){
  const list=(await db.prepare('SELECT id,club_id,serial,address,last_seen,device_status,revoked_at,token_hash IS NOT NULL AS paired FROM mg_bridges ORDER BY created_at DESC').all()).results;
  const stations=[];for(const b of list)if(await allowed(b))stations.push(b);
  return out({stations,isSupport:support,download:'downloads/MG-Bridge-Web-20261005.zip'});
 }
 if(path==='/api/mg-bridge/pair'&&request.method==='POST'){
  if(!support)fail('support_only',403);const body=await jsonBody(request,2048);
  const code=String(body.code||'').replaceAll('-','').replaceAll(' ','').toUpperCase();
  if(!/^[A-F0-9]{16}$/.test(code)||!validId(body.serial)||!privateAddress(body.address))fail('invalid_pairing');
  if(!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(body.clubId).first())fail('club_not_found',404);
  const id=makeId('station');
  // Replacing a station requires explicit revocation; never overwrite a trusted binding.
  try{await db.batch([db.prepare('INSERT INTO mg_bridges(id,club_id,serial,address,pairing_code,pairing_expires,created_by,created_at,capture_since) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,body.clubId,body.serial,body.address,code,new Date(Date.now()+10*60000).toISOString(),user.id,now,now),audit(user.id,'station_pair_authorized',id)]);}catch{fail('station_or_code_exists',409)}
  return out({id},201);
 }
 const match=path.match(/^\/api\/mg-bridge\/stations\/([A-Za-z0-9_-]+)(?:\/(events|members|map|trial|review|revoke|repair))?$/);if(!match)fail('not_found',404);
 const b=await db.prepare('SELECT * FROM mg_bridges WHERE id=?').bind(match[1]).first();if(!b||!await allowed(b))fail('station_not_found',404);
 const op=match[2];
 if(op==='revoke'&&request.method==='POST'){
  if(!support)fail('support_only',403);await db.batch([db.prepare('UPDATE mg_bridges SET revoked_at=? WHERE id=?').bind(now,b.id),audit(user.id,'station_revoked',b.id)]);return out({ok:true});
 }
 if(op==='repair'&&request.method==='POST'){
  if(!support)fail('support_only',403);const body=await jsonBody(request,1024),code=String(body.code||'').replaceAll('-','').toUpperCase();if(!/^[A-F0-9]{16}$/.test(code)||code===b.pairing_code)fail('new_pairing_code_required');
  await db.batch([db.prepare('UPDATE mg_bridges SET pairing_code=?,pairing_expires=?,token_hash=NULL,revoked_at=NULL,last_seen=NULL WHERE id=?').bind(code,new Date(Date.now()+600000).toISOString(),b.id),audit(user.id,'station_repaired',b.id)]);return out({ok:true});
 }
 if(b.revoked_at)fail('bridge_revoked',409);
 if(op==='events'&&request.method==='GET')return out({events:(await db.prepare('SELECT e.id,e.member_id,e.occurred_at,e.state,u.full_name,u.phone FROM mg_bridge_events e LEFT JOIN mg_bridge_members m ON m.bridge_id=e.bridge_id AND m.member_id=e.member_id LEFT JOIN users u ON u.id=m.user_id WHERE e.bridge_id=? ORDER BY e.occurred_at DESC LIMIT 100').bind(b.id).all()).results});
 if(op==='members'&&request.method==='GET')return out(await snapshot(b));
 if(op==='map'&&request.method==='POST'){
  const body=await jsonBody(request,2048);if(body.confirmed!==true||!validId(body.memberId))fail('identity_confirmation_required');
  const row=await db.prepare('SELECT id FROM users WHERE phone=?').bind(normalizePhone(body.phone)).first(),target=row?await userById(env,row.id):null;
  if(!active(target)||!target.phone||await db.prepare('SELECT id FROM clubs WHERE manager_user_id=?').bind(target.id).first())fail('personal_active_user_required',409);
  if(!await db.prepare('SELECT id FROM mg_bridge_events WHERE bridge_id=? AND member_id=? AND occurred_at>=?').bind(b.id,body.memberId,new Date(Date.now()-10*60000).toISOString()).first())fail('fresh_scan_required',409);
  const existing=await db.prepare('SELECT user_id FROM mg_bridge_members WHERE bridge_id=? AND member_id=?').bind(b.id,body.memberId).first();if(existing?.user_id===target.id)return out({ok:true,duplicate:true});
  try{await db.batch([db.prepare('INSERT INTO mg_bridge_members(bridge_id,member_id,user_id,confirmed_by,confirmed_at) VALUES (?,?,?,?,?)').bind(b.id,body.memberId,target.id,user.id,now),audit(user.id,'station_member_mapped',b.id,{userId:target.id,memberId:body.memberId})]);}catch{fail('member_already_mapped',409)}return out({ok:true});
 }
 if(op==='trial'&&request.method==='POST'){
  if(!support)fail('support_only',403);const body=await jsonBody(request,1024),m=await db.prepare('SELECT user_id FROM mg_bridge_members WHERE bridge_id=? AND member_id=?').bind(b.id,body.memberId).first();const target=m?await userById(env,m.user_id):null;
  if(!active(target)||!hasRole(target,'athlete'))fail('athlete_mapping_required',409);
  if(await db.prepare("SELECT id FROM attendance_trials WHERE user_id=? AND status='active' AND expires_at>?").bind(target.id,now).first())fail('legacy_trial_active',409);
  const id=makeId('mgtrial');await db.batch([db.prepare('INSERT INTO mg_bridge_trials(id,bridge_id,user_id,starts_at,expires_at,sessions,created_by) VALUES (?,?,?,?,?,30,?) ON CONFLICT(bridge_id,user_id) DO NOTHING').bind(id,b.id,target.id,now,new Date(Date.now()+30*86400000).toISOString(),user.id),audit(user.id,'station_trial_requested',b.id,{userId:target.id})]);return out({ok:true});
 }
 if(op==='review'&&request.method==='POST'){
  const body=await jsonBody(request,2048);if(!['approve','reject'].includes(body.decision))fail('invalid_review');
  const e=await db.prepare('SELECT * FROM mg_bridge_events WHERE id=? AND bridge_id=?').bind(body.eventId,b.id).first();if(!e)fail('event_not_found',404);if(e.state!=='pending')return out({ok:true,duplicate:true,state:e.state});
  if(body.decision==='reject'){await db.batch([db.prepare("UPDATE mg_bridge_events SET state='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND state='pending'").bind(user.id,now,e.id),audit(user.id,'station_event_rejected',e.id)]);return out({ok:true});}
  if(body.confirmedAdmission!==true)fail('admission_confirmation_required');
  const m=await db.prepare('SELECT user_id FROM mg_bridge_members WHERE bridge_id=? AND member_id=?').bind(b.id,e.member_id).first(),target=m?await userById(env,m.user_id):null;
  if(!active(target))fail('member_not_active',409);
  const t=await db.prepare('SELECT *,(SELECT count(*) FROM mg_bridge_visits v WHERE v.trial_id=mg_bridge_trials.id) AS used FROM mg_bridge_trials WHERE bridge_id=? AND user_id=?').bind(b.id,m.user_id).first();
  const trialWithinPeriod=!!t&&e.occurred_at>=t.starts_at&&e.occurred_at<t.expires_at;
  const priorTrialVisit=trialWithinPeriod&&await db.prepare('SELECT 1 AS ok FROM mg_bridge_visits WHERE trial_id=? AND business_day=?').bind(t.id,e.business_day).first();
  const useTrial=trialWithinPeriod&&t.used<t.sessions;
  const membership=hasRole(target,'athlete')&&!useTrial?await db.prepare("SELECT s.*,(SELECT count(*) FROM membership_visits v WHERE v.membership_id=s.id) AS used FROM memberships s WHERE s.user_id=? AND s.club_id=? AND s.status='active' AND s.starts_at<=? AND s.expires_at>? AND (SELECT count(*) FROM membership_visits v WHERE v.membership_id=s.id)<s.sessions_total AND NOT EXISTS(SELECT 1 FROM membership_visits v WHERE v.membership_id=s.id AND v.business_day=?) ORDER BY s.expires_at LIMIT 1").bind(m.user_id,b.club_id,e.occurred_at,e.occurred_at,e.business_day).first():null;
  // Staff attendance is recorded, never billed as an athlete membership.
  const statements=[db.prepare("UPDATE mg_bridge_events SET state='approved',reviewed_by=?,reviewed_at=? WHERE id=? AND state='pending'").bind(user.id,now,e.id)];
  if(hasRole(target,'athlete')){
   if(useTrial){if(!priorTrialVisit)statements.push(db.prepare("INSERT INTO mg_bridge_visits(id,trial_id,event_id,business_day,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM mg_bridge_events WHERE id=? AND state='approved' AND reviewed_by=? AND reviewed_at=?) AND NOT EXISTS(SELECT 1 FROM mg_bridge_visits WHERE trial_id=? AND business_day=?) ON CONFLICT DO NOTHING").bind(makeId('visit'),t.id,e.id,e.business_day,now,e.id,user.id,now,t.id,e.business_day));}
   else if(membership)statements.push(db.prepare("INSERT INTO membership_visits(id,membership_id,event_id,business_day,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mg_bridge_events WHERE id=? AND state='approved' AND reviewed_by=? AND reviewed_at=?) ON CONFLICT DO NOTHING").bind(makeId('membervisit'),membership.id,e.id,e.business_day,now,e.id,user.id,now));
   else if(t&&t.used>=t.sessions)fail('sessions_exhausted_or_conflict',409);
   else if(t)fail('no_valid_trial',409);
   else if(await db.prepare("SELECT 1 AS exhausted FROM memberships s WHERE s.user_id=? AND s.club_id=? AND s.status='active' AND s.starts_at<=? AND s.expires_at>? AND s.sessions_total<=(SELECT count(*) FROM membership_visits v WHERE v.membership_id=s.id) LIMIT 1").bind(m.user_id,b.club_id,e.occurred_at,e.occurred_at).first())fail('sessions_exhausted_or_conflict',409);
   else fail('no_valid_membership_or_trial',409);
  }
  statements.push(audit(user.id,'station_event_approved',e.id));try{await db.batch(statements)}catch{fail('sessions_exhausted_or_conflict',409)}
  return out({ok:true,mode:'operator_review'});
 }
 fail('not_found',404);
}
