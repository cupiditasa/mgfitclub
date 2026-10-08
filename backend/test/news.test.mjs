import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleNews, handleNewsSiteRequest, parseNewsFeed, translateBatch } from '../news.js';
import { makeNewsSlug, renderNewsArticle, renderNewsSitemap } from '../news-seo.js';

const source = { key: 'test', name: 'Test feed', category: 'fitness', host: 'news.example', url: 'https://news.example/rss' };
const now = Date.parse('2026-10-06T12:00:00Z');

test('news translations use the Cloudflare AI binding and preserve Persian source strings', async () => {
  const calls = [];
  const result = await translateBatch({ AI: { async run(model, input) {
    calls.push({ model, input });
    return { translated_text: `ترجمهٔ ${input.text}` };
  } } }, ['Strength update', 'خبر فارسی']);
  assert.deepEqual(result, ['ترجمهٔ Strength update', 'خبر فارسی']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, '@cf/meta/m2m100-1.2b');
  assert.equal(calls[0].input.source_lang, 'en');
  assert.equal(calls[0].input.target_lang, 'fa');
});

test('news translation reports an unconfigured binding only when translation is needed', async () => {
  assert.deepEqual(await translateBatch({}, ['خبر فارسی']), ['خبر فارسی']);
  await assert.rejects(() => translateBatch({}, ['English title']), /translation_not_configured/);
});

test('news article slugs are readable, stable, and unique per row', () => {
  const first = makeNewsSlug('تمرین بانوان: قدرت و سلامت', 'seednews_12345678');
  assert.match(first, /^تمرین-بانوان-قدرت-و-سلامت-[a-f0-9]{8}$/);
  assert.notEqual(first, makeNewsSlug('تمرین بانوان: قدرت و سلامت', 'seednews_abcdefgh'));
});

test('news article HTML includes canonical, source attribution, and NewsArticle metadata safely', () => {
  const html = renderNewsArticle({
    slug: 'خبر-12345678', title: 'خبر <تست>', summary: 'خلاصه', article_body: 'بند اول\n\nبند دوم',
    source_name: 'ناشر', source_url: 'https://example.com/story', image_url: 'https://example.com/image.jpg',
    category: 'ورزش', original_title: 'Original', published_at: 1791284400, created_at: 1791284401,
  });
  assert.match(html, /rel="canonical" href="https:\/\/khabar\.mgfitclub\.ir\/%D8%AE%D8%A8%D8%B1-12345678"/);
  assert.match(html, /<h1>خبر &lt;تست&gt;<\/h1>/);
  assert.match(html, /https:\/\/example\.com\/story/);
  assert.match(html, /"@type":"NewsArticle"/);
  assert.equal((html.match(/<p>بند /g) || []).length, 2);
  assert.doesNotMatch(html, /<h1>خبر <تست><\/h1>/);
});

test('news sitemap contains canonical article links', () => {
  const sitemap = renderNewsSitemap([{ slug: 'خبر-1', published_at: 1791284400 }]);
  assert.match(sitemap, /https:\/\/khabar\.mgfitclub\.ir\/%D8%AE%D8%A8%D8%B1-1/);
  assert.match(sitemap, /<lastmod>2026-10-06<\/lastmod>/);
});

test('news subdomain renders index, story, robots and sitemap from D1; unknown slugs are 404', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['schema.sql', 'migrations/001-runtime.sql', 'migrations/013-news.sql', 'migrations/014-news-instagram.sql', 'migrations/015-news-article-pages.sql']) {
    sql.exec(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  sql.prepare("INSERT INTO news_items (id,source_url,source_key,source_name,category,title,original_title,summary,original_summary,image_url,published_at,created_at,instagram_status,slug,article_body) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run('test_news_12345678', 'https://example.com/story', 'test', 'Example News', 'ورزش', 'عنوان آزمایشی', 'Original title', 'خلاصهٔ آزمایشی', 'Source summary', 'https://example.com/image.jpg', 1791284400, 1791284400, 'disabled', 'عنوان-آزمایشی-12345678', 'شرح کامل خبر.');
  const DB = { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, first() { return sql.prepare(query).get(...args) || null; }, all() { return { results: sql.prepare(query).all(...args) }; } }; } };
  const env = { DB };
  const index = await handleNewsSiteRequest(new Request('https://khabar.mgfitclub.ir/'), env);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /عنوان آزمایشی/);
  const story = await handleNewsSiteRequest(new Request('https://khabar.mgfitclub.ir/عنوان-آزمایشی-12345678'), env);
  assert.equal(story.status, 200);
  assert.match(story.headers.get('content-type'), /text\/html/);
  assert.match(await story.text(), /شرح کامل خبر/);
  const sitemap = await handleNewsSiteRequest(new Request('https://khabar.mgfitclub.ir/sitemap.xml'), env);
  assert.match(await sitemap.text(), /%D8%B9%D9%86%D9%88%D8%A7%D9%86-%D8%A2%D8%B2%D9%85%D8%A7%DB%8C%D8%B4%DB%8C-12345678/);
  const robots = await handleNewsSiteRequest(new Request('https://khabar.mgfitclub.ir/robots.txt'), env);
  assert.match(await robots.text(), /Sitemap: https:\/\/khabar\.mgfitclub\.ir\/sitemap\.xml/);
  const missing = await handleNewsSiteRequest(new Request('https://khabar.mgfitclub.ir/not-here'), env);
  assert.equal(missing.status, 404);
  sql.close();
});

