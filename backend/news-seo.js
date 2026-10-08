export const NEWS_PUBLIC_ORIGIN = "https://khabar.mgfitclub.ir";

export function makeNewsSlug(title, id) {
  const base = String(title || "خبر")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u200C\u200D\u0640]/g, "")
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
  const suffix = String(id || "story").toLowerCase().replace(/[^a-z0-9]/g, "").slice(-8) || "story";
  return `${base || "خبر"}-${suffix}`;
}

export function newsArticleUrl(story) {
  if (!story?.slug) return "";
  return `${NEWS_PUBLIC_ORIGIN}/${encodeURIComponent(story.slug)}`;
}

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeHttps = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
};

const isoDate = (seconds) => new Date(Number(seconds || 0) * 1000).toISOString();
const faDate = (seconds) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric",
}).format(new Date(Number(seconds || 0) * 1000));
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function renderNewsArticle(story) {
  const canonical = newsArticleUrl(story);
  const title = String(story.title || "خبر ورزشی");
  const description = String(story.summary || story.article_body || "گزارش خبری MG FitClub").slice(0, 300);
  const image = safeHttps(story.image_url);
  const sourceUrl = safeHttps(story.source_url);
  const published = isoDate(story.published_at);
  const modified = isoDate(Math.max(Number(story.published_at || 0), Number(story.created_at || 0)));
  const body = String(story.article_body || story.summary || "").trim();
  const paragraphs = body.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
  const originalTitle = story.original_title && story.original_title !== title
    ? `<p class="original" dir="auto"><b>عنوان اصلی:</b> ${escapeHtml(story.original_title)}</p>` : "";
  const photo = image
    ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" fetchpriority="high"><figcaption>تصویر همراه گزارش؛ اعتبار منبع در بخش منابع آمده است.</figcaption></figure>`
    : `<div class="image-fallback" role="img" aria-label="تصویر برای این خبر ثبت نشده است">MG FitClub · خبر</div>`;
  const source = sourceUrl
    ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(story.source_name || "مشاهدهٔ گزارش اصلی")}</a><p>این صفحه، شرح و خلاصهٔ تحریریهٔ MG FitClub است؛ برای متن و جزئیات کامل گزارش به ناشر اصلی مراجعه کنید.</p>`
    : `<span>${escapeHtml(story.source_name || "MG FitClub")}</span>`;
  const structuredData = {
    "@context": "https://schema.org", "@type": "NewsArticle", headline: title, description,
    articleSection: story.category || "ورزش", articleBody: body, datePublished: published, dateModified: modified,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: "تحریریهٔ MG FitClub", url: "https://mgfitclub.ir/" },
    publisher: { "@type": "Organization", name: "MG FitClub", url: "https://mgfitclub.ir/" },
    ...(image ? { image: [image] } : {}),
  };
  return `<!doctype html>
