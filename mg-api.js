(() => {
  const mgThemePages = new Set([
    "access-center.html", "account.html", "admin.html", "admin-dashboard.html",
    "admin-transactions.html", "attendance-pilot.html", "club-attendance.html",
    "coach.html", "coach-dashboard.html", "coach-directory.html", "coach-food.html",
    "coach-market-log.html", "coach-offerings.html", "coach-profile.html",
    "coach-programs.html", "coach-requests.html", "coach-transactions.html",
    "dashboard.html", "device-verification.html", "education.html", "exercise-library.html",
    "food-plan-view.html", "nutrition.html", "nutrition-builder.html", "nutrition-view.html",
    "secretary.html", "support.html", "training-request.html", "workout-log.html", "workout-view.html",
  ]);
  const mgThemeValues = new Set([
    "modern-light", "modern-light-coral", "modern-dark", "modern-dark-coral", "classic",
  ]);
  const mgThemePageName = location.pathname.split("/").filter(Boolean).pop() || "index.html";
  if (mgThemePages.has(mgThemePageName)) {
    const cookieTheme = document.cookie.match(/(?:^|;\s*)mg_theme_pref=([^;]*)/)?.[1];
    let storedTheme = "";
    try { storedTheme = localStorage.getItem("mg_dashboard_theme") || ""; } catch {}
    let theme = "";
    try { theme = decodeURIComponent(cookieTheme || ""); } catch {}
    if (!mgThemeValues.has(theme)) theme = storedTheme;
    if (!mgThemeValues.has(theme)) theme = "modern-light";
    document.documentElement.dataset.mgTheme = theme;
    if (document.body) document.body.dataset.mgTheme = theme;
    else document.addEventListener("DOMContentLoaded", () => {
      if (document.body) document.body.dataset.mgTheme = theme;
    }, { once: true });

    if (!document.querySelector("link[data-mg-global-theme]")) {
      const themeCss = document.createElement("link");
      themeCss.rel = "stylesheet";
      themeCss.href = "mg-global-theme.css?v=20261009-palette4";
      themeCss.dataset.mgGlobalTheme = "true";
      document.head.appendChild(themeCss);
    }
    if (!document.querySelector("script[data-mg-global-theme]")) {
      const themeScript = document.createElement("script");
      themeScript.src = "mg-global-theme.js?v=20261009-palette4";
      themeScript.dataset.mgGlobalTheme = "true";
      document.head.appendChild(themeScript);
    }
  }
  const activeSession = localStorage.getItem("mg_session");
  const applyStoredRole = () => {
    if (localStorage.getItem("mg_session") && document.body && !document.body.dataset.role)
      document.body.dataset.role = localStorage.getItem("mg_role") || "athlete";
  };
  if (document.body) applyStoredRole();
  else document.addEventListener("DOMContentLoaded", applyStoredRole, { once: true });
  if (activeSession && location.search.includes("demo=")) {
    const clean = new URL(location.href);
    clean.searchParams.delete("demo");
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
  }
  const API_BASE =
    window.MG_API_BASE ||
    document.documentElement.dataset.apiBase ||
    "https://api.mgfitclub.ir";

  const readJson = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "خطای سرویس");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  const request = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !headers.has("content-type"))
      headers.set("content-type", "application/json");
    const token = localStorage.getItem("mg_session");
    if (token && !headers.has("authorization"))
      headers.set("authorization", "Bearer " + token);
    const response = await fetch(API_BASE + path, {
      ...options,
      cache: "no-store",
      headers,
      body:
        options.body !== undefined && typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body,
    });
    return readJson(response);
  };

  const clearSession = () => {
    localStorage.removeItem("mg_session");
    localStorage.removeItem("mg_role");
    try { sessionStorage.removeItem("mg_recent_verified_user"); } catch {}
  };

  const verificationFingerprint = async (token) => {
    if (!token || !window.crypto?.subtle || typeof TextEncoder === "undefined") return "";
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  };

  // Short-lived continuity hint for an outage immediately after login.
  // This only unlocks the static shell; API authorization remains server-side.
  const rememberVerifiedUser = async (user) => {
    const token = localStorage.getItem("mg_session");
    if (!token || !user?.role || !user?.access_state) return false;
    try {
      const fingerprint = await verificationFingerprint(token);
      if (!fingerprint || localStorage.getItem("mg_session") !== token) return false;
      sessionStorage.setItem("mg_recent_verified_user", JSON.stringify({
        user: { id: user.id, role: user.role, access_state: user.access_state },
        fingerprint,
        verifiedAt: Date.now(),
      }));
      return true;
    } catch { return false; }
  };

  const recentVerifiedUser = async () => {
    const token = localStorage.getItem("mg_session");
    if (!token) return null;
    try {
      const record = JSON.parse(sessionStorage.getItem("mg_recent_verified_user") || "null");
      if (!record?.user?.role || !record.user.access_state || !Number.isFinite(record.verifiedAt) ||
          Date.now() - record.verifiedAt < 0 || Date.now() - record.verifiedAt > 15 * 60 * 1000) return null;
      const fingerprint = await verificationFingerprint(token);
      return fingerprint && fingerprint === record.fingerprint ? record.user : null;
    } catch { return null; }
  };

  // Only the server can decide whether a persisted session is still valid.
  const restoreSession = async () => {
    const saved = localStorage.getItem("mg_session");
    if (!saved) return null;
    try {
      const data = await request("/api/me", { signal: AbortSignal.timeout(15000) });
      if (localStorage.getItem("mg_session") !== saved) return null;
      if (!data.user?.role) throw new Error("Invalid session response");
      localStorage.setItem("mg_role", data.user.role);
      await rememberVerifiedUser(data.user);
      return data.user;
    } catch (error) {
      if (error.status === 401) {
        if (localStorage.getItem("mg_session") === saved) clearSession();
        return null;
      }
      // Network outages must not sign the user out.
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (localStorage.getItem("mg_session"))
        await request("/api/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  };

  window.MGApi = {
    base: API_BASE,
    request,
    me: () => request("/api/me"),
    dashboard: () => request("/api/dashboard"),
    membershipPlans: () => request("/api/plans/membership"),
    trainingPlans: () => request("/api/plans/training"),
    createOrder: (body) =>
      request("/api/orders", { method: "POST", body }),
    createTrainingRequest: (body) =>
      request("/api/training-requests", { method: "POST", body }),
    trainingRequests: () => request("/api/training-requests"),
    updateTrainingRequest: (id, body) =>
      request("/api/training-requests/" + encodeURIComponent(id), {
        method: "PATCH",
        body,
      }),
    createDeliverable: (body) =>
      request("/api/training-deliverables", { method: "POST", body }),
    adminUsers: () => request("/api/admin/users"),
    updateUser: (id, body) =>
      request("/api/admin/users/" + encodeURIComponent(id), {
        method: "PATCH",
        body,
      }),
    logout,
    clearSession,
    restoreSession,
    rememberVerifiedUser,
    recentVerifiedUser,
    errorMessage: (error) => ({
      support_phone_only: "این شماره اجازه ورود به پنل پشتیبانی ندارد.",
      club_account_required: "حساب مدیریت باشگاه باید توسط پشتیبانی ساخته شود.",
      staff_club_not_configured: "ثبت‌نام کارکنان موقتاً تنظیم نشده است؛ با پشتیبانی تماس بگیرید.",
      staff_club_unavailable: "باشگاه MG در دسترس نیست؛ با پشتیبانی تماس بگیرید.",
      club_required: "باشگاه را انتخاب کنید.",
      approval_required: "دسترسی شما در انتظار تأیید مدیر باشگاه است.",
      forbidden: "اجازه انجام این کار را ندارید.",
      phone_already_in_use: "یکی از شماره‌ها قبلاً به باشگاه دیگری متصل شده است.",
      invalid_club_details: "نام باشگاه، نام مدیر و شماره‌های معتبر و غیرتکراری وارد کنید (حداکثر ۱۰ شماره). شماره پشتیبانی نمی‌تواند شماره مدیریت باشد.",
      first_and_last_name_required: "نام و نام خانوادگی را جداگانه وارد کنید (حداکثر ۸۰ نویسه).",
      invalid_avatar: "تصویر معتبر JPG، PNG یا WebP انتخاب کنید.",
      invalid_or_expired_code: "کد نادرست یا منقضی شده است؛ در صورت نیاز صفحه را برای دریافت کد جدید باز کنید.",
      request_already_reviewed: "این درخواست قبلاً بررسی شده است.",
      request_no_longer_current: "کاربر نقش خود را تغییر داده؛ فهرست را تازه کنید.",
      code_delivery_failed: "ارسال کد انجام نشد؛ دوباره تلاش کنید.",
      too_many_requests: "تعداد تلاش‌ها زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.",
    }[error?.message] || "انجام عملیات ممکن نشد؛ اتصال اینترنت و دسترسی حساب را بررسی کنید."),
  };

  const page = location.pathname?.split("/").pop();
  if (page && page !== "account.html" && !/^\/staff\/login\/?$/.test(String(location.pathname || ""))) {
    const guard = document.createElement("script");
    guard.src = "access-control.js?v=20261010-athlete-api-outage";
    guard.onerror = () => {
      document.getElementById("mg-access-cloak")?.remove();
      document.body.replaceChildren(document.createTextNode("بررسی دسترسی ممکن نشد؛ اتصال اینترنت را بررسی و صفحه را دوباره بارگذاری کنید."));
    };
    document.head.appendChild(guard);
  }

  document.addEventListener("click", (event) => {
    if (!localStorage.getItem("mg_session")) return;
    const anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor) return;
    const target = new URL(anchor.href, location.href);
    if (!target.searchParams.has("demo")) return;
    event.preventDefault();
    target.searchParams.delete("demo");
    location.href = target.href;
  });
})();
