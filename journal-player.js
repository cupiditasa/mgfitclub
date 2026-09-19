(() => {
  "use strict";
  const page = document.querySelector(".journal-page");
  if (!page) return;
  const menu = document.getElementById("journal-menu");
  const toggle = document.querySelector(".journal-menu-toggle");
  const modal = document.querySelector(".story-modal");
  const serviceVideo = document.getElementById("service-player");
  const modalVideo = document.querySelector(".modal-video");
  const videos = [...document.querySelectorAll("video")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canPreview = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reducedMotion && !navigator.connection?.saveData;
  const syncScrollLock = () => document.body.classList.toggle("is-locked", Boolean(menu?.open || modal?.open));
  const pauseOthers = except => videos.forEach(video => { if (video !== except) video.pause(); });
  const play = video => { pauseOthers(video); const result = video.play(); result?.catch(() => {}); };
  videos.forEach(video => video.addEventListener("play", () => pauseOthers(video)));

  toggle?.addEventListener("click", () => {
    if (!menu.open) { pauseOthers(); menu.showModal(); }
    toggle.setAttribute("aria-expanded", "true"); syncScrollLock();
  });
  menu?.querySelector("[data-close-menu]")?.addEventListener("click", () => menu.close());
  menu?.addEventListener("close", () => {
    toggle.setAttribute("aria-expanded", "false"); syncScrollLock(); toggle.focus({ preventScroll: true });
  });
  menu?.addEventListener("click", event => {
    if (event.target.closest("a")) menu.close();
    if (event.target !== menu) return;
    const rect = menu.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) menu.close();
  });
  document.querySelector("[data-journal-back]")?.addEventListener("click", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === location.origin && referrer.pathname !== location.pathname && history.length > 1) {
        event.preventDefault(); history.back();
      }
    } catch (_) { /* A direct visit follows the real index.html fallback link. */ }
  });

  const choices = [...document.querySelectorAll(".film-choice")];
  const copies = [...document.querySelectorAll(".film-copy")];
  const counter = document.getElementById("film-counter");
  const filmError = document.getElementById("film-error");
  const direct = document.getElementById("film-direct");
  let currentFilm = 0;
  function selectFilm(index) {
    const choice = choices[index];
    if (!choice || !serviceVideo) return;
    pauseOthers();
    if (index !== currentFilm) {
      serviceVideo.src = choice.dataset.src;
      serviceVideo.poster = choice.dataset.poster;
      serviceVideo.setAttribute("aria-labelledby", "film-title-" + (index + 1));
      serviceVideo.load();
    }
    currentFilm = index;
    choices.forEach((item, i) => {
      item.classList.toggle("is-active", i === index);
      item.setAttribute("aria-pressed", String(i === index));
      item.style.setProperty("--film-progress", "0");
    });
    copies.forEach((copy, i) => { copy.hidden = i !== index; });
    counter.textContent = String(index + 1).padStart(2, "0") + " / " + String(choices.length).padStart(2, "0");
    direct.href = choice.dataset.src;
    filmError.hidden = true;
    play(serviceVideo);
  }
  choices.forEach((choice, index) => choice.addEventListener("click", () => selectFilm(index)));
  serviceVideo?.addEventListener("timeupdate", () => {
    const ratio = Number.isFinite(serviceVideo.duration) && serviceVideo.duration > 0 ? serviceVideo.currentTime / serviceVideo.duration : 0;
    choices[currentFilm]?.style.setProperty("--film-progress", String(Math.min(1, Math.max(0, ratio))));
  });
  serviceVideo?.addEventListener("error", () => { filmError.hidden = false; });
  serviceVideo?.querySelector("source")?.addEventListener("error", () => { filmError.hidden = false; });
  serviceVideo?.addEventListener("loadeddata", () => { filmError.hidden = true; });

  const stories = JSON.parse(document.getElementById("journal-story-data")?.textContent || "[]");
  const cards = [...document.querySelectorAll(".story-card")];
  const track = document.querySelector(".story-track");
  let currentStory = 0, lastStoryTrigger;
  function openStory(index, trigger) {
    if (!stories.length || !modal || !modalVideo) return;
    currentStory = (index + stories.length) % stories.length;
    const story = stories[currentStory];
    if (trigger) lastStoryTrigger = trigger;
    pauseOthers();
    modalVideo.src = story.src; modalVideo.poster = story.poster;
    document.querySelector(".modal-count").textContent = "CHAPTER " + String(currentStory + 1).padStart(2, "0");
    document.getElementById("story-modal-title").textContent = story.name;
    document.querySelector(".modal-role").textContent = story.role;
    document.querySelector(".modal-text").textContent = story.text;
    document.querySelector(".modal-tags").textContent = story.tags;
    document.querySelector(".modal-detail-link").href = story.url;
    document.querySelector(".modal-error").hidden = true;
    modalVideo.setAttribute("aria-label", "ویدیوی " + story.name);
    if (!modal.open) { modal.showModal(); document.querySelector(".modal-close").focus({ preventScroll: true }); }
    syncScrollLock(); play(modalVideo);
  }
  cards.forEach((card, index) => {
    const video = card.querySelector("video");
    card.addEventListener("click", () => {
      if (track?.dataset.suppressClick === "true") { track.dataset.suppressClick = "false"; return; }
      openStory(index, card);
    });
    if (canPreview) {
      card.addEventListener("pointerenter", () => { if (!modal.open && !menu.open && serviceVideo.paused) play(video); });
      card.addEventListener("pointerleave", () => video.pause());
    }
  });
  document.querySelector(".modal-close")?.addEventListener("click", () => modal.close());
  document.querySelector(".modal-prev")?.addEventListener("click", () => openStory(currentStory - 1));
  document.querySelector(".modal-next")?.addEventListener("click", () => openStory(currentStory + 1));
  modal?.addEventListener("close", () => {
    modalVideo.pause(); modalVideo.removeAttribute("src"); modalVideo.load();
    syncScrollLock(); lastStoryTrigger?.focus({ preventScroll: true });
  });
  modal?.addEventListener("click", event => { if (event.target === modal) modal.close(); });
  modalVideo?.addEventListener("error", () => { if (modal.open && modalVideo.getAttribute("src")) document.querySelector(".modal-error").hidden = false; });
  // Keep arrow keys available to the native video controls (seeking/volume).
  modal?.addEventListener("keydown", event => {
    if (event.target === modalVideo) return;
    if (event.key === "ArrowRight") { event.preventDefault(); openStory(currentStory - 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); openStory(currentStory + 1); }
  });
  const scrollStories = direction => track?.scrollBy({ left: direction * ((cards[0]?.getBoundingClientRect().width || 280) + 20), behavior: reducedMotion ? "auto" : "smooth" });
  document.querySelector(".rail-prev")?.addEventListener("click", () => scrollStories(1));
  document.querySelector(".rail-next")?.addEventListener("click", () => scrollStories(-1));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) entry.target.pause(); }), { threshold: 0 });
    videos.filter(video => video !== modalVideo).forEach(video => observer.observe(video));
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseOthers(); });
  window.addEventListener("pagehide", () => pauseOthers());
})();
