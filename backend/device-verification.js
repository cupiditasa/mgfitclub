// Staff-attested identity mapping using a fresh device observation. Not biometric enrollment.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const cleanId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
export async function deviceStatesForUsers(env,user,hasRole,users) {
  if(env.DEVICE_VERIFICATION_ENABLED!=='true') return users.map(u=>({...u,device_registrations:null}));
  if(!users.length)return users;
  const rows=await env.DB.prepare(`SELECT r.user_id,r.state,c.name AS club_name FROM device_registrations r JOIN clubs c ON c.id=r.club_id
    WHERE r.user_id IN (${users.map(()=>'?').join(',')}) AND (?=1 OR c.manager_user_id=?)`).bind(...users.map(u=>u.id),hasRole(user,'support')?1:0,user.id).all();
  return users.map(u=>({...u,device_registrations:rows.results.filter(r=>r.user_id===u.id).map(r=>({state:r.state,clubName:r.club_name}))}));
}
export function validateDeviceObservation(body,claim,serial,now=Date.now()) {
  if(body?.identityConfirmed!==true || body?.observedBiometric!==true) fail('identity_confirmation_required');
  if(body.deviceSerial!==serial || !cleanId(body.memberId)) fail('device_member_invalid');
  if(!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(body.deviceWallTime||'')) fail('device_time_invalid');
  const at=Date.parse(body.deviceWallTime+'+03:30');
  if(!Number.isFinite(at)||new Date(at+210*60000).toISOString().slice(0,19)!==body.deviceWallTime ||
    at<Date.parse(claim.claim_started_at) || at>Date.parse(claim.claim_expires_at) || at>now+60000 || now>=Date.parse(claim.claim_expires_at)) fail('fresh_device_observation_required');
  for(const key of ['verificationCode','punchCode','workCode']) if(!Number.isInteger(body[key])||body[key]<0||body[key]>65535) fail('invalid_device_code');
  return JSON.stringify([serial,body.memberId,body.deviceWallTime,body.verificationCode,body.punchCode,body.workCode]);
}
export async function handleDeviceVerification(request,env,c) {
  const {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,makeId,token}=c;
  if(!path.startsWith('/api/device-verification')) return null;
  if(env.DEVICE_VERIFICATION_ENABLED!=='true') return errorResponse('device_verification_disabled',503,headers);
  const db=env.DB,now=()=>new Date().toISOString();
  const output=r=>({id:r.id,userId:r.user_id,clubId:r.club_id,clubName:r.club_name,state:r.state,deviceSerial:r.device_serial,memberId:r.member_id,requestedAt:r.requested_at,verifiedAt:r.verified_at,lastError:r.last_error});
  const audit=(actor,action,id,metadata={})=>db.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,\'device_registration\',?,?)').bind(makeId('audit'),actor,action,id,JSON.stringify(metadata));
  const personal=async u=>u&&u.status==='active'&&u.access_state==='approved'&&!!u.phone&&!await db.prepare('SELECT id FROM clubs WHERE manager_user_id=?').bind(u.id).first();
  if(path.startsWith('/api/device-verification/bridge/')) {
    const raw=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    if(!/^[a-f0-9]{64}$/.test(raw)) fail('invalid_bridge_token',401);
    const b=await db.prepare('SELECT b.*,d.club_id,c.name AS club_name FROM device_verification_bridges b JOIN device_registry d ON d.serial=b.device_serial JOIN clubs c ON c.id=d.club_id WHERE b.token_hash=? AND b.revoked_at IS NULL AND b.expires_at>?').bind(await hash(raw),now()).first();
    if(!b) fail('invalid_bridge_token',401);
    const issuer=await userById(env,b.created_by);
    if(!issuer||issuer.status!=='active'||issuer.access_state!=='approved'||!hasRole(issuer,'support')) fail('bridge_issuer_inactive',403);
    if(path.endsWith('/config')&&request.method==='GET') return response({bridgeId:b.id,clubId:b.club_id,clubName:b.club_name,deviceSerial:b.device_serial,expiresAt:b.expires_at},200,headers);
    if(path.endsWith('/pending')&&request.method==='GET') {
      const rows=await db.prepare("SELECT r.id,r.user_id,r.requested_at,u.full_name,u.phone FROM device_registrations r JOIN users u ON u.id=r.user_id WHERE r.club_id=? AND r.state='pending' AND u.status='active' ORDER BY r.requested_at LIMIT 100").bind(b.club_id).all();
      return response({requests:rows.results},200,headers);
    }
    const m=path.match(/^\/api\/device-verification\/bridge\/([A-Za-z0-9_-]+)\/(claim|complete)$/);
    if(!m||request.method!=='POST') return errorResponse('not_found',404,headers);
    const r=await db.prepare('SELECT * FROM device_registrations WHERE id=? AND club_id=?').bind(m[1],b.club_id).first();
    if(!r) fail('request_not_found',404);
    if(!await personal(await userById(env,r.user_id))) fail('personal_account_required',409);
    if(m[2]==='claim') {
      if(r.state!=='pending') fail('request_not_pending',409);
      const secret=token(),started=now(),expires=new Date(Date.now()+15*60000).toISOString();
      const result=await db.prepare("UPDATE device_registrations SET claim_hash=?,claim_bridge_id=?,claim_started_at=?,claim_expires_at=?,last_error=NULL WHERE id=? AND state='pending' AND (claim_expires_at IS NULL OR claim_expires_at<=?)").bind(await hash(secret),b.id,started,expires,r.id,started).run();
      if(result.meta?.changes!==1) fail('request_busy_wait_for_expiry',409);
      return response({requestId:r.id,challenge:secret,startedAt:started,expiresAt:expires,deviceSerial:b.device_serial},200,headers);
    }
    const body=await jsonBody(request,4096);
    if(typeof body.challenge!=='string'||!r.claim_hash||await hash(body.challenge)!==r.claim_hash||r.claim_bridge_id!==b.id) fail('invalid_claim',403);
    if(r.state==='verified') {
      if(r.device_serial!==body.deviceSerial||r.member_id!==body.memberId) fail('mapping_conflict',409);
      return response({ok:true,duplicate:true,registration:output(r)},200,headers);
    }
    if(r.state!=='pending') fail('request_not_pending',409);
    const fingerprint=validateDeviceObservation(body,r,b.device_serial),verified=now(),eventHash=await hash(fingerprint);
    try {
      const changes=await db.batch([
        db.prepare("UPDATE device_registrations SET state='verified',device_serial=?,member_id=?,verified_at=?,updated_at=?,verified_by_bridge=?,event_hash=?,last_error=NULL WHERE id=? AND state='pending' AND claim_hash=? AND claim_bridge_id=? AND claim_expires_at>?").bind(b.device_serial,body.memberId,verified,verified,b.id,eventHash,r.id,r.claim_hash,b.id,verified),
        db.prepare("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) SELECT ?,?,'device_identity_verified','device_registration',?,? WHERE EXISTS (SELECT 1 FROM device_registrations WHERE id=? AND state='verified' AND verified_at=? AND verified_by_bridge=? AND event_hash=?)").bind(makeId('audit'),b.created_by,r.id,JSON.stringify({bridgeId:b.id,verificationMethod:'operator_observed_device_event',notMembershipApproval:true}),r.id,verified,b.id,eventHash)
      ]);
      if(changes[0].meta?.changes!==1) fail('request_changed_retry',409);
    } catch(e) {if(e.status)throw e;fail('device_member_already_linked_or_request_changed',409);}
    return response({ok:true,registration:output(await db.prepare('SELECT * FROM device_registrations WHERE id=?').bind(r.id).first())},200,headers);
  }
  const user=await currentUser(request,env);
  if(!user) fail('unauthorized',401);
  if(user.status!=='active'||user.access_state!=='approved') fail('approval_required',403);
  const support=hasRole(user,'support');
  const staff=hasRole(user,'support','manager','secretary');
  const canClub=async club=>support||!!await db.prepare('SELECT c.id FROM clubs c LEFT JOIN account_access a ON a.user_id=? WHERE c.id=? AND (c.manager_user_id=? OR (a.role=\'secretary\' AND a.state=\'approved\' AND a.club_id=c.id))').bind(user.id,club,user.id).first();
  if(path==='/api/device-verification/me'&&request.method==='GET') {
    const rows=await db.prepare('SELECT r.*,c.name AS club_name FROM device_registrations r JOIN clubs c ON c.id=r.club_id WHERE r.user_id=? ORDER BY r.requested_at DESC').bind(user.id).all();
    const clubs=await db.prepare('SELECT id,name FROM clubs ORDER BY name').all();
    return response({registrations:rows.results.map(output),clubs:clubs.results,canRequest:await personal(user),isStaff:staff,isSupport:support},200,headers);
  }
  if(path==='/api/device-verification/request'&&request.method==='POST') {
    if(!await personal(user)) fail('personal_account_required',409);
    const body=await jsonBody(request,1024);
    if(body.consent!==true||!cleanId(body.clubId)) fail('club_and_consent_required');
    if(!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(body.clubId).first()) fail('club_not_found',404);
    const when=now(),id=makeId('device');
    await db.prepare("INSERT INTO device_registrations (id,user_id,club_id,requested_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,club_id) DO UPDATE SET state='pending',requested_at=excluded.requested_at,updated_at=excluded.updated_at,claim_hash=NULL,claim_bridge_id=NULL,claim_started_at=NULL,claim_expires_at=NULL,last_error=NULL WHERE device_registrations.state='unregistered'").bind(id,user.id,body.clubId,when,when).run();
    const r=await db.prepare('SELECT * FROM device_registrations WHERE user_id=? AND club_id=?').bind(user.id,body.clubId).first();
    return response({ok:true,registration:output(r)},200,headers);
  }
  if(path==='/api/device-verification/roster'&&request.method==='GET') {
    if(!staff) fail('staff_only',403);
    const page=Math.max(1,Math.min(10000,parseInt(new URL(request.url).searchParams.get('page'),10)||1));
    const rows=await db.prepare(`SELECT u.id,u.full_name,u.phone,COALESCE(a.role,ur.role,u.role) AS role,r.id AS registration_id,r.club_id,c.name AS club_name,COALESCE(r.state,'unregistered') AS device_state,r.device_serial,r.member_id,r.verified_at,r.last_error
      FROM users u LEFT JOIN account_access a ON a.user_id=u.id LEFT JOIN user_roles ur ON ur.user_id=u.id
      LEFT JOIN device_registrations r ON r.user_id=u.id AND (?=1 OR EXISTS (SELECT 1 FROM clubs rc WHERE rc.id=r.club_id AND (rc.manager_user_id=? OR (rc.id=? AND ?=1)))) LEFT JOIN clubs c ON c.id=COALESCE(r.club_id,a.club_id)
      WHERE (?=1 OR EXISTS (SELECT 1 FROM clubs scope WHERE scope.id=COALESCE(r.club_id,a.club_id) AND (scope.manager_user_id=? OR (scope.id=? AND ?=1))))
      ORDER BY u.id,r.club_id LIMIT 100 OFFSET ?`).bind(support?1:0,user.id,user.club_id||'',hasRole(user,'secretary')?1:0,support?1:0,user.id,user.club_id||'',hasRole(user,'secretary')?1:0,(page-1)*100).all();
    return response({users:rows.results,page,pageSize:100},200,headers);
  }
  const reset=path.match(/^\/api\/device-verification\/registrations\/([A-Za-z0-9_-]+)\/reset$/);
  if(reset&&request.method==='POST') {
    if(!staff) fail('staff_only',403);
    const r=await db.prepare('SELECT * FROM device_registrations WHERE id=?').bind(reset[1]).first();
    if(!r||!await canClub(r.club_id)) fail('request_not_found',404);
    const body=await jsonBody(request,1024);
    if(!['identity_mismatch','cancelled','reenrollment_required'].includes(body.reason)) fail('invalid_reason');
    await db.batch([
      db.prepare("UPDATE device_registrations SET state='unregistered',device_serial=NULL,member_id=NULL,verified_at=NULL,verified_by_bridge=NULL,event_hash=NULL,claim_hash=NULL,claim_bridge_id=NULL,claim_started_at=NULL,claim_expires_at=NULL,last_error=?,updated_at=? WHERE id=?").bind(body.reason,now(),r.id),
      audit(user.id,'device_identity_reset',r.id,{reason:body.reason})
    ]);
    return response({ok:true},200,headers);
  }
  if(!support) fail('support_only',403);
  if(path==='/api/device-verification/bridges'&&request.method==='GET') {
    const rows=await db.prepare('SELECT b.id,b.device_serial,b.expires_at,b.revoked_at,d.club_id FROM device_verification_bridges b JOIN device_registry d ON d.serial=b.device_serial ORDER BY b.created_at DESC LIMIT 100').all();
    return response({bridges:rows.results},200,headers);
  }
  if(path==='/api/device-verification/bridges'&&request.method==='POST') {
    const body=await jsonBody(request,1024);
    if(!cleanId(body.clubId)||!cleanId(body.deviceSerial)) fail('invalid_bridge_setup');
    if(!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(body.clubId).first()) fail('club_not_found',404);
    const existing=await db.prepare('SELECT club_id FROM device_registry WHERE serial=?').bind(body.deviceSerial).first();
    if(existing&&existing.club_id!==body.clubId) fail('device_belongs_to_another_club',409);
    const id=makeId('bridge'),key=token(),expires=new Date(Date.now()+30*86400000).toISOString();
    try {
      await db.batch([
        db.prepare('INSERT INTO device_registry (serial,club_id) VALUES (?,?) ON CONFLICT DO NOTHING').bind(body.deviceSerial,body.clubId),
        db.prepare('INSERT INTO device_verification_bridges (id,device_serial,token_hash,created_by,expires_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM device_registry WHERE serial=? AND club_id=?)').bind(id,body.deviceSerial,await hash(key),user.id,expires,body.deviceSerial,body.clubId),
        audit(user.id,'device_bridge_issued',id,{clubId:body.clubId,deviceSerial:body.deviceSerial})
      ]);
    } catch {fail('bridge_setup_conflict',409);}
    if(!await db.prepare('SELECT id FROM device_verification_bridges WHERE id=?').bind(id).first()) fail('device_belongs_to_another_club',409);
    return response({bridgeId:id,bridgeToken:key,expiresAt:expires},201,headers);
  }
  const revoke=path.match(/^\/api\/device-verification\/bridges\/([A-Za-z0-9_-]+)\/revoke$/);
  if(revoke&&request.method==='POST') {
    await db.batch([db.prepare('UPDATE device_verification_bridges SET revoked_at=? WHERE id=?').bind(now(),revoke[1]),audit(user.id,'device_bridge_revoked',revoke[1])]);
    return response({ok:true},200,headers);
  }
  return errorResponse('not_found',404,headers);
}
