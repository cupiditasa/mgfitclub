import {normalizeExerciseName,validateWorkout,dayDuration} from './workout-domain.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{status})};
const keyOK=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{16,90}$/.test(k);
export function validEducationVideo(value){
 if(typeof value!=='string'||value.length>1500)return false;
 try{const u=new URL(value);return u.protocol==='https:'&&['mgfitclub.ir','www.mgfitclub.ir'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&/^\/(assets\/media|uploads\/education)\/[A-Za-z0-9_./-]+\.(mp4|webm)$/i.test(u.pathname)&&!u.search&&!u.hash}catch{return false}
}
export async function handleWorkouts(request,env,c){
 const {path,headers,response,errorResponse,jsonBody,currentUser,userById,hasRole,makeId,hash,normalizePhone}=c;
 if(!path.startsWith('/api/workouts/'))return null;
 if(env.WORKOUTS_ENABLED!=='true')return errorResponse('workouts_disabled',503,headers);
 const user=await currentUser(request,env);if(!user)fail('unauthorized',401);
 if(user.status!=='active'||user.access_state!=='approved')fail('approval_required',403);
 const db=env.DB,now=new Date().toISOString(),out=(x,s=200)=>response(x,s,headers),coach=hasRole(user,'coach'),support=hasRole(user,'support');
 const audit=(action,id,meta)=>db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'workout',?,?)").bind(makeId('audit'),user.id,action,id,JSON.stringify(meta));
 const payload=async()=>jsonBody(request,100000);
 const own=async id=>{if(!coach)fail('coach_only',403);const row=await db.prepare('SELECT * FROM workout_templates WHERE id=? AND coach_id=?').bind(id,user.id).first();if(!row)fail('program_not_found',404);return row};
 const readyProgram=async value=>{
  let program;try{program=validateWorkout(value)}catch(e){fail(e.message)}
  const ids=[...new Set(program.days.flatMap(d=>d.exercises.map(e=>e.exerciseId)))];
  const movements=new Map();for(let offset=0;offset<ids.length;offset+=80){const chunk=ids.slice(offset,offset+80);const rows=(await db.prepare(`SELECT e.id,e.name,e.muscle_id,e.style_id FROM education_exercises e WHERE e.active=1 AND e.id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all()).results;for(const r of rows)movements.set(r.id,r);if(rows.length!==chunk.length)fail('exercise_unavailable',409)}
  for(const day of program.days){day.totalSeconds=dayDuration(day);for(const e of day.exercises){const m=movements.get(e.exerciseId);Object.assign(e,{name:m.name,muscleId:m.muscle_id,styleId:m.style_id})}}
  return program;
 };
 if(path==='/api/workouts/catalog'&&request.method==='GET'){
  const categories=(await db.prepare('SELECT id,name,axis FROM education_categories ORDER BY axis,sort_order,name').all()).results;
  const params=new URL(request.url).searchParams,q=normalizeExerciseName(params.get('q')||''),muscle=params.get('muscle')||'',style=params.get('style')||'';
  const page=Math.max(1,Math.min(10000,Math.floor(Number(params.get('page'))||1)));
  const exercises=(await db.prepare("SELECT e.id,e.name,e.english_name,e.muscle_id,e.style_id,(SELECT count(*) FROM education_videos v WHERE v.exercise_id=e.id AND v.active=1) AS video_count FROM education_exercises e WHERE e.active=1 AND (?='' OR instr(e.normalized_name,?)>0) AND (?='' OR e.muscle_id=?) AND (?='' OR e.style_id=?) ORDER BY e.name,e.id LIMIT 201 OFFSET ?").bind(q,q,muscle,muscle,style,style,(page-1)*200).all()).results;
  return out({categories,exercises:exercises.slice(0,200),hasMore:exercises.length>200,page,canCreate:coach||support});
 }
 if(path==='/api/workouts/exercises'&&request.method==='POST'){
  if(!coach&&!support)fail('coach_only',403);const b=await payload(),name=typeof b.name==='string'?b.name.trim():'',normalized=normalizeExerciseName(name);
  if(name.length<2||name.length>140||normalized.length<2)fail('exercise_name_required');
  for(const [id,axis]of [[b.muscleId,'muscle'],[b.styleId,'style']])if(!await db.prepare('SELECT id FROM education_categories WHERE id=? AND axis=?').bind(id||'',axis).first())fail('category_required');
  const id=makeId('ex');await db.prepare('INSERT INTO education_exercises(id,name,normalized_name,muscle_id,style_id,created_by) VALUES (?,?,?,?,?,?) ON CONFLICT(normalized_name) DO NOTHING').bind(id,name,normalized,b.muscleId,b.styleId,user.id).run();
  const exercise=await db.prepare('SELECT id,name,muscle_id,style_id FROM education_exercises WHERE normalized_name=?').bind(normalized).first();return out({exercise,existing:exercise.id!==id},exercise.id===id?201:200);
 }
 const videoMatch=path.match(/^\/api\/workouts\/exercises\/(ex_[A-Za-z0-9_-]+)\/videos$/);
 if(videoMatch){
  const e=await db.prepare('SELECT id,name FROM education_exercises WHERE id=?').bind(videoMatch[1]).first();if(!e)fail('exercise_not_found',404);
  if(request.method==='GET')return out({exercise:e,videos:(await db.prepare('SELECT v.id,v.title,v.url,v.coach_id,u.full_name AS coach_name FROM education_videos v JOIN users u ON u.id=v.coach_id WHERE v.exercise_id=? AND v.active=1 AND u.status=\'active\' ORDER BY v.created_at DESC,v.id').bind(e.id).all()).results});
  if(request.method==='POST'){
   if(!coach)fail('coach_only',403);const b=await payload(),title=typeof b.title==='string'?b.title.trim():'';if(!title||title.length>160||!validEducationVideo(b.url))fail('invalid_education_video');
   await db.prepare('INSERT INTO education_videos(id,exercise_id,coach_id,title,url,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(exercise_id,coach_id,url) DO NOTHING').bind(makeId('lesson'),e.id,user.id,title,b.url,now).run();return out({ok:true});
  }
 }
 if(path==='/api/workouts/templates'&&request.method==='GET'){
  if(!coach)fail('coach_only',403);return out({programs:(await db.prepare('SELECT id,title,revision,updated_at FROM workout_templates WHERE coach_id=? AND archived=0 ORDER BY updated_at DESC,id LIMIT 500').bind(user.id).all()).results});
 }
 if(path==='/api/workouts/templates'&&request.method==='POST'){
  if(!coach)fail('coach_only',403);const b=await payload();if(!keyOK(b.requestKey))fail('request_key_required');const p=await readyProgram(b.program),fingerprint=await hash(JSON.stringify(p));
  const id=makeId('workout');await db.prepare('INSERT INTO workout_templates(id,coach_id,title,body_json,create_key,create_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(coach_id,create_key) DO NOTHING').bind(id,user.id,p.title,JSON.stringify(p),b.requestKey,fingerprint,now,now).run();
  const saved=await db.prepare('SELECT * FROM workout_templates WHERE coach_id=? AND create_key=?').bind(user.id,b.requestKey).first();if(saved.create_hash!==fingerprint)fail('request_key_conflict',409);return out({id:saved.id,revision:saved.revision,program:JSON.parse(saved.body_json)},saved.id===id?201:200);
 }
 const template=path.match(/^\/api\/workouts\/templates\/([A-Za-z0-9_-]+)(?:\/(send|archive))?$/);
 if(template){
  const t=await own(template[1]);
  if(!template[2]&&request.method==='GET')return out({id:t.id,revision:t.revision,archived:!!t.archived,program:JSON.parse(t.body_json)});
  if(!template[2]&&request.method==='PATCH'){
   const b=await payload();if(t.archived)fail('program_archived',409);if(b.revision!==t.revision)fail('revision_conflict',409);const p=await readyProgram(b.program);
   const result=await db.prepare('UPDATE workout_templates SET title=?,body_json=?,revision=revision+1,updated_at=? WHERE id=? AND coach_id=? AND revision=? AND archived=0').bind(p.title,JSON.stringify(p),now,t.id,user.id,b.revision).run();if(result.meta.changes!==1)fail('revision_conflict',409);return out({id:t.id,revision:t.revision+1,program:p});
  }
  if(template[2]==='archive'&&request.method==='POST'){await db.batch([db.prepare('UPDATE workout_templates SET archived=1,updated_at=? WHERE id=? AND coach_id=?').bind(now,t.id,user.id),audit('workout_archived',t.id,{})]);return out({ok:true})}
  if(template[2]==='send'&&request.method==='POST'){
   const b=await payload();if(!keyOK(b.requestKey)||!Number.isInteger(b.revision))fail('invalid_send');
   const phone=normalizePhone(b.phone||''),recipient=await db.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first();if(!recipient)fail('athlete_not_found',404);
   const prior=await db.prepare('SELECT id,template_id,revision,athlete_id FROM workout_deliveries WHERE coach_id=? AND request_key=?').bind(user.id,b.requestKey).first();
   if(prior){if(prior.template_id!==t.id||prior.revision!==b.revision||prior.athlete_id!==recipient.id)fail('request_key_conflict',409);return out({id:prior.id,duplicate:true})}
   if(t.archived||t.revision!==b.revision)fail('revision_conflict',409);
   const athlete=await userById(env,recipient.id);if(athlete?.status!=='active'||athlete.access_state!=='approved'||!hasRole(athlete,'athlete'))fail('athlete_required',409);
   const club=await db.prepare("SELECT c.id FROM clubs c JOIN account_access a ON a.club_id=c.id WHERE a.user_id=? AND a.role='coach' AND a.state='approved'").bind(user.id).first();if(!club)fail('coach_club_required',409);
   if(athlete.club_id&&athlete.club_id!==club.id)fail('athlete_other_club',403);
   const id=makeId('delivery'),coachName=user.full_name||'مربی',athleteName=athlete.full_name||'ورزشکار';
   const inserted=await db.batch([
    db.prepare('INSERT INTO workout_deliveries(id,template_id,revision,coach_id,athlete_id,club_id,title,snapshot_json,coach_name,athlete_name,sent_at,request_key) SELECT ?,id,revision,coach_id,?,?,title,body_json,?,?,?,? FROM workout_templates WHERE id=? AND coach_id=? AND revision=? AND archived=0 ON CONFLICT(coach_id,request_key) DO NOTHING').bind(id,athlete.id,club.id,coachName,athleteName,now,b.requestKey,t.id,user.id,b.revision),
    db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) SELECT ?,?,'workout_sent','workout_delivery',?,? WHERE EXISTS(SELECT 1 FROM workout_deliveries WHERE id=?)").bind(makeId('audit'),user.id,id,JSON.stringify({clubId:club.id,athleteId:athlete.id,revision:t.revision}),id)
   ]);
   const sent=await db.prepare('SELECT id,template_id,revision,athlete_id FROM workout_deliveries WHERE coach_id=? AND request_key=?').bind(user.id,b.requestKey).first();if(!sent)fail('revision_conflict',409);if(sent.template_id!==t.id||sent.revision!==b.revision||sent.athlete_id!==athlete.id)fail('request_key_conflict',409);return out({id:sent.id,duplicate:sent.id!==id},inserted[0].meta.changes?201:200);
  }
 }
 if(path==='/api/workouts/deliveries'&&request.method==='GET'){
  const page=Math.max(1,Math.min(10000,Math.floor(Number(new URL(request.url).searchParams.get('page'))||1)));
  const rows=(await db.prepare('SELECT d.id,d.title,d.revision,d.coach_name,d.athlete_name,d.sent_at,c.name AS club_name FROM workout_deliveries d JOIN clubs c ON c.id=d.club_id WHERE (?=1 OR d.athlete_id=? OR d.coach_id=? OR c.manager_user_id=?) ORDER BY d.sent_at DESC,d.id LIMIT 101 OFFSET ?').bind(support?1:0,user.id,coach?user.id:'',hasRole(user,'manager')?user.id:'',(page-1)*100).all()).results;return out({deliveries:rows.slice(0,100),hasMore:rows.length>100,page});
 }
 const delivered=path.match(/^\/api\/workouts\/deliveries\/([A-Za-z0-9_-]+)$/);
 if(delivered&&request.method==='GET'){
  const d=await db.prepare('SELECT d.*,c.manager_user_id FROM workout_deliveries d JOIN clubs c ON c.id=d.club_id WHERE d.id=?').bind(delivered[1]).first();if(!d||!(support||d.athlete_id===user.id||coach&&d.coach_id===user.id||hasRole(user,'manager')&&d.manager_user_id===user.id))fail('delivery_not_found',404);
  return out({id:d.id,title:d.title,revision:d.revision,coachName:d.coach_name,athleteName:d.athlete_name,sentAt:d.sent_at,program:JSON.parse(d.snapshot_json),readOnly:true});
 }
 fail('not_found',404);
}
