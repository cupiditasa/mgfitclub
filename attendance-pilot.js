(()=>{
 const button=document.getElementById('refresh'),status=document.getElementById('status'),list=document.getElementById('trials');
 const add=(parent,tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;parent.appendChild(node);return node};
 async function load(){
  button.disabled=true;list.replaceChildren();status.textContent='در حال دریافت از سرور…';
  try {
   const {trials}=await window.MGApi.request('/api/attendance-pilot/me',{signal:AbortSignal.timeout(15000)});
   status.textContent=trials.length?'ماندهٔ قطعی از سرور دریافت شد. تأییدهای آفلاین تا زمان ارسال در این عدد نیستند.':'هنوز اشتراک آزمایشی برای این حساب فعال نشده است.';
   for(const t of trials){const card=add(list,'section','');add(card,'h2',t.label);add(card,'div',t.remainingSessions+' جلسه باقی‌مانده از '+t.totalSessions,'balance');add(card,'p','مصرف ثبت‌شده: '+t.usedSessions+' جلسه');add(card,'p','اعتبار تا: '+new Date(t.expiresAt).toLocaleString('fa-IR'));add(card,'small','وضعیت: '+(t.status==='revoked'?'لغوشده':Date.parse(t.expiresAt)<=Date.now()?'منقضی':'فعال')+' — حداکثر یک جلسه در روز؛ تأیید مسئول باشگاه لازم است.');}
  } catch(e){status.textContent=e.status===401?'ابتدا با حساب ورزشکار وارد شوید.':e.status===503?'سرویس آزمایش هنوز فعال نشده است.':'دریافت انجام نشد؛ اینترنت یا سرویس را بررسی کنید. مانده‌ای حدس زده نشده است.';if(e.status===401){const link=add(status,'a',' ورود به حساب');link.href='account.html';}}
  finally{button.disabled=false;}
 }
 button.addEventListener('click',load);
 window.addEventListener('mg:access-ready',load);
 if(window.MGCurrentUser)load();
})();
