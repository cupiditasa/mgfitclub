(() => {
  const storageKey = "mg_dashboard_theme";
  const cookieKey = "mg_theme_pref";
  const choices = [
    { id: "modern-light", label: "روشن · لایم، طلایی و نقره‌ای" },
    { id: "modern-light-coral", label: "روشن · لایم و مرجانی" },
    { id: "modern-dark", label: "تیره · لایم، طلایی و نقره‌ای" },
    { id: "modern-dark-coral", label: "تیره · لایم و مرجانی" },
    { id: "classic", label: "کلاسیک · ظاهر قبلی" },
  ];
  const validThemes = new Set(choices.map((choice) => choice.id));
  const labels = new Map(choices.map((choice) => [choice.id, choice.label]));

  const readCookie = () => {
    const match = document.cookie.match(/(?:^|;\s*)mg_theme_pref=([^;]*)/);
    if (!match) return "";
    try { return decodeURIComponent(match[1]); } catch { return ""; }
  };
  const writeCookie = (theme) => {
    if (!/^(?:staff\.)?mgfitclub\.ir$/i.test(location.hostname)) return;
    document.cookie = `${cookieKey}=${encodeURIComponent(theme)}; Path=/; Domain=.mgfitclub.ir; Max-Age=31536000; SameSite=Lax; Secure`;
  };
  const saveTheme = (theme) => {
    try { localStorage.setItem(storageKey, theme); } catch {}
    writeCookie(theme);
  };
  const ensureStylesheet = () => {
    if (document.querySelector('link[data-mg-global-theme]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("mg-global-theme.css?v=20261009-palette4", document.baseURI).href;
    link.dataset.mgGlobalTheme = "true";
    document.head?.appendChild(link);
  };
  const apply = (theme, persist = false) => {
    if (!validThemes.has(theme)) return false;
    document.documentElement.dataset.mgTheme = theme;
    if (document.body) document.body.dataset.mgTheme = theme;
    document.querySelectorAll("[data-mg-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mgThemeChoice === theme));
    });
    document.querySelectorAll("[data-mg-theme-option]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mgThemeOption === theme));
    });
    const status = document.getElementById("themeSelectionStatus");
    if (status) status.textContent = labels.get(theme) || "کلاسیک";
    if (persist) saveTheme(theme);
    return true;
  };
  const currentTheme = () => {
    const cookieTheme = readCookie();
    if (validThemes.has(cookieTheme)) return cookieTheme;
    try {
      const localTheme = localStorage.getItem(storageKey);
      if (validThemes.has(localTheme)) return localTheme;
    } catch {}
    return "modern-light";
  };

  ensureStylesheet();
  const initialTheme = currentTheme();
  document.documentElement.dataset.mgTheme = initialTheme;
  if (document.body) document.body.dataset.mgTheme = initialTheme;
  else document.addEventListener("DOMContentLoaded", () => apply(initialTheme), { once: true });

  const makeSwatch = (theme) => {
    const swatch = document.createElement("span");
    swatch.className = "mg-theme-picker__swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    return swatch;
  };
  const bindExistingChoices = () => {
    document.querySelectorAll("[data-mg-theme-choice]").forEach((button) => {
      if (button.dataset.mgThemeBound) return;
      button.dataset.mgThemeBound = "true";
      button.addEventListener("click", () => apply(button.dataset.mgThemeChoice, true));
    });
    apply(currentTheme());
  };
  const addPicker = () => {
    if (!document.body || document.querySelector(".mg-theme-picker")) return;
    if (document.querySelector("[data-mg-theme-choice]")) {
      bindExistingChoices();
      return;
    }

    const root = document.createElement("div");
    root.className = "mg-theme-picker";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "mg-theme-picker__trigger";
    trigger.setAttribute("aria-label", "انتخاب تم و پالت رنگ");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.2a2.2 2.2 0 0 0 1.6-3.7 1.5 1.5 0 0 1 1.1-2.5H18a3 3 0 0 0 3-3C21 7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/><circle cx="17" cy="11" r="1"/></svg><span>تم</span>';
    const panel = document.createElement("section");
    panel.className = "mg-theme-picker__panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "انتخاب تم و پالت رنگ");
    const title = document.createElement("h2");
    title.className = "mg-theme-picker__title";
    title.textContent = "تم و پالت رنگ";
    const group = document.createElement("div");
    group.className = "mg-theme-picker__options";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "پالت‌ها");
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mg-theme-picker__option";
      button.dataset.mgThemeOption = choice.id;
      button.dataset.theme = choice.id;
      button.setAttribute("aria-pressed", "false");
      button.append(makeSwatch(choice.id));
      const label = document.createElement("span");
      label.className = "mg-theme-picker__label";
      label.textContent = choice.label;
      button.append(label);
      button.addEventListener("click", () => {
        apply(choice.id, true);
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus();
      });
      group.append(button);
    }
    panel.append(title, group);
    trigger.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      trigger.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) panel.querySelector("button")?.focus();
    });
    root.append(trigger, panel);
    document.body.append(root);
    apply(currentTheme());

    document.addEventListener("pointerdown", (event) => {
      if (!root.contains(event.target)) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || panel.hidden) return;
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    });
  };

  window.MGTheme = { apply, choices: choices.map((choice) => ({ ...choice })) };
  window.addEventListener("mg:theme-change", (event) => {
    const theme = event.detail?.theme;
    if (validThemes.has(theme)) apply(theme, true);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey && validThemes.has(event.newValue)) {
      apply(event.newValue);
      writeCookie(event.newValue);
    }
  });
  const init = () => {
    const cookieTheme = readCookie();
    if (!validThemes.has(cookieTheme)) saveTheme(initialTheme);
    apply(initialTheme);
    addPicker();
    bindExistingChoices();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
