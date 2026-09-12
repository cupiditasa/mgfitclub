(() => {
  const activeSession = localStorage.getItem("mg_session");
  if (activeSession && !document.body.dataset.role)
    document.body.dataset.role = localStorage.getItem("mg_role") || "athlete";
  if (activeSession && location.search.includes("demo=")) {
    const clean = new URL(location.href);
    clean.searchParams.delete("demo");
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
  }
  const API_BASE =
    window.MG_API_BASE ||
    document.documentElement.dataset.apiBase ||
    "https://mg-fitclub-api.cupiditasa.workers.dev";

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
  };

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
