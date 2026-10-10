import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../../education-studio.html',import.meta.url),'utf8');
const themes=fs.readFileSync(new URL('../../mg-global-theme.css',import.meta.url),'utf8');
test('education studio private-save action compiles and posts a curated week plan',()=>{
 const module=html.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/);
 assert.ok(module,'education studio module script is present');
 const source=module[1].replace(/^import\s.+?;\s*/,'');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction(source));
 assert.ok(html.includes('id="savePrivateWeek"'));
 assert.ok(source.includes('/api/workouts/saved'));
 assert.ok(source.includes("localStorage.getItem('mg_session')"));
});

test('education studio separates movement learning from workout building with accessible tabs',()=>{
 assert.match(html,/id="workspaceSwitch"[^>]*role="tablist"/);
 assert.match(html,/id="learnTab"[^>]*aria-controls="studio"/);
 assert.match(html,/id="planTab"[^>]*aria-controls="planner"/);
 assert.match(html,/body\[data-workspace="learn"\] #planner/);
 assert.match(html,/body\[data-workspace="plan"\] #studio/);
 const module=html.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/);
 assert.ok(module,'education studio module script is present');
 assert.match(module[1],/function setWorkspace\(mode,writeHash=true\)/);
 assert.match(module[1],/window\.addEventListener\('hashchange'/);
});

test('mobile movement library is an accessible off-canvas drawer, not a model overlay',()=>{
 assert.match(html,/\.layout\{display:grid;grid-template-columns:minmax\(0,1fr\);min-width:0\}/);
 assert.match(html,/\.library:not\(\.open\)\{visibility:hidden;pointer-events:none;transform:translateX\(110%\)!important\}/);
 assert.match(html,/\.library\.open\{visibility:visible;opacity:1!important;pointer-events:auto;transform:translateX\(0\)!important/);
 assert.match(html,/\.scrim:not\(\.hidden\)\{z-index:60/);
 assert.match(html,/id="burger"[^>]*aria-controls="library"[^>]*aria-expanded="false"/);
 assert.match(html,/drawerQuery\.addEventListener\('change',syncDrawerMode\)/);
 assert.match(html,/lib\.setAttribute\('inert',''\)/);
 assert.match(html,/lib\.removeAttribute\('inert'\)/);
 assert.match(html,/\$\('#scrim'\)\.onclick=\(\)=>closeDrawer\(true\)/);
 assert.match(html,/if\(e\.key==='Escape'\).*closeDrawer\(\)/s);
});

test('education header includes compact links to public site sections',()=>{
 const header=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1]||'';
 assert.match(header,/<nav class="navlinks" aria-label="ناوبری سایت">/);
 for(const href of ['index.html','membership.html','news.html','mg-journal.html','app.html','#studio','#planner'])
  assert.ok(header.includes(`href="${href}"`),`header includes ${href}`);
 assert.match(html,/@media\(max-width:1200px\)[\s\S]*?\.navlinks\{order:5;flex:1 0 100%/);
});

test('movement categories stay inside a visible, touch-scrollable filter rail',()=>{
 assert.match(html,/\.chiprow\{[^}]*overflow-x:auto[^}]*min-width:0[^}]*touch-action:pan-x/s);
 assert.match(html,/\.chiprow::-webkit-scrollbar\{height:6px\}/);
 assert.match(html,/id="catFilter"[^>]*tabindex="0"/);
 assert.match(html,/id="categoryScrollHint"/);
 assert.match(html,/برای دیدن همهٔ گروه‌ها، فهرست را افقی بکشید/);
});

test('modern education palettes keep primary gradients coherent and classic unchanged',()=>{
 assert.match(html,/:root\[data-mg-theme\^="modern-light"\]\{--grad:linear-gradient\(120deg,#d4e99e,#b8e63f\)\}/);
 assert.match(html,/:root\[data-mg-theme\^="modern-dark"\]\{--grad:linear-gradient\(120deg,#d8f89a,#b8e63f\)\}/);
 assert.match(html,/--grad:linear-gradient\(120deg,var\(--lime\),var\(--mint\)\)/);
 assert.match(html,/\.chip\[aria-pressed=true\]\{background:var\(--mg-accent-soft/);
});

test('shared modern theme text and action pairs keep WCAG AA contrast',()=>{
 const luminance=(hex)=>{
  const [r,g,b]=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
 };
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 const pairs=[
  ['#20291e','#ffffff'],['#56624f','#ffffff'],['#4d6d1c','#ffffff'],['#18210f','#b8e63f'],
  ['#f2f7ef','#17221a'],['#bac7b7','#17221a'],['#d6ff78','#17221a'],['#17200f','#c6ff3f'],
  ['#a3354d','#ffffff'],['#ff91a3','#17221a'],
 ];
 assert.ok(themes.includes('semantic surfaces, legible text, and restrained brand accents'));
 for(const [foreground,background] of pairs){
  assert.ok(themes.includes(foreground)&&themes.includes(background),`theme tokens include ${foreground} and ${background}`);
  assert.ok(ratio(foreground,background)>=4.5,`${foreground} on ${background} meets 4.5:1`);
 }
});
