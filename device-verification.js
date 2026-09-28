(()=>{
 const $=id=>document.getElementById(id),status=$('device-status'),self=$('self-device');
 const labels={unregistered:'ثبت نشده',pending:'در انتظار تأیید',verified:'✓ تأیید شده'};
 const reasons={identity_mismatch:'هویت تطبیق نداشت؛ با مسئول باشگاه هماهنگ کنید.',cancelled:'درخواست یا تأیید قبلی لغو شد.',reenrollment_required:'ثبت مجدد در دستگاه لازم است.'};
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
 const api=(p,method='GET',body)=>MGApi.request('/api/device-verification'+p,{method,...(body===undefined?{}:{body}),signal:AbortSignal.timeout(15000)});
 let page=1,busy=false;
 const error=e=>{status.textContent=({503:'این بخش هنوز روی سرور فعال نشده است.',401:'برای ادامه دوباره وارد حساب شوید.',403:'این حساب اجازهٔ انجام این کار را ندارد.'}[e.status]||'عملیات کامل نشد. وضعیت قبلی تغییر نکرده فرض نشود؛ به‌روزرسانی کنید و دوباره بررسی کنید.')};
 async function action(button,fn){button.disabled=true;try{await fn()}catch(e){error(e)}finally{button.disabled=false}}
 async function roster(){
  const data=await api('/roster?page='+page),table=el('table',''),head=el('tr','');
  for(const h of ['کاربر','باشگاه','دستگاه تردد','شناسهٔ دستگاه','عملیات'])head.append(el('th',h));table.append(head);
  for(const u of data.users){
   const row=el('tr','');row.append(el('td',(u.full_name||'نام ثبت نشده')+' — '+(u.phone||'حساب مشترک')),el('td',u.club_name||'—'),el('td',labels[u.device_state]),el('td',u.member_id||'—'));
   const cell=el('td','');
   if(u.registration_id&&u.device_state!=='unregistered'){
    const reset=el('button','لغو / نیاز به ثبت مجدد');reset.type='button';reset.onclick=()=>action(reset,async()=>{
     if(!confirm('اتصال یا درخواست این شخص لغو شود؟ اطلاعات چهره در دستگاه حذف نمی‌شود و کاربر باید دوباره درخواست بدهد.'))return;
     await api('/registrations/'+encodeURIComponent(u.registration_id)+'/reset','POST',{reason:'reenrollment_required'});await load();
    });cell.append(reset);
   }
   if(u.last_error)cell.append(el('small',reasons[u.last_error]||'نیازمند بررسی'));row.append(cell);table.append(row);
  }
  $('device-users').replaceChildren(table);$('prev-users').disabled=page===1;$('next-users').disabled=data.users.length<100;
 }
 async function bridges(){
  const data=await api('/bridges');$('bridges').replaceChildren();
  for(const b of data.bridges){const row=el('p','دستگاه '+b.device_serial+' | '+(b.revoked_at?'لغوشده':Date.parse(b.expires_at)<=Date.now()?'منقضی':'فعال'));
   if(!b.revoked_at){const revoke=el('button','لغو کلید');revoke.type='button';revoke.onclick=()=>action(revoke,async()=>{if(!confirm('این کلید رابط لغو شود؟'))return;await api('/bridges/'+encodeURIComponent(b.id)+'/revoke','POST',{});await bridges()});row.append(revoke)}$('bridges').append(row);
  }
 }
 async function load(){
  if(busy)return;busy=true;$('refresh-device').disabled=true;status.textContent='در حال دریافت وضعیت از سرور…';
  try{
   const data=await api('/me');self.replaceChildren(el('h2','وضعیت من'));
   if(!data.registrations.length)self.append(el('p','ثبت نشده'));
   for(const r of data.registrations){const p=el('p',(r.clubName||'باشگاه')+' — '+labels[r.state]);if(r.lastError)p.append(el('small',reasons[r.lastError]||'نیازمند بررسی'));self.append(p)}
   if(data.canRequest){
    const form=el('form',''),label=el('label','باشگاه موردنظر'),select=el('select','');select.required=true;select.append(new Option('انتخاب باشگاه',''));
    for(const c of data.clubs)select.append(new Option(c.name,c.id));label.append(select);
    const consentLabel=el('label',''),consent=el('input','');consent.type='checkbox';consent.required=true;consentLabel.append(consent,document.createTextNode(' موافقم نام و شمارهٔ من برای تطبیق حضوری در اختیار مسئول همین باشگاه قرار گیرد.'));
    const submit=el('button','ارسال درخواست تأیید دستگاه');submit.type='submit';form.append(label,consentLabel,submit);form.onsubmit=e=>{e.preventDefault();action(submit,async()=>{const r=await api('/request','POST',{clubId:select.value,consent:consent.checked});await load();status.textContent=r.registration.state==='verified'?'قبلاً برای این باشگاه تأیید شده‌اید.':'درخواست ثبت شد. برای تطبیق هویت و شناسایی روی دستگاه با مسئول باشگاه هماهنگ کنید.'})};self.append(form);
   }else self.append(el('p','حساب مشترک مدیریت هویت شخصی تردد نیست. برای خودتان از یک حساب شخصی با شمارهٔ تأییدشده استفاده کنید؛ نقش مشترک باشگاه را تغییر ندهید.'));
   $('staff-device').hidden=!data.isStaff;if(data.isStaff)await roster();
   $('support-device').hidden=!data.isSupport;if(data.isSupport){const select=$('bridge-club'),old=select.value;select.replaceChildren(new Option('انتخاب باشگاه',''));for(const c of data.clubs)select.append(new Option(c.name,c.id));select.value=old;await bridges()}
   status.textContent='وضعیت از سرور دریافت شد. قطع اینترنت یا نبودن رابط به معنی تأیید نیست.';
  }catch(e){self.replaceChildren();$('staff-device').hidden=true;$('support-device').hidden=true;error(e)}finally{busy=false;$('refresh-device').disabled=false}
 }
 $('bridge-form').onsubmit=e=>{e.preventDefault();const button=e.target.querySelector('button');action(button,async()=>{
  if(!confirm('کلید دسترسی به درخواست‌های کاربران همین باشگاه صادر شود؟ آن را فقط به مسئول مجاز بدهید.'))return;
  $('bridge-key').textContent='';const r=await api('/bridges','POST',{clubId:$('bridge-club').value,deviceSerial:$('bridge-serial').value.trim()});$('bridge-key').textContent='کلید فقط همین بار نمایش داده می‌شود: '+r.bridgeToken;await bridges();
 })};
 $('refresh-device').onclick=load;$('prev-users').onclick=()=>{if(page>1){page--;load()}};$('next-users').onclick=()=>{page++;load()};
 window.addEventListener('mg:access-ready',load);if(window.MGCurrentUser)load();
})();
