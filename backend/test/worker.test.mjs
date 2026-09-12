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
  assert.equal(health.body.version, "20260911");
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

test("OTP is delivered, hashed and produces an athlete session", async () => {
  const { env, DB } = envFactory();
  let sentCode = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.sms.ir/v1/send/verify");
    const payload = JSON.parse(options.body);
    assert.equal(payload.Mobile, "09170000009");
    assert.equal(payload.TemplateId, 791767);
    sentCode = payload.Parameters.find((item) => item.name === "CODE")?.value || "";
    return new Response(JSON.stringify({ status: 1, message: "موفق" }), { status: 200 });
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
