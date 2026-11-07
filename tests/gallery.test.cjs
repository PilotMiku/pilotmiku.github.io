const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

// A deliberately small DOM adapter exercises the real script without a browser.
// Native dialog focus containment and actual layout still need browser QA.
function setup({ reducedMotion = true, failImage = () => false } = {}) {
  let document;
  class Element {
    constructor() {
      this.children = []; this.attributes = new Map(); this.listeners = new Map();
      this.dataset = {}; this.textContent = ''; this.disabled = false; this.hidden = false;
      this.tabIndex = 0; this.isConnected = true; this.open = false;
      this.classes = new Set();
      this.classList = { add: (...v) => v.forEach(x => this.classes.add(x)), remove: (...v) => v.forEach(x => this.classes.delete(x)), contains: x => this.classes.has(x) };
      this.selectors = new Map();
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    removeAttribute(k) { this.attributes.delete(k); }
    addEventListener(k, fn) { if (!this.listeners.has(k)) this.listeners.set(k, []); this.listeners.get(k).push(fn); }
    emit(k, data = {}) { for (const fn of this.listeners.get(k) || []) fn({ target: this, preventDefault() {}, ...data }); }
    append(...items) { for (const item of items) this.children.push(...(item.fragment ? item.children : [item])); }
    querySelector(k) { return this.selectors.get(k); }
    querySelectorAll(k) { return this.selectors.get(k) || []; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    decode() { return Promise.resolve(); }
  }
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  const meta = new Element();
  document = new Element(); document.body = new Element(); document.activeElement = document.body;
  document.getElementById = id => { assert.ok(ids.has(id), `Missing HTML element ${id}`); return ids.get(id); };
  document.querySelector = () => meta;
  document.querySelectorAll = () => [meta];
  document.createElement = () => new Element();
  document.createDocumentFragment = () => { const el = new Element(); el.fragment = true; return el; };
  const slides = Array.from({ length: 5 }, (_, slot) => {
    const slide = new Element(); slide.dataset.position = String(slot - 2);
    slide.selectors.set('.gallery-image', new Element());
    slide.selectors.set('.preview-label', new Element()); return slide;
  });
  const stage = new Element();
  const gallery = ids.get('photography');
  gallery.children.push(...slides, ids.get('photo-next'), ids.get('photo-prev'));
  gallery.selectors.set('.gallery-slide', slides);
  gallery.selectors.set('.gallery-stage', stage);
  gallery.selectors.set('.gallery-controls', new Element());
  ids.get('photo-lightbox').selectors.set('.lightbox-stage', new Element());
  let timerId = 0;
  const timers = new Map();
  const window = {
    innerWidth: 390, devicePixelRatio: 2,
    matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }),
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); if (ms === 1250) queueMicrotask(() => { if (timers.delete(id)) fn(); }); return id; },
    clearTimeout(id) { timers.delete(id); },
    open() {},
  };
  class Image extends Element {
    set src(value) { this.source = value; queueMicrotask(() => { const fn = failImage(value) ? this.onerror : this.onload; if (fn) fn(); }); }
    get src() { return this.source; }
  }
  const context = vm.createContext({ window, document, Image, URL, console, Date });
  for (const file of ['config.js', 'photos.js', 'script.js']) vm.runInContext(readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { ids, window, document, slides, stage, timers, gallery };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('initial state exposes all twenty thumbnails and a consistent three-second interval', () => {
  const { ids } = setup();
  assert.equal(ids.get('photo-thumbnails').children.length, 20);
  assert.equal(ids.get('photo-counter').textContent, '01 / 20');
  assert.equal(ids.get('photo-thumbnails').children[0].getAttribute('aria-pressed'), 'true');
  assert.match(ids.get('gallery-help').textContent, /3 秒/);
  assert.equal(ids.get('photo-overview').hidden, false);
});

test('thumbnail selection and previous/next controls wrap and stay synchronized', async () => {
  const { ids, slides } = setup();
  ids.get('photo-thumbnails').children[19].emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '20 / 20');
  assert.equal(ids.get('photo-title').textContent, '枝头与蓝天');
  ids.get('photo-next').emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '01 / 20');
  ids.get('photo-prev').emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '20 / 20');
  const current = slides.find(s => s.dataset.position === '0');
  assert.equal(current.dataset.photoIndex, '19');
  assert.equal(current.tabIndex, 0);
});

test('animated navigation still works after an arbitrary thumbnail jump', async () => {
  const { ids, slides } = setup({ reducedMotion: false });
  ids.get('photo-thumbnails').children[9].emit('click'); await settle();
  ids.get('photo-next').emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '11 / 20');
  assert.deepEqual(slides.map(s => Number(s.dataset.position)).sort((a, b) => a - b), [-2, -1, 0, 1, 2]);
  ids.get('photo-prev').emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '10 / 20');
});

test('full-screen viewing synchronizes arrows, original image link, and return focus', async () => {
  const { ids, document } = setup();
  ids.get('photo-open').focus(); ids.get('photo-open').emit('click');
  assert.equal(ids.get('photo-lightbox').open, true);
  assert.ok(document.body.classList.contains('lightbox-is-open'));
  ids.get('photo-lightbox').emit('keydown', { key: 'ArrowRight' }); await settle();
  assert.equal(ids.get('lightbox-counter').textContent, '2 / 20');
  assert.equal(ids.get('photo-original').href, './images/web/images2.webp');
  assert.equal(ids.get('photo-title').textContent, '草木之间');
  ids.get('lightbox-close').emit('click');
  assert.equal(ids.get('photo-lightbox').open, false);
  assert.equal(document.activeElement, ids.get('photo-open'));
  assert.ok(!document.body.classList.contains('lightbox-is-open'));
});

test('horizontal touch swipes navigate while vertical scrolling is ignored', async () => {
  const { stage, ids } = setup();
  stage.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 250, clientY: 100 });
  stage.emit('pointerup', { pointerId: 1, clientX: 100, clientY: 110 }); await settle();
  assert.equal(ids.get('photo-counter').textContent, '02 / 20');
  stage.emit('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 100 });
  stage.emit('pointerup', { pointerId: 2, clientX: 190, clientY: 240 }); await settle();
  assert.equal(ids.get('photo-counter').textContent, '02 / 20');
});

test('failed image loads preserve the current photo and allow another selection', async () => {
  const { ids, gallery } = setup({ failImage: value => /images2(?:-|\.)/.test(value) });
  ids.get('photo-next').emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '01 / 20');
  assert.match(ids.get('gallery-status').textContent, /暂时无法加载/);
  assert.equal(ids.get('photo-next').disabled, false);
  assert.ok(gallery.classList.contains('has-photo-error'));
  ids.get('photo-thumbnails').children[4].emit('click'); await settle();
  assert.equal(ids.get('photo-counter').textContent, '05 / 20');
  assert.ok(!gallery.classList.contains('has-photo-error'));
});

test('opening the viewer cancels autoplay and reduced motion starts paused', () => {
  const { ids, timers } = setup({ reducedMotion: false });
  assert.ok([...timers.values()].some(t => t.ms === 3000));
  ids.get('photo-open').emit('click');
  assert.ok(![...timers.values()].some(t => t.ms === 3000));
  const reduced = setup();
  assert.equal(reduced.ids.get('photo-toggle').getAttribute('aria-pressed'), 'true');
  assert.ok(![...reduced.timers.values()].some(t => t.ms === 3000));
});
