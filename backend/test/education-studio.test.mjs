import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../../education-studio.html',import.meta.url),'utf8');
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
 assert.match(html,/\.library\.open\{visibility:visible;pointer-events:auto;transform:translateX\(0\)!important/);
 assert.match(html,/\.scrim:not\(\.hidden\)\{z-index:60/);
 assert.match(html,/id="burger"[^>]*aria-controls="library"[^>]*aria-expanded="false"/);
 assert.match(html,/drawerQuery\.addEventListener\('change',syncDrawerMode\)/);
 assert.match(html,/lib\.setAttribute\('inert',''\)/);
 assert.match(html,/lib\.removeAttribute\('inert'\)/);
 assert.match(html,/\$\('#scrim'\)\.onclick=\(\)=>closeDrawer\(true\)/);
 assert.match(html,/if\(e\.key==='Escape'\).*closeDrawer\(\)/s);
});
