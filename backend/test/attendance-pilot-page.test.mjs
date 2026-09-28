import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=fs.existsSync(new URL('../../current/index.html',import.meta.url))?new URL('../../current/',import.meta.url):new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('attendance-pilot.js',root),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function browser(request){
 class El {constructor(){this.children=[];this.textContent='';this.events={}}appendChild(n){this.children.push(n)}replaceChildren(){this.children=[]}addEventListener(n,fn){this.events[n]=fn}}
 const els={refresh:new El(),status:new El(),trials:new El()},events={};let calls=0;
 const context={document:{getElementById:id=>els[id],createElement:()=>new El()},window:{MGApi:{request:async(...a)=>{calls++;return request(...a)}},addEventListener:(n,fn)=>events[n]=fn},AbortSignal,Date};
 vm.runInNewContext(source,context);
 return {els,events,calls:()=>calls};
}
test('pilot page waits for server-backed access guard before requesting balance',async()=>{
 const b=browser(async()=>({trials:[]}));assert.equal(b.calls(),0);b.events['mg:access-ready']();await flush();assert.equal(b.calls(),1);assert.match(b.els.status.textContent,/هنوز اشتراک/);assert.equal(b.els.refresh.disabled,false);
});
test('server balances are text-only and do not become HTML or local deductions',async()=>{
 const b=browser(async()=>({trials:[{label:'<img src=x onerror=alert(1)>',remainingSessions:29,totalSessions:30,usedSessions:1,expiresAt:'2099-01-01T00:00:00Z',status:'active'}]}));
 b.events['mg:access-ready']();await flush();const card=b.els.trials.children[0];assert.equal(card.children[0].textContent,'<img src=x onerror=alert(1)>');assert.match(card.children[1].textContent,/29/);
});
test('unavailable or unauthorized API never fabricates balance',async()=>{
 for(const status of [401,503,500]){const b=browser(async()=>{throw {status}});b.events['mg:access-ready']();await flush();assert.equal(b.els.trials.children.length,0);assert.equal(b.els.refresh.disabled,false);if(status===401)assert.equal(b.els.status.children[0].href,'account.html');}
});
test('pilot HTML is private and uses existing session guard',()=>{
 const html=fs.readFileSync(new URL('attendance-pilot.html',root),'utf8');assert.match(html,/id="mg-access-cloak"/);assert.match(html,/noindex, follow/);assert.match(html,/mg-api.js\?v=20260919-access/);assert.ok(!html.includes('bridgeToken'));
});
