import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CatmullRomCurve3, LatheGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from '../../assets/vendor/three/three.module.js';
import { blinkEnvelope, dollEyeClosure, dollCameraKeyboardInput, dollIdleMotion, dollBreathingMotion, dollGazeMotion, dollHeadCounterTilt, dollGripMotion, dollThumbOpposition, dollEffortMotion } from '../../assets/education/doll-character-math.mjs';

const html = fs.readFileSync(new URL('../../education-studio.html', import.meta.url), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

test('doll blink eases through open, close, and reopen states', () => {
  assert.equal(blinkEnvelope(0.2), 0);
  assert.ok(Math.abs(blinkEnvelope(0.0375) - 0.5) < 1e-9);
  assert.equal(blinkEnvelope(0), 1);
  assert.ok(Math.abs(blinkEnvelope(-0.0575) - 0.5) < 1e-9);
  assert.equal(blinkEnvelope(-0.2), 0);
  assert.equal(blinkEnvelope(Number.NaN), 0);
});

test('doll idle motion stays subtle, finite, and can be disabled', () => {
  const still = dollIdleMotion(2, 0);
  assert.deepEqual(still, { headTilt: 0, headTurn: 0, shoulderLift: 0, gaze: 0 });
  const moving = dollIdleMotion(2);
  assert.ok(Object.values(moving).every(Number.isFinite));
  assert.ok(Math.abs(moving.headTilt) <= 0.014);
  assert.ok(Math.abs(moving.headTurn) <= 0.018);
  assert.ok(Math.abs(moving.shoulderLift) <= 0.006);
  assert.ok(Math.abs(moving.gaze) <= 0.0014);
});

test('camera keyboard controls rotate, zoom within bounds, reset and ignore unrelated keys', () => {
  const camera = { yaw: 0, pitch: 0.16, dist: 3.65 };
  assert.ok(Math.abs(dollCameraKeyboardInput('ArrowLeft', camera).yaw + 0.16) < 1e-9);
  assert.ok(Math.abs(dollCameraKeyboardInput('ArrowUp', camera).pitch - 0.28) < 1e-9);
  assert.ok(Math.abs(dollCameraKeyboardInput('+', camera).dist - 3.41) < 1e-9);
  assert.deepEqual(dollCameraKeyboardInput('Home', { yaw: 1, pitch: 0.9, dist: 5 }, 4.2), { yaw: 0, pitch: 0.16, dist: 4.2 });
  assert.equal(dollCameraKeyboardInput('Space', camera), null);
  assert.equal(dollCameraKeyboardInput('ArrowUp', { pitch: 1.15 }).pitch, 1.15);
  assert.equal(dollCameraKeyboardInput('ArrowDown', { pitch: 0.02 }).pitch, 0.02);
  assert.equal(dollCameraKeyboardInput('+', { dist: 2.7 }).dist, 2.7);
  assert.equal(dollCameraKeyboardInput('-', { dist: 7.2 }).dist, 7.2);
  assert.equal(dollCameraKeyboardInput('ArrowRight', null), null);
});

test('breathing cadence and opposing chest/abdomen response scale safely with effort', () => {
  const rest = dollBreathingMotion(1.7, 0);
  const exertion = dollBreathingMotion(1.7, 1);
  assert.ok(exertion.rate > rest.rate);
  assert.ok(Math.abs(exertion.chest) > Math.abs(rest.chest));
  assert.equal(dollBreathingMotion(1.7, 0, 0).chest, 0);
  for (let effort = 0; effort <= 1; effort += 0.05) {
    const breath = dollBreathingMotion(3.2, effort);
    assert.ok(Object.values(breath).every(Number.isFinite));
    assert.ok(Math.abs(breath.chest) <= 0.0091);
    assert.ok(Math.abs(breath.abdomen) <= 0.0046);
    assert.ok(Math.abs(breath.shoulder) <= 0.00181);
    assert.ok(breath.chest === 0 || Math.sign(breath.abdomen) === -Math.sign(breath.chest));
  }
  assert.deepEqual(dollBreathingMotion(Number.NaN, Number.NaN), dollBreathingMotion(0, 0));
});

test('gaze settles under load and remains subtle for reduced motion', () => {
  const free = dollGazeMotion(4.1, 0);
  const focused = dollGazeMotion(4.1, 1);
  assert.ok(Math.abs(focused.x) < Math.abs(free.x));
  assert.ok(Math.abs(focused.y) < Math.abs(free.y));
  assert.deepEqual(dollGazeMotion(4.1, 0, 0), { x: 0, y: 0 });
  assert.ok(Math.abs(free.x) <= 0.0014 && Math.abs(free.y) <= 0.0009);
});

test('head counter-tilt is bounded and offsets forward torso lean', () => {
  assert.ok(dollHeadCounterTilt(0.5, 0.2) < 0);
  assert.equal(dollHeadCounterTilt(0, 0), 0);
  assert.equal(dollHeadCounterTilt(100, 100), -0.09);
  assert.equal(dollHeadCounterTilt(Number.NaN, Number.NaN), 0);
});

test('grip firms up under effort while finger tremor decreases and remains bounded', () => {
  const resting = Array.from({ length: 8 }, (_, i) => dollGripMotion((i * Math.PI) / 3, 0, i % 4));
  const loaded = Array.from({ length: 8 }, (_, i) => dollGripMotion((i * Math.PI) / 3, 1, i % 4));
  assert.ok(Math.max(...loaded) > Math.max(...resting));
  assert.ok(Math.max(...loaded) - Math.min(...loaded) < Math.max(...resting) - Math.min(...resting));
  for (const value of [...resting, ...loaded]) assert.ok(value >= -0.004 && value <= 0.15);
  assert.equal(dollGripMotion(Number.NaN, Number.NaN, Number.NaN), dollGripMotion(0, 0, 0));
});

test('thumb opposition increases predictably with grip effort and stays bounded',()=>{
 assert.equal(dollThumbOpposition(0),0);
 assert.ok(Math.abs(dollThumbOpposition(.5)-.10)<1e-12);
 assert.equal(dollThumbOpposition(1),.20);
 assert.equal(dollThumbOpposition(Number.NaN),0);
 for(let effort=-.5;effort<=1.5;effort+=.05){
  const opposition=dollThumbOpposition(effort);
  assert.ok(Number.isFinite(opposition)&&opposition>=0&&opposition<=.20);
 }
});

test('effort expressions blend smoothly and stay within visual bounds', () => {
  const rested = dollEffortMotion(0);
  const strained = dollEffortMotion(1);
  assert.equal(rested.mouthOpen, 0);
  assert.equal(strained.mouthOpen, 1);
  assert.ok(strained.browTension > rested.browTension);
  assert.ok(strained.cheekFlush > rested.cheekFlush);
  assert.deepEqual(dollEffortMotion(Number.NaN), rested);
  for (let effort = 0; effort <= 1; effort += 0.05) {
    const cues = Object.values(dollEffortMotion(effort));
    assert.ok(cues.every(Number.isFinite));
    assert.ok(cues[0] >= 0 && cues[0] <= 1);
  }
});

test('animated doll details stay rigged and the mobile model uses a lighter geometry profile', () => {
  assert.match(html, /const compact3D=matchMedia\('\(max-width: 720px\), \(pointer: coarse\)'\)/);
  assert.match(html, /new THREE\.WebGLRenderer\(\{canvas,antialias:!compact3D,alpha:true,powerPreference:compact3D\?'low-power':'high-performance'\}\)/);
  assert.match(html, /R\.setPixelRatio\(Math\.min\(devicePixelRatio,compact3D\?1\.1:2\)\)/);
  assert.match(html, /R\.shadowMap\.enabled=!compact3D/);
  assert.match(html, /key\.castShadow=!compact3D/);
  assert.match(html, /key\.shadow\.mapSize\.set\(compact3D\?512:1024,compact3D\?512:1024\)/);
  assert.match(html, /const compact3D=this\.compact3D/);
  assert.match(html, /parent\.add\(m\);return m/);
  assert.match(html, /headG\.scale\.setScalar\(\.99\)/);
  assert.match(html, /this\.eyeLids=\[\]/);
  assert.match(html, /new T\.TorusGeometry\(\.094,\.0038,8,40\)/);
  assert.match(html, /const neck=lathe\(\[\[\.036,-\.078\],\[\.044,-\.058\],\[\.042,-\.028\],\[\.039,\.012\],\[\.036,\.050\],\[\.034,\.078\]\],bodySkin,32\); neck\.position\.y=\.292; neck\.scale\.y=\.76/);
  assert.match(html, /this\.gripDigits\.push/);
  assert.match(html, /dollBreathingMotion\(time,ef/);
  assert.match(html, /dollHeadCounterTilt\(p\.spine\|\|0,p\.chest\|\|0\)/);
  assert.match(html, /dollGazeMotion\(time,ef,motionScale\)/);
  assert.match(html, /dollGripMotion\(time,ef,digit\.index\)/);
  assert.match(html, /const ambientMotion=REDUCED\?0:1/);
  assert.match(html, /R\.abdomen=abdomenG/);
  assert.match(html, /expressionMaterials\.smile\.opacity=1-expression\.mouthOpen/);
  assert.match(html, /toeCap=sph\(\.024,sneakerSoleM\)/);
  assert.match(html, /const shoeTongue=sph\(\.018,sneakerM\)/);
  assert.match(html, /new T\.TorusGeometry\(\.021,\.0018,6,28\),fabricTrimM/);
  assert.match(html, /dput\(cap\(\.0011,\.018,sportAccentM\),\[-\.014,-\.058,laceZ\],\[\.014,-\.058,laceZ\+\.009\],ag\)/);
  assert.match(html, /dput\(cap\(\.0015,\.042,sneakerTreadM\),\[-\.023,-\.116,\.075\+i\*\.020\],\[\.023,-\.116,\.075\+i\*\.020\],ag\)/);
  assert.match(html, /sneakerSoleM/);
  assert.match(html, /doll-character-math\.mjs\?v=20261013-doll-hand-v1/);
  assert.match(serviceWorker, /mg-fitclub-v20261016-mobile-webgl-v29/);
  assert.match(serviceWorker, /doll-character-math\.mjs\?v=20261013-doll-hand-v1/);
});

test('stage 4 improves doll neck-to-head proportions without non-uniform head scaling',()=>{
 assert.match(html,/const headG=this\.headG=new T\.Group\(\); headG\.position\.y=\.34; headG\.scale\.setScalar\(\.99\)/);
 const headBase=.34,neckCenter=.292,neckHalfHeight=.078*.76,neckTopRadius=.034,headHalfWidth=.096;
 const overlap=neckCenter+neckHalfHeight-headBase;
 assert.ok(overlap>=.01,'neck mesh overlaps the head base by at least 1 cm in model units');
 assert.ok(neckTopRadius/headHalfWidth>=.32&&neckTopRadius/headHalfWidth<=.40,'neck top width remains proportionate to head width');
 assert.match(html,/const neck=lathe\(\[\[\.036,-\.078\],\[\.044,-\.058\],\[\.042,-\.028\],\[\.039,\.012\],\[\.036,\.050\],\[\.034,\.078\]\],bodySkin,32\); neck\.position\.y=\.292; neck\.scale\.y=\.76/);
});

test('stage 5 keeps swept hair and temple locks attached to the rotating head',()=>{
 assert.match(html,/sideCut\.position\.set\(\.071\*s,\.105,\.018\); headG\.add\(sideCut\)/,'temple locks overlap the skull edge instead of sitting behind the head');
 assert.match(html,/const hairStrands=\[\]/);
 assert.match(html,/new T\.CatmullRomCurve3\(points\.map\(point=>V3\(\.\.\.point\)\)\)/);
 assert.match(html,/new T\.TubeGeometry\(curve,12,r,6,false\)/);
 assert.match(html,/for\(const x of \[-\.027,0,\.027\]\)/);
 assert.match(html,/hairSweep\(sweep,\.0028,hairM\)/);
 assert.match(html,/hairSweep\(sweep\.map\(\(\[px,y,z\]\)=>\[px-\.0012,y\+\.001,z\+\.001\]\),\.0007,hairAccentM\)/);
 assert.match(html,/this\.hairStrands=hairStrands/);
 assert.ok((html.match(/hairSweep\(/g)||[]).length>=2,'each of three curved locks receives a hair strand and subtle accent stroke');
 for(const x of [-.027,0,.027]){
  const points=[[x-.007,.176,.077],[x-.001,.193,.092],[x+.007,.207,.080]];
  const geometry=new TubeGeometry(new CatmullRomCurve3(points.map(point=>new Vector3(...point))),12,.0028,6,false);
  geometry.computeBoundingBox();
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite),'swept lock vertices stay finite');
  assert.ok(geometry.boundingBox.min.z>.07&&geometry.boundingBox.max.z<.10,'locks remain on the crown/front hair shell instead of jutting out');
  assert.ok(geometry.boundingBox.min.y>.16&&geometry.boundingBox.max.y<.22,'locks remain within the upper hairline');
  geometry.dispose();
 }
});

test('stage 6 closes over the sclera smoothly without changing the open-eye geometry',()=>{
 assert.match(html,/const closedLid=sph\(\.0094,lidM\);closedLid\.position\.set\(eyeX,\.1005,\.0944\);closedLid\.scale\.set\(1\.22,\.90,\.30\);closedLid\.visible=false;headG\.add\(closedLid\)/);
 assert.match(html,/closed:closedLid,closedScaleY:closedLid\.scale\.y/);
 assert.match(html,/const eyeClosure=dollEyeClosure\(blink\)/);
 assert.match(html,/lids\.closed\.scale\.y=lids\.closedScaleY\*eyeClosure/);
 assert.match(html,/lids\.closed\.visible=eyeClosure>\.015/);
 assert.equal(dollEyeClosure(0),0);
 assert.equal(dollEyeClosure(.18),0);
 assert.ok(Math.abs(dollEyeClosure(.59)-.5)<1e-12);
 assert.equal(dollEyeClosure(1),1);
 assert.equal(dollEyeClosure(Number.NaN),0);
 const scleraHalfX=.009*1.24,scleraHalfY=.009*.91;
 const padHalfX=.0094*1.22,padHalfY=.0094*.90;
 assert.ok(padHalfX>scleraHalfX&&padHalfY>scleraHalfY,'closed-lid patch covers the full sclera silhouette');
 const scleraFrontZ=.0892+.009*.44,padFrontZ=.0944+.0094*.30;
 assert.ok(padFrontZ>scleraFrontZ,'closed-lid patch sits in front of the eyeball to occlude it');
});

test('stage 7 refines mirrored ear folds, nose details, and the jaw transition',()=>{
 assert.match(html,/const nostrilM=phy\(0x76564e,\.88\);nostrilM\.transparent=true;nostrilM\.opacity=\.36;nostrilM\.depthWrite=false/);
 assert.match(html,/const alarWing=sph\(\.0036,lidM\);alarWing\.scale\.set\(\.92,\.68,\.72\);alarWing\.position\.set\(\.0042\*s,\.0724,\.0943\)/);
 assert.match(html,/const nostril=sph\(\.00135,nostrilM\);nostril\.scale\.set\(1\.15,\.52,\.28\);nostril\.position\.set\(\.00215\*s,\.0697,\.0982\)/);
 assert.match(html,/const masseter=sph\(\.0125,lidM\);masseter\.scale\.set\(\.76,1\.14,\.46\);masseter\.position\.set\(\.046\*s,\.058,\.062\)/);
 assert.match(html,/const helixCurve=new T\.CatmullRomCurve3\(helixPoints\.map\(point=>V3\(\.\.\.point\)\)\)/);
 assert.match(html,/new T\.TubeGeometry\(helixCurve,14,\.00125,5,false\)/);
 assert.match(html,/const antihelixCurve=new T\.CatmullRomCurve3\(antihelixPoints\.map\(point=>V3\(\.\.\.point\)\)\)/);
 assert.match(html,/new T\.TubeGeometry\(antihelixCurve,10,\.00105,5,false\)/);
 assert.match(html,/const tragus=sph\(\.0032,lidM\);tragus\.scale\.set\(\.72,1\.05,\.55\);tragus\.position\.set\(\.085\*s,\.089,\.0025\)/);
 const noseTipFront=.0960+.0038*.50;
 const nostrilFront=.0982+.00135*.28;
 assert.ok(nostrilFront>noseTipFront,'paired nostril accents sit just in front of the soft nose tip');
 for(const side of [-1,1]){
  const helixPoints=[[.0905*side,.0775,.0014],[.101*side,.079,.0016],[.104*side,.090,.0018],[.101*side,.103,.0015],[.092*side,.108,.0008]];
  const helix=new TubeGeometry(new CatmullRomCurve3(helixPoints.map(point=>new Vector3(...point))),14,.00125,5,false);
  helix.computeBoundingBox();
  assert.ok([...helix.attributes.position.array].every(Number.isFinite),'ear helix vertices stay finite');
  assert.ok(helix.boundingBox.min.z>-.0005&&helix.boundingBox.max.z<.004&&helix.boundingBox.max.y<.112,'ear helix stays within the ear shell depth and silhouette');
  helix.dispose();
  const antihelixPoints=[[.0915*side,.080,.003],[.097*side,.085,.0032],[.095*side,.093,.0032],[.097*side,.100,.0025]];
  const antihelix=new TubeGeometry(new CatmullRomCurve3(antihelixPoints.map(point=>new Vector3(...point))),10,.00105,5,false);
  antihelix.computeBoundingBox();
  assert.ok([...antihelix.attributes.position.array].every(Number.isFinite),'inner ear-fold vertices stay finite');
  assert.ok(antihelix.boundingBox.min.z>0&&antihelix.boundingBox.max.y<.104,'inner folds stay within the ear');
 antihelix.dispose();
 }
});

test('stage 8 articulates both thumb joints and makes loaded finger curl visible but bounded',()=>{
 assert.match(html,/this\.gripDigits=\[\];this\.thumbDigits=\[\]/);
 assert.match(html,/const thumbRoot=new T\.Group\(\);thumbRoot\.position\.set\(-\.0255\*side,-\.011,\.021\);thumbRoot\.rotation\.set\(\.4,0,\.9\*side\)/);
 assert.match(html,/const thumbProximal=cap\(\.0090,\.026,handSkin\)/);
 assert.match(html,/const thumbTip=new T\.Group\(\);thumbTip\.position\.set\(0,-\.017,\.004\);thumbTip\.rotation\.z=\.22\*side/);
 assert.match(html,/const thumbDistal=cap\(\.0068,\.020,handSkin\)/);
 assert.match(html,/this\.thumbDigits\.push\(\{root:thumbRoot,tip:thumbTip,rootZ:thumbRoot\.rotation\.z,tipZ:thumbTip\.rotation\.z,side\}\)/);
 assert.match(html,/const opposition=dollThumbOpposition\(ef\)/);
 assert.match(html,/thumb\.root\.rotation\.z=thumb\.rootZ\+thumb\.side\*opposition/);
 assert.match(html,/thumb\.tip\.rotation\.z=thumb\.tipZ\+thumb\.side\*opposition\*\.72/);
 const opposition=dollThumbOpposition(1);
 for(const side of [-1,1]){
  const rootStart=.9*side,tipStart=.22*side;
  const rootEnd=rootStart+side*opposition,tipEnd=tipStart+side*opposition*.72;
  assert.ok(Math.abs(rootEnd)>Math.abs(rootStart)&&Math.abs(tipEnd)>Math.abs(tipStart),'thumb folds farther toward the palm under effort');
  assert.ok(Number.isFinite(rootEnd)&&Number.isFinite(tipEnd));
 }
 assert.ok(dollGripMotion(0,1,1)>.10,'finger curl is visible under full grip effort');
 assert.ok(dollGripMotion(0,1,1)<.15,'finger curl remains inside the safe angular bound');
});

test('stage 9 joint shells overlap limb ends at elbows, wrists, and knees',()=>{
 assert.match(html,/const elbJ=sph\(\.035,uaM\); elbJ\.scale\.set\(1\.10,1\.18,1\.10\); elbJ\.position\.set\(0,-\.005,0\)/);
 assert.match(html,/new T\.TorusGeometry\(\.0305,\.0015,8,24\)/);
 assert.match(html,/const wrJ=sph\(\.0235,faM\); wrJ\.scale\.set\(1\.02,1\.05,1\.00\); wrJ\.position\.set\(0,-\.005,0\)/);
 assert.match(html,/new T\.TorusGeometry\(\.0212,\.0020,8,24\)/);
 assert.match(html,/const knee=sph\(\.050,thighM\); knee\.scale\.set\(1\.06,1\.08,1\.06\); knee\.position\.set\(0,-\.008,0\)/);
 assert.match(html,/new T\.TorusGeometry\(\.046,\.0018,8,24\)/);
 const elbowRadial=.035*Math.min(1.10,1.10), wristRadial=.0235*Math.min(1.02,1.00), kneeRadial=.050*Math.min(1.06,1.06);
 assert.ok(elbowRadial>=.038,'elbow shell overlaps the widest proximal forearm radius');
 assert.ok(wristRadial>=.023,'wrist shell covers the forearm terminal radius');
 assert.ok(kneeRadial>=.053,'knee shell covers the widest shin entry radius');
 const elbowY=.032*1.18, wristY=.0235*1.05, kneeY=.050*1.08;
 assert.ok(elbowY>.005&&wristY>.005&&kneeY>.010,'joint shells extend past their pivot planes to overlap both linked segments');
});

test('stage 10 mirrored clavicle arcs bridge the sternum to both shoulder shells',()=>{
 assert.match(html,/const sternoclavicular=sph\(\.006,bodySkin\);sternoclavicular\.scale\.set\(1,\.90,\.95\);sternoclavicular\.position\.set\(0,\.222,\.067\)/);
 assert.match(html,/const claviclePoints=\[\[\.008\*s,\.222,\.067\],\[\.060\*s,\.237,\.064\],\[\.112\*s,\.229,\.043\],\[\.160\*s,\.214,\.012\]\]/);
 assert.match(html,/const clavicleCurve=new T\.CatmullRomCurve3\(claviclePoints\.map\(point=>V3\(\.\.\.point\)\)\)/);
 assert.match(html,/new T\.TubeGeometry\(clavicleCurve,16,\.0052,6,false\)/);
 const pair=[];
 for(const side of [-1,1]){
  const points=[[.008*side,.222,.067],[.060*side,.237,.064],[.112*side,.229,.043],[.160*side,.214,.012]];
  const geometry=new TubeGeometry(new CatmullRomCurve3(points.map(point=>new Vector3(...point))),16,.0052,6,false);
  geometry.computeBoundingBox();
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite),'clavicle vertices remain finite');
  assert.ok(geometry.boundingBox.min.y>.205&&geometry.boundingBox.max.y<.244,'arc stays within the clavicle plane');
  assert.ok(geometry.boundingBox.min.z>.005&&geometry.boundingBox.max.z<.073,'arc stays on the anterior chest surface');
  if(side<0)assert.ok(geometry.boundingBox.max.x<0,'left clavicle stays on its side');
  else assert.ok(geometry.boundingBox.min.x>0,'right clavicle stays on its side');
  pair.push(geometry.boundingBox.clone());geometry.dispose();
 }
 assert.ok(Math.abs(pair[0].min.x+pair[1].max.x)<1e-6&&Math.abs(pair[0].max.x+pair[1].min.x)<1e-6,'left and right clavicles mirror across the sternum');
 assert.ok(.008<.006+.0052,'sternoclavicular joint overlaps both medial arc ends');
 const shoulderCenter=.235-.033, shoulderRadius=.047*1.55;
 assert.ok(shoulderCenter-.160<shoulderRadius+.0052,'lateral clavicle ends overlap the shoulder blend shell');
});

