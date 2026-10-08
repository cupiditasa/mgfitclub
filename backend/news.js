import { makeNewsSlug, newsArticleUrl, renderNewsArticle, renderNewsIndex, renderNewsSitemap, NEWS_PUBLIC_ORIGIN } from "./news-seo.js";

const HOUR = 3600;
const META_SCOPES = "instagram_business_basic,instagram_business_content_publish";
const encodeBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decodeBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const bytesToHex = (bytes) => [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
const randomState = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
};
const integrationConfigured = (env) => Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_INSTAGRAM_REDIRECT_URI && env.NEWS_TOKEN_ENCRYPTION_KEY && /^v\d+\.\d+$/.test(env.META_GRAPH_API_VERSION || ""));
const graphBase = (env) => `https://graph.instagram.com/${env.META_GRAPH_API_VERSION}`;
async function encryptToken(env, token) {
  const keyBytes = decodeBase64(env.NEWS_TOKEN_ENCRYPTION_KEY);
  if (keyBytes.length !== 32) throw new Error("invalid_token_encryption_key");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return { tokenCiphertext: encodeBase64(ciphertext), tokenIv: encodeBase64(iv) };
}
async function decryptToken(env, row) {
  const keyBytes = decodeBase64(env.NEWS_TOKEN_ENCRYPTION_KEY);
  if (keyBytes.length !== 32) throw new Error("invalid_token_encryption_key");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(row.token_iv) }, key, decodeBase64(row.token_ciphertext));
  return new TextDecoder().decode(plain);
}
async function tokenHash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}
async function instagramJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(`instagram_http_${response.status}_${data.error?.code || "error"}`);
  return data;
}
function supportOnly(user, hasRole) {
  return Boolean(user && user.status === "active" && user.access_state === "approved" && hasRole(user, "support"));
}
function redirectAfterInstagram(request, env, outcome) {
  const configuredOrigin = env.PUBLIC_SITE_ORIGIN || "https://mgfitclub.ir";
  let origin = "https://mgfitclub.ir";
  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol === "https:" && (parsed.hostname === "mgfitclub.ir" || parsed.hostname.endsWith(".mgfitclub.ir"))) origin = parsed.origin;
  } catch {}
  return Response.redirect(`${origin}/support.html?instagram=${encodeURIComponent(outcome)}#news`, 302);
}
const SOURCES = [
  { key: "varzesh3", name: "ورزش سه", category: "ورزش", host: "varzesh3.com", url: "https://www.varzesh3.com/rss/all" },
  { key: "mehr", name: "مهر", category: "ورزش", host: "mehrnews.com", url: "https://www.mehrnews.com/rss/tp/9" },
  { key: "irna", name: "ایرنا", category: "ورزش", host: "irna.ir", url: "https://www.irna.ir/rss/tp/14" },
  { key: "isna", name: "ایسنا", category: "ورزش", host: "isna.ir", url: "https://www.isna.ir/rss/tp/14" },
  { key: "tasnim-sports", name: "تسنیم", category: "ورزش", host: "tasnimnews.ir", url: "https://www.tasnimnews.ir/fa/rss/feeds/3/0/0/0" },
  { key: "tasnim-women", name: "تسنیم", category: "بانوان", host: "tasnimnews.ir", url: "https://www.tasnimnews.ir/fa/rss/feeds/32/0/0/0" },
  { key: "women-fitness", name: "منابع بین‌المللی", category: "ورزش", host: "news.google.com", url: "https://news.google.com/rss/search?q=women%27s+sports+OR+women%27s+fitness+OR+female+athlete+-politics+-election+-locker-room+when%3A2d&hl=en-US&gl=US&ceid=US%3Aen" },
];