test('RSS parser keeps short text, source link, image and original publisher timestamp', () => {
  const xml = `<rss><channel><item><title>Strength update</title><link>https://news.example/story/1</link><description><![CDATA[<p>Short <b>summary</b>.</p>]]></description><pubDate>Tue, 06 Oct 2026 11:00:00 GMT</pubDate><enclosure url="https://news.example/images/1.jpg" type="image/jpeg"/></item></channel></rss>`;
  const [item] = parseNewsFeed(xml, source, now);
  assert.equal(item.title, 'Strength update');
  assert.equal(item.summary, 'Short summary.');
  assert.equal(item.sourceUrl, 'https://news.example/story/1');
  assert.equal(item.imageUrl, 'https://news.example/images/1.jpg');
  assert.equal(item.publishedAt, Math.floor(Date.parse('2026-10-06T11:00:00Z') / 1000));
});

test('Atom links and publisher name parse; unsafe URL schemes are ignored', () => {
  const xml = `<feed><entry><title>Training</title><link rel="alternate" href="https://news.example/story/2"/><summary>Summary</summary><source>Example Sports</source><updated>2026-10-06T10:00:00Z</updated></entry><entry><title>Bad</title><link href="javascript:alert(1)"/><summary>Bad</summary></entry></feed>`;
  const [item] = parseNewsFeed(xml, source, now);
  assert.equal(item.sourceName, 'Example Sports');
  assert.equal(item.sourceUrl, 'https://news.example/story/2');
});

test('RSS dates without a timezone are treated consistently as UTC', () => {
  const nearNow = Date.parse('2026-10-06T22:31:00Z');
  const xml = `<rss><item><title>Current</title><link>https://news.example/current</link><description>Summary</description><pubDate>2026-10-06T22:30:00</pubDate></item></rss>`;
  const [item] = parseNewsFeed(xml, source, nearNow);
  assert.equal(item.publishedAt, Math.floor(Date.parse('2026-10-06T22:30:00Z') / 1000));
});

test('old feed entries and links to unrelated hosts are not retained', () => {
  const xml = `<rss><item><title>Old</title><link>https://news.example/old</link><description>Summary</description><pubDate>Fri, 01 Jan 2021 00:00:00 GMT</pubDate></item><item><title>Offsite</title><link>https://evil.example/story</link><description>Summary</description></item></rss>`;
  assert.deepEqual(parseNewsFeed(xml, source, now), []);
});

test('Instagram OAuth start stores only a hashed, expiring state and requests publishing scopes', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['schema.sql', 'migrations/001-runtime.sql', 'migrations/003-club-access.sql', 'migrations/013-news.sql', 'migrations/014-news-instagram.sql', 'migrations/015-news-article-pages.sql']) {
    sql.exec(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  sql.exec("INSERT INTO users(id,phone,full_name,role) VALUES ('support','09120000000','Support','admin'); INSERT INTO account_access(user_id,role,club_id,state) VALUES ('support','support',NULL,'approved');");
  const DB = { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, first() { return sql.prepare(query).get(...args) || null; }, all() { return { results: sql.prepare(query).all(...args) }; }, run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; } }; } };
  const env = { DB, META_APP_ID: 'app-id', META_APP_SECRET: 'private-secret', META_INSTAGRAM_REDIRECT_URI: 'https://api.mgfitclub.ir/api/support/news/instagram/callback', META_GRAPH_API_VERSION: 'v25.0', NEWS_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') };
  const request = new Request('https://api.mgfitclub.ir/api/support/news/instagram/connect', { method: 'POST' });
  const result = await handleNews(request, env, {
    path: '/api/support/news/instagram/connect', headers: {}, currentUser: async () => ({ id: 'support', status: 'active', access_state: 'approved', role: 'support' }),
    hasRole: (user, ...roles) => roles.includes(user.role), jsonBody: async () => ({}),
    response: (body, status = 200) => new Response(JSON.stringify(body), { status }), errorResponse: (error, status) => new Response(JSON.stringify({ error }), { status }), makeId: (prefix) => `${prefix}_test`,
  });
  assert.equal(result.status, 200);
  const body = await result.json(), auth = new URL(body.url);
  assert.equal(auth.hostname, 'www.instagram.com');
  assert.equal(auth.searchParams.get('response_type'), 'code');
  assert.equal(auth.searchParams.get('scope'), 'instagram_business_basic,instagram_business_content_publish');
  assert.equal(auth.searchParams.get('client_secret'), null);
  const state = auth.searchParams.get('state');
  assert.match(state, /^[a-f0-9]{64}$/);
  const saved = sql.prepare('SELECT state_hash,user_id,expires_at FROM news_instagram_oauth_states').get();
  assert.equal(saved.user_id, 'support');
  assert.notEqual(saved.state_hash, state);
  assert.ok(saved.expires_at > Math.floor(Date.now() / 1000));
  sql.close();
});