test('stage 11 body and fitted shirt profiles create a measured athletic taper',()=>{
 const profile=(name)=>{
  const line=html.split(/\r?\n/).find(candidate=>candidate.includes(`const ${name}=`));
  assert.ok(line,`${name} is defined as a measurable profile`);
  const start=line.indexOf(`const ${name}=`)+`const ${name}=`.length;
  const raw=line.slice(start,line.indexOf(';',start));
  return JSON.parse(raw.replace(/(^|[\[,])(-?)\.(\d)/g,(_,prefix,sign,digit)=>`${prefix}${sign}0.${digit}`));
 };
 const radiusAt=(points,y)=>{
  for(let i=1;i<points.length;i++){
   const [r1,y1]=points[i-1],[r2,y2]=points[i];
   if(y<=y2)return r1+(r2-r1)*((y-y1)/(y2-y1));
  }
  return points.at(-1)[0];
 };
 const body=profile('torsoProfile'), shirt=profile('trainingTopProfile');
 assert.match(html,/const torso=lathe\(torsoProfile,bodySkin\)/);
 assert.match(html,/const trainingTop=clothLathe\(trainingTopProfile,fabricM\)/);
 assert.match(html,/clothSeam\(\[\[side\*\.148,-\.280/);
 assert.match(html,/clothSeam\(\[\[side\*\.148,-\.270/);
 for(const points of [body,shirt]){
  assert.ok(points.every(([radius,y],i)=>Number.isFinite(radius)&&Number.isFinite(y)&&radius>0&&(i===0||y>points[i-1][1])),'profile rings stay finite, positive, and vertically ordered');
 }
 const bodyRatio=radiusAt(body,.195)/radiusAt(body,.400);
 const shirtRatio=radiusAt(shirt,-.046)/radiusAt(shirt,.070);
 assert.ok(bodyRatio<=.70,'bare torso waist stays visibly narrower than the upper chest');
 assert.ok(shirtRatio<=.87,'fitted shirt follows the torso taper instead of hanging cylindrical');
 const torsoGeometry=new LatheGeometry(body.map(([r,y])=>new Vector2(r,y)),64);
 torsoGeometry.computeBoundingBox();
 assert.ok(Math.abs(torsoGeometry.boundingBox.max.x-.142)<1e-6&&Math.abs(torsoGeometry.boundingBox.min.x+.142)<1e-6,'lathe geometry is radially symmetric');
 assert.ok(torsoGeometry.boundingBox.max.y>.51&&torsoGeometry.boundingBox.min.y<-.017,'torso remains a continuous top-to-hip surface');
 torsoGeometry.dispose();
 const shirtGeometry=new LatheGeometry(shirt.map(([r,y])=>new Vector2(r,y)),64);
 shirtGeometry.computeBoundingBox();
 assert.ok(Math.abs(shirtGeometry.boundingBox.max.x-.150)<1e-6,'shirt keeps the designed chest width');
 assert.ok(shirtGeometry.boundingBox.min.y<-.34&&shirtGeometry.boundingBox.max.y>.21,'shirt hem and collar remain inside the profile');
 shirtGeometry.dispose();
});

test('stage 12 elbow bridge fully covers the forearm entry without swallowing the trim ring',()=>{
 assert.match(html,/const elbJ=sph\(\.035,uaM\); elbJ\.scale\.set\(1\.10,1\.18,1\.10\)/);
 assert.match(html,/const faa=lathe\(\[\[\.035,-\.005\],\[\.038,-\.07\]/);
 const elbowShellRadius=.035*1.10;
 const upperArmEndRadius=.033;
 const forearmEntryRadius=.038;
 const elbowTrimOuterRadius=.0305+.0015;
 assert.ok(elbowShellRadius>=forearmEntryRadius,'elbow shell reaches beyond the widest forearm entry to prevent a visible joint gap');
 assert.ok(elbowShellRadius>=upperArmEndRadius,'elbow shell overlaps the upper-arm terminal ring');
 assert.ok(elbowTrimOuterRadius<elbowShellRadius,'the metallic trim stays inset instead of protruding beyond the soft joint shell');
});

test('stage 13 adds a symmetric neckline stitch that stays on the front collar arc',()=>{
 assert.match(html,/const collarTopstitchProfile=\[\[-\.052,\.205,\.045\],\[-\.034,\.198,\.078\],\[0,\.193,\.084\],\[\.034,\.198,\.078\],\[\.052,\.205,\.045\]\]/);
 assert.match(html,/clothSeam\(collarTopstitchProfile,chestG,stitchM,\.0008\)/);
 const points=[[-.052,.205,.045],[-.034,.198,.078],[0,.193,.084],[.034,.198,.078],[.052,.205,.045]];
 const seam=new TubeGeometry(new CatmullRomCurve3(points.map(point=>new Vector3(...point))),25,.0008,5,false);
 seam.computeBoundingBox();
 assert.ok([...seam.attributes.position.array].every(Number.isFinite),'neckline stitch vertices stay finite');
 assert.ok(Math.abs(seam.boundingBox.min.x+seam.boundingBox.max.x)<1e-6,'neckline stitch is mirrored around the centerline');
 assert.ok(seam.boundingBox.min.z>.043&&seam.boundingBox.max.z<.086,'the stitch remains on the front neckline instead of crossing the back of the neck');
 assert.ok(seam.boundingBox.min.y>.190&&seam.boundingBox.max.y<.207,'the seam stays within the collar-to-shirt transition');
 seam.dispose();
});

test('stage 14 shoulder yoke seams mirror and track the fitted shirt shell',()=>{
 assert.match(html,/const shoulderYokeProfile=\[\[\.038,\.190,\.083\],\[\.068,\.178,\.080\],\[\.103,\.157,\.060\],\[\.132,\.130,\.034\]\]/);
 assert.match(html,/shoulderYokeProfile\.map\(\(\[x,y,z\]\)=>\[x\*side,y,z\]\)/);
 const path=[[.038,.190,.083],[.068,.178,.080],[.103,.157,.060],[.132,.130,.034]];
 const shellRadii=[.092,.105,.119,.136];
 for(let i=0;i<path.length;i++)assert.ok(Math.abs(Math.hypot(path[i][0],path[i][2])-shellRadii[i])<.002,'yoke points stay on the shirt profile');
 const boxes=[];
 for(const side of [-1,1]){
  const points=path.map(([x,y,z])=>[x*side,y,z]);
  const seam=new TubeGeometry(new CatmullRomCurve3(points.map(point=>new Vector3(...point))),20,.0009,5,false);
  seam.computeBoundingBox();
  assert.ok([...seam.attributes.position.array].every(Number.isFinite),'yoke vertices stay finite');
  assert.ok(seam.boundingBox.min.z>.03&&seam.boundingBox.max.z<.09,'yoke remains on the visible front shoulder shell');
  boxes.push(seam.boundingBox.clone());seam.dispose();
 }
 assert.ok(Math.abs(boxes[0].min.x+boxes[1].max.x)<1e-6&&Math.abs(boxes[0].max.x+boxes[1].min.x)<1e-6,'left and right yokes remain symmetric');
});

test('stage 15 adds paired shorts drawcords below the shirt hem without exceeding the waistband',()=>{
 assert.match(html,/const shortsDrawcordProfile=\[\[\.006,\.016,\.156\],\[\.010,-\.010,\.157\],\[\.009,-\.045,\.154\]\]/);
 assert.match(html,/shortsDrawcordProfile\.map\(\(\[x,y,z\]\)=>\[x\*side,y,z\]\),hips,sportAccentM,\.0012\)/);
 const path=[[.006,.016,.156],[.010,-.010,.157],[.009,-.045,.154]],boxes=[];
 for(const side of [-1,1]){
  const points=path.map(([x,y,z])=>[x*side,y,z]);
  const cord=new TubeGeometry(new CatmullRomCurve3(points.map(point=>new Vector3(...point))),10,.0012,5,false);
  cord.computeBoundingBox();
  assert.ok([...cord.attributes.position.array].every(Number.isFinite),'drawcord vertices stay finite');
  assert.ok(cord.boundingBox.max.y<.018&&cord.boundingBox.min.y>-.05,'cord hangs just below the shirt hem and above the short-leg hem');
  boxes.push(cord.boundingBox.clone());cord.dispose();
 }
 assert.ok(Math.abs(boxes[0].min.x+boxes[1].max.x)<1e-6&&Math.abs(boxes[0].max.x+boxes[1].min.x)<1e-6,'drawcords remain symmetric on the shorts front');
});

test('stage 16 aligns sneaker eyelets, laces, and tongue with the upper shell',()=>{
 assert.match(html,/shoeTongue\.position\.set\(0,-\.058,\.087\)/);
 assert.match(html,/dput\(cap\(\.0011,\.018,sportAccentM\),\[-\.014,-\.058,laceZ\],\[\.014,-\.058,laceZ\+\.009\],ag\)/);
 assert.match(html,/for\(const eyeletSide of \[-1,1\]\)for\(let i=0;i<3;i\+\+\)\{\s*const eyelet=new T\.Mesh\(new T\.TorusGeometry\(\.0022,\.00055,5,12\),gearTrimM\);\s*eyelet\.position\.set\(eyeletSide\*\.014,-\.058,\.070\+i\*\.016\);ag\.add\(eyelet\)/);
 const ring=new TorusGeometry(.0022,.00055,5,12);ring.computeBoundingBox();
 assert.ok([...ring.attributes.position.array].every(Number.isFinite),'eyelet ring vertices stay finite');
 assert.ok(Math.abs(ring.boundingBox.max.x-.00275)<1e-6,'eyelet has a compact, bounded outer radius');
 const upperHalfX=.043*1.20,upperHalfY=.043*.54,upperHalfZ=.043*1.82;
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const x=side*.014,y=-.058,z=.070+i*.016;
  const shellDistance=(x/upperHalfX)**2+((y+.078)/upperHalfY)**2+((z-.101)/upperHalfZ)**2;
  assert.ok(shellDistance<1.05,'eyelet centers remain on or just above the shoe upper surface');
 }
 ring.dispose();
});

test('stage 17 heel tab overlaps its counter and sole piping follows the sidewall',()=>{
 assert.match(html,/const heelTab=sph\(\.008,sportAccentM\);heelTab\.scale\.set\(\.72,1\.15,\.24\);heelTab\.position\.set\(0,-\.066,\.032\);ag\.add\(heelTab\)/);
 assert.match(html,/dput\(cap\(\.0016,\.064,sportAccentM\),\[soleSide\*\.045,-\.105,\.068\],\[soleSide\*\.045,-\.105,\.132\],ag\)/);
 const heelRear=.045-.022*.54,tabFront=.032+.008*.24;
 assert.ok(tabFront>heelRear&&tabFront-heelRear<.001,'reflective tab intersects the heel counter instead of floating behind it');
 const soleHalfX=.041*1.22,soleHalfZ=.041*1.78;
 const sidewallRadius=Math.hypot(.045/soleHalfX,.032/soleHalfZ);
 assert.ok(Math.abs(sidewallRadius-1)<.002,'side stripe centerline follows the sole perimeter within 0.2%');
 assert.ok(Math.abs(Math.hypot(.045,.064)-.0782)<.001,'sole stripe has a stable measured segment length');
});

test('training doll uses restrained fitted clothing with fabric detail and rigged separate shorts', () => {
  assert.match(html, /const trainingTop=clothLathe\(/);
  assert.match(html, /fabricM\.bumpMap=weaveTexture/);
  assert.match(html, /weaveCanvas\.width=weaveCanvas\.height=128/);
  assert.match(html, /fabricM=phy\(0x343a37,\.98,0\)/);
  assert.match(html, /weaveTexture\.repeat\.set\(4,3\);fabricM\.bumpMap=weaveTexture;fabricM\.roughnessMap=weaveTexture;fabricM\.bumpScale=\.00065/);
  assert.match(html, /clothSeam\(\[\[side\*\.148,-\.280/);
  assert.match(html, /const trainingShorts=clothLathe\(/);
  assert.match(html, /shortsLeg=clothLathe\(/);
  assert.match(html, /leg\.tg\.add\(shortsLeg\)/);
  assert.match(html, /brandCtx\.fillText\('MG'/);
  assert.doesNotMatch(html, /brandCtx\.fillRect\(/);
  assert.match(html, /let muscleOn=false,labelsOn=false,deepMode=false/);
  assert.match(html, /canvas\.setAttribute\('role','group'\)/);
  assert.match(html, /canvas\.tabIndex=0/);
  assert.match(html, /canvas\.setAttribute\('aria-keyshortcuts'/);
  assert.match(html, /canvas\.title=/);
  assert.match(html, /e\.stopPropagation\(\)/);
  assert.match(html, /canvas\.setAttribute\('aria-label'/);
  assert.match(html, /this\.setAttribute\('aria-pressed',String\(muscleOn\)\)/);
});

test('every exercise marked animated has a matching doll pose with start and end states', () => {
  const dataLine = html.split(/\r?\n/).find(line => line.startsWith('const DATA='));
  assert.ok(dataLine, 'exercise catalog is present as a JSON line');
  const movements = JSON.parse(dataLine.slice('const DATA='.length, -1));
  const poseSource = html.slice(html.indexOf('const POSES={'), html.indexOf('const IDLE='));
  const poseKeys = [...poseSource.matchAll(/^\s{2}([A-Za-z0-9_]+):\{/gm)].map(match => match[1]);
  const animatedKeys = movements.filter(movement => movement.anim).map(movement => movement.k);
  assert.ok(animatedKeys.length > 0, 'at least one exercise is animated');
  assert.deepEqual(animatedKeys.filter(key => !poseKeys.includes(key)), []);
  for (const key of animatedKeys) {
    assert.match(poseSource, new RegExp(`\\b${key}:\\{eq:'[^']+',A:\\{[\\s\\S]*?\\},\\s*B:\\{`));
  }
});
