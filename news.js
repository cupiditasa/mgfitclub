const grid = document.getElementById("story-grid");
const empty = document.getElementById("empty");
const archiveList = document.getElementById("archive-list");
const featuredImage = document.getElementById("featured-image");
const menuButton = document.querySelector(".menu-button");
const menu = document.querySelector(".menu");
const header = document.querySelector(".header");
const meter = document.querySelector(".scroll-meter i");

let edition = null;
let activeFilter = "all";
let countdownTimer = null;

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const toFa = (value) => String(value).replace(/\d/g, (d) => faDigits[d]);

function tehranParts(ms) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
}

function part(parts, type) {
  return parts.find((item) => item.type === type)?.value || "";
}

function formatClock(ms) {
  const parts = tehranParts(ms);
  return toFa(`${part(parts, "hour")}:${part(parts, "minute")}`);
}

function formatDate(ms) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "long",
    day: "numeric",
  }).format(new Date(ms));
}

function relativeTime(ms) {
  const diff = Date.now() - ms;
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${toFa(mins)} دقیقه پیش`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  return formatDate(ms);
}

function windowLabel(window) {
  return `${formatClock(window.startUtc)} تا ${formatClock(window.endUtc)}`;
}

function editionLabel(window) {
  const start = Math.floor(window.startHour);
  const end = (start + 4) % 24;
  return `${toFa(String(start).padStart(2, "0"))}–${toFa(String(end).padStart(2, "0"))}`;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageStyle(url) {
  let safeImage = "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") safeImage = parsed.href.replace(/["'()\\]/g, (character) => `%${character.charCodeAt(0).toString(16)}`);
  } catch (_) {}
  if (!safeImage || /mgfitclub\.ir/i.test(safeImage)) {
    return "background-image: linear-gradient(180deg, transparent 35%, rgba(5,7,5,.82)), radial-gradient(circle at 30% 20%, rgba(198,255,63,.18), transparent 42%)";
  }
  return `background-image: linear-gradient(180deg, transparent 35%, rgba(5,7,5,.82)), url(${JSON.stringify(safeImage)})`;
}

function renderFeatured(story, window) {
  if (!story) return;
  const href = story.sourceUrl || story.href || "#";
  featuredImage.style = imageStyle(story.image);
  setText("featured-cat", story.category || "بانوان");
  setText("featured-title", story.title);
  setText("featured-summary", story.summary);
  setText("featured-source", story.source);
  setText("featured-time", relativeTime(story.publishedAt));
  setText("featured-stamp", story.inWindow ? "۴ HOUR LEAD" : "TOP DESK");
  document.getElementById("featured-link").href = href;
}

function cardHtml(story) {
  const original = story.originalTitle && story.originalTitle !== story.title
    ? `<small class="card__original" dir="auto">عنوان اصلی: ${escapeHtml(story.originalTitle)}</small>` : "";
  return `
    <a class="card" href="${escapeHtml(story.sourceUrl || story.href || "#")}" target="_blank" rel="noopener noreferrer" data-cat="${escapeHtml(story.category)}">
      <div class="card__media" style='${imageStyle(story.image)}'></div>
      <div class="card__body">
        <small>${escapeHtml(story.category)}</small>
        <h3>${escapeHtml(story.title)}</h3>
        <p>${escapeHtml(story.summary)}</p>
        ${original}
        <span class="card__meta">${escapeHtml(story.source)} · ${relativeTime(story.publishedAt)}</span>
      </div>
    </a>
  `;
}

function applyFilter() {
  const stories = (edition?.stories || []).filter((story) => {
    if (activeFilter === "all") return true;
    return story.category === activeFilter;
  });
  grid.innerHTML = stories.map(cardHtml).join("");
  empty.hidden = stories.length > 0;
}

function renderArchive(items, window) {
  const section = archiveList.closest(".archive");
  if (section) section.hidden = !(items || []).length;
  archiveList.innerHTML = (items || [])
    .map((item) => `
      <a class="archive__item" href="${escapeHtml(item.featured?.href || (item.featured?.id ? `/khabar/${encodeURIComponent(item.featured.id)}` : "/"))}">
        <b>${editionLabel(item)}</b>
        <div>
          <h3>${escapeHtml(item.featured?.title || "ویرایش بدون تیتر")}</h3>
          <p>${escapeHtml(item.featured?.source || "MG News")} · ${escapeHtml(item.featured?.category || "بانوان")}</p>
        </div>
        <small>${formatDate(item.startUtc)}</small>
      </a>
    `)
    .join("");
}

function tickCountdown(nextUtc) {
  clearInterval(countdownTimer);
  const update = () => {
    const remain = Math.max(0, nextUtc - Date.now());
    const hours = Math.floor(remain / 3600000);
    const mins = Math.floor((remain % 3600000) / 60000);
    const secs = Math.floor((remain % 60000) / 1000);
    setText(
      "countdown",
      `${toFa(String(hours).padStart(2, "0"))}:${toFa(String(mins).padStart(2, "0"))}:${toFa(String(secs).padStart(2, "0"))}`
    );
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

function renderDigest(id, items) {
  const node = document.getElementById(id);
  if (!node) return;
  const list = items || [];
  const section = node.closest(".feed");
  if (section) section.hidden = list.length === 0;
  node.innerHTML = list.length ? list.map(cardHtml).join("") : "<p class='empty'>در این بازه خبر شاخصی پیدا نشد.</p>";
}

function render(data) {
  edition = data;
  setText("edition-label", `ویرایش ${editionLabel(data.window)}`);
  setText("window-label", windowLabel(data.window));
  setText("live-status", data.live ? "منابع زنده" : "آرشیو باشگاه");
  renderFeatured(data.featured, data.window);
  applyFilter();
  renderDigest("week-grid", data.highlights?.week);
  renderDigest("month-grid", data.highlights?.month);
  renderDigest("quarter-grid", data.highlights?.quarter);
  renderDigest("year-grid", data.highlights?.year);
  renderArchive(data.archive, data.window);
  tickCountdown(data.window.nextUtc);
}

async function loadNews() {
  const res = await fetch("https://api.mgfitclub.ir/api/news", { cache: "no-store" });
  if (!res.ok) throw new Error("news failed");
  render(await res.json());
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((el) => {
      el.setAttribute("aria-pressed", String(el === button));
    });
    applyFilter();
  });
});

menuButton.addEventListener("click", () => {
  const open = !menu.classList.contains("is-open");
  menu.classList.toggle("is-open", open);
  menu.setAttribute("aria-hidden", String(!open));
  menuButton.setAttribute("aria-expanded", String(open));
});

window.addEventListener("scroll", () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  meter.style.height = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
}, { passive: true });

loadNews().catch(() => {
  setText("live-status", "قطع موقت منابع");
});

setInterval(() => {
  loadNews().catch(() => {});
}, 5 * 60 * 1000);
