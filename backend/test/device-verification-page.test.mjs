import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=fs.existsSync(new URL('../../current/device-verification.html',import.meta.url))?new URL('../../current/',import.meta.url):new URL('../../',import.meta.url);
const code=fs.readFileSync(new URL('device-verification.js',root),'utf8');
class Element {
 constructor(tag='div',text=''){this.tag=tag;this.textContent=text;this.children=[];this.value='';this.hidden=false;this.disabled=false;}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=nodes}
 querySelector(tag){return this.children.find(n=>n.tag===tag)}
}
function browser(request){
 const ids=['device-status','self-device','refresh-device','staff-device','support-device','bridge-form','bridge-key','bridge-club','bridge-serial','bridges','device-users','prev-users','next-users'];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Element()])),events={};
 const window={addEventListener:(n,fn)=>events[n]=fn};
 const context={window,document:{getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createTextNode:text=>new Element('text',text)},MGApi:{request},AbortSignal,Date,Option:function(text,value){const e=new Element('option',text);e.value=value;return e},confirm:()=>true};
 vm.runInNewContext(code,context);return {nodes,events};
}
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate)};
const mine={registrations:[],clubs:[{id:'club',name:'باشگاه تست'}],canRequest:true,isStaff:false,isSupport:false};
test('device page does not load before access guard and never auto-submits a request',async()=>{
 const calls=[];const b=browser(async(path,opts)=>{calls.push([path,opts]);return mine});assert.equal(calls.length,0);
 b.events['mg:access-ready']();await flush();assert.deepEqual(calls.map(c=>c[0]),['/api/device-verification/me']);
 assert.equal(b.nodes['self-device'].children.at(-1).tag,'form');assert.equal(b.nodes['refresh-device'].disabled,false);
});
test('shared account has no enrollment form',async()=>{
 const b=browser(async()=>({...mine,canRequest:false}));b.events['mg:access-ready']();await flush();
 assert.ok(!b.nodes['self-device'].children.some(n=>n.tag==='form'));assert.match(b.nodes['self-device'].children.at(-1).textContent,/حساب مشترک/);
});
test('request form sends chosen club and explicit consent then renders pending',async()=>{
 let sent=false;const b=browser(async(path,opts)=>{if(path.endsWith('/request')){assert.equal(opts.method,'POST');assert.equal(opts.body.clubId,'club');assert.equal(opts.body.consent,true);sent=true;return {registration:{state:'pending'}}}return {...mine,registrations:sent?[{clubName:'باشگاه تست',state:'pending'}]:[]}});
 b.events['mg:access-ready']();await flush();const form=b.nodes['self-device'].children.at(-1);form.children[0].children[0].value='club';form.children[1].children[0].checked=true;
 form.onsubmit({preventDefault(){}});await flush();assert.equal(sent,true);assert.match(b.nodes['self-device'].children[1].textContent,/در انتظار تأیید/);
});
test('failed status lookup hides stale privileged tables and never shows verified',async()=>{
 const b=browser(async()=>{throw {status:503}});b.events['mg:access-ready']();await flush();
 assert.equal(b.nodes['staff-device'].hidden,true);assert.equal(b.nodes['self-device'].children.length,0);assert.match(b.nodes['device-status'].textContent,/فعال نشده/);
});
test('staff table shows three statuses with safe text; no HTML insertion',async()=>{
 const b=browser(async path=>path.endsWith('/me')?{...mine,isStaff:true}:{users:['unregistered','pending','verified'].map((state,i)=>({id:String(i),full_name:'<script>alert(1)</script>',phone:'TEST',club_name:'تست',device_state:state}))});
 b.events['mg:access-ready']();await flush();const table=b.nodes['device-users'].children[0];assert.equal(table.children.length,4);assert.equal(table.children[1].children[0].textContent,'<script>alert(1)</script> — TEST');assert.match(table.children[3].children[2].textContent,/تأیید شده/);
 assert.ok(!code.includes('innerHTML'));
});
test('private page uses session guard, viewport and dashboard entry is shared',()=>{
 const html=fs.readFileSync(new URL('device-verification.html',root),'utf8'),guard=fs.readFileSync(new URL('access-control.js',root),'utf8');
 assert.match(html,/mg-access-cloak/);assert.match(html,/noindex/);assert.match(html,/width=device-width/);assert.match(guard,/mg-device-link/);assert.match(guard,/api\/device-verification\/me/);
});
