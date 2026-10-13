import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { alignModelUpAxis } from '../../assets/education/model-axis.mjs';
import { samplePoseMotion } from '../../assets/education/pose-motion.mjs';
import { EXERCISE_ADDITIONS } from '../../assets/education/exercise-additions.mjs';
import { estimateExerciseDuration, formatExerciseDuration, sumExerciseDurations, usesIndependentTiming } from '../../assets/education/exercise-duration.mjs';
import { normalizeExerciseName } from '../workout-domain.js';

const html=fs.readFileSync(new URL('../../education-studio.html',import.meta.url),'utf8');
const themes=fs.readFileSync(new URL('../../mg-global-theme.css',import.meta.url),'utf8');

test('education library expands to 175 unique movements with estimates for every prescription',()=>{
 const start=html.indexOf('const DATA=')+'const DATA='.length;
 const end=html.indexOf('];',start)+1;
 assert.ok(start>0&&end>start,'base movement seed is present');
 const base=JSON.parse(html.slice(start,end));
 const all=[...base,...EXERCISE_ADDITIONS];
 assert.equal(EXERCISE_ADDITIONS.length,20);
 assert.equal(all.length,175);
 assert.equal(new Set(all.map(item=>item.k)).size,all.length,'movement keys are unique');
 assert.equal(new Set(all.map(item=>normalizeExerciseName(item.fa))).size,all.length,'Persian exercise names are unique');
 assert.ok(all.every(item=>estimateExerciseDuration(item)?.minSeconds>0),'all movement prescriptions have an estimate');
 const counts=JSON.parse(html.match(/const COUNTS=(\{[^\r\n]+\});/)[1]);
 const byCategory=all.reduce((result,item)=>{const group=item.cat==='پا و پشت پا (همسترینگ)'?'پا و باسن':item.cat;result[group]=(result[group]||0)+1;return result;},{});
 assert.deepEqual(byCategory,counts,'each scrollable category displays its actual movement count');
 assert.match(html,/DATA\.push\(\.\.\.EXERCISE_ADDITIONS\)/);
 assert.match(html,/const categoryOf=e=>/,'the lower-body category filter maps detailed labels consistently');
 assert.match(html,/id="movementEstimate"/);
 assert.match(html,/id="weekDuration"/);
 assert.match(fs.readFileSync(new URL('../../sw.js',import.meta.url),'utf8'),/exercise-additions\.mjs\?v=20261012-exercise-estimates-v1/);
});

test('duration estimates account for reps, one-side-per-limb, tempo and set rests',()=>{
 const start=html.indexOf('const DATA=')+'const DATA='.length,end=html.indexOf('];',start)+1;
 const base=JSON.parse(html.slice(start,end));
 const bulgarian=estimateExerciseDuration(base.find(item=>item.k==='bulgarian'));
 assert.deepEqual([bulgarian.minSeconds,bulgarian.maxSeconds],[264,360]);
 const plank=estimateExerciseDuration(base.find(item=>item.k==='plank'));
 assert.deepEqual([plank.minSeconds,plank.maxSeconds],[150,270]);
 const cardio=estimateExerciseDuration(base.find(item=>item.k==='bike'));
 assert.deepEqual([cardio.minSeconds,cardio.maxSeconds],[900,1800]);
 const cooldown=estimateExerciseDuration(base.find(item=>item.k==='cooldown'));
 assert.deepEqual([cooldown.minSeconds,cooldown.maxSeconds],[150,240]);
 const carry=estimateExerciseDuration(base.find(item=>item.k==='bottomsupcarry'));
 assert.deepEqual([carry.minSeconds,carry.maxSeconds],[228,330]);
 assert.equal(usesIndependentTiming(base.find(item=>item.k==='hundred')),true);
 assert.equal(usesIndependentTiming(base.find(item=>item.k==='bulgarian')),false);
 const cossack=EXERCISE_ADDITIONS.find(item=>item.k==='cossack-squat');
 const planned=estimateExerciseDuration(cossack,{sets:4,reps:'۸–۱۰'});
 assert.deepEqual([planned.minSeconds,planned.maxSeconds],[564,750]);
 assert.equal(formatExerciseDuration({minSeconds:30,maxSeconds:30}),'حدود ۳۰ ثانیه');
 const total=sumExerciseDurations([cossack,cossack],key=>EXERCISE_ADDITIONS.find(item=>item.k===key));
 assert.equal(total.minSeconds,2*estimateExerciseDuration(cossack).minSeconds);
});
test('education studio private-save action compiles and posts a curated week plan',()=>{
 const module=html.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/);
 assert.ok(module,'education studio module script is present');
 const source=module[1].replace(/^import\s.+?;\s*/gm,'');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction(source));
 assert.ok(html.includes('id="savePrivateWeek"'));
 assert.ok(source.includes('/api/workouts/saved'));
 assert.ok(source.includes("localStorage.getItem('mg_session')"));
});

