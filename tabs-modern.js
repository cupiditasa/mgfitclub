(() => {
  const body = document.body;
  if (!body) return;
  const path = location.pathname.toLowerCase();
  const excluded =
    /dashboard\.html$|^$/.test(path) &&
    !/coach-programs|coach-transactions|admin-transactions/.test(path);
  if (excluded) return;
  body.classList.add("tabs-modern-page");
  const queryRole = new URLSearchParams(location.search).get("demo");
  const role = body.dataset.role || queryRole || "athlete";
  const maps = {
    coach: [
      ["coach-dashboard.html?demo=coach", "⌂", "داشبورد"],
      ["coach.html?demo=coach", "＋", "ساخت برنامه"],
      ["coach-programs.html?demo=coach", "▤", "برنامه‌ها"],
      ["coach-transactions.html?demo=coach", "◉", "تراکنش‌ها"],
      ["education.html?demo=coach", "?", "آموزش"],
    ],
    manager: [
      ["admin.html?demo=manager", "⌂", "داشبورد مدیریت"],
      ["admin-transactions.html?demo=manager", "◉", "تراکنش‌ها"],
      ["support.html", "?", "پشتیبانی"],
    ],
    secretary: [
      ["secretary.html?demo=secretary", "⌂", "داشبورد"],
      ["admin.html?demo=manager", "♙", "مدیریت"],
      ["support.html", "?", "پشتیبانی"],
    ],
    support: [
      ["support.html", "⌂", "پشتیبانی"],
      ["account.html", "↩", "ورود"],
    ],
    athlete: [
      ["dashboard.html?demo=athlete", "⌂", "داشبورد"],
      ["workout-view.html?demo=athlete", "◈", "تمرین"],
      ["food-plan-view.html?demo=athlete", "◌", "تغذیه"],
      ["education.html?demo=athlete", "▤", "آموزش"],
    ],
  };
  const rail = document.createElement("aside");
  rail.className = "tabs-modern-rail";
  rail.innerHTML =
    '<button type="button" class="rail-toggle" aria-label="باز کردن منو">☰</button>' +
    (maps[role] || maps.athlete)
      .map(
        ([href, icon, label]) =>
          `<a href="${href}" title="${label}"><span>${icon}</span><span class="rail-label">${label}</span></a>`,
      )
      .join("");
  document.body.append(rail);
  const current = location.pathname.split(/[\\/]/).pop();
  rail.querySelectorAll("a").forEach((a) => {
    if (a.getAttribute("href").split("?")[0] === current)
      a.classList.add("is-current");
  });
  rail
    .querySelector(".rail-toggle")
    .addEventListener("click", () => body.classList.toggle("rail-expanded"));
  document
    .querySelectorAll("button.btn,button.primary,button.submit,a.back")
    .forEach((el) => {
      if (!el.querySelector("svg") && !el.dataset.icon)
        el.dataset.icon = el.classList.contains("back")
          ? "←"
          : el.tagName === "A"
            ? "↗"
            : "•";
    });
})();
