// Shared pure model, copied byte-for-byte to the frontend by prepare-workouts.mjs.
export const WEEK_DAYS=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
export function normalizeExerciseName(value){
 return String(value??'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
}
export function integer(value,min,max){
 if(typeof value==='string')value=value.trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
 if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw new Error('invalid_number');
 return Number(value);
}
export function validateWorkout(value){
 if(!value||!Array.isArray(value.days)||value.days.length!==7)throw new Error('seven_days_required');
 const title=typeof value.title==='string'?value.title.trim():'';if(!title||title.length>140)throw new Error('title_required');
 const days=value.days.map(day=>{
  if(!day||typeof day.timerEnabled!=='boolean'||!Array.isArray(day.exercises)||day.exercises.length>20)throw new Error('invalid_day');
  return {timerEnabled:day.timerEnabled,exercises:day.exercises.map((e,i)=>{
   if(!e||typeof e.exerciseId!=='string'||!/^ex_[A-Za-z0-9_-]{1,90}$/.test(e.exerciseId))throw new Error('exercise_required');
   return {exerciseId:e.exerciseId,sets:integer(e.sets,1,50),reps:integer(e.reps,1,1000),workSeconds:day.timerEnabled?integer(e.workSeconds,1,3600):0,setRestSeconds:day.timerEnabled?integer(e.setRestSeconds,0,3600):0,afterSeconds:day.timerEnabled&&i<day.exercises.length-1?integer(e.afterSeconds,0,3600):0};
  })};
 });return {schemaVersion:1,title,days};
}
export function dayDuration(day){if(!day.timerEnabled)return 0;return day.exercises.reduce((sum,e,i)=>sum+e.sets*e.workSeconds+(e.sets-1)*e.setRestSeconds+(i<day.exercises.length-1?e.afterSeconds:0),0)}
export function timerPhases(day){
 if(!day.timerEnabled)return [];const phases=[];
 day.exercises.forEach((e,i)=>{for(let s=0;s<e.sets;s++){phases.push({kind:'work',exerciseIndex:i,set:s+1,seconds:e.workSeconds});if(s<e.sets-1&&e.setRestSeconds>0)phases.push({kind:'setRest',exerciseIndex:i,set:s+1,seconds:e.setRestSeconds})}if(i<day.exercises.length-1&&e.afterSeconds>0)phases.push({kind:'exerciseRest',exerciseIndex:i,set:e.sets,seconds:e.afterSeconds})});return phases;
}
export function timerAt(phases,elapsedSeconds){let rest=Math.max(0,elapsedSeconds);for(let i=0;i<phases.length;i++){if(rest<phases[i].seconds)return {index:i,...phases[i],remaining:Math.ceil(phases[i].seconds-rest),complete:false};rest-=phases[i].seconds}return {complete:true,remaining:0}}
export function iranWeekday(date=new Date()){const name=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short'}).format(date);return ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'].indexOf(name)}
export function blankWorkout(){return {title:'',days:WEEK_DAYS.map(()=>({timerEnabled:false,exercises:[]}))}}
export const MEAL_TYPES=[
 {id:'breakfast',label:'صبحانه',icon:'🍳',color:'#f4bd47'},
 {id:'lunch',label:'ناهار',icon:'🍲',color:'#ff765f'},
 {id:'dinner',label:'شام',icon:'🍽️',color:'#42c879'},
 {id:'snack',label:'میان‌وعده',icon:'🍎',color:'#8c61ed'},
 {id:'supplement',label:'مکمل',icon:'💊',color:'#87909a'},
 {id:'before_sleep',label:'قبل خواب',icon:'🌙',color:'#6957d9'},
 {id:'after_sleep',label:'بعد از خواب',icon:'🌤️',color:'#45a7d5'},
 {id:'pre_workout',label:'قبل تمرین',icon:'⚡',color:'#edaa38'},
 {id:'post_workout',label:'بعد تمرین',icon:'💪',color:'#37b98b'},
 {id:'during_workout',label:'در حین تمرین',icon:'🥤',color:'#45a7d5'},
];
export function blankNutrition(){return {title:'',days:WEEK_DAYS.map(()=>({meals:[]}))}}
export function validateNutrition(value){
 if(!value||!Array.isArray(value.days)||value.days.length!==7)throw new Error('seven_days_required');
 const title=typeof value.title==='string'?value.title.trim():'';if(!title||title.length>140)throw new Error('title_required');
 const allowed=new Set(MEAL_TYPES.map(x=>x.id));
 return {schemaVersion:1,title,days:value.days.map(day=>{
  if(!day||!Array.isArray(day.meals)||day.meals.length>20)throw new Error('invalid_day');
  return {meals:day.meals.map(meal=>{
   const description=typeof meal?.description==='string'?meal.description.trim():'';
   if(!allowed.has(meal?.type)||!description||description.length>3000)throw new Error('invalid_meal');
   return {type:meal.type,description};
  })};
 })};
}