test('male anatomy preview stays readable in surface mode and page copy is not gender-mismatched',()=>{
 assert.doesNotMatch(html,/بدنسازی بانوان|ویژهٔ بانوان|برای بانوان شیراز/);
 assert.match(html,/مدل آناتومی مردانه/);
 assert.match(html,/transmission:\.42/);
 assert.doesNotMatch(html,/\bdispersion\s*:/,'Three.js r160 does not support dispersion on this material');
 assert.match(html,/transmission:\.30,thickness:\.24,roughness:\.24/);
 assert.match(html,/color:0xe2b99e/);
 assert.match(html,/pc\.scale\.set\(1\.44,\.64,\.30\)/);
 assert.doesNotMatch(html,/دم‌اسبی ورزشی|دوخت بند سینه|سوتین/);
 assert.match(html,/موی کوتاه ورزشی/);
 assert.match(html,/const fade=\(m,minOpacity=\.16\)=>\{m\.transparent=dT>\.02; m\.opacity=1-dT\*\(1-minOpacity\)/);
 assert.match(html,/fade\(m,\.40\)/);
});

test('static anatomy view hides the exercise-mode muscle labels to avoid duplicate hotspots',()=>{
 assert.ok(html.includes(',.stage.anatomy-mode .controlrow,.stage.anatomy-mode #muscleLabels{display:none}'));
 const updateLabels=html.match(/updateLabels\(exercise\)\{([\s\S]*?)\n  \}/);
 assert.ok(updateLabels,'exercise-label update method is present');
 assert.match(updateLabels[1],/if\(this\.anatomyMode\|\|!labelsOn/);
});

test('anatomy hotspots and selected guidance stay synchronized with the visible camera side',()=>{
 const updateHotspots=html.match(/updateAnatomyHotspots\(\)\{([\s\S]*?)\n  \}/);
 assert.ok(updateHotspots,'anatomy hotspot updater is present');
 assert.match(updateHotspots[1],/const facing=anatomyFaceAtYaw\(this\.cam\.yaw\),canLabel=Boolean\(facing\)/);
 assert.match(updateHotspots[1],/this\.selectedAnatomyFace!==facing\)this\.clearAnatomySelection\(\)/);
 const selectRegion=html.match(/selectAnatomyRegion\(key,face,point,normal\)\{([\s\S]*?)\n  \}/);
 assert.ok(selectRegion,'anatomy region selector is present');
 assert.match(selectRegion[1],/this\.selectedAnatomyRegion=key;this\.selectedAnatomyFace=face/);
 const clearRegion=html.match(/clearAnatomySelection\(\)\{([\s\S]*?)\n  \}/);
 assert.ok(clearRegion,'anatomy selection reset is present');
 assert.match(clearRegion[1],/this\.anatomyPanel\.hidden=true/);
 assert.match(clearRegion[1],/this\.anatomyHighlightState\.active\.value=0/);
 const setView=html.match(/setView\(v\)\{([\s\S]*?)\n  \}/);
 assert.ok(setView,'anatomy view control is present');
 assert.match(setView[1],/v==='free'\|\|anatomyFaceAtYaw\(nextYaw\)!==this\.selectedAnatomyFace/);
});

test('procedural male avatar uses a tapered head and responsive framing without changing anatomy framing',()=>{
 assert.match(html,/const head=lathe\(\[\[\.002,0\],\[\.034,\.004\],\[\.058,\.015\]/);
 assert.match(html,/defaultDistance\(\)\{\s*const aspect=this\.view\.clientWidth\/Math\.max\(1,this\.view\.clientHeight\);\s*return aspect<\.82\?4\.20:3\.65;/);
 assert.match(html,/this\.camGoal=\{yaw:0,pitch:\.16,dist:this\.anatomyMode\?4\.05:this\.defaultDistance\(\)\}/);
 assert.match(html,/const distance=this\.anatomyMode\?4\.05:this\.defaultDistance\(\)/);
});

test('animated avatar bridges the shoulder-to-torso seam symmetrically on the moving arm rig',()=>{
 assert.match(html,/const shoulderBlend=sph\(\.044,bodySkin\); shoulderBlend\.scale\.set\(1\.52,\.92,\.62\); shoulderBlend\.position\.set\(-\.036\*side,-\.016,-\.003\); sg\.add\(shoulderBlend\)/);
 assert.match(html,/R\[side<0\?'shoulderBlendL':'shoulderBlendR'\]=shoulderBlend/);
 const armStart=html.indexOf('const mkArm=(side)=>{');
 const blendAt=html.indexOf('const shoulderBlend=',armStart),deltAt=html.indexOf('const delt=sph(',armStart);
 assert.ok(armStart>=0&&blendAt>armStart&&deltAt>blendAt,'both shoulder transitions are built inside the arm rig before the deltoid');
});

test('animated muscle labels anchor to the matching modeled muscle instead of the parent bone',()=>{
 assert.match(html,/R\[side<0\?'bicepsL':'bicepsR'\]=bi/);
 assert.match(html,/R\[side<0\?'tricepsL':'tricepsR'\]=tri/);
 assert.match(html,/R\[side<0\?'forearmsL':'forearmsR'\]=flex/);
 assert.match(html,/R\[side<0\?'quadsL':'quadsR'\]=plate/);
 assert.match(html,/R\[side<0\?'hamsL':'hamsR'\]=hm/);
 assert.match(html,/R\[side<0\?'calvesL':'calvesR'\]=ga/);
 assert.match(html,/R\[s<0\?'obliquesL':'obliquesR'\]=ob/);
 assert.match(html,/R\[s<0\?'trapsL':'trapsR'\]=tp/);
 assert.match(html,/biceps:\(\)=>wp\(R\.bicepsR\|\|R\.uaR\), triceps:\(\)=>wp\(R\.tricepsR\|\|R\.uaR\)/);
 assert.match(html,/quads:\(\)=>wp\(R\.quadsR\|\|R\.thighR\), hams:\(\)=>wp\(R\.hamsR\|\|R\.thighL\)/);
 assert.match(html,/ab_obliques:\(\)=>wp\(R\.obliquesR\|\|R\.torso\)/);
 assert.match(html,/traps:\(\)=>wp\(R\.trapsR\|\|R\.top\)/);
});

test('animated pose switching resets derivative so a new exercise cannot inherit a false velocity impulse',()=>{
 const first=samplePoseMotion({exercise:'squat',y:.655},'shoulderpress',.965,1/60);
 assert.equal(first.velocity,0);
 assert.deepEqual(first.state,{exercise:'shoulderpress',y:.965});
 const continuing=samplePoseMotion(first.state,'shoulderpress',.955,.02);
 assert.ok(Math.abs(continuing.velocity-(-.5))<1e-9);
 assert.deepEqual(samplePoseMotion(continuing.state,null,.98,.02),{state:null,velocity:0});
 const recovered=samplePoseMotion(null,'squat',.655,.02);
 assert.equal(recovered.velocity,0);
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
 assert.match(html,/:root\[data-mg-theme="modern-studio"\]\{--grad:linear-gradient\(120deg,#c2410c,#1d4ed8\);--education-lime-rgb:29,78,216;--education-mint-rgb:194,65,12\}/);
 assert.match(html,/rgba\(var\(--education-lime-rgb, 201,242,79\),/);
 assert.match(html,/rgba\(var\(--education-mint-rgb, 127,232,201\),/);
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

test('live anatomy normalizes its imported long axis before fitting and hit mapping',()=>{
 assert.match(html,/const sourceBounds=new this\.T\.Box3\(\)\.setFromObject\(model\)/);
 assert.match(html,/const verticalAxis=alignModelUpAxis\(model,sourceSize\)/);
 assert.match(html,/model\.updateMatrixWorld\(true\);\s*const bounds=new this\.T\.Box3\(\)\.setFromObject\(model\)/);
 assert.match(html,/model\.position\.set\(-center\.x\*fit,-bounds\.min\.y\*fit,-center\.z\*fit\)/);
 const normalizeAt=html.indexOf('const verticalAxis=alignModelUpAxis(model,sourceSize)');
 const fitBoundsAt=html.indexOf('const bounds=new this.T.Box3().setFromObject(model)',normalizeAt);
 assert.ok(normalizeAt>=0&&fitBoundsAt>normalizeAt,'fitting bounds are recomputed after axis normalization');
});

test('the anatomical model loads and becomes the default view before the mannequin switch is offered',()=>{
 const bootStart=html.indexOf('async function boot3D(){'),bootEnd=html.indexOf('class Studio{',bootStart);
 assert.ok(bootStart>=0&&bootEnd>bootStart,'3D initialization is present');
 const boot=html.slice(bootStart,bootEnd);
 assert.match(boot,/await S3D\.ensureAnatomy\(\);\s*S3D\.setAnatomyMode\(true\)/);
 assert.match(html,/this\.anatomyMode\?'نمایش مدل تمرینی':'نمایش مدل آناتومی'/);
 assert.match(html,/Anatomy model unavailable; keeping the animated model as fallback/);
});

test('anatomy model comparison normalizes non-Y-up assets before display fitting',()=>{
 const compare=fs.readFileSync(new URL('../../assets/education/blender-review/model-compare.html',import.meta.url),'utf8');
 assert.match(compare,/const initialBox=new THREE\.Box3\(\)\.setFromObject\(current\)/);
 assert.match(compare,/const verticalAxis=alignModelUpAxis\(current,initialSize\)/);
 assert.match(compare,/current\.updateMatrixWorld\(true\)/);
 assert.match(compare,/const box=new THREE\.Box3\(\)\.setFromObject\(current\)[^;]*scale=2\.1\/size\.y/);
 const zUp={rotation:{x:0,z:0}};assert.equal(alignModelUpAxis(zUp,{x:26,y:11,z:68}),'z');assert.equal(zUp.rotation.x,-Math.PI/2);
 const xUp={rotation:{x:0,z:0}};assert.equal(alignModelUpAxis(xUp,{x:50,y:8,z:10}),'x');assert.equal(xUp.rotation.z,Math.PI/2);
 const yUp={rotation:{x:0,z:0}};assert.equal(alignModelUpAxis(yUp,{x:20,y:70,z:15}),'y');assert.deepEqual(yUp.rotation,{x:0,z:0});
 const mgLive={rotation:{x:0,z:0}};assert.equal(alignModelUpAxis(mgLive,{x:2.19,y:.49,z:2.82}),'z');assert.equal(mgLive.rotation.x,-Math.PI/2);
 assert.throws(()=>alignModelUpAxis({rotation:{x:0,z:0}},{x:0,y:0,z:0}),/finite, positive/);
});

test('anatomy comparison can isolate meshes, inspect neutral geometry stats and release replaced assets',()=>{
 const compare=fs.readFileSync(new URL('../../assets/education/blender-review/model-compare.html',import.meta.url),'utf8');
 const module=compare.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/);
 assert.ok(module,'comparison viewer module is present');
 const source=module[1].replace(/^import\s.+?;\s*/gm,'');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction(source));
 assert.match(compare,/data-show-all/);assert.match(compare,/data-hide-all/);
 assert.match(compare,/aria-pressed/);assert.match(compare,/data-isolate/);
 assert.match(compare,/const label=`بخش \$\{new Intl\.NumberFormat\('fa-IR'\)\.format\(i\+1\)\}`/);
 assert.match(compare,/\.mesh-row \.mesh-toggle\.active/);
 assert.match(compare,/role','status'/);assert.match(compare,/aria-live','polite'/);
 assert.match(compare,/function showMeshDetail\(mesh,index\)/);
 assert.match(compare,/geometry\.index\?\.count\?\?geometry\.attributes\.position\?\.count/);
 assert.match(compare,/ابعاد نمایشی/);assert.match(compare,/شناسهٔ علمی عضله محسوب نمی‌شوند/);
 assert.match(compare,/function disposeModel\(model\)/);
 assert.match(compare,/data-model="phase23c"/);
 assert.match(compare,/candidate-fullbody-ecorche-phase23c-decimate90-ccby-meshopt\.glb/);
 assert.match(compare,/بهینه‌شده · ۶٫۷۴MB · بازبینی/);
 assert.match(compare,/requestId!==loadSequence/);
});
