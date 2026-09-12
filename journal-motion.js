(function () {
  "use strict";

  const page = document.querySelector(".mg-experience");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0, inside: false, speed: 0 };

  function setPointer(clientX, clientY) {
    const rect = page.getBoundingClientRect();
    pointer.x = clientX;
    pointer.y = clientY;
    page.style.setProperty("--page-pointer-x", `${clientX - rect.left}px`);
    page.style.setProperty("--page-pointer-y", `${clientY - rect.top}px`);
  }

  page.addEventListener("pointermove", (event) => {
    setPointer(event.clientX, event.clientY);
    pointer.inside = true;
    pointer.speed = Math.min(1, pointer.speed + 0.08);
  }, { passive: true });
  page.addEventListener("pointerleave", () => { pointer.inside = false; }, { passive: true });

  // 01 — the hero orbit gets a real frame loop and responds to pointer velocity.
  const orbit = document.querySelector(".exp-hero-orbit");
  const orbitCanvas = document.querySelector(".orbit-canvas");
  if (orbit && orbitCanvas && !reduceMotion) {
    const ctx = orbitCanvas.getContext("2d");
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let size = 0;
    let angle = 0;
    let last = performance.now();

    function resizeOrbit() {
      size = Math.max(120, orbit.clientWidth);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      orbitCanvas.width = size * dpr;
      orbitCanvas.height = size * dpr;
      orbitCanvas.style.width = `${size}px`;
      orbitCanvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawOrbit(now) {
      const dt = Math.min(40, now - last);
      last = now;
      pointer.speed *= 0.965;
      angle += (0.0008 + pointer.speed * 0.0035) * dt;
      ctx.clearRect(0, 0, size, size);
      const center = size / 2;
      const rings = [0.43, 0.62, 0.79];
      rings.forEach((ratio, index) => {
        const radius = size * ratio / 2;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(198,255,63,${0.1 + index * 0.035})`;
        ctx.lineWidth = index === 1 ? 1.15 : 0.7;
        ctx.stroke();
        const orbitAngle = angle * (index % 2 ? -1 : 1) * (1 + index * 0.16) + index * 1.7;
        const x = center + Math.cos(orbitAngle) * radius;
        const y = center + Math.sin(orbitAngle) * radius;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
        glow.addColorStop(0, "rgba(198,255,63,.9)");
        glow.addColorStop(1, "rgba(198,255,63,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#c6ff3f";
        ctx.beginPath(); ctx.arc(x, y, index === 1 ? 3 : 2, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(drawOrbit);
    }

    new ResizeObserver(resizeOrbit).observe(orbit);
    resizeOrbit();
    requestAnimationFrame(drawOrbit);
    orbit.addEventListener("pointermove", () => {
      pointer.speed = Math.min(1, pointer.speed + 0.3);
      orbit.style.setProperty("--orbit-tilt", `${(Math.random() - 0.5) * 2}deg`);
    }, { passive: true });
  }

  // 02 — services receive a moving signal line and a focused item state.
  const serviceSection = document.querySelector(".exp-services");
  const serviceSignal = document.querySelector(".service-signal");
  const serviceItems = [...document.querySelectorAll(".exp-lines article")];
  if (serviceSection && serviceSignal) {
    serviceItems.forEach((item, index) => {
      item.dataset.index = index;
      item.addEventListener("pointerenter", () => {
        serviceSection.style.setProperty("--service-progress", `${index / Math.max(1, serviceItems.length - 1)}`);
        serviceItems.forEach((other) => other.classList.toggle("is-focused", other === item));
      }, { passive: true });
    });
    serviceSection.addEventListener("pointermove", (event) => {
      const rect = serviceSection.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      serviceSection.style.setProperty("--service-progress", progress.toFixed(3));
      serviceSignal.style.setProperty("--signal-x", `${event.clientX - rect.left}px`);
    }, { passive: true });
  }

  // 03 — horizontal story rail gets drag, tilt and a progress trace.
  const track = document.querySelector(".story-track");
  const progress = document.querySelector(".story-progress span");
  const cards = [...document.querySelectorAll(".story-card")];
  if (track) {
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    track.addEventListener("pointerdown", (event) => {
      dragging = true; startX = event.clientX; startScroll = track.scrollLeft;
      track.setPointerCapture?.(event.pointerId); track.classList.add("is-dragging");
    });
    track.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      track.scrollLeft = startScroll - (event.clientX - startX) * 1.25;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => track.addEventListener(name, () => {
      dragging = false; track.classList.remove("is-dragging");
    }));
    track.addEventListener("scroll", () => {
      const max = Math.max(1, track.scrollWidth - track.clientWidth);
      progress?.style.setProperty("--story-progress", `${track.scrollLeft / max}`);
    }, { passive: true });
    cards.forEach((card) => card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--card-rotate-x", `${(-y * 4).toFixed(2)}deg`);
      card.style.setProperty("--card-rotate-y", `${(x * 5).toFixed(2)}deg`);
    }, { passive: true }));
    cards.forEach((card) => card.addEventListener("pointerleave", () => {
      card.style.setProperty("--card-rotate-x", "0deg");
      card.style.setProperty("--card-rotate-y", "0deg");
    }, { passive: true }));
  }

  // 04 — modal receives a subtle cinematic light field.
  const modal = document.querySelector(".story-modal");
  if (modal) {
    modal.addEventListener("pointermove", (event) => {
      modal.style.setProperty("--modal-x", `${event.clientX}px`);
      modal.style.setProperty("--modal-y", `${event.clientY}px`);
    }, { passive: true });
  }

  // 05 — final CTA becomes a responsive neon grid with click/touch bursts.
  const finalSection = document.querySelector(".exp-final");
  const ctaCanvas = document.querySelector(".cta-canvas");
  if (finalSection && ctaCanvas && !reduceMotion) {
    const ctx = ctaCanvas.getContext("2d");
    const particles = [];
    let width = 0; let height = 0; let dpr = 1;
    let pointerX = 0; let pointerY = 0; let active = false;

    function resizeCta() {
      const rect = finalSection.getBoundingClientRect();
      width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctaCanvas.width = width * dpr; ctaCanvas.height = height * dpr;
      ctaCanvas.style.width = `${width}px`; ctaCanvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function burst(x, y, amount = 14) {
      for (let i = 0; i < amount; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = 0.5 + Math.random() * 2.4;
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, size: 1 + Math.random() * 2.5 });
      }
    }
    function drawCta(now) {
      ctx.clearRect(0, 0, width, height);
      const horizon = height * 0.3;
      ctx.strokeStyle = "rgba(8,10,8,.2)"; ctx.lineWidth = 1;
      for (let y = horizon; y < height + 80; y += 42) {
        const depth = (y - horizon) / Math.max(1, height - horizon);
        const yy = horizon + Math.pow(depth, 1.4) * (height - horizon + 90);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(width, yy); ctx.stroke();
      }
      const vanishingX = width * 0.5 + (pointerX - width * 0.5) * 0.08;
      for (let x = -width; x < width * 2; x += 70) {
        ctx.beginPath(); ctx.moveTo(vanishingX, horizon); ctx.lineTo(x, height); ctx.stroke();
      }
      if (active) {
        const glow = ctx.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, 150);
        glow.addColorStop(0, "rgba(255,255,255,.35)"); glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow; ctx.fillRect(pointerX - 150, pointerY - 150, 300, 300);
      }
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.012; p.life -= 0.018;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(8,10,8,${Math.max(0, p.life)})`;
        ctx.shadowColor = "rgba(8,10,8,.5)"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      requestAnimationFrame(drawCta);
    }
    finalSection.addEventListener("pointerenter", () => { active = true; });
    finalSection.addEventListener("pointerleave", () => { active = false; });
    finalSection.addEventListener("pointermove", (event) => {
      const rect = finalSection.getBoundingClientRect(); pointerX = event.clientX - rect.left; pointerY = event.clientY - rect.top;
      finalSection.style.setProperty("--cta-x", `${pointerX}px`); finalSection.style.setProperty("--cta-y", `${pointerY}px`);
    }, { passive: true });
    finalSection.addEventListener("pointerdown", (event) => {
      const rect = finalSection.getBoundingClientRect(); burst(event.clientX - rect.left, event.clientY - rect.top, 20);
    });
    new ResizeObserver(resizeCta).observe(finalSection);
    resizeCta(); burst(width * 0.5, height * 0.28, 28); requestAnimationFrame(drawCta);
  }
})();

// Shared preview notice used by the journal entry page as well as login/PWA.
(() => {
  const cssHref = "preview-notice.css?v=20260912";
  const scriptSrc = "preview-notice.js?v=20260912";
  if (!document.querySelector(`link[href^="preview-notice.css"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }
  if (!document.querySelector(`script[src^="preview-notice.js"]`)) {
    const script = document.createElement("script");
    script.src = scriptSrc;
    document.body.appendChild(script);
  }
})();
