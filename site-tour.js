(() => {
  "use strict";

  const seenKey = "mgfitclub_site_tour_seen_v1";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const steps = [
    {
      selector: ".hero__actions",
      title: "از همین‌جا شروع کن",
      copy: "برای آشنایی با باشگاه یا رزرو بازدید، از دکمه‌های این بخش استفاده کن.",
    },
    {
      selector: ".mg-digital__intro",
      title: "مسیرهای دیجیتال MG",
      copy: "عضویت، مربی‌ها، برنامه‌ها و محتوای آموزشی را یک‌جا پیدا می‌کنی.",
    },
    {
      selector: '.mg-digital__item[href="membership.html"]',
      title: "پکیج‌های عضویت",
      copy: "خدمات و پکیج‌ها را ببین و راه مناسب شروع عضویت را انتخاب کن.",
    },
    {
      selector: '.mg-digital__item[href="account.html"]',
      title: "حساب و برنامهٔ شخصی",
      copy: "از اینجا وارد حساب می‌شوی و درخواست برنامهٔ تمرینی یا غذایی و گفت‌وگو با مربی را پیگیری می‌کنی.",
    },
    {
      selector: '.mg-digital__item[href="education-studio.html"]',
      title: "استودیوی آموزش حرکت",
      copy: "حرکت‌ها را در کتابخانه ببین؛ می‌توانی برنامهٔ تمرینی‌ات را هم در استودیو بسازی.",
    },
    {
      selector: '.mg-digital__item[href="news.html"]',
      title: "خبرهای ورزشی",
      copy: "خبرها و مطالب ورزشی را بخوان و برای هر خبر، منبع را هم ببین.",
    },
    {
      selector: '.mg-digital__item[href="app.html"]',
      title: "اپلیکیشن MG",
      copy: "راهنمای نصب وب‌اپ و نسخهٔ اندروید از این بخش در دسترس است. هر وقت خواستی این راهنما را از منوی سایت دوباره باز کن.",
    },
  ];

  let seen = false;
  try { seen = localStorage.getItem(seenKey) === "1"; } catch {}
  const starts = [...document.querySelectorAll("[data-site-tour-start]")];
  if (!starts.length) return;

  const tour = document.createElement("div");
  tour.className = "site-tour";
  tour.hidden = true;
  tour.innerHTML = `
    <div class="site-tour__backdrop" data-tour-dismiss></div>
    <div class="site-tour__spotlight" aria-hidden="true"></div>
    <section class="site-tour__panel" role="dialog" aria-modal="true" aria-labelledby="siteTourTitle" aria-describedby="siteTourCopy" tabindex="-1" data-placement="bottom">
      <div class="site-tour__heading">
        <svg class="site-tour__mascot" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 5c-4 0-7 3-7 7v3c-10 3-17 12-17 24 0 12 10 20 24 20s24-8 24-20c0-12-7-21-17-24v-3c0-4-3-7-7-7Z" fill="var(--mg-accent,#c6ff3f)" stroke="var(--mg-selected-border,#91bd2d)" stroke-width="2"/>
          <path d="M20 32c2-3 6-3 8 0m8 0c2-3 6-3 8 0" fill="none" stroke="var(--mg-on-selected,#17200f)" stroke-linecap="round" stroke-width="3"/>
          <path d="M26 42c3 4 9 4 12 0" fill="none" stroke="var(--mg-on-selected,#17200f)" stroke-linecap="round" stroke-width="3"/>
          <path d="m12 18-3-4m43 4 3-4" stroke="var(--mg-accent,#c6ff3f)" stroke-linecap="round" stroke-width="3"/>
        </svg>
        <div><p class="site-tour__eyebrow">راهنمای MG FitClub</p><h2 class="site-tour__title" id="siteTourTitle"></h2></div>
      </div>
      <p class="site-tour__copy" id="siteTourCopy"></p>
      <div class="site-tour__footer">
        <span class="site-tour__progress" aria-live="polite"></span>
        <div class="site-tour__actions">
          <button class="site-tour__button site-tour__button--skip" type="button" data-tour-skip>رد کردن</button>
          <button class="site-tour__button" type="button" data-tour-back>قبلی</button>
          <button class="site-tour__button site-tour__button--primary" type="button" data-tour-next>بعدی</button>
        </div>
      </div>
    </section>`;
  document.body.append(tour);

  const panel = tour.querySelector(".site-tour__panel");
  const spotlight = tour.querySelector(".site-tour__spotlight");
  const title = tour.querySelector("#siteTourTitle");
  const copy = tour.querySelector("#siteTourCopy");
  const progress = tour.querySelector(".site-tour__progress");
  const back = tour.querySelector("[data-tour-back]");
  const next = tour.querySelector("[data-tour-next]");
  let index = 0;
  let activeTarget = null;
  let returnFocus = null;
  let frame = 0;

  const markSeen = () => {
    seen = true;
    try { localStorage.setItem(seenKey, "1"); } catch {}
  };
  const placeSpotlight = () => {
    frame = 0;
    if (!activeTarget || tour.hidden) return;
    const rect = activeTarget.getBoundingClientRect();
    const pad = 7;
    const left = Math.max(5, rect.left - pad);
    const top = Math.max(5, rect.top - pad);
    spotlight.style.left = `${left}px`;
    spotlight.style.top = `${top}px`;
    spotlight.style.width = `${Math.max(20, Math.min(innerWidth - left - 5, rect.width + pad * 2))}px`;
    spotlight.style.height = `${Math.max(20, Math.min(innerHeight - top - 5, rect.height + pad * 2))}px`;
    panel.dataset.placement = rect.top > innerHeight * .55 ? "top" : "bottom";
  };
  const scheduleSpotlight = () => {
    if (!frame) frame = requestAnimationFrame(placeSpotlight);
  };
  const render = async (focusNext = false) => {
    activeTarget?.classList.remove("site-tour-target");
    const step = steps[index];
    activeTarget = document.querySelector(step.selector);
    title.textContent = step.title;
    copy.textContent = step.copy;
    progress.textContent = `${new Intl.NumberFormat("fa-IR").format(index + 1)} از ${new Intl.NumberFormat("fa-IR").format(steps.length)}`;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? "پایان" : "بعدی";
    if (activeTarget) {
      activeTarget.classList.add("site-tour-target");
      activeTarget.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center", inline: "nearest" });
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    scheduleSpotlight();
    if (focusNext) next.focus({ preventScroll: true });
  };
  const close = () => {
    markSeen();
    tour.hidden = true;
    document.body.classList.remove("site-tour-open");
    activeTarget?.classList.remove("site-tour-target");
    activeTarget = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  };
  const open = async (origin) => {
    if (!tour.hidden) return;
    const menuButton = document.querySelector(".menu-button");
    returnFocus = !(origin instanceof HTMLElement)
      ? document.activeElement
      : origin.closest('[aria-hidden="true"]')
        ? menuButton || document.activeElement
        : origin;
    index = 0;
    tour.hidden = false;
    document.body.classList.add("site-tour-open");
    await render();
    tour.querySelector("[data-tour-skip]").focus({ preventScroll: true });
  };

  starts.forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    open(button);
  }));
  tour.querySelector("[data-tour-skip]").addEventListener("click", close);
  tour.querySelector("[data-tour-dismiss]").addEventListener("click", close);
  back.addEventListener("click", async () => {
    if (index === 0) return;
    index -= 1;
    await render(true);
  });
  next.addEventListener("click", async () => {
    if (index >= steps.length - 1) return close();
    index += 1;
    await render(true);
  });
  tour.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...tour.querySelectorAll("button:not(:disabled)")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  window.addEventListener("resize", scheduleSpotlight, { passive: true });
  window.addEventListener("scroll", scheduleSpotlight, { passive: true, capture: true });

  if (!seen) {
    window.addEventListener("load", () => window.setTimeout(() => {
      if (!seen) open(null);
    }, 1700), { once: true });
  }
})();
