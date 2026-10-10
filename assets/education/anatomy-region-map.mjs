export const ANATOMY_REGION_RADII = Object.freeze({
  // Broad fallback zones remain useful between the more specific landmarks.
  chest: [0.25, 0.16, 0.105],
  shoulders: [0.14, 0.14, 0.10],
  biceps: [0.105, 0.19, 0.09],
  forearms: [0.09, 0.20, 0.075],
  ab_obliques: [0.16, 0.24, 0.10],
  quads: [0.14, 0.34, 0.10],
  calves: [0.105, 0.22, 0.075],
  traps: [0.19, 0.15, 0.085],
  triceps: [0.105, 0.19, 0.085],
  lats: [0.19, 0.24, 0.09],
  glutes: [0.19, 0.16, 0.09],
  hams: [0.14, 0.30, 0.09],
  pec_upper: [0.17, 0.075, 0.075],
  pec_lower: [0.17, 0.075, 0.075],
  delt_front: [0.105, 0.09, 0.075],
  delt_side: [0.10, 0.10, 0.075],
  delt_rear: [0.105, 0.09, 0.075],
  brachialis: [0.08, 0.105, 0.07],
  forearm_flexors: [0.075, 0.15, 0.06],
  forearm_extensors: [0.075, 0.15, 0.06],
  abs_upper: [0.115, 0.09, 0.065],
  abs_lower: [0.115, 0.09, 0.065],
  obliques: [0.10, 0.18, 0.07],
  rectus_femoris: [0.075, 0.20, 0.07],
  vastus_lateralis: [0.065, 0.20, 0.07],
  vastus_medialis: [0.055, 0.13, 0.07],
  tibialis_anterior: [0.06, 0.18, 0.06],
  traps_upper: [0.13, 0.085, 0.07],
  traps_mid: [0.15, 0.09, 0.07],
  triceps_long: [0.075, 0.15, 0.065],
  triceps_lateral: [0.075, 0.15, 0.065],
  lat_upper: [0.13, 0.14, 0.075],
  lat_lower: [0.14, 0.14, 0.075],
  erector_spinae: [0.085, 0.25, 0.06],
  glute_max: [0.13, 0.12, 0.075],
  glute_med: [0.105, 0.08, 0.075],
  ham_biceps_femoris: [0.065, 0.23, 0.07],
  ham_semitendinosus: [0.065, 0.23, 0.07],
  gastrocnemius: [0.085, 0.13, 0.07],
  soleus: [0.075, 0.11, 0.065],
});