const cleanText = (value) => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ""; } })
  .replace(/&#x([\da-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; } })
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/\s+/g, " ").replace(/\s+([,.;!?،؛:])/g, "$1").trim();
const tag = (xml, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(xml || "").match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i"))?.[1] || "";
};
const attr = (xml, name) => String(xml || "").match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] || "";
const classify = (text, fallback) => {
  const value = String(text || "").toLowerCase();
  if (/trx/.test(value)) return "TRX";
  if (/پیلاتس|pilates/.test(value)) return "پیلاتس";
  if (/بدنساز|bodybuild|weightlift|strength training/.test(value)) return "بدنسازی";
  if (/بانوان|زنان|زنانه|women|female athlete/.test(value)) return "بانوان";
  if (/fitness|فیتنس|workout|تمرین|nutrition|تغذیه/.test(value)) return "فیتنس";
  return fallback;
};
function safeHttps(value, allowedHost) {
  try {
    const url = new URL(cleanText(value));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "";
    if (allowedHost && allowedHost !== "news.google.com" && host !== allowedHost && !host.endsWith(`.${allowedHost}`)) return "";
    return url.href;
  } catch { return ""; }
}

export function parseNewsFeed(xml, source, now = Date.now()) {
  const blocks = [...String(xml || "").matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
  const items = [];
  for (const [, kind, block] of blocks) {
    const atom = kind.toLowerCase() === "entry";
    const linkTag = block.match(/<link\b[^>]*\/?\s*>/i)?.[0] || "";
    const sourceUrl = safeHttps(atom ? attr(linkTag, "href") : tag(block, "link"), source.host === "news.google.com" ? null : source.host);
    const title = cleanText(tag(block, "title"));
    const summary = cleanText(tag(block, "content:encoded") || tag(block, "summary") || tag(block, "description"));
    if (!sourceUrl || !title || title.length > 400 || !summary) continue;
    const imageTag = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/i)?.[0] || "";
    const imageUrl = safeHttps(attr(imageTag, "url"), source.host === "news.google.com" ? null : source.host);
    let publishedText = cleanText(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"));
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(publishedText)) publishedText += "Z";
    const published = Date.parse(publishedText);
    const publishedAt = Number.isFinite(published) ? Math.floor(published / 1000) : Math.floor(now / 1000);
    const nowSeconds = Math.floor(now / 1000);
    if (publishedAt > nowSeconds + 300 || publishedAt < nowSeconds - 3 * 86400) continue;
    items.push({ sourceUrl, sourceName: cleanText(tag(block, "source")) || source.name, sourceKey: source.key, category: classify(`${title} ${summary}`, source.category), title, summary: summary.slice(0, 6000), imageUrl, publishedAt });
  }
  return items;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, redirect: "follow",
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9", "accept-language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7", "user-agent": "MGFitClubNewsBot/1.0 (+https://mgfitclub.ir/news.html)" },
    });
    if (!response.ok) throw new Error(`feed_http_${response.status}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

function feedErrorCode(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "timeout";
  const detail = error?.cause?.code || error?.cause?.name || "";
  const message = `${error?.name || ""}_${error?.message || error || "unknown_error"}_${detail}`.replace(/https?:\/\/\S+/g, "url").replace(/[^a-zA-Z0-9_.:-]/g, "_");
  return message.slice(0, 90) || "unknown_error";
}

export async function translateBatch(env, strings) {
  const indexes = [], source = [];
  strings.forEach((value, index) => { if (value && !/[\u0600-\u06ff]/.test(value)) { indexes.push(index); source.push(value); } });
  if (!source.length) return strings;
  if (typeof env.AI?.run !== "function") throw new Error("translation_not_configured");
  const results = new Array(source.length);
  let cursor = 0;
  const translateWorker = async () => {
    while (cursor < source.length) {
      const index = cursor++;
      const result = await env.AI.run("@cf/meta/m2m100-1.2b", {
        text: source[index].slice(0, 1200), source_lang: "en", target_lang: "fa",
      });
      results[index] = cleanText(result?.translated_text);
      if (!results[index]) throw new Error("translation_incomplete");
    }
  };
  const outcomes = await Promise.allSettled(Array.from({ length: Math.min(4, source.length) }, translateWorker));
  const failed = outcomes.find((outcome) => outcome.status === "rejected");
  if (failed) throw failed.reason;
  const translated = [...strings];
  indexes.forEach((index, i) => { translated[index] = results[i]; });
  return translated;
}

async function storyId(url) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)));
  return [...digest.slice(0, 16)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export async function runNewsUpdate(env, { force = false } = {}) {
  const db = env.DB;
  const settings = await db.prepare("SELECT * FROM news_settings WHERE id='global'").first();
  if (!settings?.enabled && !force) return { skipped: true, reason: "disabled" };
  const current = Math.floor(Date.now() / 1000);
  if (!force && settings.last_sync_at && current - settings.last_sync_at < settings.interval_hours * HOUR) return { skipped: true, reason: "not_due" };
  const feeds = await Promise.all(SOURCES.map(async (source) => {
    try { return { source, items: parseNewsFeed(await fetchText(source.url), source), error: null }; }
    catch (error) { return { source, items: [], error: feedErrorCode(error) }; }
  }));
  const dedup = new Map();
  for (const feed of feeds) for (const item of feed.items) dedup.set(item.sourceUrl, item);
  const sourceFailures = feeds.filter((feed) => feed.error).map((feed) => ({ source: feed.source.key, error: feed.error }));
  const sourceCount = feeds.length - sourceFailures.length;
  if (sourceFailures.length) {
    const log = JSON.stringify({ sourcesOk: sourceCount, failed: sourceFailures });
    if (sourceCount) console.warn("[news] some RSS sources failed", log);
    else console.error("[news] all RSS sources failed", log);
  }
  const candidates = [...dedup.values()].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 80);
  let inserted = 0, translateFailures = 0;
  for (let offset = 0; offset < candidates.length; offset += 16) {
    const batch = candidates.slice(offset, offset + 16);
    let translated;
    try { translated = await translateBatch(env, batch.flatMap((item) => [item.title, item.summary])); }
    catch (error) {
      translated = batch.flatMap((item) => [item.title, item.summary].map((value) => {
        if (/[\u0600-\u06ff]/.test(value)) return value;
        translateFailures++;
        return "";
      }));
      if (error.message !== "translation_not_configured") console.warn("[news] translation batch failed", error.message);
    }
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i], title = translated[i * 2], summary = translated[i * 2 + 1];
      if (!title || !summary) continue;
      const id = await storyId(item.sourceUrl);
      const slug = makeNewsSlug(title.slice(0, 400), id);
      const result = await db.prepare("INSERT OR IGNORE INTO news_items (id,source_url,source_key,source_name,category,title,original_title,summary,original_summary,image_url,published_at,created_at,instagram_status,slug,article_body) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id, item.sourceUrl, item.sourceKey, item.sourceName, item.category, title.slice(0, 400), item.title, summary.slice(0, 900), item.summary, item.imageUrl, item.publishedAt, current, settings?.instagram_auto_publish ? "pending" : "disabled", slug, summary.slice(0, 6000)).run();
      inserted += Number(result.meta?.changes || 0);
    }
  }
  const status = sourceCount ? "ok" : "source_error";
  const sourceErrorSummary = sourceFailures.length ? `${status}:${JSON.stringify(sourceFailures)}`.slice(0, 900) : null;
  const errorSummary = [sourceErrorSummary, translateFailures ? `translation_skipped:${translateFailures}` : null].filter(Boolean).join(";").slice(0, 1000) || null;
  await db.prepare("UPDATE news_settings SET last_sync_at=?,last_sync_status=?,last_sync_error=?,updated_at=? WHERE id='global'").bind(current, status, errorSummary, current).run();
  return { inserted, scanned: candidates.length, sourcesOk: sourceCount, sourceFailures, translationSkipped: translateFailures };
}

async function getInstagramToken(env, connection) {
  let accessToken = await decryptToken(env, connection);
  let expiresAt = Number(connection.expires_at);
  if (expiresAt <= Math.floor(Date.now() / 1000) + 14 * 86400) {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);
    const refreshed = await instagramJson(url);
    if (!refreshed.access_token || !Number(refreshed.expires_in)) throw new Error("instagram_refresh_incomplete");
    accessToken = refreshed.access_token;
    expiresAt = Math.floor(Date.now() / 1000) + Number(refreshed.expires_in);
    const encrypted = await encryptToken(env, accessToken);
    await env.DB.prepare("UPDATE news_instagram_connections SET token_ciphertext=?,token_iv=?,expires_at=?,updated_at=? WHERE id='global'")
      .bind(encrypted.tokenCiphertext, encrypted.tokenIv, expiresAt, Math.floor(Date.now() / 1000)).run();
  }
  return accessToken;
}

async function publishPendingInstagram(env) {
  const settings = await env.DB.prepare("SELECT instagram_auto_publish,instagram_rights_confirmed FROM news_settings WHERE id='global'").first();
  if (!settings?.instagram_auto_publish || !settings.instagram_rights_confirmed || !integrationConfigured(env)) return { published: 0, skipped: true };
  const connection = await env.DB.prepare("SELECT * FROM news_instagram_connections WHERE id='global'").first();
  if (!connection || connection.expires_at <= Math.floor(Date.now() / 1000)) return { published: 0, skipped: true, reason: "instagram_not_connected" };
  let accessToken;
  try { accessToken = await getInstagramToken(env, connection); }
  catch (error) {
    console.warn("[news] Instagram token refresh failed", error.message);
    return { published: 0, skipped: true, reason: "instagram_token_refresh_failed" };
  }
  const rows = (await env.DB.prepare("SELECT id,title,summary,source_name,source_url,image_url FROM news_items WHERE instagram_status='pending' AND created_at>=? ORDER BY published_at DESC LIMIT 5")
    .bind(Math.floor(Date.now() / 1000) - 2 * 86400).all()).results || [];
  let published = 0;
  for (const story of rows) {
    const claim = await env.DB.prepare("UPDATE news_items SET instagram_status='publishing',instagram_error=NULL WHERE id=? AND instagram_status='pending'").bind(story.id).run();
    if (Number(claim.meta?.changes || 0) !== 1) continue;
    try {
      const imageUrl = safeHttps(story.image_url);
      if (!imageUrl) throw new Error("image_missing_or_unsafe");
      const caption = `${story.title}\n\n${story.summary}\n\nمنبع: ${story.source_name}\n${story.source_url}\n\n#MGFitClub #اخبار_ورزشی`.slice(0, 2200);
      const create = await instagramJson(`${graphBase(env)}/${encodeURIComponent(connection.ig_user_id)}/media`, {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ image_url: imageUrl, caption, access_token: accessToken }),
      });
      if (!create.id) throw new Error("instagram_container_missing");
      const publish = await instagramJson(`${graphBase(env)}/${encodeURIComponent(connection.ig_user_id)}/media_publish`, {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ creation_id: create.id, access_token: accessToken }),
      });
      if (!publish.id) throw new Error("instagram_media_missing");
      await env.DB.prepare("UPDATE news_items SET instagram_status='published',instagram_media_id=?,instagram_error=NULL WHERE id=? AND instagram_status='publishing'").bind(String(publish.id), story.id).run();
      published++;
    } catch (error) {
      const code = String(error.message || "instagram_publish_failed").slice(0, 120);
      await env.DB.prepare("UPDATE news_items SET instagram_status='failed',instagram_error=? WHERE id=? AND instagram_status='publishing'").bind(code, story.id).run();
      console.warn("[news] Instagram publish failed", story.id, code);
    }
  }
  return { published };
}

