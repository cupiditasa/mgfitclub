import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=fs.existsSync(new URL('../../current/app.html',import.meta.url))?new URL('../../current/',import.meta.url):new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
test('app is a permanent guide, while the PWA still starts at login',()=>{
  const html=read('app.html');
  assert.ok(!html.includes('location.replace'));
  assert.ok(!html.includes('__MG_PREVIEW_NOTICE_ON_CLOSE'));
  assert.ok(html.includes('id="android-guide"')&&html.includes('id="ios-guide"'));
  assert.ok(html.includes('id="install-app" type="button" hidden'));
  assert.equal(JSON.parse(read('manifest.webmanifest')).start_url,'account.html?source=pwa');
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    if(match[1].startsWith('#'))continue;
    assert.ok(fs.existsSync(new URL(match[1].split('?')[0],root)),match[1]);
  }
  for(const asset of ['app-install.js','app-install.css'])assert.ok(read('sw.js').includes(asset));
});
function fixture(standalone=false){
  const handlers={},install={hidden:true,disabled:false,addEventListener(n,f){this[n]=f}},status={};
  const window={isSecureContext:true,matchMedia:()=>({matches:standalone,addEventListener(){}}),addEventListener(n,f){handlers[n]=f}};
  const navigator={serviceWorker:{register:()=>Promise.resolve()}};
  vm.runInNewContext(read('app-install.js'),{window,navigator,document:{getElementById:id=>id==='install-app'?install:status}});
  return{handlers,install,status};
}
test('install is offered only after browser event, prompts on click and handles dismissal',async()=>{
  const f=fixture();assert.equal(f.install.hidden,true);let prompted=0,prevented=false;
  f.handlers.beforeinstallprompt({preventDefault(){prevented=true},async prompt(){prompted++},userChoice:Promise.resolve({outcome:'dismissed'})});
  assert.equal(prevented,true);assert.equal(f.install.hidden,false);assert.equal(prompted,0);
  await f.install.click();assert.equal(prompted,1);assert.equal(f.install.hidden,true);assert.match(f.status.textContent,/لغو/);
  await f.install.click();assert.equal(prompted,1);
});
test('standalone app does not offer reinstall; prompt failures leave manual guide usable',async()=>{
  const installed=fixture(true);installed.handlers.beforeinstallprompt({preventDefault(){throw Error('must not intercept')}});assert.equal(installed.install.hidden,true);
  const f=fixture();f.handlers.beforeinstallprompt({preventDefault(){},async prompt(){throw Error('unavailable')}});await f.install.click();assert.equal(f.install.disabled,false);assert.match(f.status.textContent,/راهنمای دستی/);
  f.handlers.appinstalled();assert.equal(f.install.hidden,true);assert.match(f.status.textContent,/انجام شد/);
});
