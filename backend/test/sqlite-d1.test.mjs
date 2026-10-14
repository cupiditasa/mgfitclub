import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import fs from "node:fs";
import { SqliteD1Database } from "../sqlite-d1.js";
import worker from "../worker.js";

test("SQLite D1 adapter binds values and matches D1 run/all/first results", async () => {
  const raw = new Database(":memory:");
  const db = new SqliteD1Database(raw);
  raw.exec("CREATE TABLE members(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");

  const inserted = await db.prepare("INSERT INTO members(name) VALUES (?)").bind("MG").run();
  assert.equal(inserted.success, true);
  assert.equal(inserted.meta.changes, 1);
  assert.equal(inserted.meta.last_row_id, 1);
  assert.deepEqual(await db.prepare("SELECT id,name FROM members ORDER BY id").all(), {
    success: true,
    results: [{ id: 1, name: "MG" }],
    meta: { changes: 1 },
  });
  assert.deepEqual(await db.prepare("SELECT id,name FROM members WHERE id=?").bind(1).first(), {
    id: 1,
    name: "MG",
  });
  assert.equal(await db.prepare("SELECT id FROM members WHERE id=?").bind(999).first(), null);
  db.close();
});

test("SQLite D1 batch commits atomically and returns ordered statement results", async () => {
  const raw = new Database(":memory:");
  const db = new SqliteD1Database(raw);
  raw.exec("CREATE TABLE members(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");

  const results = await db.batch([
    db.prepare("INSERT INTO members(name) VALUES (?)").bind("one"),
    db.prepare("INSERT INTO members(name) VALUES (?)").bind("two"),
    db.prepare("SELECT name FROM members ORDER BY id"),
  ]);
  assert.equal(results[0].meta.changes, 1);
  assert.equal(results[1].meta.changes, 1);
  assert.deepEqual(results[2].results, [{ name: "one" }, { name: "two" }]);

  await assert.rejects(db.batch([
    db.prepare("INSERT INTO members(name) VALUES (?)").bind("three"),
    db.prepare("INSERT INTO members(name) VALUES (?)").bind("one"),
  ]));
  assert.deepEqual(
    (await db.prepare("SELECT name FROM members ORDER BY id").all()).results,
    [{ name: "one" }, { name: "two" }],
  );
  db.close();
});

test("full MG schema and migrations run on SQLite and serve through the Worker adapter", async () => {
  const raw = new Database(":memory:");
  raw.pragma("foreign_keys = ON");
  raw.exec(fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const migrationsPath = new URL("../migrations/", import.meta.url);
  const migrations = fs.readdirSync(migrationsPath)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right, "en"));
  for (const migration of migrations) {
    raw.exec(fs.readFileSync(new URL(migration, migrationsPath), "utf8"));
  }

  const DB = new SqliteD1Database(raw);
  const env = {
    DB,
    APP_ORIGIN: "https://mgfitclub.ir",
    ENVIRONMENT: "production",
    OTP_SECRET: "test-only-secret",
    SMS_API_KEY: "test-only-key",
    STAFF_DEFAULT_CLUB_ID: "club_fbb1b21f-93cf-4a88-bbd8-ca5db63b0d2d",
    WORKOUTS_ENABLED: "true",
  };
  try {
    const health = await worker.fetch(new Request("https://mgfitclub.ir/health"), env, { waitUntil() {} });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, "mg-fitclub-api");

    const plans = await worker.fetch(new Request("https://mgfitclub.ir/api/plans/membership"), env, { waitUntil() {} });
    assert.equal(plans.status, 200);
    assert.ok(Array.isArray((await plans.json()).plans));
    assert.ok(raw.prepare("PRAGMA foreign_key_check").all().length === 0);
  } finally {
    DB.close();
  }
});
