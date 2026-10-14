import Database from "better-sqlite3";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

class SqliteD1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  execute() {
    const statement = this.database.prepare(this.sql);
    if (statement.reader) {
      const results = statement.all(...this.values);
      return { success: true, results, meta: { changes: results.length } };
    }

    const result = statement.run(...this.values);
    return {
      success: true,
      meta: { changes: result.changes, last_row_id: result.lastInsertRowid },
    };
  }

  async run() {
    return this.execute();
  }

  async all() {
    const result = this.execute();
    return result.results ? result : { ...result, results: [] };
  }

  async first(columnName) {
    const result = this.database.prepare(this.sql).get(...this.values);
    return columnName && result ? result[columnName] : result || null;
  }
}

export class SqliteD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new SqliteD1Statement(this.database, sql);
  }

  async batch(statements) {
    if (!Array.isArray(statements)) throw new TypeError("D1 batch expects an array of statements.");
    for (const statement of statements) {
      if (!(statement instanceof SqliteD1Statement) || statement.database !== this.database) {
        throw new TypeError("D1 batch contains a statement from another database.");
      }
    }

    const executeAll = this.database.transaction(() => statements.map((statement) => statement.execute()));
    return executeAll();
  }

  close() {
    this.database.close();
  }
}

export function openSqliteD1(filePath) {
  if (!filePath || filePath === ":memory:") {
    throw new Error("MG_DB_PATH must point to a provisioned on-disk SQLite database.");
  }

  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error("MG database file is missing; refusing to create an empty production database.");
  }

  mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  const database = new Database(absolutePath, { fileMustExist: true, timeout: 5000 });
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("synchronous = FULL");
  return new SqliteD1Database(database);
}
