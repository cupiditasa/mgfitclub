import {MEAL_TYPES,validateNutrition} from './workout-domain.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{status})};
const keyOK=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{16,90}$/.test(k);
export async function handleNutrition(request,env,c){
 const {path,headers,response,errorResponse,jsonBody,currentUser,userById,hasRole,makeId,hash,normalizePhone}=c;
 if(!path.startsWith('/api/workouts/nutrition/'))return null;
 if(env.WORKOUTS_ENABLED!=='true')return errorResponse('workouts_disabled',503,headers);
 const user=await currentUser(request,env);if(!user)fail('unauthorized',401);
 if(user.status!=='active'||user.access_state!=='approved')fail('approval_required',403);
 const db=env.DB,now=new Date().toISOString(),out=(data,status=200)=>response(data,status,headers),coach=hasRole(user,'coach'),support=hasRole(user,'support');
 const audit=(action,id,meta)=>db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'nutrition',?,?)").bind(makeId('audit'),user.id,action,id,JSON.stringify(meta));
 const payload=async()=>jsonBody(request,1500000);
 const ready=value=>{try{return validateNutrition(value)}catch(e){fail(e.message)}};
 if(path==='/api/workouts/nutrition/types'&&request.method==='GET')return out({mealTypes:MEAL_TYPES});
 if(path==='/api/workouts/nutrition/templates'&&request.method==='GET'){
  if(!coach)fail('coach_only',403);
  return out({programs:(await db.prepare('SELECT id,title,revision,updated_at FROM nutrition_templates WHERE coach_id=? AND archived=0 ORDER BY updated_at DESC,id LIMIT 500').bind(user.id).all()).results});
 }
 if(path==='/api/workouts/nutrition/templates'&&request.method==='POST'){
  if(!coach)fail('coach_only',403);const b=await payload();if(!keyOK(b.requestKey))fail('request_key_required');const p=ready(b.program),fingerprint=await hash(JSON.stringify(p)),id=makeId('nutrition');
  await db.prepare('INSERT INTO nutrition_templates(id,coach_id,title,body_json,create_key,create_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(coach_id,create_key) DO NOTHING').bind(id,user.id,p.title,JSON.stringify(p),b.requestKey,fingerprint,now,now).run();
  const saved=await db.prepare('SELECT * FROM nutrition_templates WHERE coach_id=? AND create_key=?').bind(user.id,b.requestKey).first();if(saved.create_hash!==fingerprint)fail('request_key_conflict',409);
  return out({id:saved.id,revision:saved.revision,program:JSON.parse(saved.body_json)},saved.id===id?201:200);
 }
 const template=path.match(/^\/api\/workouts\/nutrition\/templates\/([A-Za-z0-9_-]+)(?:\/(send|archive))?$/);
 if(template){
  if(!coach)fail('coach_only',403);const t=await db.prepare('SELECT * FROM nutrition_templates WHERE id=? AND coach_id=?').bind(template[1],user.id).first();if(!t)fail('program_not_found',404);
  if(!template[2]&&request.method==='GET')return out({id:t.id,revision:t.revision,archived:!!t.archived,program:JSON.parse(t.body_json)});
  if(!template[2]&&request.method==='PATCH'){
   const b=await payload();if(t.archived)fail('program_archived',409);if(b.revision!==t.revision)fail('revision_conflict',409);const p=ready(b.program),result=await db.prepare('UPDATE nutrition_templates SET title=?,body_json=?,revision=revision+1,updated_at=? WHERE id=? AND coach_id=? AND revision=? AND archived=0').bind(p.title,JSON.stringify(p),now,t.id,user.id,b.revision).run();if(result.meta.changes!==1)fail('revision_conflict',409);return out({id:t.id,revision:t.revision+1,program:p});
  }
  if(template[2]==='archive'&&request.method==='POST'){
   await db.batch([db.prepare('UPDATE nutrition_templates SET archived=1,updated_at=? WHERE id=? AND coach_id=?').bind(now,t.id,user.id),audit('nutrition_archived',t.id,{})]);return out({ok:true});
  }
  if(template[2]==='send'&&request.method==='POST'){
   const b=await payload();if(!keyOK(b.requestKey)||!Number.isInteger(b.revision))fail('invalid_send');const phone=normalizePhone(b.phone||''),recipient=await db.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first();if(!recipient)fail('athlete_not_found',404);
   const prior=await db.prepare('SELECT id,template_id,revision,athlete_id FROM nutrition_deliveries WHERE coach_id=? AND request_key=?').bind(user.id,b.requestKey).first();if(prior){if(prior.template_id!==t.id||prior.revision!==b.revision||prior.athlete_id!==recipient.id)fail('request_key_conflict',409);return out({id:prior.id,duplicate:true})}
   if(t.archived||t.revision!==b.revision)fail('revision_conflict',409);const athlete=await userById(env,recipient.id);if(athlete?.status!=='active'||athlete.access_state!=='approved'||!hasRole(athlete,'athlete'))fail('athlete_required',409);
   const club=await db.prepare("SELECT c.id FROM clubs c JOIN account_access a ON a.club_id=c.id WHERE a.user_id=? AND a.role='coach' AND a.state='approved'").bind(user.id).first();if(!club)fail('coach_club_required',409);if(athlete.club_id&&athlete.club_id!==club.id)fail('athlete_other_club',403);
   const id=makeId('food_delivery'),coachName=user.full_name||'مربی',athleteName=athlete.full_name||'ورزشکار';
   const inserted=await db.batch([
    db.prepare('INSERT INTO nutrition_deliveries(id,template_id,revision,coach_id,athlete_id,club_id,title,snapshot_json,coach_name,athlete_name,sent_at,request_key) SELECT ?,id,revision,coach_id,?,?,title,body_json,?,?,?,? FROM nutrition_templates WHERE id=? AND coach_id=? AND revision=? AND archived=0 ON CONFLICT(coach_id,request_key) DO NOTHING').bind(id,athlete.id,club.id,coachName,athleteName,now,b.requestKey,t.id,user.id,b.revision),
    db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) SELECT ?,?,'nutrition_sent','nutrition_delivery',?,? WHERE EXISTS(SELECT 1 FROM nutrition_deliveries WHERE id=?)").bind(makeId('audit'),user.id,id,JSON.stringify({clubId:club.id,athleteId:athlete.id,revision:t.revision}),id)
   ]);
   const sent=await db.prepare('SELECT id,template_id,revision,athlete_id FROM nutrition_deliveries WHERE coach_id=? AND request_key=?').bind(user.id,b.requestKey).first();if(!sent)fail('revision_conflict',409);if(sent.template_id!==t.id||sent.revision!==b.revision||sent.athlete_id!==athlete.id)fail('request_key_conflict',409);return out({id:sent.id,duplicate:sent.id!==id},inserted[0].meta.changes?201:200);
  }
 }
 if(path==='/api/workouts/nutrition/deliveries'&&request.method==='GET'){
  const page=Math.max(1,Math.min(10000,Math.floor(Number(new URL(request.url).searchParams.get('page'))||1)));
  const rows=(await db.prepare("SELECT d.id,d.title,d.revision,d.coach_name,d.athlete_name,d.sent_at,c.name AS club_name FROM nutrition_deliveries d JOIN clubs c ON c.id=d.club_id WHERE (?=1 OR d.athlete_id=? OR d.coach_id=? OR c.manager_user_id=?) ORDER BY d.sent_at DESC,d.id LIMIT 101 OFFSET ?").bind(support?1:0,user.id,coach?user.id:'',hasRole(user,'manager')?user.id:'',(page-1)*100).all()).results;return out({deliveries:rows.slice(0,100),hasMore:rows.length>100,page});
 }
 const delivery=path.match(/^\/api\/workouts\/nutrition\/deliveries\/([A-Za-z0-9_-]+)$/);
 if(delivery&&request.method==='GET'){
  const d=await db.prepare('SELECT d.*,c.manager_user_id FROM nutrition_deliveries d JOIN clubs c ON c.id=d.club_id WHERE d.id=?').bind(delivery[1]).first();if(!d||!(support||d.athlete_id===user.id||coach&&d.coach_id===user.id||hasRole(user,'manager')&&d.manager_user_id===user.id))fail('delivery_not_found',404);
  return out({id:d.id,title:d.title,revision:d.revision,coachName:d.coach_name,athleteName:d.athlete_name,sentAt:d.sent_at,program:JSON.parse(d.snapshot_json),readOnly:true});
 }
 fail('not_found',404);
}
