(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const toFa = value => String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const focusHistory = [];
  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  const rememberFocus = () => focusHistory.push(document.activeElement);
  const restoreFocus = () => {
    const target = focusHistory.pop();
    if (target && document.contains(target)) target.focus();
  };
  const focusFirst = container => {
    const target = $(focusableSelector, container);
    if (target) setTimeout(() => target.focus(), 0);
  };
  const syncBodyLock = () => {
    const overlayOpen =
      $(".menu")?.classList.contains("is-open") ||
      $(".gallery-modal")?.classList.contains("is-open") ||
      $(".lightbox")?.classList.contains("is-open");
    document.body.classList.toggle("is-locked", overlayOpen);
  };

  const preloader = $(".preloader");
  window.addEventListener("load", () => {
    setTimeout(() => preloader.classList.add("is-hidden"), 420);
  });
  setTimeout(() => preloader.classList.add("is-hidden"), 2200);

  const header = $(".header");
  const menuButton = $(".menu-button");
  const menu = $(".menu");

  const closeMenu = (shouldRestoreFocus = true) => {
    const wasOpen = menu.classList.contains("is-open");
    menu.classList.remove("is-open");
    menuButton.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    syncBodyLock();
    if (wasOpen) {
      if (shouldRestoreFocus) restoreFocus();
      else focusHistory.pop();
    }
  };

  menuButton.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    if (open) rememberFocus();
    menu.classList.toggle("is-open", open);
    menuButton.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    syncBodyLock();
    if (open) focusFirst(menu);
    else restoreFocus();
  });

  $$("a", menu).forEach(link => link.addEventListener("click", () => closeMenu(false)));

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .13, rootMargin: "0px 0px -7% 0px" });

  $$("[data-reveal]").forEach(element => revealObserver.observe(element));

  const hero = $(".hero");
  const heroVideo = $(".hero__video");
  const heroCopy = $(".hero__copy");
  const heroStage = $(".hero__stage");
  const heroVideoLight = $(".hero__video-light");
  const heroVideoHint = $(".hero__video-hint");
  const journey = $(".journey");
  const journeyScenes = $$(".journey__scene");
  const journeyCurrent = $(".journey__count b");
  const journeyProgress = $(".journey__line i");
  const scrollMeter = $(".scroll-meter i");

  const sectionProgress = section => {
    const rect = section.getBoundingClientRect();
    return clamp(-rect.top / Math.max(section.offsetHeight - innerHeight, 1));
  };

  let rafPending = false;

  const renderScroll = () => {
    const scrollTop = window.scrollY;
    const pageHeight = document.documentElement.scrollHeight - innerHeight;
    scrollMeter.style.height = `${clamp(scrollTop / Math.max(pageHeight, 1)) * 100}%`;
    header.classList.toggle("is-scrolled", scrollTop > 40);

    const heroP = sectionProgress(hero);
    if (!reducedMotion) {
      heroVideo.style.setProperty("--video-scale", String(1.02 + heroP * .18));
      heroVideo.style.setProperty("--video-scroll-y", `${heroP * -3}%`);
      heroVideo.style.filter = `saturate(${.82 - heroP * .18}) contrast(1.08) brightness(${.9 - heroP * .12})`;
      heroCopy.style.transform = innerWidth <= 680
        ? `translate3d(0, ${heroP * -45}px, 0)`
        : `translate3d(0, calc(-48% - ${heroP * 70}px), 0)`;
      heroCopy.style.opacity = String(1 - heroP * 1.15);
    }

    const journeyP = sectionProgress(journey);
    const sceneFloat = journeyP * (journeyScenes.length - 1);
    const activeIndex = Math.min(journeyScenes.length - 1, Math.round(sceneFloat));

    journeyScenes.forEach((scene, index) => {
      const delta = index - sceneFloat;
      const distance = Math.abs(delta);
      const opacity = clamp(1 - distance * 1.35);
      const visual = $(".journey__visual", scene);
      const copy = $(".journey__copy", scene);

      scene.classList.toggle("is-active", index === activeIndex);
      scene.style.opacity = opacity;

      if (!reducedMotion) {
        scene.style.transform = `translate3d(0, ${delta * 68}vh, ${-distance * 520}px) rotateX(${delta * -5}deg)`;
        visual.style.transform = `scale(${1 - Math.min(distance * .08, .14)})`;
        copy.style.transform = `translateY(${delta * 60}px)`;
      }
    });

    journeyCurrent.textContent = toFa(String(activeIndex + 1).padStart(2, "0"));
    journeyProgress.style.width = `${journeyP * 100}%`;
    rafPending = false;
  };

  window.addEventListener("scroll", () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(renderScroll);
  }, { passive: true });

  window.addEventListener("resize", renderScroll);
  renderScroll();

  if (reducedMotion) {
    heroVideo.pause();
  } else if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let scrubTarget = 0;
    let scrubCurrent = 0;
    let scrubRaf = 0;
    let scrubbing = false;
    let lastVideoSeek = 0;

    const startVideoScrub = () => {
      if (scrubbing) return;
      scrubbing = true;
      heroVideo.pause();
      if (heroVideo.duration) {
        scrubCurrent = heroVideo.currentTime / heroVideo.duration;
        scrubTarget = scrubCurrent;
      }
      heroStage.classList.add("is-scrubbing");
      if (!scrubRaf) scrubRaf = requestAnimationFrame(renderVideoScrub);
    };

    const renderVideoScrub = () => {
      if (!scrubbing) {
        scrubRaf = 0;
        return;
      }

      if (heroVideo.duration) {
        scrubCurrent += (scrubTarget - scrubCurrent) * .16;
        const targetTime = Math.min(heroVideo.duration - .04, Math.max(.04, scrubCurrent * heroVideo.duration));
        const now = performance.now();
        if (!heroVideo.seeking && now - lastVideoSeek > 80 && Math.abs(heroVideo.currentTime - targetTime) > .04) {
          heroVideo.currentTime = targetTime;
          lastVideoSeek = now;
        }
        heroVideoHint.style.setProperty("--video-progress", scrubCurrent.toFixed(4));
      }
      scrubRaf = requestAnimationFrame(renderVideoScrub);
    };

    heroStage.addEventListener("pointerenter", startVideoScrub);

    heroStage.addEventListener("pointermove", event => {
      startVideoScrub();
      const rect = heroStage.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width);
      const y = clamp((event.clientY - rect.top) / rect.height);
      scrubTarget = x;
      heroStage.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
      heroStage.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
      heroVideoLight.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
      heroVideoLight.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
      heroVideo.style.setProperty("--video-x", `${(x - .5) * -5}px`);
      heroVideo.style.setProperty("--video-y", `${(y - .5) * -3}px`);
    });

    heroStage.addEventListener("pointerleave", () => {
      scrubbing = false;
      heroStage.classList.remove("is-scrubbing");
      heroVideo.style.setProperty("--video-x", "0px");
      heroVideo.style.setProperty("--video-y", "0px");
      heroVideo.play().catch(() => {});
    });
  }

  const lightbox = $(".lightbox");
  const lightboxImage = $(".lightbox img");
  const lightboxCaption = $(".lightbox figcaption");
  let lightboxItems = [];
  let lightboxIndex = 0;

  const showLightboxItem = () => {
    const item = lightboxItems[lightboxIndex];
    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt || "تصویر باشگاه MG";
    lightboxCaption.textContent = `${toFa(lightboxIndex + 1)} / ${toFa(lightboxItems.length)}`;
  };

  const openLightbox = (items, index) => {
    rememberFocus();
    lightboxItems = items;
    lightboxIndex = index;
    showLightboxItem();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    syncBodyLock();
    focusFirst(lightbox);
  };

  const closeLightbox = () => {
    const wasOpen = lightbox.classList.contains("is-open");
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    syncBodyLock();
    if (wasOpen) restoreFocus();
  };

  const moveLightbox = direction => {
    lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    lightboxImage.animate(
      [
        { opacity: 0, transform: `translateX(${direction * 22}px)` },
        { opacity: 1, transform: "translateX(0)" }
      ],
      { duration: 280, easing: "cubic-bezier(.16,1,.3,1)" }
    );
    showLightboxItem();
  };

  const selectedGalleryButtons = $$(".gallery__item");
  const selectedGalleryItems = selectedGalleryButtons.map(button => ({
    src: button.dataset.src,
    alt: $("img", button).alt
  }));

  selectedGalleryButtons.forEach((button, index) => {
    button.addEventListener("click", () => openLightbox(selectedGalleryItems, index));
  });

  $(".lightbox__close").addEventListener("click", closeLightbox);
  $(".lightbox__nav--prev").addEventListener("click", () => moveLightbox(-1));
  $(".lightbox__nav--next").addEventListener("click", () => moveLightbox(1));
  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) closeLightbox();
  });

  const galleryData = [
    ...Array.from({ length: 25 }, (_, index) => ({
      category: "gym",
      src: `assets/images/gym-${String(index + 1).padStart(2, "0")}.jpg`,
      alt: `فضای باشگاه MG، تصویر ${index + 1}`
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      category: "training",
      src: `assets/images/training-${String(index + 1).padStart(2, "0")}.jpg`,
      alt: `تمرین تخصصی بانوان، تصویر ${index + 1}`
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      category: "buffet",
      src: `assets/images/buffet-${String(index + 1).padStart(2, "0")}.jpg`,
      alt: `بوفه سلامت MG، تصویر ${index + 1}`
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      category: "manager",
      src: `assets/images/manager-${String(index + 1).padStart(2, "0")}.jpg`,
      alt: `مدیریت باشگاه MG، تصویر ${index + 1}`
    }))
  ];

  const galleryModal = $(".gallery-modal");
  const galleryModalGrid = $(".gallery-modal__grid");

  const renderGallery = (filter = "all") => {
    const items = galleryData.filter(item => filter === "all" || item.category === filter);
    galleryModalGrid.innerHTML = "";

    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<img src="${item.src}" alt="${item.alt}" loading="lazy" decoding="async">`;
      button.addEventListener("click", () => openLightbox(items, index));
      galleryModalGrid.appendChild(button);
    });
  };

  const openGallery = () => {
    rememberFocus();
    renderGallery();
    galleryModal.classList.add("is-open");
    galleryModal.setAttribute("aria-hidden", "false");
    syncBodyLock();
    focusFirst(galleryModal);
  };

  const closeGallery = () => {
    const wasOpen = galleryModal.classList.contains("is-open");
    galleryModal.classList.remove("is-open");
    galleryModal.setAttribute("aria-hidden", "true");
    syncBodyLock();
    if (wasOpen) restoreFocus();
  };

  $("[data-open-gallery]").addEventListener("click", openGallery);
  $("[data-close-gallery]").addEventListener("click", closeGallery);

  $$(".gallery-modal__filters button").forEach(button => {
    button.addEventListener("click", () => {
      $$(".gallery-modal__filters button").forEach(item => item.classList.remove("is-active"));
      button.classList.add("is-active");
      renderGallery(button.dataset.filter);
    });
  });

  const motionVideo = $(".motion-story__video");
  const motionStory = $(".motion-story");
  const motionMedia = $(".motion-story__media");
  const motionLight = $(".motion-story__light");
  const motionScrub = $(".motion-story__scrub");
  const motionControl = $("[data-video-control]");

  if (motionVideo && motionControl) {
    const controlLabel = $("span", motionControl);
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    let motionInView = false;
    let motionManualPause = false;
    let motionScrubbing = false;
    let motionTarget = 0;
    let motionCurrent = 0;
    let motionRaf = 0;
    let motionLastSeek = 0;

    const updateVideoControl = () => {
      const paused = motionVideo.paused;
      motionControl.setAttribute("aria-pressed", String(paused));
      controlLabel.textContent = paused ? "پخش ویدئو" : "توقف ویدئو";
    };

    const renderMotionScrub = () => {
      if (!motionScrubbing) {
        motionRaf = 0;
        return;
      }

      if (motionVideo.duration) {
        motionCurrent += (motionTarget - motionCurrent) * .15;
        const targetTime = Math.min(motionVideo.duration - .04, Math.max(.04, motionCurrent * motionVideo.duration));
        const now = performance.now();
        if (!motionVideo.seeking && now - motionLastSeek > 80 && Math.abs(motionVideo.currentTime - targetTime) > .04) {
          motionVideo.currentTime = targetTime;
          motionLastSeek = now;
        }
        motionScrub.style.setProperty("--motion-progress", motionCurrent.toFixed(4));
      }

      motionRaf = requestAnimationFrame(renderMotionScrub);
    };

    const startMotionScrub = () => {
      if (!finePointer || reducedMotion || motionScrubbing) return;
      motionScrubbing = true;
      motionVideo.pause();
      if (motionVideo.duration) {
        motionCurrent = motionVideo.currentTime / motionVideo.duration;
        motionTarget = motionCurrent;
      }
      motionStory.classList.add("is-scrubbing");
      if (!motionRaf) motionRaf = requestAnimationFrame(renderMotionScrub);
    };

    const motionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        motionInView = entry.isIntersecting;
        if (reducedMotion || !motionInView || motionManualPause || motionScrubbing) {
          motionVideo.pause();
        } else {
          motionVideo.play().catch(() => {});
        }
        updateVideoControl();
      });
    }, { threshold: .3 });

    motionObserver.observe(motionVideo);

    const pointerInsideMotionMedia = event => {
      const rect = motionMedia.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };

    motionStory.addEventListener("pointermove", event => {
      if (!finePointer || reducedMotion) return;
      if (!pointerInsideMotionMedia(event)) {
        if (motionScrubbing) {
          motionScrubbing = false;
          motionStory.classList.remove("is-scrubbing");
          motionVideo.style.setProperty("--motion-x", "0px");
          motionVideo.style.setProperty("--motion-y", "0px");
          if (motionInView && !motionManualPause) motionVideo.play().catch(() => {});
        }
        return;
      }

      startMotionScrub();
      const rect = motionMedia.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width);
      const y = clamp((event.clientY - rect.top) / rect.height);
      motionTarget = x;
      motionLight.style.setProperty("--motion-pointer-x", `${event.clientX - rect.left}px`);
      motionLight.style.setProperty("--motion-pointer-y", `${event.clientY - rect.top}px`);
      motionVideo.style.setProperty("--motion-x", `${(x - .5) * -5}px`);
      motionVideo.style.setProperty("--motion-y", `${(y - .5) * -4}px`);
    });
    motionStory.addEventListener("pointerleave", () => {
      if (!finePointer) return;
      motionScrubbing = false;
      motionStory.classList.remove("is-scrubbing");
      motionVideo.style.setProperty("--motion-x", "0px");
      motionVideo.style.setProperty("--motion-y", "0px");
      if (motionInView && !motionManualPause) motionVideo.play().catch(() => {});
    });

    motionControl.addEventListener("click", () => {
      motionManualPause = !motionVideo.paused;
      if (motionManualPause) motionVideo.pause();
      else motionVideo.play().catch(() => {});
      updateVideoControl();
    });
    motionVideo.addEventListener("play", updateVideoControl);
    motionVideo.addEventListener("pause", updateVideoControl);
    updateVideoControl();
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (lightbox.classList.contains("is-open")) closeLightbox();
      else if (galleryModal.classList.contains("is-open")) closeGallery();
      else closeMenu();
    }

    if (lightbox.classList.contains("is-open")) {
      if (event.key === "ArrowLeft") moveLightbox(1);
      if (event.key === "ArrowRight") moveLightbox(-1);
    }

    if (event.key === "Tab") {
      const activeOverlay = lightbox.classList.contains("is-open")
        ? lightbox
        : galleryModal.classList.contains("is-open")
          ? galleryModal
          : menu.classList.contains("is-open")
            ? menu
            : null;

      if (!activeOverlay) return;
      const focusable = $$(focusableSelector, activeOverlay)
        .filter(element => element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!activeOverlay.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const form = $(".form");
  const formStatus = $(".form__status");
  const mobileCta = $(".mobile-cta");
  const registerSection = $(".register");
  const clubWhatsappNumber = "989178483446";

  const registerObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      mobileCta.classList.toggle("is-hidden", entry.isIntersecting);
    });
  }, { threshold: .12 });

  registerObserver.observe(registerSection);

  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").replace(/\s/g, "");
    const goal = data.get("goal");

    if (name.length < 3 || phone.length < 10 || !goal) {
      formStatus.textContent = "لطفاً نام، شماره تماس و هدف تمرینی خود را کامل وارد کنید.";
      return;
    }

    const message = [
      "سلام، برای رزرو بازدید از MG FitClub پیام می‌دهم.",
      "",
      `نام: ${name}`,
      `شماره تماس: ${phone}`,
      `هدف تمرینی: ${goal}`
    ].join("\n");
    const whatsappUrl = `https://wa.me/${clubWhatsappNumber}?text=${encodeURIComponent(message)}`;

    formStatus.textContent = `${name} عزیز، واتساپ باز می‌شود تا درخواستت را برای باشگاه ارسال کنی.`;
    window.location.href = whatsappUrl;
  });
})();