async function handleInstagramCallback(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.has("error")) return redirectAfterInstagram(request, env, "denied");
  const code = url.searchParams.get("code") || "", state = url.searchParams.get("state") || "";
  if (!code || !state || !integrationConfigured(env)) return redirectAfterInstagram(request, env, "error");
  const stateHash = await tokenHash(state);
  const saved = await env.DB.prepare("SELECT user_id,expires_at FROM news_instagram_oauth_states WHERE state_hash=?").bind(stateHash).first();
  await env.DB.prepare("DELETE FROM news_instagram_oauth_states WHERE state_hash=?").bind(stateHash).run();
  if (!saved || saved.expires_at < Math.floor(Date.now() / 1000)) return redirectAfterInstagram(request, env, "state_expired");
  const actor = await env.DB.prepare("SELECT u.status,COALESCE(a.role,ur.role,u.role) AS role,COALESCE(a.state,CASE WHEN COALESCE(ur.role,u.role)='athlete' THEN 'approved' ELSE 'pending' END) AS access_state FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN account_access a ON a.user_id=u.id WHERE u.id=?")
    .bind(saved.user_id).first();
  if (!actor || actor.status !== "active" || actor.role !== "support" || actor.access_state !== "approved") return redirectAfterInstagram(request, env, "unauthorized");
  try {
    const shortToken = await instagramJson("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, grant_type: "authorization_code", redirect_uri: env.META_INSTAGRAM_REDIRECT_URI, code }),
    });
    if (!shortToken.access_token) throw new Error("instagram_short_token_missing");
    const exchange = new URL("https://graph.instagram.com/access_token");
    exchange.searchParams.set("grant_type", "ig_exchange_token");
    exchange.searchParams.set("client_secret", env.META_APP_SECRET);
    exchange.searchParams.set("access_token", shortToken.access_token);
    const longToken = await instagramJson(exchange);
    const accessToken = longToken.access_token;
    const expiresIn = Number(longToken.expires_in);
    if (!accessToken || !expiresIn) throw new Error("instagram_long_token_missing");
    const profileUrl = new URL(`${graphBase(env)}/me`);
    profileUrl.searchParams.set("fields", "user_id,username");
    profileUrl.searchParams.set("access_token", accessToken);
    const profile = await instagramJson(profileUrl);
    const userId = String(profile.user_id || profile.id || shortToken.user_id || "");
    if (!userId || !profile.username) throw new Error("instagram_profile_incomplete");
    const encrypted = await encryptToken(env, accessToken), now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO news_instagram_connections (id,ig_user_id,username,token_ciphertext,token_iv,expires_at,updated_at) VALUES ('global',?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ig_user_id=excluded.ig_user_id,username=excluded.username,token_ciphertext=excluded.token_ciphertext,token_iv=excluded.token_iv,expires_at=excluded.expires_at,updated_at=excluded.updated_at")
      .bind(userId, String(profile.username).slice(0, 100), encrypted.tokenCiphertext, encrypted.tokenIv, now + expiresIn, now).run();
    await env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'news','global',?)")
      .bind(`audit_${crypto.randomUUID()}`, saved.user_id, "news_instagram_connected", JSON.stringify({ username: String(profile.username).slice(0, 100) })).run();
    return redirectAfterInstagram(request, env, "connected");
  } catch (error) {
    console.warn("[news] Instagram OAuth callback failed", String(error.message || "oauth_error").slice(0, 120));
    return redirectAfterInstagram(request, env, "error");
  }
}

