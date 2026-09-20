import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = fs.existsSync(new URL("../../current/mg-journal.html", import.meta.url)) ? new URL("../../current/", import.meta.url) : new URL("../../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
const html = read("mg-journal.html");
const playerSource = read("journal-player.js");
const stories = JSON.parse(html.match(/<script type="application\/json" id="journal-story-data">([\s\S]*?)<\/script>/)[1]);

test("journal retains all seven films, service copy and coach links; book section is removed", () => {
  assert.ok(!/mg-book|book-bg\.mp4|mg-book-mobile/.test(html + read("journal.css") + read("journal-layout.css")));
  assert.ok(html.indexOf('id="mg-stories"') < html.indexOf('id="service-films"'));
  assert.ok(html.indexOf('id="service-films"') < html.indexOf('class="exp-final"'));
  for (let i = 1; i <= 4; i++) assert.ok(html.includes(`assets/images/journal-service-${i}.webp`));
  for (const story of stories) {
    assert.ok(story.text.length > 80);
    assert.ok(fs.existsSync(new URL(story.src, root)));
    assert.ok(fs.existsSync(new URL(story.poster, root)));
    assert.ok(fs.existsSync(new URL(story.url, root)));
  }
  assert.equal(stories.length, 3);
  const topics = ["فانکشنال و حال خوب", "قدرت، انضباط و اعتمادبه‌نفس", "تغذیه سالم و رشد عضلات", "MG؛ فراتر از باشگاه، یک سبک زندگی"];
  const choices = [...html.matchAll(/<a class="poster-card"[\s\S]*?<\/a>/g)].map(m => m[0]);
  for (let i = 0; i < topics.length; i++) {
    const choice = choices[i];
    assert.ok(choice?.includes(`assets/images/journal-service-${i + 1}.webp`));
    assert.ok(choice?.includes(topics[i]));
  }
  assert.ok(!html.includes('id="service-player"'));
  assert.ok(!/<video[^>]*autoplay/i.test(html));
  assert.match(read("journal-layout.css"), /object-fit:contain/);
  assert.match(read("journal-layout.css"), /aspect-ratio:9\/16/);
});

test("journal links, posters, IDs and accessible navigation targets resolve", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const match of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(https?:|data:|tel:|mailto:)/.test(value)) continue;
    const path = value.split(/[?#]/)[0];
    if (path) assert.ok(fs.existsSync(new URL(path, root)), value);
    if (value.startsWith("#")) assert.ok(ids.includes(value.slice(1)), value);
  }
  assert.match(html, /class="journal-back" href="index.html"/);
  assert.match(html, /aria-controls="journal-menu" aria-expanded="false"/);
  assert.match(html, /<dialog class="story-modal" aria-labelledby="story-modal-title"/);
  assert.equal((html.match(/class="poster-card"/g) || []).length, 4);
  new vm.Script(playerSource);
  new vm.Script(read("journal-motion.js"));
});

