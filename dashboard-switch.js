(() => {
  const token = () => {
    try { return localStorage.getItem("mg_session") || ""; }
    catch (_) { return ""; }
  };
  const session = token();
  if (!session || !document.body) return;

  const page = location.pathname.split("/").pop() || "index.html";
  const privatePages = new Set([
    "dashboard.html", "coach-dashboard.html", "admin.html",
    "secretary.html", "support.html", "access-center.html",
  ]);
  const publicPages = new Set([
    "index.html", "membership.html", "education-studio.html", "news.html", "app.html",
  ]);
  const isPrivate = privatePages.has(page);
  if (!isPrivate && !publicPages.has(page)) return;

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("dashboard-switch.css?v=20261008", document.currentScript.src).href;
  document.head.append(style);

  const root = document.createElement("div");
  root.className = "mg-switch-root";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mg-switch-trigger";
  button.textContent = isPrivate ? "سویچ به عمومی" : "سویچ به خصوصی";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", isPrivate ? "menu" : "false");
  root.append(button);

  if (isPrivate) {
    const menu = document.createElement("nav");
    menu.className = "mg-switch-menu";
    menu.setAttribute("aria-label", "صفحه‌های عمومی سایت");
    menu.setAttribute("role", "menu");
    const links = [
      ["صفحهٔ اصلی سایت", "index.html"],
      ["لیست قیمت‌ها", "membership.html"],
      ["آموزش‌ها", "education-studio.html"],
      ["خبرها", "news.html"],
      ["اپلیکیشن", "app.html"],
    ];
    for (const [label, href] of links) {
      const link = document.createElement("a");
      link.href = new URL(href, location.href).href;
      link.textContent = label;
      link.setAttribute("role", "menuitem");
      menu.append(link);
    }
    menu.hidden = true;
    root.append(menu);
    button.addEventListener("click", () => {
      menu.hidden = !menu.hidden;
      button.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });
  } else {
    const status = document.createElement("p");
    status.className = "mg-switch-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;
    root.append(status);
    let busy = false;
    button.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      status.hidden = false;
      status.textContent = "در حال بررسی نشست ورود…";
      try {
        const response = await fetch("https://api.mgfitclub.ir/api/me", {
          cache: "no-store",
          headers: { authorization: "Bearer " + session },
        });
        if (response.status === 401) {
          localStorage.removeItem("mg_session");
          localStorage.removeItem("mg_role");
          location.replace("account.html");
          return;
        }
        if (!response.ok) throw new Error("service_unavailable");
        const data = await response.json();
        const role = data.user?.role;
        const route = {
          athlete: "dashboard.html", coach: "coach-dashboard.html",
          manager: "admin.html", admin: "admin.html",
          secretary: "secretary.html", support: "support.html",
        }[role];
        if (!route) throw new Error("role_unavailable");
        localStorage.setItem("mg_role", role);
        location.assign(new URL(route, location.href).href);
      } catch (_) {
        status.textContent = "اتصال به سامانه بررسی نشد؛ اینترنت را بررسی کنید و دوباره بزنید.";
        busy = false;
        button.disabled = false;
      }
    });
  }
  document.body.append(root);
})();
