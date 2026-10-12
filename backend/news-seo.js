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

export function renderNewsArticle(story, relatedRows = []) {
  const canonical = newsArticleUrl(story);
  const title = String(story.title || "خبر ورزشی");
  const description = String(story.summary || story.article_body || "گزارش خبری MG FitClub").slice(0, 300);
  const image = safeHttps(story.image_url);
  const sourceUrl = safeHttps(story.source_url);
  const published = isoDate(story.published_at);
  const modified = isoDate(Math.max(Number(story.published_at || 0), Number(story.created_at || 0)));
  const body = String(story.article_body || story.summary || "").trim();
  const blocks = body.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
  const contentHtml = blocks.map((block) => block.startsWith("## ")
    ? `<h2>${escapeHtml(block.slice(3))}</h2>`
    : `<p>${escapeHtml(block)}</p>`).join("");
  let sourceRefs = [];
  try { sourceRefs = JSON.parse(story.source_refs || "[]"); } catch { sourceRefs = []; }
  if (!Array.isArray(sourceRefs)) sourceRefs = [];
  const citations = sourceRefs.map((ref) => {
    const href = safeHttps(ref.url);
    return href ? `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title || ref.publisher || "منبع پژوهشی")}</a>${ref.published ? ` <time>${escapeHtml(ref.published)}</time>` : ""}${ref.publisher ? ` · ${escapeHtml(ref.publisher)}` : ""}</li>` : "";
  }).filter(Boolean).join("");
  let keywordList = [];
  try { keywordList = Array.isArray(story.keywords) ? story.keywords : JSON.parse(story.keywords || "[]"); } catch { keywordList = []; }
  const originalTitle = story.original_title && story.original_title !== title
    ? `<p class="original" dir="auto"><b>عنوان اصلی:</b> ${escapeHtml(story.original_title)}</p>` : "";
  const photo = image
    ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(story.image_alt || title)}" fetchpriority="high"><figcaption>تصویر اختصاصی تحریریهٔ MG FitClub</figcaption></figure>`
    : `<div class="image-fallback" role="img" aria-label="تصویر برای این خبر ثبت نشده است">MG FitClub · خبر</div>`;
  const source = citations
    ? `<ol>${citations}</ol><p>این مطلب، جمع‌بندی و توضیح تحریریهٔ MG FitClub بر پایهٔ منابع بالا است؛ برای تصمیم پزشکی یا برنامهٔ شخصی با متخصص مشورت کنید.</p>`
    : sourceUrl
    ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(story.source_name || "مشاهدهٔ گزارش اصلی")}</a><p>این صفحه، شرح و خلاصهٔ تحریریهٔ MG FitClub است؛ برای متن و جزئیات کامل گزارش به ناشر اصلی مراجعه کنید.</p>`
    : `<span>${escapeHtml(story.source_name || "MG FitClub")}</span>`;
  const structuredData = {
    "@context": "https://schema.org", "@type": story.schema_type || "NewsArticle", headline: title, description,
    articleSection: story.category || "ورزش", articleBody: body, datePublished: published, dateModified: modified,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: "تحریریهٔ MG FitClub", url: "https://mgfitclub.ir/" },
    publisher: { "@type": "Organization", name: "MG FitClub", url: "https://mgfitclub.ir/" },
    ...(keywordList.length ? { keywords: keywordList } : {}),
    ...(sourceRefs.length ? { citation: sourceRefs.map((ref) => safeHttps(ref.url)).filter(Boolean) } : {}),
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
<meta name="keywords" content="${escapeHtml(keywordList.join(", "))}"><meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<script type="application/ld+json">${jsonForHtml(structuredData)}</script>
<style>
:root{color-scheme:dark;--bg:#07100d;--ink:#f1f7f2;--muted:#adbbb2;--lime:#c6ff3f;--line:#293c31}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 80% 0,#1b3023 0,transparent 45%),var(--bg);color:var(--ink);font-family:Tahoma,"Segoe UI",sans-serif;line-height:2}a{color:var(--lime);text-underline-offset:4px}.top{max-width:920px;margin:auto;padding:24px 22px}.brand{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:16px}.brand a{color:var(--ink);text-decoration:none}.brand span,.eyebrow{color:var(--lime)}main{max-width:820px;margin:34px auto;padding:0 20px 60px}.crumb,.date,.foot{color:var(--muted);font-size:.9rem}article{margin-top:20px;padding:clamp(22px,5vw,48px);background:#111d18;border:1px solid var(--line);border-radius:24px;box-shadow:0 24px 80px #0005}h1{font-size:clamp(1.7rem,4vw,2.55rem);line-height:1.65}figure{margin:24px 0 30px}figure img{display:block;width:100%;max-height:490px;object-fit:cover;border-radius:18px}figcaption{color:var(--muted);font-size:.8rem}.image-fallback{height:260px;display:grid;place-items:center;border-radius:18px;background:#101b16;color:var(--lime);font-size:1.3rem}.story p{font-size:1.08rem;margin:0 0 1.15em}.story h2{margin:2em 0 .65em;color:var(--lime);font-size:1.35rem;line-height:1.6}.original{color:var(--muted);border-right:3px solid var(--lime);padding-right:14px}.related,.sources{margin-top:24px;padding:20px;border:1px solid var(--line);border-radius:16px}.related h2{margin:0 0 8px;font-size:1rem}.related ul{margin:0;padding-right:1.2rem}.related li{margin:6px 0}.related a{font-size:.92rem}.sources p{color:var(--muted);font-size:.88rem}.foot{text-align:center;margin-top:24px}@media(max-width:600px){main{margin-top:16px;padding:0 12px 36px}article{border-radius:18px}.story p{font-size:1rem}}
</style><link rel="stylesheet" href="https://mgfitclub.ir/mg-global-theme.css?v=20261012-studio-contrast" data-mg-global-theme="true"></head><body><script src="https://mgfitclub.ir/mg-global-theme.js?v=20261012-studio-contrast"></script>
<header class="top"><div class="brand"><a href="https://mgfitclub.ir/news.html"><b>MG FITCLUB</b> · میز خبر</a><a href="https://mgfitclub.ir/news.html"><span>بازگشت به همهٔ خبرها ←</span></a></div></header>
<main><nav class="crumb" aria-label="مسیر راهنما"><a href="https://mgfitclub.ir/">صفحهٔ اصلی</a> / <a href="https://mgfitclub.ir/news.html">اخبار ورزشی</a> / <span>${escapeHtml(story.category || "خبر")}</span></nav>
<article><div class="eyebrow">${escapeHtml(story.category || "ورزش")}</div><h1>${escapeHtml(title)}</h1>
<time class="date" datetime="${published}">${escapeHtml(faDate(story.published_at))} · ${escapeHtml(story.source_name || "MG FitClub")}</time>
${photo}${originalTitle}<section class="story" aria-label="شرح مطلب">${contentHtml}</section>
<aside class="related"><h2>مطالب مرتبط</h2>${relatedRows.length ? `<ul>${relatedRows.map((item) => `<li><a href="${escapeHtml(newsArticleUrl(item))}">${escapeHtml(item.title)}</a></li>`).join("")}</ul>` : `<a href="https://mgfitclub.ir/news.html">بازگشت به همهٔ راهنماها و خبرها</a>`}</aside>
<aside class="sources"><b>منبع و گزارش کامل</b><br>${source}</aside></article>
<p class="foot">خلاصه و شرح خبر به فارسی توسط تحریریهٔ MG FitClub تهیه شده است. برای جزئیات بیشتر، گزارش ناشر اصلی را ببینید.</p></main></body></html>`;
}

