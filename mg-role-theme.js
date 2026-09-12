(() => {
  const b = document.body;
  if (!b) return;
  const v = document.createElement("video");
  v.className = "role-bg";
  v.autoplay = true;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("aria-hidden", "true");
  v.innerHTML =
    '<source src="assets/video/dashboard-bg-progressive.mp4" type="video/mp4">';
  const o = document.createElement("div");
  o.className = "role-bg-overlay";
  o.setAttribute("aria-hidden", "true");
  b.prepend(o);
  b.prepend(v);
  const move = (e) => {
    const x = Math.max(0, Math.min(1, e.clientX / innerWidth)),
      y = Math.max(0, Math.min(1, e.clientY / innerHeight));
    o.style.setProperty("--role-px", `${x * 100}%`);
    o.style.setProperty("--role-py", `${y * 100}%`);
    v.style.setProperty("--role-bg-x", `${(x - 0.5) * -10}px`);
    v.style.setProperty("--role-bg-y", `${(y - 0.5) * -7}px`);
  };
  document.addEventListener("pointermove", move, { passive: true });
  v.play().catch(() => {});
})();
