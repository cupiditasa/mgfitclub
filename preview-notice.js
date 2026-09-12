(() => {
  "use strict";

  const init = () => {
    if (document.querySelector(".mg-preview-notice")) return;

    const backdrop = document.createElement("div");
    backdrop.className = "mg-preview-notice";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = `
      <section class="mg-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="mg-preview-title" aria-describedby="mg-preview-copy">
        <button class="mg-preview-close" type="button" aria-label="بستن پیام">×</button>
        <div class="mg-preview-mark" aria-hidden="true">MG</div>
        <p class="mg-preview-kicker">MG FITCLUB / PREVIEW</p>
        <h2 class="mg-preview-title" id="mg-preview-title">شما در حال مشاهده نسخهٔ پیش‌نمایش هستید</h2>
        <p class="mg-preview-copy" id="mg-preview-copy">بعضی از آیتم‌ها نیاز به ارتقای کدنویسی دارند.</p>
        <p class="mg-preview-signature">با تشکر، پشتیبانی MG</p>
        <div class="mg-preview-actions">
          <button class="mg-preview-confirm" type="button">متوجه شدم</button>
        </div>
      </section>`;

    document.body.appendChild(backdrop);
    const closeButton = backdrop.querySelector(".mg-preview-close");
    const confirmButton = backdrop.querySelector(".mg-preview-confirm");
    const previousFocus = document.activeElement;
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      backdrop.classList.remove("is-visible");
      backdrop.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("mg-preview-lock");
      window.removeEventListener("keydown", onKeydown);
      window.setTimeout(() => backdrop.remove(), 320);
      if (typeof window.__MG_PREVIEW_NOTICE_ON_CLOSE === "function") {
        window.__MG_PREVIEW_NOTICE_ON_CLOSE();
      }
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") close();
    };

    closeButton.addEventListener("click", close);
    confirmButton.addEventListener("click", close);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    window.addEventListener("keydown", onKeydown);
    document.documentElement.classList.add("mg-preview-lock");
    window.requestAnimationFrame(() => {
      backdrop.classList.add("is-visible");
      backdrop.setAttribute("aria-hidden", "false");
      confirmButton.focus({ preventScroll: true });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
