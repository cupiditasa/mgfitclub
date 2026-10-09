(()=>{'use strict';
const $=id=>document.getElementById(id),root=$('profile'),status=$('market-message'),coachId=new URLSearchParams(location.search).get('id'),key=()=>crypto.randomUUID();
let started=false,coach;
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n}
function field(label,input){const node=el('label',label);node.append(input);return node}
function imageData(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('image_read_failed'));reader.readAsDataURL(blob)})}
async function compressPhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('invalid_photo');
 let bitmap;try{bitmap=typeof createImageBitmap==='function'?await createImageBitmap(file):null;if(!bitmap){const url=URL.createObjectURL(file);try{bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('invalid_photo'));image.src=url})}finally{URL.revokeObjectURL(url)}}}catch{throw new Error('invalid_photo')}
 try{
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>24000000)throw new Error('invalid_photo');
  let width=Math.min(bitmap.width,1200);
  for(let pass=0;pass<7;pass++){
   const height=Math.max(1,Math.round(bitmap.height*width/bitmap.width)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);
   for(const quality of [.82,.72,.62,.52]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=115000)return await imageData(blob)}
   width=Math.round(width*.78);
  }
  throw new Error('photo_too_large');
 }finally{bitmap.close?.()}
}
async function request(kind,packageId){
 const dialog=document.createElement('dialog'),form=el('form',null,'market-form'),notice=el('p','','muted'),submit=el('button','ارسال درخواست به مربی','primary'),close=el('button','انصراف');close.type='button';close.onclick=()=>dialog.close();
 const height=document.createElement('input');height.type='number';height.inputMode='numeric';height.min='80';height.max='250';height.required=true;height.placeholder='مثلاً ۱۷۰';
 const weight=document.createElement('input');weight.type='number';weight.inputMode='decimal';weight.min='25';weight.max='350';weight.step='.1';weight.required=true;weight.placeholder='مثلاً ۶۴٫۵';
 const goal=document.createElement('textarea');goal.required=true;goal.maxLength=500;goal.placeholder='مثلاً افزایش قدرت، کاهش وزن یا آمادگی برای مسابقه';
 const photo=document.createElement('input');photo.type='file';photo.accept='image/jpeg,image/png,image/webp';photo.required=true;
 const preview=document.createElement('img');preview.className='intake-preview';preview.alt='پیش‌نمایش عکس انتخاب‌شده';preview.hidden=true;
 photo.onchange=()=>{const file=photo.files?.[0];preview.hidden=!file;if(file){if(preview.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);preview.src=URL.createObjectURL(file)}};
 const notes=document.createElement('textarea');notes.maxLength=2000;notes.placeholder='توضیحات تکمیلی (اختیاری)';
 form.append(field('قد (سانتی‌متر) · اجباری',height),field('وزن (کیلوگرم) · اجباری',weight),field('هدف تمرینی · اجباری',goal),field('عکس · اجباری (JPG، PNG یا WebP)',photo),preview,field('توضیحات تکمیلی · اختیاری',notes),el('p',packageId?'پکیج انتخاب‌شده: '+(coach.workoutPackages.find(x=>x.id===packageId)?.name||'برنامهٔ تمرینی'):'','muted'),el('div',null,'actions'),notice);
 const actions=form.querySelector('.actions');actions.append(close,submit);dialog.append(el('h2','درخواست برنامهٔ تمرینی از '+coach.name),form);document.body.append(dialog);dialog.showModal();
 let requestKey=key(),lastSubmission='';
 form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;close.disabled=true;notice.textContent='در حال آماده‌سازی و ارسال اطلاعات…';try{
  const photoData=await compressPhoto(photo.files?.[0]);
  const body={coachId:coach.id,kind,packageId,heightCm:Number(height.value),weightKg:Number(weight.value),goal:goal.value.trim(),photoData,notes:notes.value.trim()},fingerprint=JSON.stringify(body);if(fingerprint!==lastSubmission){requestKey=key();lastSubmission=fingerprint}body.requestKey=requestKey;
  await MGApi.request('/api/coach-market/requests',{method:'POST',body});
  dialog.close();status.textContent='درخواست برنامهٔ تمرینی همراه اطلاعات و عکس برای مربی ارسال شد.';
 }catch(err){notice.textContent=err.message==='workout_intake_required'?'قد، وزن، هدف و عکس معتبر لازم است.':err.message==='offering_disabled'?'این خدمت فعلاً درخواست جدید نمی‌پذیرد.':err.message==='invalid_photo'?'یک عکس معتبر JPG، PNG یا WebP تا حداکثر ۱۲ مگابایت انتخاب کنید.':err.message==='photo_too_large'?'حجم عکس پس از فشرده‌سازی هنوز زیاد است؛ عکس دیگری انتخاب کنید.':'ارسال درخواست انجام نشد؛ اطلاعات و اتصال حساب را بررسی کنید.'}finally{submit.disabled=false;close.disabled=false}}
 dialog.addEventListener('close',()=>{if(preview.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);dialog.remove()},{once:true});
}
async function order(kind,packageId){
 if(kind==='workout'){await request(kind,packageId);return}
 const notes=prompt('اگر توضیحی برای مربی دارید بنویسید (اختیاری):')||'';
 try{await MGApi.request('/api/coach-market/requests',{method:'POST',body:{coachId:coach.id,kind,packageId,notes,requestKey:key()}});status.textContent='درخواست شما برای مربی ارسال شد.'}catch(err){status.textContent=err.message==='offering_disabled'?'این خدمت فعلاً درخواست جدید نمی‌پذیرد.':'درخواست ثبت نشد؛ وضعیت حساب و اتصال را بررسی کنید.'}
}
function packageSection(title,kind,items){const section=el('section',null,'market-panel');section.append(el('h2',title));for(const item of items){const card=el('article',null,'offer-card');card.append(el('h3',item.name),el('p',item.description||'','muted'),el('strong',Number(item.price).toLocaleString('fa-IR')+' تومان','price'));const button=el('button',kind==='workout'?'سفارش این پکیج':'درخواست این پکیج','primary');button.onclick=()=>order(kind,item.id);card.append(button);section.append(card)}root.append(section)}
async function init(user){if(started)return;started=true;if(user.role!=='athlete'){location.replace('coach-directory.html');return}if(!coachId){status.textContent='شناسهٔ مربی مشخص نیست.';return}try{coach=(await MGApi.request('/api/coach-market/coaches/'+encodeURIComponent(coachId))).coach;$('coach-name').textContent=coach.name;const cover=el('div',null,'profile-cover'),hero=document.createElement('img');hero.alt='تصویر معرفی '+coach.name;hero.src=coach.hero_image||coach.avatar||'assets/brand/mg-mark-acid.webp';cover.append(hero,el('h2',coach.specialty||'مربی باشگاه'));root.append(cover,el('section',coach.bio||'اطلاعات معرفی این مربی هنوز تکمیل نشده است.','market-panel'));if(coach.workoutEnabled)packageSection('پکیج‌های برنامهٔ تمرینی','workout',coach.workoutPackages);if(coach.inPersonEnabled)packageSection('مربی حضوری','in_person',coach.inPersonPackages);if(coach.nutritionEnabled){const section=el('section',null,'market-panel');section.append(el('h2','برنامهٔ غذایی'));const button=el('button','درخواست برنامهٔ غذایی','primary');button.onclick=()=>order('nutrition');section.append(el('p','پس از تأیید مربی، برنامهٔ متناسب برای شما از کتابخانهٔ غذایی او ارسال می‌شود.','muted'),button);root.append(section)}const chat=el('section',null,'market-panel'),form=el('form',null,'market-form'),message=document.createElement('textarea'),send=el('button','ارسال پیام','primary');message.required=true;message.maxLength=4000;message.placeholder='پیام خود را برای مربی بنویسید';form.append(message,send);form.onsubmit=async e=>{e.preventDefault();try{await MGApi.request('/api/messages',{method:'POST',body:{recipientId:coach.id,body:message.value}});message.value='';status.textContent='پیام ارسال شد.'}catch{status.textContent='ارسال پیام انجام نشد.'}};chat.append(el('h2','ارتباط با مربی'),form);root.append(chat);status.textContent='صفحهٔ مربی بارگذاری شد.'}catch{status.textContent='صفحهٔ این مربی در باشگاه شما در دسترس نیست.'}}
window.addEventListener('mg:access-ready',e=>init(e.detail));if(window.MGCurrentUser)init(window.MGCurrentUser)
})();
