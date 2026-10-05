(()=>{
 const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text||'';return n};
 const api=(p,body)=>MGApi.request('/api/mg-bridge/'+p,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{body}),signal:AbortSignal.timeout(20000)});
 const messages={mg_bridge_disabled:'نسخهٔ جدید رابط هنوز روی سرور فعال نشده؛ نصب قبلی را فعلاً کنار نگذارید.',fresh_scan_required:'شخص باید در ده دقیقهٔ اخیر روی دستگاه شناسایی شده و رکورد به سایت رسیده باشد.',member_already_mapped:'کد یا حساب قبلاً متصل شده است؛ آن را به شخص دیگری نسبت ندهید.',personal_active_user_required:'شماره باید متعلق به حساب شخصی فعال و تأییدشده باشد.',no_valid_trial:'برای زمان این حضور، پکیج آزمایشی معتبر وجود ندارد.',sessions_exhausted_or_conflict:'جلسات تمام شده یا وضعیت هم‌زمان تغییر کرده؛ فهرست را تازه کنید.',station_or_code_exists:'این دستگاه یا کد قبلاً ثبت شده؛ از اتصال مجدد استفاده کنید.',athlete_mapping_required:'ابتدا حساب ورزشکار را به کد دستگاه وصل کنید.',legacy_trial_active:'اشتراک آزمایشی قبلی فعال است؛ پشتیبان باید ابتدا آن را بررسی کند.',bridge_revoked:'دسترسی این رابط قطع شده است.'};
 let stations=[],support=false,loading=false,started=false;
 const base=()=>{if(!$('station').value)throw new Error('دستگاهی انتخاب نشده است.');return 'stations/'+encodeURIComponent($('station').value)};
 const say=t=>$('message').textContent=t;
 const error=e=>say(messages[e.message]||({401:'دوباره وارد حساب شوید.',403:'اجازهٔ این عملیات را ندارید.'}[e.status])||'عملیات کامل نشد. اینترنت را بررسی و وضعیت را تازه کنید. '+(e.status?'کد '+e.status:''));
 async function act(button,fn){if(button.disabled)return;button.disabled=true;say('در حال انجام…');try{await fn();say('انجام شد.');await load()}catch(e){error(e)}finally{button.disabled=false}}
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=()=>act(b,fn);return b};
 async function load(){
  if(loading)return;loading=true;
  try{
   const mine=await api('mine');$('my-trials').hidden=false;$('my-balances').replaceChildren(...(mine.registrations||[]).map(r=>el('p','✓ اتصال به '+r.club_name+' — کد '+r.member_id)),...mine.trials.map(t=>el('p',`${t.club_name}: ${t.sessions-t.used} جلسه باقی‌مانده — پایان ${new Date(t.expires_at).toLocaleDateString('fa-IR')}`)));
   if(!(mine.registrations||[]).length)$('my-balances').append(el('p','هنوز به دستگاه متصل نشده‌اید. مسئول باشگاه پس از یک شناسایی تازه، حساب شما را در همین صفحه متصل می‌کند.'));
   if(!['support','manager','secretary'].includes(MGCurrentUser.role))return;
   const r=await api('stations');stations=r.stations;support=r.isSupport;$('staff').hidden=false;$('setup').hidden=!support;
   const old=$('station').value;$('station').replaceChildren(...stations.map(s=>new Option(s.serial+(s.revoked_at?' — غیرفعال':''),s.id)));if(stations.some(s=>s.id===old))$('station').value=old;
   if(!stations.length){$('connection').textContent='رابطی ثبت نشده است؛ پشتیبان اتصال اولیه را انجام دهد.';return;}
   const station=stations.find(s=>s.id===$('station').value),online=station.last_seen&&Date.now()-Date.parse(station.last_seen)<90000;
   $('connection').textContent=(station.revoked_at?'دسترسی قطع شده':!station.paired?'منتظر اتصال برنامه':online?'رابط آنلاین':'رابط آفلاین یا وضعیت قدیمی')+' | دستگاه: '+({connected:'خواندن موفق',connection_failed:'دستگاه در دسترس نیست',sdk_missing:'SDK موجود نیست',serial_mismatch:'سریال متفاوت',read_failed:'خواندن ناموفق',timeout:'مهلت خواندن تمام شد',capture_partial:'خواندن ناقص'}[station.device_status]||'هنوز بررسی نشده');
   if(station.revoked_at){$('events').replaceChildren();$('members').replaceChildren();return;}
   const [events,snapshot]=await Promise.all([api(base()+'/events'),api(base()+'/members')]);
   const table=el('table'),head=el('tr');for(const h of ['شخص / کد','زمان','وضعیت','عملیات'])head.append(el('th',h));table.append(head);
   for(const e of events.events){const row=el('tr'),actions=el('td');row.append(el('td',(e.full_name||'حساب متصل نشده')+' / '+e.member_id),el('td',new Date(e.occurred_at).toLocaleString('fa-IR')),el('td',({pending:'منتظر بررسی',approved:'تأیید شده',rejected:'رد شده'})[e.state]));
    if(!e.phone)actions.append(button('اتصال حساب',async()=>{$('member').value=e.member_id;$('phone').focus();$('mapping').scrollIntoView({behavior:'smooth'})}));
    if(e.state==='pending')for(const [decision,title]of [['approve','تأیید حضور'],['reject','رد رکورد']])actions.append(button(title,async()=>{if(!confirm(title+' برای کد '+e.member_id+'؟ تأیید ورود ورزشکار می‌تواند یک جلسه کسر کند.'))return;await api(base()+'/review',{eventId:e.id,decision,confirmedAdmission:decision==='approve'})}));row.append(actions);table.append(row);
   }$('events').replaceChildren(table);
   $('members').replaceChildren(...snapshot.members.map(m=>{const card=el('article',`${m.name||'نام ثبت نشده'} — کد ${m.member_id}`);card.append(el('small',m.trial_id?`${m.sessions-m.used} جلسه / ${new Date(m.expires_at).toLocaleDateString('fa-IR')}`:'بدون پکیج آزمایشی'));if(support&&m.role==='athlete'&&!m.trial_id)card.append(button('فعال‌سازی رایگان ۳۰ روز / ۳۰ جلسه',async()=>{if(confirm('پکیج رایگان از همین لحظه فعال شود؟ پرداختی ثبت نمی‌شود.'))await api(base()+'/trial',{memberId:m.member_id})}));return card}));
   return true;
  }catch(e){error(e);return false}finally{loading=false}
 }
 $('pair').onsubmit=e=>{e.preventDefault();act(e.submitter,async()=>{await api('pair',{clubId:$('club').value,code:$('code').value,serial:$('serial').value.trim(),address:$('address').value.trim()});$('code').value=''})};
 $('mapping').onsubmit=e=>{e.preventDefault();act(e.submitter,async()=>{await api(base()+'/map',{phone:$('phone').value.trim(),memberId:$('member').value.trim(),confirmed:$('consent').checked});$('consent').checked=false})};
 $('repair').onclick=()=>act($('repair'),async()=>{if(confirm('کلید قبلی همین رابط باطل و کد جدید جایگزین شود؟'))await api(base()+'/repair',{code:$('code').value.trim()})});
 $('revoke').onclick=()=>act($('revoke'),async()=>{if(confirm('دسترسی این رابط به سایت قطع شود؟'))await api(base()+'/revoke',{})});
 $('refresh').onclick=load;$('station').onchange=load;
 async function start(){if(started)return;started=true;const ok=await load();if(support){try{const r=await MGApi.request('/api/clubs');$('club').replaceChildren(...r.clubs.map(c=>new Option(c.name,c.id)))}catch(e){error(e);return}}if(ok)say('برای دریافت رکوردهای جدید، به‌روزرسانی را بزنید.');}
 window.addEventListener('mg:access-ready',start);if(window.MGCurrentUser)start();
})();
