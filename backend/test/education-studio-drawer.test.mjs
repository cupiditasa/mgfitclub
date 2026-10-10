import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../../education-studio.html',import.meta.url),'utf8');

test('mobile movement library stays off-canvas until opened and does not occupy model layout',()=>{
 assert.match(html,/\.layout\{display:grid;grid-template-columns:minmax\(0,1fr\);min-width:0\}/);
 assert.match(html,/\.library:not\(\.open\)\{visibility:hidden;pointer-events:none;transform:translateX\(110%\)!important\}/);
 assert.match(html,/\.library\.open\{visibility:visible;opacity:1!important;pointer-events:auto;transform:translateX\(0\)!important/);
 assert.match(html,/\.scrim:not\(\.hidden\)\{z-index:60/);
 assert.match(html,/id="burger"[^>]*aria-controls="library"[^>]*aria-expanded="false"/);
});

test('mobile movement drawer synchronizes accessibility, focus, resize, backdrop and Escape state',()=>{
 const module=html.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/);
 assert.ok(module,'education studio module script is present');
 const source=module[1].replace(/^import\s.+?;\s*/gm, '');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction(source));
 assert.match(source,/drawerQuery\.addEventListener\('change',syncDrawerMode\)/);
 assert.match(source,/lib\.setAttribute\('inert',''\)/);
 assert.match(source,/lib\.removeAttribute\('inert'\)/);
 assert.match(source,/requestAnimationFrame\(\(\)=>\$\('#search'\)\.focus\(\{preventScroll:true\}\)\)/);
 assert.match(source,/\$\('#scrim'\)\.onclick=\(\)=>closeDrawer\(true\)/);
 assert.match(source,/if\(e\.key==='Escape'\).*closeDrawer\(\)/s);
});
