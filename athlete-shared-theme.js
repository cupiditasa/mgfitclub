(() => {
  const b = document.body;
  if (!b) return;
  const v = document.createElement("video");
  v.className = "athlete-bg";
  v.autoplay = true;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("aria-hidden", "true");
  v.innerHTML =
    '<source src="assets/video/dashboard-bg-progressive.mp4" type="video/mp4">';
  const o = document.createElement("div");
  o.className = "athlete-bg-overlay";
  o.setAttribute("aria-hidden", "true");
  b.prepend(o);
  b.prepend(v);
  let raf = 0;
  const move = (e) => {
    const x = Math.max(0, Math.min(1, e.clientX / innerWidth)),
      y = Math.max(0, Math.min(1, e.clientY / innerHeight));
    o.style.setProperty("--ath-px", `${x * 100}%`);
    o.style.setProperty("--ath-py", `${y * 100}%`);
    v.style.setProperty("--ath-bg-x", `${(x - 0.5) * -10}px`);
    v.style.setProperty("--ath-bg-y", `${(y - 0.5) * -7}px`);
  };
  document.addEventListener("pointermove", move, { passive: true });
  v.play().catch(() => {});
})();
