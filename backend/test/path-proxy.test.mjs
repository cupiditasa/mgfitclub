import test from "node:test";
import assert from "node:assert/strict";
import proxy from "../path-proxy.js";

test("same-origin API path maps health and preserves query string", async () => {
  const originalFetch = globalThis.fetch;
  let called;
  globalThis.fetch = async (request) => {
    called = request;
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await proxy.fetch(new Request("https://mgfitclub.ir/api/api01?probe=1"));
    assert.equal(response.status, 200);
    assert.equal(called.url, "https://api.mgfitclub.ir/health?probe=1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("same-origin API path forwards auth, method, body and path", async () => {
  const originalFetch = globalThis.fetch;
  let called;
  globalThis.fetch = async (request) => {
    called = request;
    return new Response("ok");
  };
  try {
    const request = new Request("https://mgfitclub.ir/api/api01/api/auth/request-code", {
      method: "POST",
      headers: { authorization: "Bearer session", "content-type": "application/json" },
      body: JSON.stringify({ phone: "09123456789" }),
    });
    assert.equal((await proxy.fetch(request)).status, 200);
    assert.equal(called.url, "https://api.mgfitclub.ir/api/auth/request-code");
    assert.equal(called.method, "POST");
    assert.equal(called.headers.get("authorization"), "Bearer session");
    assert.deepEqual(await called.json(), { phone: "09123456789" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("proxy refuses paths outside its exact prefix", async () => {
  const response = await proxy.fetch(new Request("https://mgfitclub.ir/api/api010/api/me"));
  assert.equal(response.status, 404);
});
