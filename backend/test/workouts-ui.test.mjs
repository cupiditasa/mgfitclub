import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as domain from '../workout-domain.js';
const frontendRoot=fs.existsSync(new URL('../../current/workouts.js',import.meta.url))?new URL('../../current/',import.meta.url):new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('workouts.js',frontendRoot),'utf8').replace(/^import .*;\r?\n/,'');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
function browser(mode,api){
 class E{
  constructor(tag,text){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this._text=text||'';this.value='';this.className='';this.classList={toggle:()=>{}}}
  set textContent(v){this._text=String(v);this.children=[]} get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ')}
  append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}}replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  setAttribute(k,v){this.attributes[k]=v}addEventListener(k,fn){this[k]=fn}
  matches(s){return s[0]==='#'?this.id===s.slice(1):s==='[data-exercise-index]'?this.dataset.exerciseIndex!==undefined:this.tagName===s}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)])}
  querySelector(s){return this.querySelectorAll(s)[0]||null}
  closest(s){return this.matches(s)?this:this.parent?.closest(s)}
  showModal(){this.open=true}close(){this.open=false;this.remove()}reportValidity(){return true}
 }
 const root=new E('div'),status=new E('p'),back=new E('a'),body=new E('body'),events={};root.id='workout-root';status.id='workout-status';back.id='workout-back';body.dataset.workoutPage=mode;body.append(root,status,back);
 const document={body,createElement:tag=>new E(tag),getElementById:id=>body.querySelector('#'+id),querySelectorAll:s=>body.querySelectorAll(s),addEventListener:(name,fn)=>events['doc:'+name]=fn};
 const context=vm.createContext({...domain,document,URLSearchParams,AbortSignal,crypto,Date,performance,setInterval,clearInterval,confirm:()=>true,location:{search:'',href:'',reload(){}},history:{replaceState(){}},Option:class extends E{constructor(text,value){super('option',text);this.value=value}},MGApi:{request:api},addEventListener:(name,fn)=>events[name]=fn});context.window=context;vm.runInContext(source,context);
 const click=async(text)=>{const b=body.querySelectorAll('button').find(b=>b.textContent===text);assert.ok(b,'Missing button '+text);await b.onclick({currentTarget:b});await flush()};
 const label=text=>body.querySelectorAll('label').find(x=>x._text===text)?.children[0];
 return {context,root,status,body,events,click,label,ready:async(role='coach')=>{events['mg:access-ready']({detail:{role}});await flush()}};
}
const cat={categories:[{id:'core',name:'مرکز بدن',axis:'muscle'},{id:'strength',name:'بدنسازی',axis:'style'}],exercises:[{id:'ex_test',name:'حرکت نمونه',muscle_id:'core',style_id:'strength'}],canCreate:true,hasMore:false};
test('builder waits for access, defaults Saturday, picker retains draft, saves to API',async()=>{const calls=[],b=browser('builder',async(path,options)=>{calls.push({path,options});if(path.includes('/catalog'))return structuredClone(cat);if(path.endsWith('/templates'))return {id:'workout_test',revision:1,program:options.body.program};throw Error(path)});assert.equal(calls.length,0);await b.ready();assert.equal(b.root.querySelectorAll('button').find(x=>x.attributes['aria-selected']==='true').textContent,'شنبه');const title=b.label('نام برنامه');title.value='برنامه تست';title.oninput();await b.click('＋ تمرین جدید');await b.click('حرکت نمونه · بدنسازی');assert.equal(b.label('نام برنامه').value,'برنامه تست');assert.equal(b.label('تعداد ست').value,3);const toggle=b.label('تایمر این روز فعال باشد');toggle.checked=true;toggle.onchange();assert.ok(b.label('زمان هر ست (ثانیه)'));await vm.runInContext('save()',b.context);assert.equal(calls.at(-1).options.method,'POST');assert.equal(calls.at(-1).options.body.program.days[0].exercises.length,1);assert.equal(vm.runInContext('dirty',b.context),false)});
test('save failure preserves draft, unchanged retry retains request key',async()=>{const calls=[],b=browser('builder',async(path,options)=>{calls.push(options.body);throw Error('network')});await b.ready();b.label('نام برنامه').value='Keep';b.label('نام برنامه').oninput();await vm.runInContext('save()',b.context);assert.equal(b.label('نام برنامه').value,'Keep');assert.equal(vm.runInContext('dirty',b.context),true);await vm.runInContext('save()',b.context);assert.equal(calls[0].requestKey,calls[1].requestKey);b.label('نام برنامه').value='Changed';b.label('نام برنامه').oninput();await vm.runInContext('save()',b.context);assert.notEqual(calls[2].requestKey,calls[1].requestKey)});
test('dirty link opens save/discard/cancel choice; no silent navigation',async()=>{const b=browser('builder',async()=>{});await b.ready();b.label('نام برنامه').value='Draft';b.label('نام برنامه').oninput();let prevented=false;const a={href:'coach-programs.html',target:''};b.events['doc:click']({target:{closest:()=>a},preventDefault(){prevented=true}});assert.ok(prevented);assert.ok(b.body.textContent.includes('خروج بدون ذخیره'));assert.ok(b.body.textContent.includes('ادامه ویرایش'));assert.equal(b.context.location.href,'')});
test('athlete manually selects immutable delivery; no automatic latest, no edit controls',async()=>{const calls=[],p=domain.blankWorkout();p.title='Read only';const b=browser('viewer',async(path)=>{calls.push(path);if(path.includes('?page='))return {deliveries:[{id:'delivery_test',title:p.title,coach_name:'Coach',sent_at:'2026-10-05T10:00:00Z'}],hasMore:false};return {program:p,title:p.title,coachName:'Coach',athleteName:'Athlete',revision:1}});await b.ready('athlete');assert.equal(calls.length,1);const select=b.label('برنامه دریافتی');select.value='delivery_test';select.onchange();await flush();assert.equal(calls.length,2);assert.ok(b.root.textContent.includes('فقط خواندنی'));assert.ok(!b.root.textContent.includes('ذخیره برنامه'));assert.equal(b.root.querySelectorAll('button').find(x=>x.attributes['aria-selected']==='true').textContent,domain.WEEK_DAYS[domain.iranWeekday()])});
test('library errors never fabricate program rows',async()=>{const b=browser('library',async()=>{throw Error('offline')});await b.ready();assert.ok(!b.root.textContent.includes('برنامه تمرینی سه ماهه'));assert.ok(b.root.textContent.includes('تلاش دوباره'))});