// Shared registry used by the education UI and its automated tests. The
// anchors are approximate picking landmarks, not boundaries in the source GLB.
export const ANATOMY_REGION_INFO = Object.freeze({
  chest:{name:'سینه',muscles:['chest'],description:'عضلات جلوی قفسهٔ سینه؛ حرکت‌های پرس و فلای مرتبط را ببینید.',anchors:{front:[0,1.65,.13]}},
  shoulders:{name:'سرشانه',muscles:['shoulders'],description:'ناحیهٔ شانه؛ حرکت‌های پرس و نشر مرتبط را ببینید.',anchors:{front:[-.24,1.78,.075],back:[-.24,1.78,-.075]}},
  biceps:{name:'جلو بازو',muscles:['biceps'],description:'بخش جلویی بازو؛ حرکت‌های خم‌کردن آرنج مرتبط را ببینید.',anchors:{front:[.31,1.52,.055]}},
  forearms:{name:'ساعد',muscles:['forearms'],description:'ساعد و مچ؛ حرکت‌های گرفتن و خم‌کردن مچ مرتبط را ببینید.',anchors:{front:[.42,1.24,.045],back:[.42,1.24,-.045]}},
  ab_obliques:{name:'شکم و پهلو',muscles:['ab_obliques','core'],description:'مرکز بدن و عضلات کناری شکم؛ حرکت‌های پایدارسازی و شکم مرتبط را ببینید.',anchors:{front:[0,1.36,.105]}},
  quads:{name:'چهارسر ران',muscles:['quads'],description:'جلوی ران؛ حرکت‌های اسکوات و جلوپا مرتبط را ببینید.',anchors:{front:[-.10,.88,.075]}},
  calves:{name:'ساق پا',muscles:['calves'],description:'عضلات ساق؛ حرکت‌های بالا آمدن روی پنجه مرتبط را ببینید.',anchors:{front:[.075,.30,.07],back:[.075,.30,-.07]}},
  traps:{name:'ذوزنقه و پشت گردن',muscles:['traps'],description:'بالای پشت و اطراف کتف؛ حرکت‌های شراگ و کششی مرتبط را ببینید.',anchors:{back:[0,1.78,-.075]}},
  triceps:{name:'پشت بازو',muscles:['triceps'],description:'بخش پشتی بازو؛ حرکت‌های بازکردن آرنج مرتبط را ببینید.',anchors:{back:[-.31,1.52,-.05]}},
  lats:{name:'زیربغل',muscles:['lats','back'],description:'کناره‌های پشت؛ حرکت‌های بارفیکس و زیربغل مرتبط را ببینید.',anchors:{back:[.14,1.45,-.09]}},
  glutes:{name:'باسن',muscles:['glutes'],description:'عضلات سرینی؛ حرکت‌های پل باسن و هیپ‌هینج مرتبط را ببینید.',anchors:{back:[0,1.15,-.085]}},
  hams:{name:'پشت ران',muscles:['hams'],description:'همسترینگ در پشت ران؛ حرکت‌های خم‌کردن زانو و ددلیفت مرتبط را ببینید.',anchors:{back:[-.10,.78,-.07]}},
  pec_upper:{name:'سینهٔ بالایی',muscles:['chest'],description:'بخش بالایی عضلهٔ سینه؛ این تفکیک ناحیه‌ای برای راهنمایی آموزشی است.',anchors:{front:[0,1.72,.13]},hotspot:false},
  pec_lower:{name:'سینهٔ میانی و پایینی',muscles:['chest'],description:'بخش میانی و پایینی سینه؛ مرزبندی نمایش تقریبی است.',anchors:{front:[0,1.57,.13]},hotspot:false},
  delt_front:{name:'سر جلویی سرشانه',muscles:['shoulders'],description:'بخش جلویی دلتوئید؛ با گروه حرکات سرشانه مرتبط است.',anchors:{front:[-.245,1.78,.10]},hotspot:false},
  delt_side:{name:'سر میانی سرشانه',muscles:['shoulders'],description:'بخش کناری دلتوئید؛ با گروه حرکات سرشانه مرتبط است.',anchors:{front:[-.31,1.78,.045]},hotspot:false},
  delt_rear:{name:'سر پشتی سرشانه',muscles:['shoulders'],description:'بخش پشتی دلتوئید؛ با گروه حرکات سرشانه و پشت مرتبط است.',anchors:{back:[-.245,1.78,-.10]},hotspot:false},
  brachialis:{name:'براکیالیس',muscles:['biceps'],description:'عضلهٔ عمقی بازو؛ نمایش آناتومیک این مدل تقریبی است.',anchors:{front:[.31,1.43,.06]},hotspot:false},
  forearm_flexors:{name:'خم‌کننده‌های ساعد',muscles:['forearms'],description:'گروه خم‌کننده‌های ساعد و مچ؛ ناحیهٔ آموزشی تقریبی است.',anchors:{front:[.42,1.22,.05]},hotspot:false},
  forearm_extensors:{name:'بازکننده‌های ساعد',muscles:['forearms'],description:'گروه بازکننده‌های ساعد و مچ؛ ناحیهٔ آموزشی تقریبی است.',anchors:{back:[.42,1.22,-.05]},hotspot:false},
  abs_upper:{name:'راست شکمی ـ بخش بالایی',muscles:['core'],description:'بخش بالایی راست شکمی؛ با گروه حرکات مرکزی بدن مرتبط است.',anchors:{front:[0,1.46,.12]},hotspot:false},
  abs_lower:{name:'راست شکمی ـ بخش پایینی',muscles:['core'],description:'بخش پایینی راست شکمی؛ با گروه حرکات مرکزی بدن مرتبط است.',anchors:{front:[0,1.25,.12]},hotspot:false},
  obliques:{name:'مایل‌های شکمی',muscles:['ab_obliques','core'],description:'ناحیهٔ مایل‌های شکمی در پهلو؛ مرزها در مدل تقریبی‌اند.',anchors:{front:[.14,1.36,.10]},hotspot:false},
  rectus_femoris:{name:'راست‌رانی',muscles:['quads'],description:'بخش مرکزی چهارسر ران؛ گروه حرکات جلو ران مرتبط را ببینید.',anchors:{front:[.10,.88,.085]},hotspot:false},
  vastus_lateralis:{name:'پهن‌جانبی',muscles:['quads'],description:'بخش خارجی چهارسر ران؛ گروه حرکات جلو ران مرتبط را ببینید.',anchors:{front:[.19,.88,.06]},hotspot:false},
  vastus_medialis:{name:'پهن‌میانی',muscles:['quads'],description:'بخش داخلی چهارسر ران نزدیک زانو؛ نمایش تقریبی است.',anchors:{front:[.07,.62,.085]},hotspot:false},
  tibialis_anterior:{name:'درشت‌نی قدامی',muscles:['calves'],description:'ناحیهٔ جلویی ساق؛ با گروه حرکات ساق مرتبط است.',anchors:{front:[.12,.30,.075]},hotspot:false},
  traps_upper:{name:'ذوزنقه‌ای ـ بخش بالایی',muscles:['traps'],description:'بخش بالایی ذوزنقه‌ای و پشت گردن؛ ناحیهٔ آموزشی تقریبی است.',anchors:{back:[0,1.88,-.08]},hotspot:false},
  traps_mid:{name:'ذوزنقه‌ای ـ بخش میانی',muscles:['traps','back'],description:'بخش میانی ذوزنقه‌ای بین دو کتف؛ ناحیهٔ آموزشی تقریبی است.',anchors:{back:[0,1.72,-.09]},hotspot:false},
  triceps_long:{name:'سر بلند پشت‌بازو',muscles:['triceps'],description:'سر بلند سه‌سر بازویی؛ با گروه حرکات پشت‌بازو مرتبط است.',anchors:{back:[.31,1.57,-.06]},hotspot:false},
  triceps_lateral:{name:'سر خارجی پشت‌بازو',muscles:['triceps'],description:'سر خارجی سه‌سر بازویی؛ مرز مدل برای آموزش تقریبی است.',anchors:{back:[.37,1.49,-.045]},hotspot:false},
  lat_upper:{name:'زیربغل ـ بخش بالایی',muscles:['lats','back'],description:'بخش بالایی عضلهٔ پهن پشتی؛ گروه حرکات کششی پشت مرتبط را ببینید.',anchors:{back:[.19,1.56,-.09]},hotspot:false},
  lat_lower:{name:'زیربغل ـ بخش پایینی',muscles:['lats','back'],description:'بخش پایینی عضلهٔ پهن پشتی؛ گروه حرکات کششی پشت مرتبط را ببینید.',anchors:{back:[.17,1.35,-.09]},hotspot:false},
  erector_spinae:{name:'راست‌کننده‌های ستون مهره',muscles:['lowback','back'],description:'ناحیهٔ عضلات راست‌کنندهٔ ستون مهره؛ نمایش ناحیه‌ای تقریبی است.',anchors:{back:[0,1.42,-.105]},hotspot:false},
  glute_max:{name:'سرینی بزرگ',muscles:['glutes'],description:'بخش اصلی سرینی؛ با گروه حرکات باسن مرتبط است.',anchors:{back:[0,1.11,-.11]},hotspot:false},
  glute_med:{name:'سرینی میانی',muscles:['glutes'],description:'بخش بالایی و کناری سرینی؛ مرزبندی نمایش تقریبی است.',anchors:{back:[.16,1.20,-.09]},hotspot:false},
  ham_biceps_femoris:{name:'همسترینگ ـ دوسر رانی',muscles:['hams'],description:'بخش خارجی همسترینگ؛ با گروه حرکات پشت ران مرتبط است.',anchors:{back:[.15,.81,-.08]},hotspot:false},
  ham_semitendinosus:{name:'همسترینگ ـ نیم‌وتری',muscles:['hams'],description:'بخش داخلی همسترینگ؛ ناحیهٔ آموزشی تقریبی است.',anchors:{back:[.06,.81,-.085]},hotspot:false},
  gastrocnemius:{name:'دوقلوی ساق',muscles:['calves'],description:'بخش برجستهٔ پشتی ساق؛ با گروه حرکات ساق مرتبط است.',anchors:{back:[.08,.34,-.09]},hotspot:false},
  soleus:{name:'نعلی ساق',muscles:['calves'],description:'بخش عمقی‌تر ساق؛ مرز نمایش از مدل سطحی قابل تأیید نیست.',anchors:{back:[.08,.22,-.075]},hotspot:false}
});