export async function handleNews(request, env, c) {
  const { path, headers, currentUser, hasRole, jsonBody, response, errorResponse, makeId } = c;
  if (path === "/api/support/news/instagram/callback" && request.method === "GET") return handleInstagramCallback(request, env);
  if (path === "/api/news" && request.method === "GET") {
    const rows = (await env.DB.prepare("SELECT id,slug,title,summary,source_name AS source,source_url AS sourceUrl,image_url AS image,category,published_at AS publishedAt,original_title AS originalTitle FROM news_items WHERE published_at>=? ORDER BY published_at DESC,id DESC LIMIT 60").bind(Math.floor(Date.now() / 1000) - 7 * 86400).all()).results
      .map((row) => {
        const slug = row.slug || makeNewsSlug(row.title, row.id);
        return { ...row, slug, publishedAt: row.publishedAt * 1000, articleUrl: newsArticleUrl({ slug }), href: row.sourceUrl };
      });
    const settings = await env.DB.prepare("SELECT last_sync_at,last_sync_status,interval_hours FROM news_settings WHERE id='global'").first();
    const block = 4 * HOUR * 1000, end = Math.floor(Date.now() / block + 1) * block;
    const dueAt = settings?.last_sync_at ? (settings.last_sync_at + Number(settings.interval_hours || 4) * HOUR) * 1000 : Date.now();
    const nextSync = Math.ceil(dueAt / (HOUR * 1000)) * HOUR * 1000;
    const timeWindow = { startUtc: end - block, endUtc: end, nextUtc: nextSync, startHour: new Date(end - block).getUTCHours() };
    return response({ featured: rows[0] || null, stories: rows.slice(1), highlights: { week: [], month: [], quarter: [], year: [] }, archive: [], window: timeWindow, generatedAt: settings?.last_sync_at ? settings.last_sync_at * 1000 : null, live: settings?.last_sync_status === "ok" }, 200, headers);
  }
  if (!path.startsWith("/api/support/news/")) return null;
  const user = await currentUser(request, env);
  if (!user) return errorResponse("unauthorized", 401, headers);
  if (!supportOnly(user, hasRole)) return errorResponse("forbidden", 403, headers);
  if (path === "/api/support/news/settings" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM news_settings WHERE id='global'").first();
    const connection = await env.DB.prepare("SELECT username,expires_at FROM news_instagram_connections WHERE id='global'").first();
    const connected = Boolean(connection && connection.expires_at > Math.floor(Date.now() / 1000));
    return response({ settings: { enabled: !!row.enabled, intervalHours: row.interval_hours, instagramAutoPublish: !!row.instagram_auto_publish, instagramRightsConfirmed: !!row.instagram_rights_confirmed, lastSyncAt: row.last_sync_at, lastSyncStatus: row.last_sync_status, lastSyncError: row.last_sync_error }, instagram: { configured: integrationConfigured(env), canConnect: integrationConfigured(env), connected, username: connected ? connection.username : null, expiresAt: connected ? connection.expires_at : null }, translation: { configured: typeof env.AI?.run === "function", provider: "cloudflare-workers-ai" } }, 200, headers);
  }
  if (path === "/api/support/news/settings" && request.method === "PATCH") {
    const body = await jsonBody(request, 2048), intervalHours = Number(body.intervalHours);
    if (typeof body.enabled !== "boolean" || typeof body.instagramAutoPublish !== "boolean" || typeof body.instagramRightsConfirmed !== "boolean" || ![2, 3, 4, 6, 12].includes(intervalHours)) return errorResponse("invalid_news_settings", 400, headers);
    if (body.instagramAutoPublish) {
      const connected = await env.DB.prepare("SELECT expires_at FROM news_instagram_connections WHERE id='global'").first();
      if (!body.instagramRightsConfirmed) return errorResponse("instagram_image_rights_confirmation_required", 400, headers);
      if (!connected || connected.expires_at <= Math.floor(Date.now() / 1000)) return errorResponse("instagram_not_connected", 409, headers);
      if (!integrationConfigured(env)) return errorResponse("instagram_not_configured", 409, headers);
    }
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE news_settings SET enabled=?,interval_hours=?,instagram_auto_publish=?,instagram_rights_confirmed=?,updated_at=? WHERE id='global'").bind(+body.enabled, intervalHours, +body.instagramAutoPublish, +body.instagramRightsConfirmed, now).run();
    await env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'news','global',?)").bind(makeId("audit"), user.id, "news_settings_updated", JSON.stringify({ enabled: body.enabled, intervalHours, instagramAutoPublish: body.instagramAutoPublish, instagramRightsConfirmed: body.instagramRightsConfirmed })).run();
    return response({ ok: true }, 200, headers);
  }
  if (path === "/api/support/news/instagram/connect" && request.method === "POST") {
    if (!integrationConfigured(env)) return errorResponse("instagram_not_configured", 409, headers);
    const state = randomState(), stateHash = await tokenHash(state), now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("DELETE FROM news_instagram_oauth_states WHERE expires_at<?").bind(now).run();
    await env.DB.prepare("INSERT INTO news_instagram_oauth_states(state_hash,user_id,expires_at) VALUES (?,?,?)").bind(stateHash, user.id, now + 600).run();
    const authorize = new URL("https://www.instagram.com/oauth/authorize");
    authorize.searchParams.set("client_id", env.META_APP_ID);
    authorize.searchParams.set("redirect_uri", env.META_INSTAGRAM_REDIRECT_URI);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", META_SCOPES);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("enable_fb_login", "0");
    authorize.searchParams.set("force_authentication", "1");
    return response({ url: authorize.toString() }, 200, headers);
  }
  if (path === "/api/support/news/instagram/disconnect" && request.method === "POST") {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("DELETE FROM news_instagram_connections WHERE id='global'").run();
    await env.DB.prepare("UPDATE news_settings SET instagram_auto_publish=0,updated_at=? WHERE id='global'").bind(now).run();
    await env.DB.prepare("UPDATE news_items SET instagram_status='disabled' WHERE instagram_status='pending'").run();
    await env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'news','global','{}')").bind(makeId("audit"), user.id, "news_instagram_disconnected").run();
    return response({ ok: true }, 200, headers);
  }
  if (path === "/api/support/news/sync" && request.method === "POST") {
    const result = await runNewsUpdate(env, { force: true });
    const instagram = await publishPendingInstagram(env);
    await env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,'news','global',?)").bind(makeId("audit"), user.id, "news_sync_requested", JSON.stringify(result)).run();
    return response({ ok: true, ...result, instagram }, 200, headers);
  }
  return errorResponse("method_not_allowed", 405, headers);
}

