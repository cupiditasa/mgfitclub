// Controlled free trial; never marks an order/payment as paid. Disabled unless explicitly enabled.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const serialOK=s=>typeof s==='string' && /^[A-Za-z0-9_-]{3,80}$/.test(s);
const memberOK=s=>typeof s==='string' && /^[A-Za-z0-9_-]{1,40}$/.test(s);
export function trialWindow(nowMs=Date.now()) {
  return {startsAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+30*86400000).toISOString()};
}
export function normalizeTrialEvent(body,trial,nowMs=Date.now()) {
  if(!body || typeof body!=='object' || Array.isArray(body)) fail('invalid_event');
  if(body.confirmedAdmission!==true) fail('operator_confirmation_required');
  if(body.deviceSerial!==trial.device_serial || body.deviceMemberId!==trial.device_member_id) fail('trial_member_mismatch',403);
  if(typeof body.deviceWallTime!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(body.deviceWallTime)) fail('invalid_device_time');
  // Fixed pilot interpretation: verified contemporary Tehran wall clock; no historical DST guesses.
  const ms=Date.parse(body.deviceWallTime+'+03:30');
  if(!Number.isFinite(ms)||new Date(ms+210*60000).toISOString().slice(0,19)!==body.deviceWallTime) fail('invalid_device_time');
  if(ms<Date.parse(trial.starts_at)||ms>=Date.parse(trial.expires_at)||ms>nowMs+5*60000) fail('event_outside_trial_or_future');
  for(const key of ['verificationCode','punchCode','workCode']) if(!Number.isInteger(body[key])||body[key]<0||body[key]>65535) fail('invalid_device_code');
  return {occurredAt:new Date(ms).toISOString(),businessDay:body.deviceWallTime.slice(0,10),fingerprint:JSON.stringify([trial.device_serial,trial.device_member_id,body.deviceWallTime,body.verificationCode,body.punchCode,body.workCode])};
}
export async function handleAttendancePilot(request,env,ctx) {
  const {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,normalizePhone,validPhone,makeId,token}=ctx;
  if(!path.startsWith('/api/attendance-pilot')) return null;
  if(env.ATTENDANCE_PILOT_ENABLED!=='true') return errorResponse('attendance_pilot_disabled',503,headers);
  const db=env.DB;
  const state=async t=>{
    const count=await db.prepare('SELECT COUNT(*) AS used FROM attendance_trial_consumptions WHERE trial_id=?').bind(t.id).first();
    return {id:t.id,userId:t.user_id,clubId:t.club_id,label:'اشتراک آزمایشی رایگان — ۳۰ روز، ۳۰ جلسه',isTrial:true,startsAt:t.starts_at,expiresAt:t.expires_at,totalSessions:t.total_sessions,usedSessions:count.used,remainingSessions:t.total_sessions-count.used,status:t.status,confirmationMode:'operator',dailyLimit:1};
  };
  const consume=async(trial,body,review=null)=>{
    const event=normalizeTrialEvent(body,trial),eventHash=await hash(event.fingerprint);
    const findReceipt=()=>db.prepare('SELECT id FROM attendance_trial_consumptions WHERE trial_id=? AND (event_hash=? OR business_day=?)').bind(trial.id,eventHash,event.businessDay).first();
    const existing=await findReceipt(),id=makeId('attendance');
    const statements=[],reviewTime=new Date().toISOString();
    if(review) {
      statements.push(db.prepare("UPDATE attendance_trial_observations SET status='approved',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(review.actor,reviewTime,review.id));
    }
    if(!existing) {
      const guard=review?"EXISTS (SELECT 1 FROM attendance_trial_observations WHERE id=? AND status='approved' AND reviewed_by=? AND reviewed_at=?)":'1=1';
      statements.push(db.prepare("INSERT INTO attendance_trial_consumptions (id,trial_id,event_hash,business_day,occurred_at,confirmed_at,source) SELECT ?,?,?,?,?,?,'operator_confirmed_device_pilot' WHERE "+guard+" ON CONFLICT DO NOTHING").bind(id,trial.id,eventHash,event.businessDay,event.occurredAt,reviewTime,...(review?[review.id,review.actor,reviewTime]:[])));
    }
    if(review) statements.push(db.prepare("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) SELECT ?,?,'pilot_arrival_approved','attendance_observation',?,? WHERE EXISTS (SELECT 1 FROM attendance_trial_observations WHERE id=? AND status='approved' AND reviewed_by=? AND reviewed_at=?)").bind(makeId('audit'),review.actor,review.id,JSON.stringify({trialId:trial.id}),review.id,review.actor,reviewTime));
    try {if(statements.length) await db.batch(statements);} catch(e) {
      // Retry a race from scratch, never return success for a rolled-back review.
      if(!review && await findReceipt()) return response({ok:true,duplicate:true,receiptId:(await findReceipt()).id,trial:await state(trial)},200,headers);
      fail('trial_inactive_or_exhausted_retry',409);
    }
    if(review) {
      const outcome=await db.prepare('SELECT status FROM attendance_trial_observations WHERE id=?').bind(review.id).first();
      if(outcome.status!=='approved') return response({ok:true,alreadyReviewed:true,status:outcome.status},200,headers);
    }
    const receipt=await findReceipt();
    if(!receipt) fail('consumption_not_recorded',409);
    return response({ok:true,duplicate:receipt.id!==id,receiptId:receipt.id,trial:await state(trial)},200,headers);
  };
  const user=path.startsWith('/api/attendance-pilot/bridge/')?null:await currentUser(request,env);
  if(path.startsWith('/api/attendance-pilot/bridge/')) {
    const raw=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
    if(!/^[a-f0-9]{64}$/.test(raw)) fail('invalid_bridge_token',401);
    const trial=await db.prepare("SELECT t.* FROM attendance_trials t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.status='active' AND u.status='active'").bind(await hash(raw)).first();
    if(!trial) fail('invalid_bridge_token',401);
    const athlete=await userById(env,trial.user_id);
    if(!athlete||!hasRole(athlete,'athlete')||athlete.access_state!=='approved') fail('trial_athlete_access_changed',403);
    if(Date.now()<Date.parse(trial.starts_at)||Date.now()>=Date.parse(trial.expires_at)) fail('trial_expired_or_not_started',403);
    if(path==='/api/attendance-pilot/bridge/config'&&request.method==='GET')
      return response({trial:await state(trial),deviceSerial:trial.device_serial,deviceMemberId:trial.device_member_id},200,headers);
    if(path==='/api/attendance-pilot/bridge/observe'&&request.method==='POST') {
      const raw=await jsonBody(request,4096);
      const event=normalizeTrialEvent({...raw,confirmedAdmission:true},trial),eventHash=await hash(event.fingerprint);
      const body={deviceSerial:trial.device_serial,deviceMemberId:trial.device_member_id,deviceWallTime:raw.deviceWallTime,verificationCode:raw.verificationCode,punchCode:raw.punchCode,workCode:raw.workCode};
      await db.prepare('INSERT INTO attendance_trial_observations (id,trial_id,event_hash,event_json,occurred_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(makeId('observation'),trial.id,eventHash,JSON.stringify(body),event.occurredAt).run();
      const item=await db.prepare('SELECT id,status FROM attendance_trial_observations WHERE trial_id=? AND event_hash=?').bind(trial.id,eventHash).first();
      return response({ok:true,observationId:item.id,reviewStatus:item.status,trialId:trial.id,charged:false},200,headers);
    }
    if(path==='/api/attendance-pilot/bridge/consume'&&request.method==='POST') {
      return consume(trial,await jsonBody(request,4096));
    }
    return errorResponse('not_found',404,headers);
  }
  if(!user) fail('unauthorized',401);
  if(user.access_state!=='approved'||user.status!=='active') fail('approval_required',403);
  if(path==='/api/attendance-pilot/me'&&request.method==='GET') {
    const list=await db.prepare('SELECT * FROM attendance_trials WHERE user_id=? ORDER BY created_at DESC LIMIT 10').bind(user.id).all();
    return response({trials:await Promise.all(list.results.map(state))},200,headers);
  }
  if(path.startsWith('/api/attendance-pilot/review')) {
    if(!hasRole(user,'support','manager')) fail('reviewer_only',403);
    const support=hasRole(user,'support')?1:0;
    if(path==='/api/attendance-pilot/review'&&request.method==='GET') {
      const list=await db.prepare("SELECT o.*,t.user_id,t.device_member_id,t.club_id,u.full_name,u.phone FROM attendance_trial_observations o JOIN attendance_trials t ON t.id=o.trial_id JOIN clubs c ON c.id=t.club_id JOIN users u ON u.id=t.user_id WHERE (?=1 OR c.manager_user_id=?) ORDER BY o.created_at DESC,o.id DESC LIMIT 200").bind(support,user.id).all();
      return response({observations:list.results.map(o=>({id:o.id,trialId:o.trial_id,name:o.full_name,phone:o.phone,memberId:o.device_member_id,clubId:o.club_id,event:JSON.parse(o.event_json),status:o.status,reviewedBy:o.reviewed_by,reviewedAt:o.reviewed_at}))},200,headers);
    }
    const reviewMatch=path.match(/^\/api\/attendance-pilot\/review\/([A-Za-z0-9_-]+)$/);
    if(reviewMatch&&request.method==='POST') {
      const body=await jsonBody(request,1024);
      if(!body||!['approve','reject'].includes(body.decision)) fail('invalid_review');
      if(body.decision==='approve'&&body.confirmedAdmission!==true) fail('operator_confirmation_required');
      const o=await db.prepare('SELECT o.* FROM attendance_trial_observations o JOIN attendance_trials t ON t.id=o.trial_id JOIN clubs c ON c.id=t.club_id WHERE o.id=? AND (?=1 OR c.manager_user_id=?)').bind(reviewMatch[1],support,user.id).first();
      if(!o) fail('observation_not_found',404);
      if(o.status!=='pending') return response({ok:true,alreadyReviewed:true,status:o.status},200,headers);
      if(body.decision==='reject') {
        await db.batch([
          db.prepare("UPDATE attendance_trial_observations SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(user.id,new Date().toISOString(),o.id),
          db.prepare("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,'pilot_arrival_rejected','attendance_observation',?,'{}')").bind(makeId('audit'),user.id,o.id)
        ]);
        return response({ok:true},200,headers);
      }
      const trial=await db.prepare('SELECT * FROM attendance_trials WHERE id=?').bind(o.trial_id).first(),athlete=await userById(env,trial.user_id);
      if(trial.status!=='active'||Date.now()>=Date.parse(trial.expires_at)||!athlete||athlete.status!=='active'||athlete.access_state!=='approved'||!hasRole(athlete,'athlete')) fail('trial_not_active',409);
      return consume(trial,{...JSON.parse(o.event_json),confirmedAdmission:true},{id:o.id,actor:user.id});
    }
    return errorResponse('not_found',404,headers);
  }
  if(!hasRole(user,'support')) fail('support_only',403);
  if(path==='/api/attendance-pilot/grant'&&request.method==='POST') {
    const body=await jsonBody(request,4096),phone=normalizePhone(body.phone);
    if(!validPhone(phone)||!serialOK(body.deviceSerial)||!memberOK(body.deviceMemberId)||typeof body.clubId!=='string'||!/^pilot-[A-Za-z0-9_-]{8,80}$/.test(body.requestKey||'')) fail('invalid_trial_setup');
    const row=await db.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first();
    const athlete=row?await userById(env,row.id):null;
    if(!athlete||!hasRole(athlete,'athlete')||athlete.status!=='active'||athlete.access_state!=='approved') fail('active_athlete_required',409);
    const club=await db.prepare('SELECT id FROM clubs WHERE id=?').bind(body.clubId).first();
    if(!club) fail('club_not_found',404);
    const previous=await db.prepare('SELECT * FROM attendance_trials WHERE request_key=?').bind(body.requestKey).first();
    if(previous) {
      if(previous.user_id!==athlete.id||previous.club_id!==club.id||previous.device_serial!==body.deviceSerial||previous.device_member_id!==body.deviceMemberId) fail('idempotency_conflict',409);
      return response({ok:true,duplicate:true,trial:await state(previous),tokenReturned:false},200,headers);
    }
    const id=makeId('trial'),bridgeToken=token(),window=trialWindow();
    try {
      await db.batch([
        db.prepare('INSERT INTO attendance_trials (id,request_key,user_id,club_id,device_serial,device_member_id,starts_at,expires_at,token_hash,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(id,body.requestKey,athlete.id,club.id,body.deviceSerial,body.deviceMemberId,window.startsAt,window.expiresAt,await hash(bridgeToken),user.id),
        db.prepare("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,'free_trial_granted','attendance_trial',?,?)")
          .bind(makeId('audit'),user.id,id,JSON.stringify({userId:athlete.id,clubId:club.id,sessions:30,days:30,paid:false}))
      ]);
    } catch(e) {fail('trial_conflict_retry_same_request_key',409);}
    const trial=await db.prepare('SELECT * FROM attendance_trials WHERE id=?').bind(id).first();
    return response({ok:true,trial:await state(trial),bridgeToken,deviceSerial:trial.device_serial,deviceMemberId:trial.device_member_id},201,headers);
  }
  const match=path.match(/^\/api\/attendance-pilot\/([A-Za-z0-9_-]+)\/(revoke|rotate-token)$/);
  if(match&&request.method==='POST') {
    const trial=await db.prepare('SELECT * FROM attendance_trials WHERE id=?').bind(match[1]).first();
    if(!trial) fail('trial_not_found',404);
    if(match[2]==='revoke') {
      await db.batch([
        db.prepare("UPDATE attendance_trials SET status='revoked' WHERE id=?").bind(trial.id),
        db.prepare("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,'free_trial_revoked','attendance_trial',?,'{}')").bind(makeId('audit'),user.id,trial.id)
      ]);
      return response({ok:true},200,headers);
    }
    if(trial.status!=='active'||Date.now()>=Date.parse(trial.expires_at)) fail('inactive_trial',409);
    const bridgeToken=token();
    await db.batch([
      db.prepare("UPDATE attendance_trials SET token_hash=? WHERE id=? AND status='active'").bind(await hash(bridgeToken),trial.id),
      db.prepare("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,'trial_token_rotated','attendance_trial',?,'{}')").bind(makeId('audit'),user.id,trial.id)
    ]);
    return response({ok:true,bridgeToken,trial:await state(trial)},200,headers);
  }
  return errorResponse('not_found',404,headers);
}
