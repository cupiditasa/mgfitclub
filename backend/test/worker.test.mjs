import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import worker from "../worker.js";

class D1Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }
  bind(...args) {
    this.args = args;
    return this;
  }
  first() {
    return this.db.prepare(this.sql).get(...this.args) || null;
  }
  all() {
    return { results: this.db.prepare(this.sql).all(...this.args) };
  }
  run() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) } };
  }
}

class D1Mock {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
    this.db.exec(fs.readFileSync(new URL("../migrations/001-runtime.sql", import.meta.url), "utf8"));
  }
  prepare(sql) {
    return new D1Statement(this.db, sql);
  }
  batch(statements) {
    this.db.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.run());
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

const seed = (db) => {
  const users = [
    ["u_admin", "admin@example.test", "مدیر", "admin"],
    ["u_coach", "09170000001", "مربی تست", "coach"],
    ["u_athlete", "09170000002", "ورزشکار تست", "athlete"],
    ["u_secretary", "09170000003", "منشی تست", "athlete"],
  ];
  for (const [id, phoneOrEmail, name, role] of users) {
    const column = phoneOrEmail.includes("@") ? "email" : "phone";
    db.prepare("INSERT INTO users (id," + column + ",full_name,role,status) VALUES (?,?,?,?,?)").bind(id, phoneOrEmail, name, role, "active").run();
    if (role !== "athlete") db.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,?)").bind(id, role).run();
  }
  db.prepare("INSERT INTO test_accounts (username,password_hash,role,user_id) VALUES (?,?,?,?)").bind("admin", "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", "admin", "u_admin").run();
  db.prepare("INSERT INTO test_accounts (username,password_hash,role,user_id) VALUES (?,?,?,?)").bind("athlete", "23a1f74bc589fe525387f8d2c40f1e552a564fe5de00af935bb7a0592fc976c6", "athlete", "u_athlete").run();
  db.prepare("INSERT INTO test_accounts (username,password_hash,role,user_id) VALUES (?,?,?,?)").bind("coach", "e0f167bc84b881bc06f6884fb48e02f41dfc5579e25489db6c6bde238e4aed15", "coach", "u_coach").run();
  db.prepare("INSERT INTO training_plans (id,title,price,is_active) VALUES (?,?,?,?)").bind("plan_test", "برنامه تست", 0, 1).run();
};

const envFactory = () => {
  const DB = new D1Mock();
  seed(DB);
  const env = {
    DB,
    OTP_SECRET: "test-otp-secret",
    TEST_MODE: "true",
    DEV_MODE: "false",
    SMS_API_KEY: "test-key",
    SMS_LINE_NUMBER: "30002108035903",
    SMS_TEMPLATE_ID: "791767",
  };
  return { env, DB };
};

const call = async (env, path, options = {}) => {
  const request = new Request("https://test.local" + path, {
    ...options,
    headers: { Origin: "https://test.local", ...(options.headers || {}) },
  });
  const result = await worker.fetch(request, env);
  return { status: result.status, body: await result.json() };
};

test("health and role-aware test login", async () => {
  const { env } = envFactory();
  const health = await call(env, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.version, "20260912-sms-template-1");
  assert.deepEqual(health.body.otp, { provider: "sms.ir", method: "verify", templateId: 791767, parameter: "CODE" });
  const login = await call(env, "/api/auth/test-login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "admin");
  const dashboard = await call(env, "/api/dashboard", {
    headers: { authorization: "Bearer " + login.body.token },
  });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.user.role, "admin");
});