export async function handleNewsSiteRequest(request, env) {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== new URL(NEWS_PUBLIC_ORIGIN).hostname || request.method !== "GET") return null;
  const headers = { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };
  if (url.pathname === "/robots.txt") return new Response(`User-agent: *\nAllow: /\nSitemap: ${NEWS_PUBLIC_ORIGIN}/sitemap.xml\n`, { headers: { ...headers, "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
  if (url.pathname === "/sitemap.xml") {
    const rows = (await env.DB.prepare("SELECT slug,published_at AS publishedAt FROM news_items WHERE slug<>'' ORDER BY published_at DESC LIMIT 5000").all()).results || [];
    return new Response(renderNewsSitemap(rows), { headers: { ...headers, "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
  }
  if (url.pathname === "/" || url.pathname === "") {
    const rows = (await env.DB.prepare("SELECT slug,title,summary,source_name,image_url,category,published_at FROM news_items ORDER BY published_at DESC,id DESC LIMIT 60").all()).results || [];
    return new Response(renderNewsIndex(rows), { headers: { ...headers, "cache-control": "public, max-age=300, stale-while-revalidate=3600" } });
  }
  let slug;
  try { slug = decodeURIComponent(url.pathname.slice(1)); } catch { slug = ""; }
  if (!slug || slug.includes("/") || slug.length > 180) return new Response("Not found", { status: 404, headers: { ...headers, "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
  const story = await env.DB.prepare("SELECT slug,title,summary,article_body AS article_body,source_name,source_url,image_url,category,original_title,published_at,created_at FROM news_items WHERE slug=? LIMIT 1").bind(slug).first();
  if (!story) return new Response("Not found", { status: 404, headers: { ...headers, "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
  return new Response(renderNewsArticle(story), { headers: { ...headers, "cache-control": "public, max-age=300, stale-while-revalidate=3600" } });
}

export async function handleNewsScheduled(_controller, env, context) {
  const settings = await env.DB.prepare("SELECT enabled FROM news_settings WHERE id='global'").first();
  if (settings?.enabled) context.waitUntil((async () => {
    await runNewsUpdate(env);
    await publishPendingInstagram(env);
  })());
}
