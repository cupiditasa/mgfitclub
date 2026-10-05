const fail=(code,status=400)=>{throw Object.assign(new Error(code),{status})};
const validKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,90}$/.test(value);
const cleanPackages=value=>{
 if(!Array.isArray(value)||value.length>30)fail('invalid_packages');
 return value.map(item=>{
  const name=typeof item?.name==='string'?item.name.trim():'';
  const description=typeof item?.description==='string'?item.description.trim():'';
  const price=Number(item?.price);
  if(name.length<2||name.length>100||description.length>1000||!Number.isSafeInteger(price)||price<0||price>100000000000)fail('invalid_package');
  return {id:typeof item.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(item.id)?item.id:crypto.randomUUID(),name,description,price};
 });
};
export async function handleCoachMarket(request,env,c){
 const {path,headers,response,errorResponse,jsonBody,currentUser,hasRole,makeId}=c;
 if(!path.startsWith('/api/coach-market'))return null;
 const user=await currentUser(request,env);if(!user)return errorResponse('unauthorized',401,headers);
 if(user.status!=='active'||user.access_state!=='approved')return errorResponse('approval_required',403,headers);
 const db=env.DB,now=new Date().toISOString(),out=(value,status=200)=>response(value,status,headers);
 const coach=hasRole(user,'coach'),athlete=hasRole(user,'athlete'),manager=hasRole(user,'manager'),support=hasRole(user,'support');
 const audit=(action,id,meta={})=>db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'coach_service_request',?,?)").bind(makeId('audit'),user.id,action,id,JSON.stringify(meta));
 const body=()=>jsonBody(request,25000);
 if(path==='/api/coach-market/offers'&&request.method==='GET'){
  if(!coach)fail('coach_only',403);
  const row=await db.prepare('SELECT * FROM coach_offerings WHERE coach_id=?').bind(user.id).first();
  return out({offerings:row?{workoutEnabled:!!row.workout_enabled,nutritionEnabled:!!row.nutrition_enabled,inPersonEnabled:!!row.in_person_enabled,workoutPackages:JSON.parse(row.workout_packages_json),inPersonPackages:JSON.parse(row.in_person_packages_json),specialty:row.specialty,bio:row.bio,heroImage:row.hero_image}: {workoutEnabled:false,nutritionEnabled:false,inPersonEnabled:false,workoutPackages:[],inPersonPackages:[],specialty:'',bio:'',heroImage:null}});
 }
 if(path==='/api/coach-market/offers'&&request.method==='PATCH'){
  if(!coach)fail('coach_only',403);const b=await body();
  for(const flag of ['workoutEnabled','nutritionEnabled','inPersonEnabled'])if(typeof b[flag]!=='boolean')fail('invalid_offering_switch');
  const workout=cleanPackages(b.workoutPackages),inPerson=cleanPackages(b.inPersonPackages);
  if(b.workoutEnabled&&!workout.length)fail('workout_package_required');
  if(b.inPersonEnabled&&!inPerson.length)fail('in_person_package_required');
  const specialty=typeof b.specialty==='string'?b.specialty.trim():'',bio=typeof b.bio==='string'?b.bio.trim():'';
  const heroImage=typeof b.heroImage==='string'&&b.heroImage.length<=500?b.heroImage:null;
  if(specialty.length>140||bio.length>3000||heroImage&&!/^https:\/\//.test(heroImage))fail('invalid_coach_profile');
  await db.prepare("INSERT INTO coach_offerings(coach_id,workout_enabled,nutrition_enabled,in_person_enabled,workout_packages_json,in_person_packages_json,specialty,bio,hero_image,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(coach_id) DO UPDATE SET workout_enabled=excluded.workout_enabled,nutrition_enabled=excluded.nutrition_enabled,in_person_enabled=excluded.in_person_enabled,workout_packages_json=excluded.workout_packages_json,in_person_packages_json=excluded.in_person_packages_json,specialty=excluded.specialty,bio=excluded.bio,hero_image=excluded.hero_image,updated_at=excluded.updated_at").bind(user.id,+b.workoutEnabled,+b.nutritionEnabled,+b.inPersonEnabled,JSON.stringify(workout),JSON.stringify(inPerson),specialty,bio,heroImage,now).run();
  return out({ok:true});
 }
 if(path==='/api/coach-market/coaches'&&request.method==='GET'){
  if(!athlete&&!manager&&!support)fail('forbidden',403);
  const clubId=manager?user.club_id:athlete?user.club_id:(new URL(request.url).searchParams.get('clubId')||'');
  if(!clubId||support&&!clubId)fail('club_required',400);
  const rows=(await db.prepare("SELECT u.id,u.full_name,p.first_name,p.last_name,p.avatar_data,o.specialty,o.bio,o.hero_image,o.workout_enabled,o.nutrition_enabled,o.in_person_enabled,o.workout_packages_json,o.in_person_packages_json FROM users u JOIN account_access a ON a.user_id=u.id AND a.role='coach' AND a.state='approved' LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN coach_offerings o ON o.coach_id=u.id WHERE a.club_id=? AND u.status='active' ORDER BY COALESCE(NULLIF(p.first_name||' '||p.last_name,' '),u.full_name),u.id LIMIT 200").bind(clubId).all()).results;
  return out({coaches:rows.map(r=>({...r,name:[r.first_name,r.last_name].filter(Boolean).join(' ')||r.full_name,avatar:r.avatar_data,workoutEnabled:!!r.workout_enabled,nutritionEnabled:!!r.nutrition_enabled,inPersonEnabled:!!r.in_person_enabled,workoutPackages:JSON.parse(r.workout_packages_json||'[]'),inPersonPackages:JSON.parse(r.in_person_packages_json||'[]')}))});
 }
 const profileMatch=path.match(/^\/api\/coach-market\/coaches\/([A-Za-z0-9_-]+)$/);
 if(profileMatch&&request.method==='GET'){
  if(!athlete&&!manager&&!support)fail('forbidden',403);
  const target=profileMatch[1],clubId=user.club_id||new URL(request.url).searchParams.get('clubId')||'',row=await db.prepare("SELECT u.id,u.full_name,p.first_name,p.last_name,p.avatar_data,o.specialty,o.bio,o.hero_image,o.workout_enabled,o.nutrition_enabled,o.in_person_enabled,o.workout_packages_json,o.in_person_packages_json FROM users u JOIN account_access a ON a.user_id=u.id AND a.role='coach' AND a.state='approved' LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN coach_offerings o ON o.coach_id=u.id WHERE u.id=? AND a.club_id=? AND u.status='active'").bind(target,clubId).first();
  if(!row)fail('coach_not_found',404);
  return out({coach:{...row,name:[row.first_name,row.last_name].filter(Boolean).join(' ')||row.full_name,avatar:row.avatar_data,workoutEnabled:!!row.workout_enabled,nutritionEnabled:!!row.nutrition_enabled,inPersonEnabled:!!row.in_person_enabled,workoutPackages:JSON.parse(row.workout_packages_json||'[]'),inPersonPackages:JSON.parse(row.in_person_packages_json||'[]')}});
 }
 if(path==='/api/coach-market/requests'&&request.method==='POST'){
  if(!athlete)fail('athlete_only',403);const b=await body(),kind=String(b.kind||'');if(!['workout','nutrition','in_person'].includes(kind)||!validKey(b.requestKey))fail('invalid_request');
  const coachRow=await db.prepare("SELECT o.*,a.club_id FROM coach_offerings o JOIN account_access a ON a.user_id=o.coach_id AND a.role='coach' AND a.state='approved' JOIN users u ON u.id=o.coach_id AND u.status='active' WHERE o.coach_id=? AND a.club_id=?").bind(String(b.coachId||''),user.club_id||'').first();if(!coachRow)fail('coach_not_found',404);
  const flag=kind==='workout'?'workout_enabled':kind==='nutrition'?'nutrition_enabled':'in_person_enabled';if(!coachRow[flag])fail('offering_disabled',409);
  let pkg=null;if(kind!=='nutrition'){const list=JSON.parse(kind==='workout'?coachRow.workout_packages_json:coachRow.in_person_packages_json);pkg=list.find(x=>x.id===b.packageId);if(!pkg)fail('package_not_found',404)}
  const notes=typeof b.notes==='string'?b.notes.trim():'';if(notes.length>2000)fail('notes_too_long');
  const id=makeId('coach_request');
  await db.batch([db.prepare('INSERT INTO coach_service_requests(id,request_key,club_id,coach_id,athlete_id,kind,package_id,package_name,package_price,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(athlete_id,request_key) DO NOTHING').bind(id,b.requestKey,user.club_id,coachRow.coach_id,user.id,kind,pkg?.id||null,pkg?.name||null,pkg?.price??null,notes,now,now),db.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) SELECT ?,?,'coach_request_created','coach_service_request',?,? WHERE EXISTS(SELECT 1 FROM coach_service_requests WHERE id=?)").bind(makeId('audit'),user.id,id,JSON.stringify({kind,coachId:coachRow.coach_id}),id)]);
  const saved=await db.prepare('SELECT id,status FROM coach_service_requests WHERE athlete_id=? AND request_key=?').bind(user.id,b.requestKey).first();return out({ok:true,request:saved},saved.id===id?201:200);
 }
 if(path==='/api/coach-market/requests'&&request.method==='GET'){
  if(!coach&&!athlete&&!manager&&!support)fail('forbidden',403);
  const where=coach?'r.coach_id=?':athlete?'r.athlete_id=?':manager?'r.club_id=?':'1=1',value=coach||athlete?user.id:manager?user.club_id||'':'';
  if(manager&&!value)fail('club_required',400);
  const rows=(await db.prepare(`SELECT r.*,a.full_name AS athlete_name,a.phone AS athlete_phone,c.full_name AS coach_name FROM coach_service_requests r JOIN users a ON a.id=r.athlete_id JOIN users c ON c.id=r.coach_id WHERE ${where} ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 300`).bind(...(support?[]:[value])).all()).results;
  return out({requests:rows});
 }
 const requestMatch=path.match(/^\/api\/coach-market\/requests\/([A-Za-z0-9_-]+)$/);
 if(requestMatch&&request.method==='PATCH'){
  if(!coach)fail('coach_only',403);const b=await body(),status=String(b.status||'');if(!['approved','rejected'].includes(status))fail('invalid_status');
  const item=await db.prepare('SELECT * FROM coach_service_requests WHERE id=? AND coach_id=?').bind(requestMatch[1],user.id).first();if(!item)fail('request_not_found',404);if(item.status!=='pending')fail('request_already_reviewed',409);
  await db.batch([db.prepare("UPDATE coach_service_requests SET status=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND coach_id=? AND status='pending'").bind(status,user.id,now,now,item.id,user.id),audit('coach_request_'+status,item.id,{kind:item.kind,athleteId:item.athlete_id})]);return out({ok:true,status});
 }
 return errorResponse('not_found',404,headers);
}