export const ANATOMY_REGIONS_BY_VIEW = Object.freeze({
  front:['shoulders','chest','biceps','forearms','ab_obliques','quads','calves'],
  back:['traps','shoulders','triceps','forearms','lats','glutes','hams','calves']
});

// Front/back anchors are not valid from a side-on view. Return null there so
// the UI can ask the user to choose a supported angle instead of mislabeling.
export function anatomyFaceAtYaw(yaw, minFacing = Math.SQRT1_2) {
  if (!Number.isFinite(yaw) || !Number.isFinite(minFacing) || minFacing < 0 || minFacing > 1) return null;
  const facing = Math.cos(yaw);
  if (facing >= minFacing) return 'front';
  if (facing <= -minFacing) return 'back';
  return null;
}

// Match a raycast point to the nearest labeled anatomical anchor on the
// visible side. The normalized distance makes each region use its own size.
export function pickAnatomyRegion(point, face, regionInfo) {
  if (!point || !['front', 'back'].includes(face)) return null;
  const px = Number(point.x), py = Number(point.y), pz = Number(point.z);
  if (![px, py, pz].every(Number.isFinite)) return null;

  let bestKey = null;
  let bestDistance = Infinity;
  for (const [key, info] of Object.entries(regionInfo || {})) {
    // Fine anatomical landmarks are descriptive metadata only until the GLB
    // provides verified selectable boundaries for them. Keep picking aligned
    // with the broader hotspots actually rendered by the UI.
    if (info?.hotspot === false) continue;
    const anchor = info?.anchors?.[face];
    const radii = ANATOMY_REGION_RADII[key];
    if (!anchor || !radii || anchor.length < 3) continue;

    const dx = (Math.abs(px) - Math.abs(anchor[0])) / radii[0];
    const dy = (py - anchor[1]) / radii[1];
    const dz = (pz - anchor[2]) / radii[2];
    const distance = dx * dx + dy * dy + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  }

  // A bounded region prevents clicks on the head, feet or outside silhouette
  // from being mislabeled as whichever region happens to be nearest.
  return bestDistance <= 2.25 ? bestKey : null;
}
