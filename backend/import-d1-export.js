import Database from "better-sqlite3";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import process from "node:process";

const sourcePath = process.env.MG_D1_EXPORT_PATH;
const targetPath = process.env.MG_DB_PATH;

if (!sourcePath || !targetPath || !isAbsolute(sourcePath) || !isAbsolute(targetPath)) {
  throw new Error("MG_D1_EXPORT_PATH and MG_DB_PATH must be absolute file paths.");
}

const source = resolve(sourcePath);
const target = resolve(targetPath);
if (source === target) throw new Error("The export and database paths must be different.");
if (!existsSync(source) || !statSync(source).isFile()) throw new Error("D1 export file is missing.");
if (existsSync(target)) throw new Error("Refusing to overwrite an existing MG database.");

const sourceBytes = statSync(source).size;
if (sourceBytes < 1024 || sourceBytes > 512 * 1024 * 1024) throw new Error("D1 export size is outside the accepted range.");

process.umask(0o077);
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const sql = readFileSync(source, "utf8");
if (!/^\s*(?:PRAGMA|BEGIN|CREATE TABLE)\b/i.test(sql)) throw new Error("The input does not look like a SQLite/D1 export.");

let db;
try {
  db = new Database(target, { timeout: 5000 });
  db.pragma("foreign_keys = OFF");
  db.exec(sql);
  db.pragma("foreign_keys = ON");

  const integrity = db.pragma("integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error("Imported database integrity check failed.");
  }
  const foreignKeys = db.pragma("foreign_key_check");
  if (foreignKeys.length) throw new Error("Imported database has foreign-key violations.");

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length < 10) throw new Error("Imported database has fewer tables than expected.");
  const rowCount = tables.reduce((sum, table) => sum + Number(db.prepare(`SELECT COUNT(*) AS count FROM \"${table.name.replaceAll("\"", "\"\"")}\"`).get().count), 0);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.close();
  db = null;
  chmodSync(target, 0o600);
  process.stdout.write(`Imported MG database: ${tables.length} tables, ${rowCount} rows; integrity and foreign keys OK.\n`);
} catch (error) {
  try { db?.close(); } catch {}
  for (const candidate of [target, `${target}-wal`, `${target}-shm`]) {
    try { rmSync(candidate, { force: true }); } catch {}
  }
  throw error;
}
