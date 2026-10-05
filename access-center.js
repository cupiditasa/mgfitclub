(() => {
  const app = document.getElementById("access-app");
  const roles = { athlete: "ورزشکار", coach: "مربی", secretary: "منشی", manager: "مدیر باشگاه", admin: "مدیر باشگاه", support: "پشتیبانی فنی" };
  const states = { approved: "تأییدشده", pending: "در انتظار تأیید", rejected: "تأییدنشده", active: "فعال", blocked: "مسدود" };
  const routes = { athlete: "dashboard.html", coach: "coach-dashboard.html", secretary: "secretary.html", manager: "admin.html", support: "support.html" };
  let current, page = 1, clubEdit = null, tabVersion = 0;
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const button = (text, fn, cls) => { const b = el("button", text, cls); b.type = "button"; b.onclick = fn; return b; };
  const input = (labelText, type = "text") => { const label = el("label", labelText); const field = el("input"); field.type = type; label.append(field); return { label, field }; };
  const api = (path, method = "GET", body) => MGApi.request(path, { method, ...(body === undefined ? {} : { body }), signal: AbortSignal.timeout(20000) });
  const status = el("p", "", "access-status"); status.setAttribute("role", "status");
  const report = (message, error = false) => { status.textContent = message; status.dataset.error = String(error); };
  async function run(b, fn) {
    if (b.disabled) return; b.disabled = true; report("");
    try { await fn(); } catch (e) { report(MGApi.errorMessage(e), true); } finally { b.disabled = false; }
  }
  let panel, nav;
  async function choose(name) {
    const version = ++tabVersion; report("");
    for (const b of nav.children) b.setAttribute("aria-selected", String(b.dataset.tab === name));
    panel.replaceChildren(el("p", "در حال دریافت اطلاعات…"));
    try {
      const card = el("section", undefined, "access-card");
      if (name === "profile") await profileTab(card);
      if (name === "role") await roleTab(card);
      if (name === "users") await usersTab(card);
      if (name === "approvals") await approvalsTab(card);
      if (name === "clubs") await clubsTab(card);
      if (name === "attendance") await attendanceTab(card);
      if (name === "bridge") {
        card.append(el("h2", "رابط واحد و مدیریت تردد MG"), el("p", "دانلود رابط ویندوز، اتصال باشگاه و بررسی حضورها در یک صفحه."));
        const link = el("a", "باز کردن مدیریت تردد و دانلود رابط"); link.href = "club-attendance.html"; card.append(link);
      }
      if (version === tabVersion) { panel.replaceChildren(card); history.replaceState(null, "", "#" + name); }
    } catch (e) { if (version === tabVersion) { panel.replaceChildren(button("تلاش دوباره", () => choose(name))); report(MGApi.errorMessage(e), true); } }
  }
  function init(user) {
    if (!app || current) return; current = user;
    const header = el("header"), title = el("div");
    title.append(el("div", "MG FITCLUB / ACCOUNT", "access-brand"), el("h1", roles[user.role] || "حساب من"), el("p", user.club_name || user.full_name || "حساب و دسترسی‌های شما", "access-muted"));
    const links = el("div", undefined, "access-actions");
    const back = el("a", "بازگشت به داشبورد"); back.href = routes[user.role] || "dashboard.html";
    const out = button("خروج", () => run(out, async () => { try { await MGApi.logout(); } finally { location.replace("account.html"); } }));
    links.append(back, out); header.append(title, links);
    const device = el('a', 'تأیید دستگاه تردد'); device.href = 'device-verification.html'; links.append(device);
    nav = el("nav", undefined, "access-tabs"); nav.setAttribute("aria-label", "بخش‌های حساب");
    const tabs = [];
    if (["support", "manager", "secretary"].includes(user.role) && user.access_state === "approved") tabs.push(["bridge", "تردد و دانلود رابط MG"]);
    if (user.role === "support") tabs.push(["clubs", "باشگاه‌ها و شماره‌های ورود"], ["users", "تمام کاربران"]);
    if (user.role === "manager" && user.access_state === "approved") tabs.push(["approvals", "درخواست‌های تأیید"], ["users", "کاربران ثبت‌نام‌شده"]);
    if (["support", "manager"].includes(user.role) && user.access_state === "approved") tabs.push(["attendance", "تأیید حضور آزمایشی"]);
    if (user.role !== "manager") tabs.push(["profile", "مشخصات و تصویر من"]);
    if (!["manager", "support"].includes(user.role)) tabs.push(["role", "تغییر رول کاربری"]);
    panel = el("div");
    for (const [key, label] of tabs) { const b = button(label, () => choose(key)); b.dataset.tab = key; nav.append(b); }
    app.replaceChildren(header, nav, status, panel);
    if (!tabs.length) { panel.append(el("p", "حساب مدیریت باید توسط پشتیبانی به باشگاه متصل شود.")); return; }
    const wanted = location.hash.slice(1); choose(tabs.some(t => t[0] === wanted) ? wanted : tabs[0][0]);
  }
  async function attendanceTab(card) {
    card.append(el("h2", "بررسی حضور آزمایشی"), el("p", "ثبت دستگاه به‌تنهایی تأیید ورود نیست. تنها پس از اطمینان از ورود واقعی همان شخص تأیید کنید. تأیید مدیر و پشتیبان روی یک حضور، مصرف دوباره ایجاد نمی‌کند؛ حداکثر یک جلسه در روز.", "access-warning"));
    card.append(button("تازه‌سازی", () => choose("attendance")));
    const data = await api("/api/attendance-pilot/review");
    if (!data.observations.length) card.append(el("p", "حضوری برای بررسی دریافت نشده است. ابتدا رکورد عضو آزمایشی را از نرم‌افزار رابط ارسال کنید."));
    for (const item of data.observations) {
      const row = el("section", undefined, "access-card");
      row.append(el("h3", item.name || "نام ثبت نشده"), el("p", "شماره: " + (item.phone || "—") + " | شناسهٔ دستگاه: " + item.memberId), el("p", "زمان دستگاه: " + item.event.deviceWallTime), el("p", "کد تردد خام: " + item.event.punchCode + " | کد شناسایی خام: " + item.event.verificationCode), el("p", "وضعیت: " + (states[item.status] || item.status)));
      if (item.status === "pending") for (const decision of ["approve", "reject"]) {
        const b = button(decision === "approve" ? "تأیید ورود و مصرف جلسه" : "رد این رکورد", () => run(b, async () => {
          if (!window.confirm(decision === "approve" ? "از ورود واقعی همین شخص در این زمان مطمئن هستید؟ تأیید شما درخواست مصرف یک جلسه را ثبت می‌کند." : "این رکورد برای مصرف جلسه رد شود؟")) return;
          const result = await api("/api/attendance-pilot/review/" + encodeURIComponent(item.id), "POST", { decision, confirmedAdmission: decision === "approve" });
          await choose("attendance");
          report(result.alreadyReviewed ? "این رکورد قبلاً بررسی شده است؛ وضعیت تازه شد." : result.trial ? "ثبت شد؛ ماندهٔ قطعی: " + result.trial.remainingSessions + " جلسه" : "نتیجهٔ بررسی ثبت شد.");
        }), decision === "approve" ? "primary" : "danger");
        row.append(b);
      }
      card.append(row);
    }
    card.append(el("small", "حداکثر ۲۰۰ رکورد اخیر نمایش داده می‌شود. این بخش فقط برای پایلوت است، نه حسابداری جیم پالس."));
  }
  async function profileTab(card) {
    const data = await api("/api/me/profile");
    let avatar = data.profile.avatar_data;
    card.append(el("h2", "مشخصات شخصی"));
    const form = el("form"), grid = el("div", undefined, "access-grid");
    const first = input("نام"), last = input("نام خانوادگی");
    first.field.value = data.profile.first_name; last.field.value = data.profile.last_name;
    first.field.autocomplete = "given-name"; last.field.autocomplete = "family-name";
    for (const f of [first, last]) { f.field.required = true; f.field.maxLength = 80; grid.append(f.label); }
    if (!data.profile.first_name && data.user.full_name) card.append(el("p", "نام فعلی حساب: " + data.user.full_name, "access-muted"));
    const preview = el("img", undefined, "access-avatar"); preview.alt = "تصویر پروفایل"; preview.hidden = !avatar;
    if (avatar) preview.src = avatar;
    const photo = input("عکس پروفایل (JPG، PNG یا WebP؛ حداکثر ۵ مگابایت)", "file"); photo.field.accept = "image/jpeg,image/png,image/webp";
    photo.field.onchange = async () => {
      const file = photo.field.files[0]; if (!file) return;
      if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { report("تصویر معتبر با حجم کمتر از ۵ مگابایت انتخاب کنید.", true); photo.field.value = ""; return; }
      save.disabled = true;
      try {
        const bitmap = await createImageBitmap(file);
        const ratio = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#172018"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        avatar = canvas.toDataURL("image/jpeg", .82);
        if (avatar.length > 160000) avatar = canvas.toDataURL("image/jpeg", .6);
        preview.src = avatar; preview.hidden = false; report("تصویر آماده است؛ برای ثبت، ذخیره را بزنید.");
      } catch (_) { report("این تصویر قابل خواندن نیست.", true); } finally { save.disabled = false; }
    };
    const remove = button("حذف تصویر", () => { avatar = null; preview.hidden = true; photo.field.value = ""; });
    const save = el("button", "ذخیره مشخصات", "primary"); save.type = "submit";
    form.onsubmit = e => { e.preventDefault(); run(save, async () => {
      await api("/api/me/profile", "PATCH", { firstName: first.field.value, lastName: last.field.value, avatarData: avatar }); report("مشخصات و تصویر شما ذخیره شد.");
    }); };
    form.append(preview, grid, photo.label, remove, save); card.append(form);
  }
  async function roleTab(card) {
    const data = await api("/api/clubs");
    card.append(el("h2", "تغییر رول کاربری"), el("p", "وضعیت فعلی: " + (states[current.access_state] || current.access_state), "access-tag"), el("p", "مربی و منشی تنها پس از تأیید مدیر باشگاه به امکانات دسترسی دارند. تغییر نقش، درخواست قبلی را لغو می‌کند و برای نقش جدید تأیید تازه لازم است.", "access-warning"));
    const role = el("select"); role.setAttribute("aria-label", "نقش جدید");
    for (const key of ["athlete", "coach", "secretary"]) role.add(new Option(roles[key], key));
    role.value = current.role;
    const club = el("select"); club.setAttribute("aria-label", "باشگاه"); club.add(new Option("انتخاب باشگاه", "")); data.clubs.forEach(c => club.add(new Option(c.name, c.id))); club.value = current.club_id || "";
    role.onchange = () => { club.hidden = role.value === "athlete"; }; role.onchange();
    const save = button("ثبت نقش جدید", () => run(save, async () => {
      if (role.value !== "athlete" && !club.value) { report("باشگاه را انتخاب کنید.", true); return; }
      const result = await api("/api/me/role", "POST", { role: role.value, clubId: club.value });
      localStorage.setItem("mg_role", result.user.role); location.replace(routes[result.user.role]);
    }), "primary"); card.append(role, club, save);
  }
  async function usersTab(card) {
    const data = await api("/api/admin/users?page=" + page);
    card.append(el("h2", "تمام کاربران ثبت‌نام‌شده"), el("p", "تعداد کل: " + data.total + " | صفحه " + data.page, "access-muted"));
    const wrap = el("div", undefined, "access-table-wrap"), table = el("table"), head = el("tr");
    ["نام", "شماره / ایمیل", "نقش", "باشگاه", "تأیید دسترسی", "حساب", "دستگاه تردد"].forEach(s => head.append(el("th", s))); table.append(head);
    for (const u of data.users) {
      const deviceStates={unregistered:'ثبت نشده',pending:'در انتظار تأیید',verified:'✓ تأیید شده'};
      const deviceText=!u.device_registrations?'سرویس فعال نیست':u.device_registrations.length?u.device_registrations.map(r=>r.clubName+': '+deviceStates[r.state]).join('، '):current.role==='manager'?'ثبت نشده در باشگاه شما':'ثبت نشده';
      const row = el("tr"); [u.full_name || "ثبت نشده", u.phone || u.email || "حساب مشترک باشگاه", roles[u.role] || u.role, u.club_name || "—", states[u.access_state] || u.access_state, states[u.status] || u.status,deviceText].forEach(s => row.append(el("td", s))); table.append(row);
    }
    wrap.append(table); card.append(wrap);
    const prev = button("صفحه قبل", () => { page--; choose("users"); }), next = button("صفحه بعد", () => { page++; choose("users"); });
    prev.disabled = page <= 1; next.disabled = page * data.pageSize >= data.total;
    card.append(prev, next, button("تازه‌سازی", () => choose("users")));
  }
  async function approvalsTab(card) {
    const data = await api("/api/access-requests");
    card.append(el("h2", "درخواست‌های تأیید مربی و منشی"), button("تازه‌سازی", () => choose("approvals")));
    if (!data.requests.length) card.append(el("p", "درخواست بررسی‌نشده‌ای ندارید."));
    for (const r of data.requests) {
      const row = el("article", undefined, "access-request");
      row.append(el("strong", r.full_name || "نام تکمیل نشده"), el("p", (r.phone || "") + " · " + roles[r.role] + " · " + r.club_name));
      for (const [state, label] of [["approved", "تأیید دسترسی"], ["rejected", "عدم تأیید"]]) {
        const b = button(label, () => run(b, async () => { await api("/api/access-requests/" + encodeURIComponent(r.id), "PATCH", { state }); await choose("approvals"); report("نتیجه بررسی ثبت شد."); }), state === "approved" ? "primary" : "danger"); row.append(b);
      }
      card.append(row);
    }
  }
  async function clubsTab(card) {
    const data = await api("/api/support/clubs");
    const editing = clubEdit;
    card.append(el("h2", editing ? "ویرایش باشگاه" : "ساخت حساب باشگاه"));
    const form = el("form"), name = input("نام باشگاه"), manager = input("نام و نام خانوادگی مدیر"), phoneBox = el("div");
    name.field.required = manager.field.required = true; name.field.maxLength = 120; manager.field.maxLength = 160;
    name.field.value = editing?.name || ""; manager.field.value = editing?.manager_name || "";
    function phoneField(value = "") {
      if (phoneBox.children.length >= 10) return;
      const row = el("div", undefined, "access-phone"), f = el("input"); f.type = "tel"; f.inputMode = "tel"; f.placeholder = "09xxxxxxxxx"; f.required = true; f.value = value; f.setAttribute("aria-label", "شماره ورود مدیریت");
      row.append(f, button("حذف", () => { if (phoneBox.children.length > 1) row.remove(); })); phoneBox.append(row);
    }
    (editing?.phones || [""]).forEach(phoneField);
    const add = button("＋ افزودن شماره ورود", () => phoneField());
    const note = el("p", "این شماره‌ها با انتخاب نقش مدیریت به همین حساب مشترک وارد می‌شوند؛ حساب شخصی قبلی آن‌ها مستقل و محفوظ می‌ماند. ویرایش باشگاه برای امنیت، نشست‌های مدیریت را خارج می‌کند.", "access-warning");
    const save = el("button", editing ? "ذخیره تغییرات" : "ساخت و تأیید حساب باشگاه", "primary"); save.type = "submit";
    form.onsubmit = e => { e.preventDefault(); run(save, async () => {
      const path = "/api/support/clubs" + (editing ? "/" + encodeURIComponent(editing.id) : "");
      await api(path, editing ? "PATCH" : "POST", { name: name.field.value, managerName: manager.field.value, phones: [...phoneBox.querySelectorAll("input")].map(f => f.value) });
      clubEdit = null; await choose("clubs"); report("حساب باشگاه و شماره‌های ورود ذخیره شدند.");
    }); };
    form.append(name.label, manager.label, note, phoneBox, add, save); card.append(form);
    if (editing) card.append(button("انصراف از ویرایش", () => { clubEdit = null; choose("clubs"); }));
    card.append(el("h2", "باشگاه‌های ثبت‌شده"));
    if (!data.clubs.length) card.append(el("p", "هنوز باشگاهی ساخته نشده است."));
    for (const c of data.clubs) {
      const row = el("article", undefined, "access-request"); row.append(el("strong", c.name), el("p", c.manager_name), el("p", c.phones.join(" — ")), button("ویرایش نام و شماره‌ها", () => { clubEdit = c; choose("clubs"); })); card.append(row);
    }
  }
  window.addEventListener("mg:access-ready", e => init(e.detail));
  if (window.MGCurrentUser) init(window.MGCurrentUser);
})();
