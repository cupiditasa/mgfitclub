import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const frontendRoot = fs.existsSync(new URL("../../current/mg-api.js", import.meta.url)) ? new URL("../../current/", import.meta.url) : new URL("../../", import.meta.url);
const apiSource = fs.readFileSync(new URL("mg-api.js", frontendRoot), "utf8");
const accountSource = fs.readFileSync(new URL("account.html", frontendRoot), "utf8");
const loginSource = [...accountSource.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('challengeId = ""'));

function browser(fetcher, saved = "saved-token", pathname = "") {
  const values = new Map(saved ? [["mg_session", saved], ["mg_role", "athlete"]] : []);
  const elements = Object.fromEntries(["target", "code", "action", "status", "roles", "roleToggle", "loginInstructions", "staffEntry", "athleteEntry"].map(id => [id, {
    value: "", style: {}, textContent: "", disabled: false, hidden: false,
    addEventListener() {}, querySelectorAll() { return []; },
    classList: { toggle() {}, remove() {} },
  }]));
  const context = vm.createContext({
    Headers, URL, AbortSignal, fetch: fetcher,
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, val) => values.set(key, val), removeItem: key => values.delete(key) },
    document: { body: null, documentElement: { dataset: {} }, head: { appendChild() {} }, cookie: "", addEventListener() {}, createElement: () => ({ dataset: {}, addEventListener() {} }), getElementById: id => elements[id], querySelector: () => ({ href: "" }) },
    location: { hostname: "mgfitclub.ir", pathname, search: "", href: `https://mgfitclub.ir${pathname || "/account.html"}`, replace(url) { this.redirect = url; } },
    history: { replaceState() {} },
  });
  context.window = context;
  vm.runInContext(apiSource, context);
  return { context, values, elements };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("staff sessions on athlete login are revoked and moved to the staff login path", async () => {
  const b = browser(async (url, options) => {
    if (url.endsWith("/api/auth/logout")) return Response.json({ ok: true });
    assert.ok(url.endsWith("/api/me"));
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.get("authorization"), "Bearer saved-token");
    return Response.json({ user: { role: "coach" } });
  });
  vm.runInContext(loginSource, b.context);
  await flush();
  assert.equal(b.context.location.redirect, "https://mgfitclub.ir/staff/login");
  assert.equal(b.values.has("mg_session"), false);
});

test("staff login path opens staff role choices and rejects an athlete session", async () => {
  const b = browser(async (url) => {
    if (url.endsWith("/api/auth/logout")) return Response.json({ ok: true });
    assert.ok(url.endsWith("/api/me"));
    return Response.json({ user: { role: "athlete" } });
  }, "athlete-token", "/staff/login");
  vm.runInContext(loginSource, b.context);
  await flush();
  assert.equal(b.elements.roleToggle.hidden, false);
  assert.equal(b.elements.roles.hidden, false);
  assert.equal(b.elements.athleteEntry.hidden, false);
  assert.equal(b.context.location.redirect, "https://mgfitclub.ir/account.html");
  assert.equal(b.values.has("mg_session"), false);
});

test("staff login route loads the shared login page while retaining its URL", () => {
  const route = fs.readFileSync(new URL("staff/login/index.html", frontendRoot), "utf8");
  assert.match(route, /fetch\("\/account\.html"/);
  assert.match(accountSource, /<base href="\/"\s*\/>/);
  assert.match(apiSource, /staff\\\/login/);
});

test("account login sends API requests through the same-origin API path gateway", () => {
  assert.match(accountSource, /window\.MG_API_BASE\s*=\s*["']https:\/\/mgfitclub\.ir\/api\/api01["']/);
  assert.match(accountSource, /const API = window\.MG_API_BASE \|\|/);
});

test("invalid or expired session is cleared and login remains available", async () => {
  const b = browser(async () => Response.json({ error: "unauthorized" }, { status: 401 }));
  vm.runInContext(loginSource, b.context);
  await flush();
  assert.equal(b.values.has("mg_session"), false);
  assert.equal(b.context.location.redirect, undefined);
  assert.equal(b.elements.action.disabled, false);
});

test("network failure preserves login and the button retries without requesting another OTP", async () => {
  let calls = 0;
  const b = browser(async url => {
    assert.ok(url.endsWith("/api/me"));
    if (++calls === 1) throw new TypeError("offline");
    return Response.json({ user: { role: "athlete" } });
  });
  vm.runInContext(loginSource, b.context);
  await flush();
  assert.equal(b.values.get("mg_session"), "saved-token");
  assert.equal(b.elements.action.disabled, false);
  await b.elements.action.onclick();
  assert.equal(calls, 2);
  assert.equal(b.context.location.redirect, "/dashboard.html");
});

test("logout clears local session even on network failure", async () => {
  const b = browser(async () => { throw new TypeError("offline"); });
  await assert.rejects(b.context.MGApi.logout());
  assert.equal(b.values.has("mg_session"), false);
  assert.equal(await b.context.MGApi.restoreSession(), null);
});

test("late restore cannot restore a session after logout", async () => {
  let respond;
  const b = browser(() => new Promise(resolve => { respond = resolve; }));
  const pending = b.context.MGApi.restoreSession();
  b.context.MGApi.clearSession();
  respond(Response.json({ user: { role: "coach" } }));
  assert.equal(await pending, null);
  assert.equal(b.values.has("mg_role"), false);
});

test("service worker bypasses API, cross-origin, authorized and no-store requests", () => {
  const handlers = {};
  const context = vm.createContext({ URL, self: { location: { origin: "https://site.test" }, addEventListener: (name, fn) => { handlers[name] = fn; } } });
  vm.runInContext(fs.readFileSync(new URL("sw.js", frontendRoot), "utf8"), context);
  for (const request of [
    new Request("https://api.test/api/me"),
    new Request("https://site.test/api/me"),
    new Request("https://site.test/private", { headers: { Authorization: "Bearer test" } }),
    new Request("https://site.test/private", { cache: "no-store" }),
  ]) handlers.fetch({ request, respondWith() { assert.fail("Private request must not use cache"); } });
});
