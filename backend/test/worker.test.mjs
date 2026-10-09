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
    this.db.exec(fs.readFileSync(new URL("../migrations/003-club-access.sql", import.meta.url), "utf8"));
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
  db.prepare("INSERT INTO clubs (id,name,manager_name,manager_user_id,created_by) VALUES ('club_test','MG','مدیر','u_admin','u_admin')").run();
  db.prepare("INSERT INTO account_access (user_id,role,club_id,state) VALUES ('u_admin','manager','club_test','approved'),('u_coach','coach','club_test','approved')").run();
};

const envFactory = () => {
  const DB = new D1Mock();
  seed(DB);
  const env = {
    DB,
    OTP_SECRET: "test-otp-secret",
    TEST_MODE: "true",
    ENVIRONMENT: "test",
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

const post = (env, path, body, token, method = "POST") => call(env, path, {
  method, body: JSON.stringify(body), headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
});
async function otpLogin(env, phone, role = "athlete", clubId, tamperedRole) {
  let code;
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.sms.ir/v1/send/verify");
    code = JSON.parse(options.body).Parameters[0].value;
    return Response.json({ status: 1, data: { messageId: 1234567 } });
  };
  try {
    const request = await post(env, "/api/auth/request-code", { phone, role, clubId });
    assert.equal(request.status, 202, JSON.stringify(request.body));
    const login = await post(env, "/api/auth/verify-code", { phone, challengeId: request.body.challengeId, code, role: tamperedRole || role });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    return login.body;
  } finally { globalThis.fetch = saved; }
}

test("support is bound to the verified fixed phone; club numbers share one account", async () => {
  const { env, DB } = envFactory();
  assert.equal((await post(env, "/api/auth/request-code", { phone: "09170000009", role: "support" })).status, 403);
  assert.equal((await post(env, "/api/auth/request-code", { phone: "09170000009", role: "manager" })).status, 403);
  const support = await otpLogin(env, "09174922677", "support");
  assert.equal(support.user.role, "support");
  assert.equal(support.user.access_state, "approved");
  const created = await post(env, "/api/support/clubs", { name: "باشگاه آزمایشی", managerName: "مدیر آزمایشی", phones: ["09170000011", "+989170000012"] }, support.token);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const first = await otpLogin(env, "09170000011", "manager");
  const second = await otpLogin(env, "09170000012", "manager");
  assert.equal(first.user.id, second.user.id);
  assert.equal(first.user.role, "manager");
  assert.equal(first.user.club_id, created.body.clubId);
  assert.equal(first.user.access_state, "approved");
  assert.equal(DB.prepare("SELECT COUNT(*) AS n FROM users WHERE phone IN ('09170000011','09170000012')").first().n, 0);
  assert.equal((await post(env, "/api/support/clubs", { name: "بدون اجازه", managerName: "مدیر", phones: ["09170000013"] }, first.token)).status, 403);
  assert.equal((await post(env, "/api/me/role", { role: "manager" }, second.token)).status, 403);
  const collision = await post(env, "/api/support/clubs", { name: "دیگر", managerName: "مدیر", phones: ["09170000011"] }, support.token);
  assert.equal(collision.status, 409);
  const personalClub = await post(env, "/api/support/clubs", { name: "شخصی مستقل", managerName: "مدیر", phones: ["09170000002"] }, support.token);
  assert.equal(personalClub.status, 201);
  const personalLogin = await otpLogin(env, "09170000002", "athlete");
  const sharedLogin = await otpLogin(env, "09170000002", "manager");
  assert.equal(personalLogin.user.id, "u_athlete");
  assert.notEqual(sharedLogin.user.id, personalLogin.user.id);
  assert.equal(sharedLogin.user.role, "manager");
  const edit = await post(env, "/api/support/clubs/" + created.body.clubId, { name: "ویرایش", managerName: "مدیر", phones: ["09170000012", "09170000013"] }, support.token, "PATCH");
  assert.equal(edit.status, 200);
  for (const token of [first.token, second.token]) assert.equal((await call(env, "/api/me", { headers: { authorization: "Bearer " + token } })).status, 401);
  assert.equal((await post(env, "/api/auth/request-code", { phone: "09170000011", role: "manager" })).status, 403);
});

test("pending staff cannot use any protected feature; only their club manager approves", async () => {
  const { env, DB } = envFactory();
  const manager = (await post(env, "/api/auth/test-login", { username: "admin", password: "admin" })).body;
  for (const [i, role] of ["coach", "secretary"].entries()) {
    const staff = await otpLogin(env, "0917000002" + i, role, "club_test", "support");
    assert.equal(staff.user.role, role); // verify body cannot replace stored intent
    assert.equal(staff.user.access_state, "pending");
    const headers = { authorization: "Bearer " + staff.token };
    for (const path of ["/api/dashboard", "/api/training-requests", "/api/entry-requests", "/api/coach/programs", "/api/messages", "/api/admin/users", "/api/support/clubs", "/api/access-requests"]) {
      const result = await call(env, path, { headers });
      assert.equal(result.status, 403, path); assert.equal(result.body.error, "approval_required");
    }
    assert.equal((await post(env, "/api/coach/programs", { title: "محفوظ" }, staff.token)).status, 403);
    assert.equal((await post(env, "/api/me/role", { role: "support" }, staff.token)).status, 400);
    const list = await call(env, "/api/access-requests", { headers: { authorization: "Bearer " + manager.token } });
    const item = list.body.requests.find(r => r.user_id === staff.user.id);
    assert.ok(item);
    const support = await otpLogin(env, "09174922677", "support");
    assert.equal((await post(env, "/api/access-requests/" + item.id, { state: "approved" }, support.token, "PATCH")).status, 403);
    // A different real club manager cannot approve this request.
    const c = await post(env, "/api/support/clubs", { name: "دیگر" + i, managerName: "مدیر", phones: ["0917000003" + i] }, support.token);
    assert.equal(c.status, 201);
    const other = await otpLogin(env, "0917000003" + i, "manager");
    assert.equal((await post(env, "/api/access-requests/" + item.id, { state: "approved" }, other.token, "PATCH")).status, 404);
    assert.equal((await post(env, "/api/access-requests/" + item.id, { state: "approved" }, manager.token, "PATCH")).status, 200);
    const me = await call(env, "/api/me", { headers });
    assert.equal(me.body.user.access_state, "approved");
    assert.equal((await call(env, "/api/dashboard", { headers })).status, 200);
    assert.equal((await post(env, "/api/access-requests/" + item.id, { state: "rejected" }, manager.token, "PATCH")).status, 409);
  }
  assert.equal(DB.prepare("SELECT COUNT(*) AS n FROM access_requests WHERE state='approved'").first().n, 2);
});

test("role changes cancel pending requests, remove old privilege and never auto-approve staff", async () => {
  const { env, DB } = envFactory();
  const staff = await otpLogin(env, "09170000040", "coach", "club_test");
  const pending = DB.prepare("SELECT id FROM access_requests WHERE user_id=?").bind(staff.user.id).first();
  const athlete = await post(env, "/api/me/role", { role: "athlete" }, staff.token);
  assert.equal(athlete.body.user.role, "athlete"); assert.equal(athlete.body.user.access_state, "approved");
  assert.equal(DB.prepare("SELECT state FROM access_requests WHERE id=?").bind(pending.id).first().state, "cancelled");
  const manager = (await post(env, "/api/auth/test-login", { username: "admin", password: "admin" })).body;
  assert.equal((await post(env, "/api/access-requests/" + pending.id, { state: "approved" }, manager.token, "PATCH")).status, 409);
  const next = await post(env, "/api/me/role", { role: "secretary", clubId: "club_test" }, staff.token);
  assert.equal(next.body.user.access_state, "pending");
  const newRequest = DB.prepare("SELECT id FROM access_requests WHERE user_id=? AND state='pending'").bind(staff.user.id).first();
  assert.equal((await post(env, "/api/access-requests/" + newRequest.id, { state: "rejected" }, manager.token, "PATCH")).status, 200);
  assert.equal((await call(env, "/api/dashboard", { headers: { authorization: "Bearer " + staff.token } })).status, 403);
});

test("profiles are private, pending users can edit theirs, and SVG/oversize uploads are rejected", async () => {
  const { env } = envFactory();
  const user = await otpLogin(env, "09170000041", "secretary", "club_test");
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=";
  const result = await post(env, "/api/me/profile", { firstName: "نام", lastName: "آزمایشی", avatarData: png, userId: "u_admin", role: "support" }, user.token, "PATCH");
  assert.equal(result.status, 200); assert.equal(result.body.user.full_name, "نام آزمایشی");
  assert.equal(result.body.user.role, "secretary"); assert.equal(result.body.user.access_state, "pending");
  const profile = await call(env, "/api/me/profile", { headers: { authorization: "Bearer " + user.token } });
  assert.equal(profile.body.profile.avatar_data, png);
  for (const avatarData of ["data:image/svg+xml;base64,PHN2Zz4=", "https://tracking.test/avatar", "data:image/png;base64,AAAA"]) {
    assert.equal((await post(env, "/api/me/profile", { firstName: "a", lastName: "b", avatarData }, user.token, "PATCH")).status, 400);
  }
  assert.equal((await post(env, "/api/me/profile", { firstName: "a".repeat(180001), lastName: "b" }, user.token, "PATCH")).status, 413);
  const manager = (await post(env, "/api/auth/test-login", { username: "admin", password: "admin" })).body;
  assert.equal((await post(env, "/api/me/profile", { firstName: "a", lastName: "b" }, manager.token, "PATCH")).status, 403);
  assert.equal((await call(env, "/api/me/profile")).status, 401);
});

test("every registered user is listed with pagination; demo login is unavailable outside test", async () => {
  const { env, DB } = envFactory();
  const support = await otpLogin(env, "09174922677", "support");
  for (let i = 0; i < 105; i++) DB.prepare("INSERT INTO users (id,full_name) VALUES (?,?)").bind("page_" + i, "مهمان " + i).run();
  const headers = { authorization: "Bearer " + support.token };
  const first = await call(env, "/api/admin/users", { headers });
  const second = await call(env, "/api/admin/users?page=2", { headers });
  assert.equal(first.body.users.length, 100);
  assert.equal(first.body.users.length + second.body.users.length, first.body.total);
  assert.equal(new Set([...first.body.users, ...second.body.users].map(u => u.id)).size, first.body.total);
  delete env.ENVIRONMENT;
  assert.equal((await post(env, "/api/auth/test-login", { username: "admin", password: "admin" })).status, 404);
  const before = DB.prepare("SELECT COUNT(*) AS n FROM users").first().n;
  DB.db.exec(fs.readFileSync(new URL("../migrations/003-club-access.sql", import.meta.url), "utf8"));
  assert.equal(DB.prepare("SELECT COUNT(*) AS n FROM users").first().n, before);
});

test("legacy support claims cannot grant privileges and initial support elevation revokes old sessions", async () => {
  const { env, DB } = envFactory();
  DB.prepare("INSERT INTO user_roles (user_id,role) VALUES ('u_athlete','support')").run();
  const forged = (await post(env, "/api/auth/test-login", { username: "athlete", password: "athlete" })).body;
  assert.equal(forged.user.access_state, "rejected");
  assert.equal((await call(env, "/api/support/clubs", { headers: { authorization: "Bearer " + forged.token } })).status, 403);
  DB.prepare("UPDATE user_roles SET role='athlete' WHERE user_id='u_athlete'").run();
  DB.prepare("UPDATE users SET phone='09174922677' WHERE id='u_athlete'").run();
  const old = (await post(env, "/api/auth/test-login", { username: "athlete", password: "athlete" })).body;
  const support = await otpLogin(env, "09174922677", "support");
  assert.equal(support.user.id, old.user.id);
  assert.equal((await call(env, "/api/me", { headers: { authorization: "Bearer " + old.token } })).status, 401);
  assert.equal((await call(env, "/api/support/clubs", { headers: { authorization: "Bearer " + support.token } })).status, 200);
});

test("staff registrations require a real club and manager/support roles cannot be self-assigned", async () => {
  const { env } = envFactory();
  for (const role of ["coach", "secretary"]) {
    assert.equal((await post(env, "/api/auth/request-code", { phone: "09170000088", role })).status, 400);
    assert.equal((await post(env, "/api/auth/request-code", { phone: "09170000088", role, clubId: "missing" })).status, 400);
  }
  const athlete = await otpLogin(env, "09170000089");
  for (const role of ["admin", "manager", "support"]) {
    assert.equal((await post(env, "/api/me/role", { role }, athlete.token)).status, 400);
    assert.equal((await post(env, "/api/admin/users/" + athlete.user.id, { role }, athlete.token, "PATCH")).status, 403);
  }
});

test("sessions last at most 90 days, reject expiry and are revoked by logout", async () => {
  const { env, DB } = envFactory();
  const signIn = async () => {
    const result = await call(env, "/api/auth/test-login", {
      method: "POST",
      body: JSON.stringify({ username: "athlete", password: "athlete" }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(result.status, 200);
    return { authorization: "Bearer " + result.body.token };
  };
  const headers = await signIn();
  const remaining = DB.prepare("SELECT julianday(expires_at)-julianday('now') AS days FROM sessions LIMIT 1").first();
  assert.ok(remaining.days > 89.99 && remaining.days <= 90);
  assert.equal((await call(env, "/api/me", { headers })).status, 200);
  await call(env, "/api/auth/logout", { method: "POST", headers });
  assert.equal((await call(env, "/api/me", { headers })).status, 401);
  const nextHeaders = await signIn();
  DB.prepare("UPDATE sessions SET expires_at=datetime('now','-1 second')").run();
  assert.equal((await call(env, "/api/me", { headers: nextHeaders })).status, 401);
});

test("90-day session migration extends only active unrevoked sessions", () => {
  const { DB } = envFactory();
  DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,datetime('now'))")
    .bind("active_session", "u_athlete", "active_hash", DB.prepare("SELECT datetime('now','+20 days') AS value").first().value).run();
  DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,revoked_at) VALUES (?,?,?,datetime('now','+20 days'),datetime('now'),datetime('now'))")
    .bind("revoked_session", "u_athlete", "revoked_hash").run();
  DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,datetime('now','-1 day'),datetime('now','-31 days'))")
    .bind("expired_session", "u_athlete", "expired_hash").run();
  DB.db.exec(fs.readFileSync(new URL("../migrations/016-session-max-90-days.sql", import.meta.url), "utf8"));
  const days = (id) => DB.prepare("SELECT julianday(expires_at)-julianday('now') AS value FROM sessions WHERE id=?").bind(id).first().value;
  assert.ok(days("active_session") > 89.99 && days("active_session") <= 90);
  assert.ok(days("revoked_session") > 19.99 && days("revoked_session") <= 20);
  assert.ok(days("expired_session") < 0);
});

test("staff subdomain is allowed by API CORS when root origin is configured", async () => {
  const { env } = envFactory();
  env.APP_ORIGIN = "https://mgfitclub.ir";
  const response = await worker.fetch(new Request("https://api.mgfitclub.ir/health", {
    headers: { Origin: "https://staff.mgfitclub.ir" },
  }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://staff.mgfitclub.ir");
});

test("health and role-aware test login", async () => {
  const { env } = envFactory();
  const health = await call(env, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.version, "20261008-news-sync-fontfix-1");
  assert.deepEqual(health.body.otp, { provider: "sms.ir", method: "verify", templateId: 791767, parameter: "CODE" });
  const login = await call(env, "/api/auth/test-login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "manager");
  const dashboard = await call(env, "/api/dashboard", {
    headers: { authorization: "Bearer " + login.body.token },
  });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.user.role, "manager");
});

test("OTP uses only the approved template, is hashed and produces an athlete session", async () => {
  const { env, DB } = envFactory();
  // An inherited development flag must never expose a production login code.
  delete env.ENVIRONMENT;
  env.DEV_MODE = "true";
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
      body: JSON.stringify({ phone: "+989170000009", role: "athlete" }),
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

test("repairing the missing role table preserves users and restores OTP login and dashboard", async () => {
  const { env, DB } = envFactory();
  // Reproduce the incomplete production migration, in the in-memory test DB only.
  DB.db.exec("DROP TABLE user_roles");
  assert.throws(() => DB.prepare("SELECT * FROM user_roles").all(), /no such table/);
  const usersBefore = DB.prepare("SELECT * FROM users ORDER BY id").all().results;
  const repair = fs.readFileSync(new URL("../migrations/002-user-roles-repair.sql", import.meta.url), "utf8");
  DB.db.exec(repair);
  DB.db.exec(repair);
  assert.deepEqual(DB.prepare("SELECT * FROM users ORDER BY id").all().results, usersBefore);
  assert.equal(DB.prepare("SELECT COUNT(*) AS count FROM user_roles").first().count, 0);
  const originalFetch = globalThis.fetch;
  let receivedCode = "";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.sms.ir/v1/send/verify");
    const payload = JSON.parse(options.body);
    assert.equal(payload.TemplateId, 791767);
    assert.equal(payload.Mobile, "09170000002");
    receivedCode = payload.Parameters[0].value;
    return new Response(JSON.stringify({ status: 1, data: { messageId: 9001004 } }));
  };
  try {
    const requested = await call(env, "/api/auth/request-code", {
      method: "POST", body: JSON.stringify({ phone: "09170000002" }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(requested.status, 202);
    const verified = await call(env, "/api/auth/verify-code", {
      method: "POST", body: JSON.stringify({ phone: "09170000002", code: receivedCode, challengeId: requested.body.challengeId }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.user.role, "athlete");
    assert.equal(verified.body.user.id, "u_athlete");
    const headers = { authorization: "Bearer " + verified.body.token };
    assert.equal((await call(env, "/api/me", { headers })).status, 200);
    assert.equal((await call(env, "/api/dashboard", { headers })).status, 200);
    assert.deepEqual(DB.prepare("SELECT * FROM users ORDER BY id").all().results, usersBefore);
    // Reapplying the repair must also preserve any role assignments added later.
    DB.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,?)").bind("u_secretary", "secretary").run();
    DB.db.exec(repair);
    assert.equal(DB.prepare("SELECT role FROM user_roles WHERE user_id=?").bind("u_secretary").first().role, "secretary");
  } finally { globalThis.fetch = originalFetch; }
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
  assert.equal(role.status, 403); // Legacy direct role assignment cannot bypass approvals.
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
