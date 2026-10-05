import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const frontendRoot = fs.existsSync(new URL("../../current/access-control.js", import.meta.url)) ? new URL("../../current/", import.meta.url) : new URL("../../", import.meta.url);
const source = fs.readFileSync(new URL("access-control.js", frontendRoot), "utf8");
const flush = () => new Promise(resolve => setImmediate(resolve));

function guardBrowser(path, getUser) {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.style = {}; this.inert = false; this.attributes = {}; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    appendChild(node) { this.append(node); return node; }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    setAttribute(k, v) { this.attributes[k] = v; }
    focus() { document.activeElement = this; }
    contains(target) { return this === target || this.children.some(c => c.contains(target)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(c => [...((selector[0] === "." ? c.className === selector.slice(1) : selector[0] === "#" ? c.id === selector.slice(1) : c.tagName === selector) ? [c] : []), ...c.querySelectorAll(selector)]);
    }
  }
  const document = {
    head: new Element("head"), body: new Element("body"), readyState: "complete", hidden: false,
    createElement: tag => new Element(tag), addEventListener() {},
    getElementById(id) { return this.head.querySelector("#" + id) || this.body.querySelector("#" + id); },
    querySelector(selector) { return this.body.querySelector(selector); },
    querySelectorAll(selector) { return this.body.querySelectorAll(selector); },
  };
  const cloak = new Element("style"); cloak.id = "mg-access-cloak"; document.head.append(cloak);
  const content = new Element("main"); document.body.append(content);
  const events = [];
  const context = vm.createContext({ document, Date,
    location: { pathname: "/" + path, search: "?demo=coach", replace(url) { this.redirect = url; } },
    MGApi: { restoreSession: getUser, request: async () => ({ profile: {} }), logout: async () => {} },
    CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data.detail; } },
    addEventListener() {}, dispatchEvent: event => events.push(event),
  });
  context.window = context;
  vm.runInContext(source, context);
  return { context, document, content, events };
}

test("pending staff see a modal lock with role/profile controls, never an unlocked dashboard", async () => {
  for (const role of ["coach", "secretary"]) {
    const b = guardBrowser(role === "coach" ? "coach-dashboard.html" : "secretary.html", async () => ({ role, access_state: "pending" }));
    await flush();
    const lock = b.document.getElementById("mg-access-lock");
    assert.ok(lock);
    assert.equal(lock.attributes["aria-modal"], "true");
    assert.equal(b.content.inert, true);
    assert.deepEqual(lock.querySelectorAll("a").map(a => a.href), ["access-center.html#role", "access-center.html#profile"]);
    assert.equal(b.events.length, 0);
  }
});

test("pending members may open their account center; approved members unlock their matching dashboard", async () => {
  for (const [path, user] of [
    ["access-center.html", { role: "coach", access_state: "pending" }],
    ["coach-dashboard.html", { role: "coach", access_state: "approved" }],
    ["support.html", { role: "support", access_state: "approved" }],
  ]) {
    const b = guardBrowser(path, async () => user); await flush();
    assert.equal(b.document.getElementById("mg-access-lock"), null);
    assert.equal(b.content.inert, false);
    assert.equal(b.events[0].type, "mg:access-ready");
  }
});

test("demo URL and wrong role cannot unlock staff or support pages", async () => {
  const anonymous = guardBrowser("coach-dashboard.html", async () => null); await flush();
  assert.equal(anonymous.context.location.redirect, "account.html");
  assert.equal(anonymous.content.inert, true);
  const wrong = guardBrowser("support.html", async () => ({ role: "athlete", access_state: "approved" })); await flush();
  assert.equal(wrong.context.location.redirect, "dashboard.html");
  assert.equal(wrong.content.inert, true);
});

test("server/network failure leaves the dashboard locked", async () => {
  const b = guardBrowser("coach-dashboard.html", async () => { throw Error("offline"); }); await flush();
  assert.ok(b.document.getElementById("mg-access-lock"));
  assert.equal(b.content.inert, true);
  assert.equal(b.events.length, 0);
});

test("all protected HTML pages load the guard version and begin cloaked; inline scripts compile", () => {
  const root = frontendRoot;
  for (const file of fs.readdirSync(root).filter(name => name.endsWith(".html"))) {
    const html = fs.readFileSync(new URL(file, root), "utf8");
    if (html.includes("mg-api.js") && file !== "account.html") {
      assert.ok(html.includes('id="mg-access-cloak"'), file);
      assert.ok(/mg-api\.js\?v=(20260919-access|20261005)/.test(html), file);
    }
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/type=["'](?:application\/(?:ld\+)?json|module)/.test(match[1]) || !match[2].trim()) continue;
      assert.doesNotThrow(() => new vm.Script(match[2], { filename: file }), file);
    }
  }
});

test("profile names in legacy manager cards are escaped, not injected into handlers", () => {
  const html = fs.readFileSync(new URL("admin.html", frontendRoot), "utf8");
  const functions = html.slice(html.indexOf("function escapeHtml"), html.indexOf("function renderAthletes"));
  const context = vm.createContext({}); vm.runInContext(functions, context);
  const result = context.cardAthlete({ name: "'><img src=x onerror=alert(1)>", status: "فعال", join: "", days: "", last: "" });
  assert.ok(!result.includes("<img"));
  assert.ok(result.includes("&lt;img"));
  assert.ok(result.includes("report(this.closest("));
});
