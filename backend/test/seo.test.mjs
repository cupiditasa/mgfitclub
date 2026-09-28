import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=fs.existsSync(new URL('../../current/index.html',import.meta.url))?new URL('../../current/',import.meta.url):new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const base='https://mgfitclub.ir/';
const sitemap=read('sitemap.xml');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const publicFiles=urls.map(url=>url===base?'index.html':url.slice(base.length));
test('sitemap contains only unique canonical public pages with crawlable static content',()=>{
  assert.equal(urls.length,10);assert.equal(new Set(urls).size,urls.length);
  for(const [i,file] of publicFiles.entries()){
    const html=read(file);
    assert.ok(urls[i].startsWith(base));assert.ok(!urls[i].includes('?'));
    const canonical=[...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/g)];assert.equal(canonical.length,1,file);
    assert.ok(canonical[0][0].includes(urls[i]),file);
    assert.match(html,/<meta name="robots" content="index, follow, max-image-preview:large">/);
    assert.match(html,/<h1\b/);assert.match(html,/<title>[^<]+<\/title>/);
    assert.match(html,/<meta\s+name=["']description["']\s+content=["'][^"']+/);
    assert.ok(html.includes(`property="og:url" content="${urls[i]}"`));
    const image=html.match(/property="og:image" content="([^"]+)"/)[1];
    assert.ok(image.startsWith(base));assert.ok(fs.existsSync(new URL(image.slice(base.length),root)));
    for(const script of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g))JSON.parse(script[1]);
  }
});
test('video sitemap entries use real accessible assets and no invented publication dates',()=>{
  const entries=[...sitemap.matchAll(/<video:video>([\s\S]*?)<\/video:video>/g)];assert.equal(entries.length,7);
  for(const [,entry] of entries){
    for(const tag of ['thumbnail_loc','content_loc']){
      const url=entry.match(new RegExp(`<video:${tag}>([^<]+)</video:${tag}>`))[1];
      assert.ok(url.startsWith(base));assert.ok(fs.existsSync(new URL(url.slice(base.length),root)));
    }
    assert.match(entry,/<video:title>[^<]+<\/video:title>/);assert.match(entry,/<video:description>[^<]+<\/video:description>/);
  }
  assert.ok(!sitemap.includes('publication_date'));assert.ok(!sitemap.includes('lastmod'));
});
test('private pages explicitly noindex but remain crawlable so the directive can be read',()=>{
  const files=fs.readdirSync(root).filter(f=>f.endsWith('.html')&&!publicFiles.includes(f)&&!/^google[a-f0-9]+\.html$/.test(f));assert.ok(files.length>=16);
  for(const file of files){const html=read(file);assert.match(html,/<meta name="robots" content="noindex, follow">/);assert.ok(!urls.includes(base+file));}
  const robots=read('robots.txt');assert.ok(robots.includes('Sitemap: '+base+'sitemap.xml'));
  const groups=robots.split(/User-agent: /).slice(1);assert.equal(groups.length,2);
  for(const group of groups){assert.ok(group.includes('Allow: /'));assert.ok(group.includes('Disallow: /backend/'));assert.ok(!group.includes('Disallow: /account.html'));}
  assert.ok(groups.some(g=>g.startsWith('OAI-SearchBot\n')||g.startsWith('OAI-SearchBot\r\n')));
  assert.ok(!robots.includes('User-agent: GPTBot'));
});
test('main entity markup uses existing public contact details without fabricated ratings',()=>{
  const scripts=[...read('index.html').matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const club=scripts.find(x=>x['@type']==='HealthClub');assert.equal(club.url,base);assert.equal(club['@id'],base+'#club');
  assert.equal(club.telephone,'+989178483446');assert.ok(!club.aggregateRating);
  const site=scripts.find(x=>x['@type']==='WebSite');assert.equal(site.publisher['@id'],club['@id']);
});
