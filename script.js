(() => {
  "use strict";
  const config = window.SITE_CONFIG || {};
  const name = typeof config.name === "string" && config.name.trim() ? config.name.trim() : "CanoeChen";
  const description = `${name} 的个人主页。东北大学在读学生，来自重庆，以摄影为主要爱好，也热爱编程、关注 AI。在这里分享摄影作品、开源项目与生活。`;
  document.querySelectorAll("[data-name]").forEach(element => { element.textContent = name; });
  document.title = `${name} · 代码、镜头与日常`;
  document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').forEach(element => { element.content = description; });
  document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]').forEach(element => { element.content = document.title; });
  document.querySelector('meta[property="og:site_name"]').content = `${name} 的自留地`;
  document.getElementById("year").textContent = new Date().getFullYear();

  const email = typeof config.email === "string" ? config.email.trim() : "";
  if (/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) {
    document.getElementById("email-link").href = `mailto:${email}`;
    document.getElementById("email-text").textContent = email;
  }
  try {
    const github = new URL(config.github);
    if (github.protocol === "https:" && github.hostname === "github.com" && !github.username && !github.password && /^\/[A-Za-z0-9-]+\/?$/.test(github.pathname)) {
      document.getElementById("github-link").href = github.href;
      document.getElementById("github-text").textContent = `github.com${github.pathname.replace(/\/$/, "")}`;
    }
  } catch { /* 配置无效时保留静态联系方式。 */ }

  const gallery = document.getElementById("photography");
  const photos = window.PHOTO_GALLERY;
  if (!gallery || !Array.isArray(photos) || photos.length < 2) return;
  const slides = [...gallery.querySelectorAll(".gallery-slide")];
  const previous = document.getElementById("photo-prev");
  const next = document.getElementById("photo-next");
  const toggle = document.getElementById("photo-toggle");
  const open = document.getElementById("photo-open");
  const counter = document.getElementById("photo-counter");
  const title = document.getElementById("photo-title");
  const status = document.getElementById("gallery-status");
  const thumbnails = document.getElementById("photo-thumbnails");
  const lightbox = document.getElementById("photo-lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxStatus = document.getElementById("lightbox-status");
  const lightboxPrevious = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const interval = Number.isFinite(config.slideshowInterval) ? Math.max(3000, config.slideshowInterval) : 3000;
  const sizes = "(max-width: 760px) 60vw, 660px";
  const cache = new Map();
  let index = 0;
  let timer;
  let busy = false;
  let failed = false;
  let userPaused = motionPreference.matches;
  let hovering = false;
  let focused = false;
  let visible = !("IntersectionObserver" in window);
  let returnFocus;
  let focusAfterLoad = false;
  let suppressClickUntil = 0;
  const wrapIndex = value => ((value % photos.length) + photos.length) % photos.length;
  const variant = (photo, width) => photo.src.replace("/web/", "/responsive/").replace(/\.webp$/, `-${width}.webp`);
  const srcset = photo => [800, 1280].filter(width => width < photo.width)
    .map(width => `${variant(photo, width)} ${width}w`).concat(`${photo.src} ${photo.width}w`).join(", ");

  function setImage(image, photo) {
    image.sizes = sizes;
    image.srcset = srcset(photo);
    image.src = variant(photo, 800);
    image.alt = photo.alt;
    image.width = photo.width;
    image.height = photo.height;
  }

  function fillSlide(slide, photoIndex) {
    setImage(slide.querySelector(".gallery-image"), photos[photoIndex]);
    slide.dataset.photoIndex = String(photoIndex);
  }

  function updateSlides() {
    slides.forEach(slide => {
      const position = Number(slide.dataset.position);
      const inView = Math.abs(position) <= 1;
      const photo = photos[Number(slide.dataset.photoIndex)];
      slide.tabIndex = inView ? 0 : -1;
      slide.disabled = !inView || (busy && slide !== document.activeElement);
      slide.setAttribute("aria-disabled", String(busy || !inView));
      slide.setAttribute("aria-label", `${position === 0 ? "放大查看" : position < 0 ? "查看上一张" : "查看下一张"}：${photo.title}`);
      if (inView) slide.removeAttribute("aria-hidden");
      else slide.setAttribute("aria-hidden", "true");
      if (position === 0) { slide.setAttribute("aria-current", "true"); slide.setAttribute("aria-haspopup", "dialog"); }
      else { slide.removeAttribute("aria-current"); slide.removeAttribute("aria-haspopup"); }
      slide.querySelector(".preview-label").textContent = position < 0 ? "上一张" : "下一张";
    });
  }

  function updateLightbox() {
    const photo = photos[index];
    lightboxStatus.textContent = "";
    lightboxImage.src = photo.src;
    lightboxImage.alt = photo.alt;
    document.getElementById("lightbox-title").textContent = photo.title;
    document.getElementById("lightbox-counter").textContent = `${index + 1} / ${photos.length}`;
    document.getElementById("photo-original").href = photo.src;
  }

  function updateSelection() {
    const photo = photos[index];
    title.textContent = photo.title;
    counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    counter.setAttribute("aria-label", `当前第 ${index + 1} 张，共 ${photos.length} 张`);
    [...thumbnails.children].forEach((button, photoIndex) => { button.setAttribute("aria-pressed", String(photoIndex === index)); });
    if (lightbox.open) updateLightbox();
  }

  function setBusy(value) {
    busy = value;
    [previous, next, open, lightboxPrevious, lightboxNext].forEach(button => {
      button.disabled = value && button !== document.activeElement;
      button.setAttribute("aria-disabled", String(value));
    });
    gallery.setAttribute("aria-busy", String(value));
    updateSlides();
  }

  function loadPhoto(photoIndex, fullSize = false) {
    const photo = photos[photoIndex];
    const key = `${photoIndex}:${fullSize ? "full" : "responsive"}:${window.innerWidth}:${window.devicePixelRatio}`;
    if (!cache.has(key)) {
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        const timeout = window.setTimeout(() => finish(new Error("Photo load timed out")), 12000);
        function finish(error) {
          window.clearTimeout(timeout);
          image.onload = image.onerror = null;
          if (error) { cache.delete(key); reject(error); }
          else resolve(image);
        }
        image.onload = () => finish();
        image.onerror = () => finish(new Error("Photo unavailable"));
        if (fullSize) image.src = photo.src;
        else setImage(image, photo);
      });
      cache.set(key, promise);
    }
    return cache.get(key);
  }

  function schedule() {
    window.clearTimeout(timer);
    if (!userPaused && !hovering && !focused && visible && !document.hidden && !busy && !failed && !lightbox.open) {
      timer = window.setTimeout(() => { void showPhoto(index + 1, false); }, interval);
    }
  }

  function updateToggle() {
    if (failed) {
      toggle.textContent = "重试";
      toggle.setAttribute("aria-label", "重试加载并播放自动轮播");
      toggle.setAttribute("aria-pressed", String(userPaused));
      return;
    }
    toggle.textContent = userPaused ? "播放" : "暂停";
    toggle.setAttribute("aria-label", userPaused ? "播放自动轮播" : "暂停自动轮播");
    toggle.setAttribute("aria-pressed", String(userPaused));
  }

  async function showPhoto(requestedIndex, manual = true, animate = true) {
    if (busy) return;
    const photoIndex = wrapIndex(requestedIndex);
    if (photoIndex === index) return;
    const direction = photoIndex === wrapIndex(index + 1) ? 1 : photoIndex === wrapIndex(index - 1) ? -1 : 0;
    const shouldAnimate = animate && direction !== 0 && !lightbox.open && !motionPreference.matches;
    const focusedSlide = slides.includes(document.activeElement) ? document.activeElement : null;
    setBusy(true);
    window.clearTimeout(timer);
    try {
      // Only the selected photograph gates navigation; a broken preview cannot block it.
      await loadPhoto(photoIndex, lightbox.open);
      if (shouldAnimate) {
        const incoming = slides.find(slide => Number(slide.dataset.position) === direction);
        const incomingImage = incoming.querySelector(".gallery-image");
        if (incomingImage.decode) await incomingImage.decode();
        slides.forEach(slide => {
          slide.classList.remove("is-arriving");
          slide.dataset.position = String(Number(slide.dataset.position) - direction);
        });
        incoming.classList.add("is-arriving");
        index = photoIndex;
        updateSlides();
        updateSelection();
        await new Promise(resolve => window.setTimeout(resolve, 1250));
        const recycled = slides.find(slide => Math.abs(Number(slide.dataset.position)) > 2);
        if (recycled) {
          recycled.classList.add("is-recycling");
          const position = direction * 2;
          fillSlide(recycled, wrapIndex(index + position));
          recycled.dataset.position = String(position);
          void recycled.offsetWidth;
          recycled.classList.remove("is-recycling");
        }
        incoming.classList.remove("is-arriving");
      } else {
        index = photoIndex;
        slides.forEach((slide, slot) => {
          slide.classList.add("is-recycling");
          const position = slot - 2;
          fillSlide(slide, wrapIndex(index + position));
          slide.dataset.position = String(position);
          void slide.offsetWidth;
          slide.classList.remove("is-recycling", "is-arriving");
        });
        updateSelection();
      }
      gallery.classList.remove("has-photo-error");
      failed = false;
      updateToggle();
      status.textContent = manual ? `第 ${index + 1} 张：${photos[index].title}` : "";
      [-1, 1].forEach(offset => { void loadPhoto(wrapIndex(index + offset)).catch(() => {}); });
      if (focusedSlide && Math.abs(Number(focusedSlide.dataset.position)) > 1) {
        (direction === 1 ? next : previous).focus({ preventScroll: true });
      }
    } catch {
      failed = true;
      updateToggle();
      gallery.classList.add("has-photo-error");
      const message = "照片暂时无法加载，已保留当前照片。请重试或选择其他作品。";
      status.textContent = message;
      if (lightbox.open) lightboxStatus.textContent = message;
    } finally {
      setBusy(false);
      if (focusAfterLoad && !lightbox.open) {
        focusAfterLoad = false;
        open.focus({ preventScroll: true });
      }
      schedule();
    }
  }

  function openLightbox() {
    if (busy) return;
    if (typeof lightbox.showModal !== "function") {
      window.open(photos[index].src, "_blank", "noopener,noreferrer");
      return;
    }
    returnFocus = document.activeElement;
    updateLightbox();
    lightbox.showModal();
    document.body.classList.add("lightbox-is-open");
    schedule();
  }

  slides.forEach(slide => {
    fillSlide(slide, wrapIndex(Number(slide.dataset.position)));
    slide.addEventListener("click", () => {
      if (Date.now() < suppressClickUntil) return;
      const position = Number(slide.dataset.position);
      if (position === 0) openLightbox();
      else if (Math.abs(position) === 1) void showPhoto(index + position);
    });
  });
  const thumbnailFragment = document.createDocumentFragment();
  photos.forEach((photo, photoIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "photo-thumbnail";
    button.setAttribute("aria-label", `查看第 ${photoIndex + 1} 张：${photo.title}`);
    const image = document.createElement("img");
    image.src = variant(photo, 320);
    image.alt = "";
    image.width = 320;
    image.height = Math.round(320 * photo.height / photo.width);
    image.loading = "lazy";
    image.decoding = "async";
    const label = document.createElement("span");
    label.textContent = photo.title;
    button.append(image, label);
    button.addEventListener("click", () => { void showPhoto(photoIndex, true, false); });
    thumbnailFragment.append(button);
  });
  thumbnails.append(thumbnailFragment);
  document.getElementById("photo-total").textContent = `${photos.length} 张`;
  document.getElementById("photo-overview").hidden = false;
  document.getElementById("gallery-help").textContent = `每张停留约 ${interval / 1000} 秒；点击中间照片可放大，左右预览可翻页，也可在手机上左右滑动。`;
  gallery.querySelector(".gallery-controls").hidden = false;
  updateSlides();
  updateSelection();

  previous.addEventListener("click", () => { void showPhoto(index - 1); });
  next.addEventListener("click", () => { void showPhoto(index + 1); });
  open.addEventListener("click", openLightbox);
  toggle.addEventListener("click", () => {
    if (failed) {
      failed = false;
      userPaused = false;
      updateToggle();
      void showPhoto(index + 1);
      return;
    }
    userPaused = !userPaused;
    updateToggle();
    schedule();
  });
  lightboxPrevious.addEventListener("click", () => { void showPhoto(index - 1, true, false); });
  lightboxNext.addEventListener("click", () => { void showPhoto(index + 1, true, false); });
  document.getElementById("lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("close", () => {
    document.body.classList.remove("lightbox-is-open");
    // A thumbnail/slide may have moved while the dialog was open.
    const target = returnFocus && returnFocus.isConnected && !returnFocus.disabled && returnFocus.tabIndex >= 0 ? returnFocus : open;
    if (target.disabled) focusAfterLoad = true;
    else target.focus({ preventScroll: true });
    schedule();
  });
  lightboxImage.addEventListener("error", () => { lightboxStatus.textContent = "大图暂时无法加载，请重试或查看其他作品。"; });
  lightbox.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
  function handleKeys(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      void showPhoto(index + (event.key === "ArrowLeft" ? -1 : 1), true, !lightbox.open);
    }
  }
  gallery.addEventListener("keydown", handleKeys);
  lightbox.addEventListener("keydown", handleKeys);

  function enableSwipe(stage) {
    let start;
    stage.addEventListener("pointerdown", event => {
      if (event.pointerType === "touch" || event.pointerType === "pen") start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    stage.addEventListener("pointercancel", () => { start = null; });
    stage.addEventListener("pointerup", event => {
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressClickUntil = Date.now() + 500;
        void showPhoto(index + (dx < 0 ? 1 : -1), true, !lightbox.open);
      }
    });
  }
  enableSwipe(gallery.querySelector(".gallery-stage"));
  enableSwipe(lightbox.querySelector(".lightbox-stage"));
  gallery.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") { hovering = true; schedule(); } });
  gallery.addEventListener("pointerleave", () => { hovering = false; schedule(); });
  gallery.addEventListener("focusin", () => { focused = true; schedule(); });
  gallery.addEventListener("focusout", event => { focused = gallery.contains(event.relatedTarget); schedule(); });
  document.addEventListener("visibilitychange", schedule);
  motionPreference.addEventListener("change", event => { if (event.matches) userPaused = true; updateToggle(); schedule(); });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) [-1, 1].forEach(offset => { void loadPhoto(wrapIndex(index + offset)).catch(() => {}); });
      schedule();
    }, { threshold: 0.15 });
    observer.observe(gallery);
  }
  updateToggle();
  schedule();
})();