<html lang="fa" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | MG FitClub</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article"><meta property="og:locale" content="fa_IR"><meta property="og:site_name" content="MG FitClub">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="article:published_time" content="${published}"><meta property="article:modified_time" content="${modified}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<script type="application/ld+json">${jsonForHtml(structuredData)}</script>
<style>
:root{color-scheme:dark;--bg:#07100d;--ink:#f1f7f2;--muted:#adbbb2;--lime:#c6ff3f;--line:#293c31}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 80% 0,#1b3023 0,transparent 45%),var(--bg);color:var(--ink);font-family:Tahoma,"Segoe UI",sans-serif;line-height:2}a{color:var(--lime);text-underline-offset:4px}.top{max-width:920px;margin:auto;padding:24px 22px}.brand{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:16px}.brand a{color:var(--ink);text-decoration:none}.brand span,.eyebrow{color:var(--lime)}main{max-width:820px;margin:34px auto;padding:0 20px 60px}.crumb,.date,.foot{color:var(--muted);font-size:.9rem}article{margin-top:20px;padding:clamp(22px,5vw,48px);background:#111d18;border:1px solid var(--line);border-radius:24px;box-shadow:0 24px 80px #0005}h1{font-size:clamp(1.7rem,4vw,2.55rem);line-height:1.65}figure{margin:24px 0 30px}figure img{display:block;width:100%;max-height:490px;object-fit:cover;border-radius:18px}figcaption{color:var(--muted);font-size:.8rem}.image-fallback{height:260px;display:grid;place-items:center;border-radius:18px;background:#101b16;color:var(--lime);font-size:1.3rem}.story p{font-size:1.08rem;margin:0 0 1.15em}.original{color:var(--muted);border-right:3px solid var(--lime);padding-right:14px}.sources{margin-top:34px;padding:20px;border:1px solid var(--line);border-radius:16px}.sources p{color:var(--muted);font-size:.88rem}.foot{text-align:center;margin-top:24px}@media(max-width:600px){main{margin-top:16px;padding:0 12px 36px}article{border-radius:18px}.story p{font-size:1rem}}
</style></head><body>
<header class="top"><div class="brand"><a href="https://mgfitclub.ir/news.html"><b>MG FITCLUB</b> · میز خبر</a><a href="https://mgfitclub.ir/news.html"><span>بازگشت به همهٔ خبرها ←</span></a></div></header>
<main><nav class="crumb" aria-label="مسیر راهنما"><a href="https://mgfitclub.ir/">صفحهٔ اصلی</a> / <a href="https://mgfitclub.ir/news.html">اخبار ورزشی</a> / <span>${escapeHtml(story.category || "خبر")}</span></nav>
<article><div class="eyebrow">${escapeHtml(story.category || "ورزش")}</div><h1>${escapeHtml(title)}</h1>
<time class="date" datetime="${published}">${escapeHtml(faDate(story.published_at))} · ${escapeHtml(story.source_name || "MG FitClub")}</time>
${photo}${originalTitle}<section class="story" aria-label="شرح خبر">${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>
<aside class="sources"><b>منبع و گزارش کامل</b><br>${source}</aside></article>
<p class="foot">خلاصه و شرح خبر به فارسی توسط تحریریهٔ MG FitClub تهیه شده است. برای جزئیات بیشتر، گزارش ناشر اصلی را ببینید.</p></main></body></html>`;
}

const xmlEscape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export function renderNewsSitemap(rows) {
  const urls = (rows || []).filter((row) => row.slug).map((row) => `  <url><loc>${xmlEscape(newsArticleUrl(row))}</loc><lastmod>${xmlEscape(isoDate(row.published_at ?? row.publishedAt).slice(0, 10))}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function renderNewsIndex(rows) {
  const cards = (rows || []).map((story) => `<article><a href="${escapeHtml(newsArticleUrl(story))}">${story.image_url ? `<img src="${escapeHtml(safeHttps(story.image_url))}" alt="" loading="lazy">` : ""}<div><small>${escapeHtml(story.category || "ورزش")} · ${escapeHtml(story.source_name || "MG FitClub")}</small><h2>${escapeHtml(story.title || "خبر ورزشی")}</h2><p>${escapeHtml(story.summary || "")}</p></div></a></article>`).join("\n");
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>آخرین اخبار ورزشی | MG FitClub</title><meta name="description" content="خبرهای ورزشی منتخب با خلاصهٔ فارسی و پیوند به منبع اصلی."><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${NEWS_PUBLIC_ORIGIN}/"><style>*{box-sizing:border-box}body{margin:0;background:#07100d;color:#f1f7f2;font:16px/1.9 Tahoma,"Segoe UI",sans-serif}header,main{max-width:980px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #293c31}header a{color:#c6ff3f;text-decoration:none}h1{font-size:clamp(1.8rem,5vw,3rem)}main>p{color:#adbbb2}section{display:grid;gap:16px}article{border:1px solid #293c31;border-radius:18px;background:#111d18;overflow:hidden}article>a{display:grid;grid-template-columns:minmax(130px,240px) 1fr;color:inherit;text-decoration:none}article img{width:100%;height:100%;min-height:170px;max-height:240px;object-fit:cover}article div{padding:18px}small{color:#c6ff3f}h2{font-size:1.25rem;margin:.3em 0}article p{color:#adbbb2;margin:0}@media(max-width:600px){header,main{padding:16px}article>a{grid-template-columns:1fr}article img{height:200px}}</style></head><body><header><a href="https://mgfitclub.ir/news.html">MG FITCLUB · میز خبر</a><span>خبرهای ورزشی</span></header><main><h1>آخرین اخبار ورزشی</h1><p>خلاصهٔ فارسی خبرها همراه با منبع اصلی؛ برای شرح هر خبر روی عنوان آن بزنید.</p><section>${cards || "<p>فعلاً خبری برای نمایش ثبت نشده است.</p>"}</section></main></body></html>`;
}
