(() => {
  const routes = { athlete: "dashboard.html", coach: "coach-dashboard.html", manager: "admin.html", admin: "admin.html", secretary: "secretary.html", support: "support.html" };
  const page = location.pathname.split("/").pop();
  const center = page === "access-center.html";
  const style = document.createElement("style");
  style.textContent = `
    #mg-access-lock{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:#080d08bb;backdrop-filter:blur(18px);direction:rtl;color:#f1f4ef;font-family:Tahoma,sans-serif;visibility:visible}
    #mg-access-lock .lock-card{max-width:480px;width:100%;box-sizing:border-box;text-align:center;border:1px solid #77915080;border-radius:28px;padding:30px;background:#151d15e8;box-shadow:0 20px 80px #0008}
    #mg-access-lock .lock-symbol{font-size:74px;line-height:1.4;color:#c6ff3f}
    #mg-access-lock p{line-height:2;font-size:14px}
    #mg-access-lock button,#mg-access-lock a{display:inline-block;font:inherit;margin:6px;padding:12px;border-radius:12px;background:#c6ff3f;color:#142008;border:0;text-decoration:none;cursor:pointer}
    #mg-access-lock a.secondary{background:#ffffff10;color:#edf4e7;border:1px solid #ffffff30}
    .mg-account-link,.mg-device-link,.mg-bridge-link{position:fixed;left:14px;bottom:16px;z-index:99999;background:#162015e8;color:#d4ff8d;border:1px solid #8ba95a;padding:10px 14px;border-radius:30px;font:12px Tahoma;text-decoration:none;backdrop-filter:blur(12px)}
  `;
  document.head.appendChild(style);
  const hidden = new Map();
  let overlay, checking = false, lastCheck = 0, lastUser;
  const inertContent = () => {
    for (const child of document.body.children) if (child !== overlay && !hidden.has(child)) {
      hidden.set(child, child.inert); child.inert = true;
    }
  };
  function unlock() {
    overlay?.remove(); overlay = null;
    for (const [el, wasInert] of hidden) el.inert = wasInert;
    hidden.clear();
    document.getElementById("mg-access-cloak")?.remove();
  }
  function lock(title, message, pending = false) {
    if (!overlay) { overlay = document.createElement("section"); overlay.id = "mg-access-lock"; document.body.appendChild(overlay); }
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", title);
    overlay.replaceChildren();
    const card = document.createElement("div"); card.className = "lock-card";
    const icon = document.createElement("div"); icon.className = "lock-symbol"; icon.textContent = "🔒"; icon.setAttribute("aria-hidden", "true");
    const h = document.createElement("h1"); h.textContent = title;
    const p = document.createElement("p"); p.textContent = message;
    const retry = document.createElement("button"); retry.textContent = "بررسی دوباره دسترسی"; retry.onclick = () => check(true);
    card.append(icon, h, p, retry);
    if (pending) {
      const link = document.createElement("a"); link.href = "access-center.html#role"; link.textContent = "تغییر رول کاربری"; link.className = "secondary"; card.append(link);
      const profile = document.createElement("a"); profile.href = "access-center.html#profile"; profile.textContent = "تکمیل مشخصات من"; profile.className = "secondary"; card.append(profile);
    }
    const out = document.createElement("button"); out.textContent = "خروج از حساب";
    out.onclick = async () => { try { await MGApi.logout(); } finally { location.replace("account.html"); } };
    card.append(out); overlay.append(card); inertContent();
    document.getElementById("mg-access-cloak")?.remove();
    retry.focus();
  }
  async function check(force = false) {
    if (checking || (!force && Date.now() - lastCheck < 10000)) return;
    checking = true; lastCheck = Date.now();
    try {
      const user = await MGApi.restoreSession();
      if (!user) { location.replace("account.html"); return; }
      if (user.access_state !== "approved" && !center) {
        lock(user.access_state === "rejected" ? "درخواست تأیید نشده است" : "در انتظار تأیید مدیر", "حساب شما ثبت شده است. تا تأیید مدیر باشگاه، امکانات پنل قفل هستند. می‌توانید مشخصات خود را کامل کنید یا نقش دیگری انتخاب کنید.", !["manager", "support"].includes(user.role));
        return;
      }
      const allowed = page.startsWith("coach") ? ["coach"] : page.startsWith("admin") ? ["manager"] : page === "secretary.html" ? ["secretary"] : page === "support.html" ? ["support"] : page === "dashboard.html" ? ["athlete"] : null;
      if (allowed && !allowed.includes(user.role)) { location.replace(routes[user.role] || "account.html"); return; }
      unlock();
      document.body.dataset.role = user.role;
      window.MGCurrentUser = user;
      if (["support", "manager", "secretary"].includes(user.role) && !document.querySelector('.mg-bridge-link')) {
        const bridgeLink = document.createElement('a'); bridgeLink.href = 'club-attendance.html'; bridgeLink.textContent = 'تردد و دانلود رابط MG'; bridgeLink.className = 'mg-bridge-link'; bridgeLink.style.bottom = '128px'; document.body.append(bridgeLink);
      }
      let deviceLink = document.querySelector('.mg-device-link');
      if (!deviceLink) {
        deviceLink = document.createElement('a'); deviceLink.href = 'device-verification.html'; deviceLink.className = 'mg-device-link';
        deviceLink.style.cssText = 'bottom:72px;max-width:calc(100vw - 56px);font-size:12px';
        deviceLink.textContent = 'تأیید دستگاه تردد'; document.body.appendChild(deviceLink);
      }
      Promise.resolve().then(() => MGApi.request('/api/device-verification/me', typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? {signal:AbortSignal.timeout(10000)} : {})).then(data => {
        const verified=data.registrations.filter(r=>r.state==='verified');
        deviceLink.textContent=(verified.length?'✓ ':data.registrations.some(r=>r.state==='pending')?'⏳ ':'')+'تأیید دستگاه تردد';
        deviceLink.title=verified.length?'تأییدشده در: '+verified.map(r=>r.clubName).join('، '):'بررسی وضعیت و ثبت درخواست';
      }).catch(()=>{deviceLink.textContent='تأیید دستگاه تردد';deviceLink.title='وضعیت قابل دریافت نیست؛ برای بررسی باز کنید.'}).finally(()=>{
        return MGApi.request('/api/mg-bridge/mine',typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? {signal:AbortSignal.timeout(10000)} : {}).then(data=>{
          deviceLink.href='club-attendance.html';
          if(data.registrations?.length){deviceLink.textContent='✓ اتصال دستگاه تردد';deviceLink.title=data.registrations.map(r=>r.club_name+' / '+r.member_id).join('، ')}
        }).catch(()=>{});
      });
      if (!center && page !== "support.html" && !document.querySelector(".mg-account-link")) {
        const link = document.createElement("a"); link.href = "access-center.html"; link.className = "mg-account-link";
        link.textContent = user.role === "manager" ? "کاربران و درخواست‌های تأیید" : "مشخصات و نقش من"; document.body.appendChild(link);
      }
      if (!center && user.role !== "manager" && !lastUser) {
        MGApi.request("/api/me/profile").then(({ profile }) => {
          for (const target of document.querySelectorAll(".hero-card .avatar, .profile-card .avatar")) {
            if (!profile.avatar_data) continue;
            const img = document.createElement("img"); img.src = profile.avatar_data; img.alt = "تصویر پروفایل شما";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%";
            target.replaceChildren(img);
          }
        }).catch(() => {});
      }
      if (!lastUser || lastUser.role !== user.role || lastUser.access_state !== user.access_state)
        window.dispatchEvent(new CustomEvent("mg:access-ready", { detail: user }));
      lastUser = user;
    } catch (_) {
      lock("ارتباط با سرور برقرار نشد", "برای محافظت از حساب، بدون بررسی اعتبار ورود امکان نمایش پنل نیست. اتصال اینترنت را بررسی و دوباره تلاش کنید.");
    } finally { checking = false; }
  }
  const start = () => { lock("بررسی دسترسی", "لطفاً چند لحظه صبر کنید…"); check(true); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("pageshow", () => check());
  window.addEventListener("storage", e => { if (e.key === "mg_session") check(true); });
  document.addEventListener("focusin", e => {
    if (overlay && !overlay.contains(e.target)) overlay.querySelector("button")?.focus();
  });
})();