test("OTP uses only the approved template, is hashed and produces an athlete session", async () => {
  const { env, DB } = envFactory();
  let sentCode = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.sms.ir/v1/send/verify");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-API-KEY"], "test-key");
    const payload = JSON.parse(options.body);
    assert.deepEqual(Object.keys(payload).sort(), ["Mobile", "Parameters", "TemplateId"]);
    assert.equal(payload.Mobile, "09170000009");
    assert.equal(payload.TemplateId, 791767);
    sentCode = payload.Parameters.find((item) => item.name === "CODE")?.value || "";
    assert.deepEqual(payload.Parameters, [{ name: "CODE", value: sentCode }]);
    return new Response(JSON.stringify({ status: 1, data: { messageId: 9001001 } }), { status: 200 });
  };
  try {
    const requested = await call(env, "/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ phone: "+989170000009", role: "coach" }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(requested.status, 202, JSON.stringify(requested.body));
    assert.match(sentCode, /^\d{6}$/);
    const stored = DB.prepare("SELECT code_hash,delivery_status FROM login_challenges").all();
    assert.equal(stored.results.length, 1);
    assert.equal(stored.results[0].delivery_status, "sent");
    assert.notEqual(stored.results[0].code_hash, sentCode);
    assert.equal(requested.body.devCode, undefined);
    const log = DB.prepare("SELECT metadata_json FROM audit_logs WHERE action='auth_code_requested'").first();
    assert.deepEqual(JSON.parse(log.metadata_json), {
      channel: "phone", sent: true, smsMethod: "verify", templateId: 791767,
      providerStatus: 1, messageId: 9001001, failureReason: null,
    });
    const code = sentCode;
    const verified = await call(env, "/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ phone: "09170000009", code, challengeId: requested.body.challengeId }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.user.role, "athlete");
    const replay = await call(env, "/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ phone: "09170000009", code, challengeId: requested.body.challengeId }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(replay.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("approved verification template needs no private line or template binding", async () => {
  const { env } = envFactory();
  delete env.SMS_TEMPLATE_ID;
  delete env.SMS_LINE_NUMBER;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.sms.ir/v1/send/verify");
    const payload = JSON.parse(options.body);
    assert.equal(payload.TemplateId, 791767);
    assert.equal(payload.Mobile, "09170000009");
    assert.deepEqual(Object.keys(payload).sort(), ["Mobile", "Parameters", "TemplateId"]);
    return new Response(JSON.stringify({ status: 1, data: { messageId: 9001002 } }));
  };
  try {
    const result = await call(env, "/api/auth/request-code", {
      method: "POST", body: JSON.stringify({ phone: "۰۹۱۷۰۰۰۰۰۰۹" }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(result.status, 202);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("a different template or missing API key cannot trigger SMS or a fallback", async (t) => {
  for (const [name, overrides] of [
    ["wrong template", { SMS_TEMPLATE_ID: "123456" }],
    ["invalid template", { SMS_TEMPLATE_ID: "invalid" }],
    ["missing API key", { SMS_API_KEY: "" }],
  ]) {
    await t.test(name, async () => {
      const { env, DB } = envFactory();
      Object.assign(env, overrides);
      const originalFetch = globalThis.fetch;
      let calls = 0;
      globalThis.fetch = async () => { calls++; throw new Error("Unexpected SMS request"); };
      try {
        const result = await call(env, "/api/auth/request-code", {
          method: "POST", body: JSON.stringify({ phone: "09170000009" }),
          headers: { "content-type": "application/json" },
        });
        assert.equal(result.status, 503);
        assert.equal(result.body.error, "code_delivery_failed");
        assert.equal(calls, 0);
        assert.equal(DB.prepare("SELECT delivery_status FROM login_challenges").first().delivery_status, "failed");
      } finally { globalThis.fetch = originalFetch; }
    });
  }
});

test("provider failures cannot silently fall back or create a valid login code", async (t) => {
  const failures = [
    ["provider rejection", () => new Response(JSON.stringify({ status: 1008, data: null }))],
    ["HTTP error", () => new Response(JSON.stringify({ status: 1, data: { messageId: 9001003 } }), { status: 503 })],
    ["missing message ID", () => new Response(JSON.stringify({ status: 1, data: {} }))],
    ["invalid JSON", () => new Response("not json")],
    ["null JSON", () => new Response("null")],
    ["network error", () => { throw new TypeError("fetch failed"); }],
    ["timeout", () => { throw new DOMException("timed out", "TimeoutError"); }],
  ];
  for (const [name, reply] of failures) {
    await t.test(name, async () => {
      const { env, DB } = envFactory();
      const originalFetch = globalThis.fetch;
      let calls = 0;
      let capturedCode = "";
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(url, "https://api.sms.ir/v1/send/verify");
        capturedCode = JSON.parse(options.body).Parameters[0].value;
        return reply();
      };
      try {
        const requested = await call(env, "/api/auth/request-code", {
          method: "POST", body: JSON.stringify({ phone: "09170000009" }),
          headers: { "content-type": "application/json" },
        });
        assert.equal(requested.status, 503);
        assert.equal(requested.body.error, "code_delivery_failed");
        assert.equal(calls, 1);
        const challenge = DB.prepare("SELECT id,delivery_status FROM login_challenges").first();
        assert.equal(challenge.delivery_status, "failed");
        const verified = await call(env, "/api/auth/verify-code", {
          method: "POST", body: JSON.stringify({ phone: "09170000009", code: capturedCode, challengeId: challenge.id }),
          headers: { "content-type": "application/json" },
        });
        assert.equal(verified.status, 401);
        assert.equal(DB.prepare("SELECT COUNT(*) AS count FROM sessions").first().count, 0);
        const log = JSON.parse(DB.prepare("SELECT metadata_json FROM audit_logs WHERE action='auth_code_requested'").first().metadata_json);
        assert.equal(log.sent, false);
        assert.equal(log.smsMethod, "verify");
        assert.equal(log.templateId, 791767);
        assert.deepEqual(Object.keys(log).sort(), [
          "channel", "failureReason", "messageId", "providerStatus", "sent", "smsMethod", "templateId",
        ]);
        assert(!JSON.stringify(log).includes(env.SMS_API_KEY));
      } finally { globalThis.fetch = originalFetch; }
    });
  }
});

test("training request is idempotent and entry request is not duplicated", async () => {
  const { env } = envFactory();
  const login = await call(env, "/api/auth/test-login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin" }),
    headers: { "content-type": "application/json" },
  });
  const adminToken = login.body.token;
  const role = await call(env, "/api/admin/users/u_secretary", {
    method: "PATCH",
    body: JSON.stringify({ role: "secretary" }),
    headers: { "content-type": "application/json", authorization: "Bearer " + adminToken },
  });
  assert.equal(role.status, 200);
  assert.equal(role.body.user.role, "secretary");
  const athlete = await call(env, "/api/auth/test-login", {
    method: "POST",
    body: JSON.stringify({ username: "athlete", password: "athlete" }),
    headers: { "content-type": "application/json" },
  });
  const first = await call(env, "/api/entry-requests", {
    method: "POST",
    body: "{}",
    headers: { authorization: "Bearer " + athlete.body.token, "content-type": "application/json" },
  });
  assert.equal(first.status, 201);
  const duplicateEntry = await call(env, "/api/entry-requests", {
    method: "POST",
    body: "{}",
    headers: { authorization: "Bearer " + athlete.body.token, "content-type": "application/json" },
  });
  assert.equal(duplicateEntry.status, 200);
  const request = await call(env, "/api/training-requests", {
    method: "POST",
    body: JSON.stringify({ planId: "plan_test", idempotencyKey: "abcdefghijklmnop", goal: "قدرت" }),
    headers: { authorization: "Bearer " + athlete.body.token, "content-type": "application/json" },
  });
  assert.equal(request.status, 201);
  const duplicate = await call(env, "/api/training-requests", {
    method: "POST",
    body: JSON.stringify({ planId: "plan_test", idempotencyKey: "abcdefghijklmnop", goal: "قدرت" }),
    headers: { authorization: "Bearer " + athlete.body.token, "content-type": "application/json" },
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
});
