import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=fs.existsSync(new URL('../../current/mg-journal.html',import.meta.url))?new URL('../../current/',import.meta.url):new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const slugs=['functional-wellbeing','strength-confidence','healthy-nutrition','mg-lifestyle'];
test('four dedicated films have correct media, unique SEO, real back links and related pages',()=>{
  slugs.forEach((slug,i)=>{
    const p=`videos/${slug}.html`,html=read(p);
    assert.ok(read('mg-journal.html').includes(`href="${p}"`));
    assert.ok(html.includes(`src="../assets/media/service-${i+1}.mp4"`));
    assert.ok(html.includes(`poster="../assets/images/journal-service-${i+1}.webp"`));
    assert.ok(html.includes(`rel="canonical" href="https://mgfitclub.ir/${p}"`));
    assert.ok(html.includes('href="../mg-journal.html#service-films"'));
    assert.ok(html.includes('controls playsinline preload="none"'));
    assert.ok(!/<video[^>]*autoplay/.test(html));
    const metadata=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(metadata.url,`https://mgfitclub.ir/${p}`);
    assert.equal((html.match(/class="poster-card"/g)||[]).length,3);
    for(const match of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)){
      const value=match[1];if(/^(https?:|#)/.test(value))continue;
      assert.ok(fs.existsSync(new URL(value.split(/[?#]/)[0],new URL(p,root))),value);
    }
    assert.ok(read('sw.js').includes(`./${p}`));
  });
  assert.match(read('journal-gallery.css'),/object-fit:contain/);
  assert.match(read('journal-gallery.css'),/prefers-reduced-motion/);
});
function fixture(){
  class E{constructor(){this.handlers={};this.dataset={};this.hidden=false;this.attrs={};this.scrollLeft=0;this.scrollWidth=1200;this.clientWidth=500;this.classList={add(){},remove(){}}}addEventListener(n,f){(this.handlers[n]??=[]).push(f)}emit(n,props={}){const e={preventDefault(){this.prevented=true},stopPropagation(){},...props};(this.handlers[n]||[]).forEach(f=>f(e));return e}setAttribute(k,v){this.attrs[k]=v}getBoundingClientRect(){return{width:260}}scrollBy(opts){this.scrolled=opts}setPointerCapture(){}querySelector(){return null}}
  const track=new E(),count=new E();const cards=['تمرین','انگیزه','تغذیه','سبک زندگی'].map(c=>{const e=new E();e.dataset.category=c;return e});track.querySelectorAll=()=>cards;
  const filters=['همه','تمرین','تغذیه'].map(c=>{const e=new E();e.dataset.posterFilter=c;return e});const arrows=[1,-1].map(c=>{const e=new E();e.dataset.posterDirection=c;return e});
  const document={getElementById:id=>id==='poster-track'?track:id==='poster-count'?count:null,querySelector:()=>new E(),querySelectorAll:s=>s.includes('filter')?filters:arrows};
  vm.runInNewContext(read('journal-gallery.js'),{document,window:new E(),matchMedia:()=>({matches:true}),Date});return{track,cards,filters,arrows,count};
}
test('gallery filters keep navigation links and counts coherent; arrows respect RTL boundaries',()=>{
  const f=fixture();assert.equal(f.arrows[0].disabled,true);assert.equal(f.arrows[1].disabled,false);
  f.filters[2].emit('click');assert.deepEqual(f.cards.map(c=>c.hidden),[true,true,false,true]);assert.equal(f.filters[2].attrs['aria-pressed'],'true');assert.match(f.count.textContent,/۱/);
  f.filters[0].emit('click');assert.ok(f.cards.every(c=>!c.hidden));f.arrows[1].emit('click');assert.equal(f.track.scrolled.left,-284);assert.equal(f.track.scrolled.behavior,'auto');
  f.track.scrollLeft=-700;f.track.emit('scroll');assert.equal(f.arrows[1].disabled,true);
});
test('mouse dragging suppresses accidental navigation; clicks and touch remain native',()=>{
  let f=fixture();f.track.emit('pointerdown',{pointerType:'mouse',button:0,pointerId:1,clientX:100});f.track.emit('pointermove',{pointerId:1,clientX:130});f.track.emit('pointerup');assert.equal(f.track.scrollLeft,-30);assert.equal(f.track.emit('click').prevented,true);
  f=fixture();f.track.emit('pointerdown',{pointerType:'touch',button:0,pointerId:2,clientX:100});f.track.emit('pointermove',{pointerId:2,clientX:150});assert.equal(f.track.emit('click').prevented,undefined);
  f=fixture();f.track.emit('pointerdown',{pointerType:'mouse',button:0,pointerId:1,clientX:100});f.track.emit('pointermove',{pointerId:1,clientX:102});f.track.emit('pointerup');assert.equal(f.track.emit('click').prevented,undefined);
});