function fixture({ reduced = false, hover = false, saveData = false, referrer = "" } = {}) {
  class Element {
    constructor() {
      this.handlers = {}; this.attrs = {}; this.dataset = {}; this.hidden = false; this.open = false; this.paused = true; this.currentTime = 0; this.duration = 20; this.playCalls = 0; this.loads = 0;
      const classes = new Set();
      this.classList = { contains: c => classes.has(c), toggle: (c, value) => { const add = value === undefined ? !classes.has(c) : value; if (add) classes.add(c); else classes.delete(c); return add; } };
      this.style = { values: {}, setProperty: (key, value) => { this.style.values[key] = value; } };
    }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    emit(name, properties = {}) { const e = { target: this, button: 0, preventDefault() { this.prevented = true; }, ...properties }; for (const fn of this.handlers[name] || []) fn(e); return e; }
    pause() { this.paused = true; }
    play() { this.paused = false; this.playCalls++; this.emit("play"); return Promise.resolve(); }
    load() { this.loads++; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return k === "src" ? this.src : this.attrs[k]; }
    removeAttribute(k) { delete this.attrs[k]; if (k === "src") this.src = ""; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit("close"); }
    focus() { this.focused = true; }
    closest() { return null; }
    querySelector(selector) { return this.children?.[selector] || null; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 400, bottom: 800, width: 280 }; }
    scrollBy(value) { this.scroll = value; }
  }
  const selectors = {};
  for (const s of [".journal-page", ".journal-menu-toggle", ".story-modal", ".modal-video", "[data-journal-back]", ".story-track", ".modal-count", ".modal-role", ".modal-text", ".modal-tags", ".modal-detail-link", ".modal-error", ".modal-close", ".modal-prev", ".modal-next", ".rail-prev", ".rail-next"]) selectors[s] = new Element();
  const byId = {};
  for (const id of ["journal-menu", "service-player", "film-counter", "film-error", "film-direct", "journal-story-data", "story-modal-title"]) byId[id] = new Element();
  byId["journal-story-data"].textContent = JSON.stringify(stories);
  const menuClose = new Element(); byId["journal-menu"].children = { "[data-close-menu]": menuClose };
  const videoSource = new Element(); byId["service-player"].children = { source: videoSource };
  const choices = Array.from({ length: 4 }, (_, i) => { const e = new Element(); e.dataset = { film: String(i), src: `assets/media/service-${i + 1}.mp4`, poster: `assets/images/journal-service-${i + 1}.webp` }; return e; });
  const copies = choices.map(() => new Element());
  const cards = stories.map(() => { const e = new Element(); e.children = { video: new Element() }; return e; });
  const videos = [byId["service-player"], selectors[".modal-video"], ...cards.map(c => c.children.video)];
  const document = new Element(); document.body = new Element(); document.referrer = referrer; document.hidden = false;
  document.querySelector = selector => selectors[selector] || null;
  document.getElementById = id => byId[id] || null;
  document.querySelectorAll = selector => ({ video: videos, ".film-choice": choices, ".film-copy": copies, ".story-card": cards }[selector] || []);
  const window = new Element(); window.matchMedia = query => ({ matches: query.includes("reduced-motion") ? reduced : hover });
  const history = { length: 2, back() { this.wentBack = true; } };
  vm.runInNewContext(playerSource, { document, window, navigator: { connection: { saveData } }, URL, location: { origin: "https://mgfitclub.ir", pathname: "/mg-journal.html" }, history });
  return { document, window, selectors, byId, menuClose, choices, copies, cards, videos, history, videoSource };
}

test("journal does not autoplay on entry", () => {
  assert.ok(fixture().videos.every(v => v.playCalls === 0));
});

test("menu closes accessibly and the back link uses history only for a same-site origin", () => {
  const f = fixture({ referrer: "https://mgfitclub.ir/index.html" });
  f.selectors[".journal-menu-toggle"].emit("click");
  assert.equal(f.byId["journal-menu"].open, true);
  assert.equal(f.selectors[".journal-menu-toggle"].attrs["aria-expanded"], "true");
  assert.equal(f.document.body.classList.contains("is-locked"), true);
  f.menuClose.emit("click");
  assert.equal(f.selectors[".journal-menu-toggle"].attrs["aria-expanded"], "false");
  assert.equal(f.document.body.classList.contains("is-locked"), false);
  assert.ok(f.selectors["[data-journal-back]"].emit("click").prevented);
  assert.ok(f.history.wentBack);
  for (const referrer of ["", "https://other.test/", "https://mgfitclub.ir/mg-journal.html"]) {
    const other = fixture({ referrer });
    assert.ok(!other.selectors["[data-journal-back]"].emit("click").prevented);
  }
});

test("coach modal pauses services, restores focus and does not open after a rail drag", () => {
  const f = fixture(); f.cards[0].emit("click");
  assert.equal(f.selectors[".story-modal"].open, true);
  assert.equal(f.byId["service-player"].paused, true);
  assert.equal(f.selectors[".modal-video"].src, stories[0].src);
  assert.equal(f.selectors[".modal-text"].textContent, stories[0].text);
  f.selectors[".modal-next"].emit("click"); assert.equal(f.selectors[".modal-video"].src, stories[1].src);
  f.selectors[".modal-close"].emit("click");
  assert.equal(f.selectors[".modal-video"].paused, true); assert.equal(f.selectors[".modal-video"].src, ""); assert.ok(f.cards[0].focused);
  f.selectors[".story-track"].dataset.suppressClick = "true"; f.cards[1].emit("click"); assert.equal(f.selectors[".story-modal"].open, false);
});

test("reduced motion/data saving avoid hover playback; leaving the page pauses all video", () => {
  for (const options of [{ reduced: true, hover: true }, { hover: true, saveData: true }, { hover: false }]) {
    const f = fixture(options); f.cards[0].emit("pointerenter"); assert.ok(f.videos.every(v => v.playCalls === 0));
    f.choices[0].emit("click"); f.document.hidden = true; f.document.emit("visibilitychange"); assert.ok(f.videos.every(v => v.paused));
  }
});