const xmlEscape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export function renderNewsSitemap(rows) {
  const urls = (rows || []).filter((row) => row.slug).map((row) => `  <url><loc>${xmlEscape(newsArticleUrl(row))}</loc><lastmod>${xmlEscape(isoDate(row.published_at ?? row.publishedAt).slice(0, 10))}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function renderNewsIndex(editorialRows = [], feedRows = []) {
  const card = (story, local = false) => `<article><a href="${escapeHtml(newsArticleUrl(story))}">${story.image_url ? `<img src="${escapeHtml(safeHttps(story.image_url))}" alt="${escapeHtml(story.image_alt || story.title || "")}" loading="lazy">` : ""}<div><small>${escapeHtml(story.category || "ورزش")} · ${escapeHtml(story.source_name || "MG FitClub")}</small><h3>${escapeHtml(story.title || "خبر ورزشی")}</h3><p>${escapeHtml(story.summary || "")}</p><span>${local ? "مقالهٔ تحریریه" : "خبر گردآوری‌شده · مشاهدهٔ منبع"}</span></div></a></article>`;
  const editorialCards = editorialRows.map((story) => card(story, true)).join("\n");
  const feedCards = feedRows.map((story) => card(story, false)).join("\n");
  const itemList = editorialRows.map((story, position) => ({ "@type": "ListItem", position: position + 1, url: newsArticleUrl(story), name: story.title }));
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: "راهنماهای ورزشی و اخبار MG FitClub", url: `${NEWS_PUBLIC_ORIGIN}/`, mainEntity: { "@id": `${NEWS_PUBLIC_ORIGIN}/#articles` } },
    { "@type": "ItemList", "@id": `${NEWS_PUBLIC_ORIGIN}/#articles`, itemListElement: itemList },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "صفحهٔ اصلی", item: "https://mgfitclub.ir/" }, { "@type": "ListItem", position: 2, name: "اخبار ورزشی", item: `${NEWS_PUBLIC_ORIGIN}/` }] },
  ] };
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>راهنماهای ورزش بانوان در شیراز و خبرهای ورزشی | MG FitClub</title><meta name="description" content="راهنماهای مستند پیلاتس، TRX و بدنسازی بانوان در شیراز از تحریریهٔ MG FitClub؛ فید خبرهای وب در بخشی جداگانه."><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${NEWS_PUBLIC_ORIGIN}/"><script type="application/ld+json">${jsonForHtml(schema)}</script><style>*{box-sizing:border-box}body{margin:0;background:#07100d;color:#f1f7f2;font:16px/1.9 Tahoma,"Segoe UI",sans-serif}header,main{max-width:1120px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #293c31}header a{color:#c6ff3f;text-decoration:none}h1{font-size:clamp(1.8rem,5vw,3rem)}main>p{color:#adbbb2}.news-section{margin:54px 0}.news-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.news-card{border:1px solid #293c31;border-radius:20px;background:#111d18;overflow:hidden}.news-card>a{display:grid;grid-template-columns:minmax(150px,240px) 1fr;min-height:190px;color:inherit;text-decoration:none}.news-card img{width:100%;height:100%;min-height:190px;max-height:260px;object-fit:cover}.news-card div{padding:18px}.news-card small{color:#c6ff3f}.news-card h3{font-size:1.12rem;line-height:1.7;margin:.4em 0}.news-card p{color:#adbbb2;margin:0 0 .8rem;font-size:.92rem}.news-card span{color:#c6ff3f;font-size:.8rem}.feed-section{border-top:1px solid #293c31;padding-top:34px;color:#bdc4bd}.empty{color:#adbbb2}@media(max-width:760px){header,main{padding:16px}.news-grid{grid-template-columns:1fr}.news-card>a{grid-template-columns:1fr}.news-card img{height:220px;min-height:0;max-height:240px}.news-card div{padding:16px}.news-section{margin:36px 0}}</style><link rel="stylesheet" href="https://mgfitclub.ir/mg-global-theme.css?v=20261012-studio-contrast" data-mg-global-theme="true"></head><body><script src="https://mgfitclub.ir/mg-global-theme.js?v=20261012-studio-contrast"></script><header><a href="https://mgfitclub.ir/news.html">MG FITCLUB · میز خبر</a><span>شیراز · سلامت و ورزش بانوان</span></header><main><h1>راهنمای تمرین و اخبار ورزشی بانوان</h1><p>تحریریهٔ MG FitClub، راهنماهای ورزشیِ مستند و متناسب با پرسش‌های ورزشکاران شیراز را جدا از فید خبرهای گردآوری‌شده منتشر می‌کند.</p><section class="news-section"><h2>مقاله‌های اختصاصی تحریریهٔ MG</h2><div class="news-grid">${editorialCards || "<p class='empty'>مقاله‌ای منتشر نشده است.</p>"}</div></section><section class="news-section feed-section"><h2>فید خبرهای وب</h2><p>این خبرها از ناشران بیرونی گردآوری شده‌اند؛ برای متن کامل به گزارش اصلی بروید.</p><div class="news-grid">${feedCards || "<p class='empty'>خبر گردآوری‌شده‌ای موجود نیست.</p>"}</div></section></main></body></html>`;
}
