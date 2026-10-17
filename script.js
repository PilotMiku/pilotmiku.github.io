(() => {
  "use strict";
  const config = window.SITE_CONFIG || {};
  const name = typeof config.name === "string" && config.name.trim() ? config.name.trim() : "XX";
  document.querySelectorAll("[data-name]").forEach(element => { element.textContent = name; });
  document.title = `${name} · 代码、镜头与日常`;
  document.querySelector('meta[name="description"]').content = `${name} 的个人主页。东北大学在读学生，来自重庆，以摄影为主要爱好，也热爱编程、关注 AI。在这里分享摄影作品、学习思考与生活。`;
  document.getElementById("year").textContent = new Date().getFullYear();

  const email = typeof config.email === "string" ? config.email.trim() : "";
  if (/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) {
    const link = document.getElementById("email-link");
    link.href = `mailto:${email}`;
    link.removeAttribute("aria-disabled");
    document.getElementById("email-text").textContent = email;
  }

  try {
    const github = new URL(config.github);
    if (github.protocol === "https:" && github.hostname === "github.com" && !github.username && !github.password && /^\/[A-Za-z0-9-]+\/?$/.test(github.pathname)) {
      const link = document.getElementById("github-link");
      link.href = github.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.removeAttribute("aria-disabled");
      document.getElementById("github-text").textContent = `github.com${github.pathname.replace(/\/$/, "")}`;
    }
  } catch { /* 未填写有效地址时保留静态提示。 */ }

  const gallery = document.getElementById("photography");
  const photos = window.PHOTO_GALLERY;
  if (!gallery || !Array.isArray(photos) || photos.length < 2) return;

  const slides = [...gallery.querySelectorAll(".gallery-slide")];
  const previous = document.getElementById("photo-prev");
  const next = document.getElementById("photo-next");
  const toggle = document.getElementById("photo-toggle");
  const counter = document.getElementById("photo-counter");
  const title = document.getElementById("photo-title");
  const status = document.getElementById("gallery-status");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const interval = Number.isFinite(config.slideshowInterval) ? Math.max(4000, config.slideshowInterval) : 7000;
  const cache = new Map();
  let index = 0;
  let timer;
  let busy = false;
  let failed = false;
  let userPaused = motionPreference.matches;
  let hovering = false;
  let focused = false;
  let visible = !("IntersectionObserver" in window);

  gallery.querySelector(".gallery-controls").hidden = false;

  const wrapIndex = value => (value + photos.length) % photos.length;

  function fillSlide(slide, photoIndex) {
    const photo = photos[photoIndex];
    const image = slide.querySelector(".gallery-image");
    image.src = photo.src;
    image.alt = photo.alt;
    image.width = photo.width;
    image.height = photo.height;
    slide.dataset.photoIndex = String(photoIndex);
  }

  function updateSlides() {
    slides.forEach(slide => {
      const position = Number(slide.dataset.position);
      const inView = Math.abs(position) <= 1;
      const photo = photos[Number(slide.dataset.photoIndex)];
      slide.tabIndex = inView && position !== 0 ? 0 : -1;
      slide.disabled = busy || !inView;
      slide.setAttribute("aria-label", `${position === 0 ? "当前照片" : position < 0 ? "查看上一张" : "查看下一张"}：${photo.title}`);
      if (inView) slide.removeAttribute("aria-hidden");
      else slide.setAttribute("aria-hidden", "true");
      if (position === 0) slide.setAttribute("aria-current", "true");
      else slide.removeAttribute("aria-current");
      slide.querySelector(".preview-label").textContent = position < 0 ? "上一张" : "下一张";
    });
  }

  slides.forEach(slide => {
    fillSlide(slide, wrapIndex(Number(slide.dataset.position)));
    slide.addEventListener("click", () => {
      const position = Number(slide.dataset.position);
      if (Math.abs(position) === 1) void showPhoto(index + position);
    });
  });
  updateSlides();

  function loadPhoto(photoIndex) {
    if (!cache.has(photoIndex)) {
      const photo = photos[photoIndex];
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => { cache.delete(photoIndex); reject(new Error("Photo unavailable")); };
        image.src = photo.src;
      });
      cache.set(photoIndex, promise);
    }
    return cache.get(photoIndex);
  }

  function schedule() {
    window.clearTimeout(timer);
    if (!userPaused && !hovering && !focused && visible && !document.hidden && !busy && !failed) {
      timer = window.setTimeout(() => { void showPhoto(index + 1, false); }, interval);
    }
  }

  function updateToggle() {
    toggle.textContent = userPaused ? "播放" : "暂停";
    toggle.setAttribute("aria-label", userPaused ? "播放自动轮播" : "暂停自动轮播");
    toggle.setAttribute("aria-pressed", String(userPaused));
  }

  async function showPhoto(requestedIndex, manual = true) {
    if (busy) return;
    const photoIndex = (requestedIndex + photos.length) % photos.length;
    if (photoIndex === index) return;
    const direction = photoIndex === wrapIndex(index + 1) ? 1 : -1;
    busy = true;
    previous.disabled = next.disabled = true;
    updateSlides();
    window.clearTimeout(timer);
    try {
      // 当前作品与左右预览都准备好后，再让相框沿对应方向移动。
      await Promise.all([-1, 0, 1].map(offset => loadPhoto(wrapIndex(photoIndex + offset))));
      const photo = photos[photoIndex];
      const incoming = slides.find(slide => Number(slide.dataset.position) === direction);
      await Promise.all(slides
        .filter(slide => Math.abs(Number(slide.dataset.position) - direction) <= 1)
        .map(slide => {
          const image = slide.querySelector(".gallery-image");
          return image.decode ? image.decode() : Promise.resolve();
        }));

      slides.forEach(slide => {
        slide.classList.remove("is-arriving");
        slide.dataset.position = String(Number(slide.dataset.position) - direction);
      });
      incoming.classList.add("is-arriving");
      index = photoIndex;
      updateSlides();
      title.textContent = photo.title;
      counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
      counter.setAttribute("aria-label", `当前第 ${index + 1} 张，共 ${photos.length} 张`);
      gallery.classList.remove("has-photo-error");
      failed = false;
      status.textContent = manual ? `第 ${index + 1} 张：${photo.title}` : "";
      [-2, 2].forEach(offset => { void loadPhoto(wrapIndex(index + offset)).catch(() => {}); });
      await new Promise(resolve => window.setTimeout(resolve, motionPreference.matches ? 0 : 1250));

      // 只循环利用已移出视野的卡片，避免左右预览在切换时被替换闪动。
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
      if (slides.includes(document.activeElement) && Math.abs(Number(document.activeElement.dataset.position)) > 1) {
        (direction === 1 ? next : previous).focus({ preventScroll: true });
      }
    } catch {
      failed = true;
      gallery.classList.add("has-photo-error");
      status.textContent = "这张照片暂时无法加载，已保留当前照片。请检查图片文件后重试。";
    } finally {
      busy = false;
      previous.disabled = next.disabled = false;
      updateSlides();
      schedule();
    }
  }

  previous.addEventListener("click", () => { void showPhoto(index - 1); });
  next.addEventListener("click", () => { void showPhoto(index + 1); });
  toggle.addEventListener("click", () => {
    userPaused = !userPaused;
    updateToggle();
    schedule();
  });
  gallery.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      void showPhoto(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  gallery.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") { hovering = true; schedule(); }
  });
  gallery.addEventListener("pointerleave", () => { hovering = false; schedule(); });
  gallery.addEventListener("focusin", () => { focused = true; schedule(); });
  gallery.addEventListener("focusout", event => {
    focused = gallery.contains(event.relatedTarget);
    schedule();
  });
  document.addEventListener("visibilitychange", schedule);
  motionPreference.addEventListener("change", event => {
    if (event.matches) userPaused = true;
    updateToggle();
    schedule();
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) [-2, -1, 1, 2].forEach(offset => { void loadPhoto(wrapIndex(index + offset)).catch(() => {}); });
      schedule();
    }, { threshold: 0.15 });
    observer.observe(gallery);
  }
  updateToggle();
  schedule();
})();
