import Database from "better-sqlite3";
import { chmodSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";

const sourcePath = process.env.MG_DB_PATH;
const backupDirectory = process.env.MG_BACKUP_DIR;

if (!sourcePath || !backupDirectory) throw new Error("MG_DB_PATH and MG_BACKUP_DIR must be set.");
if (sourcePath === ":memory:") throw new Error("In-memory databases cannot be backed up.");
if (!isAbsolute(backupDirectory) || resolve(backupDirectory) === dirname(resolve(backupDirectory))) {
  throw new Error("MG_BACKUP_DIR must be a dedicated absolute directory, not a filesystem root.");
}

process.umask(0o077);
mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replaceAll(":", "-");
const fileName = `mg-fitclub-${timestamp}.sqlite`;
const backupPath = join(backupDirectory, fileName);
const temporaryPath = `${backupPath}.tmp`;
const database = new Database(resolve(sourcePath), { readonly: true, fileMustExist: true, timeout: 5000 });

try {
  await database.backup(temporaryPath);
} catch (error) {
  try { unlinkSync(temporaryPath); } catch {}
  throw error;
} finally {
  database.close();
}

chmodSync(temporaryPath, 0o600);
renameSync(temporaryPath, backupPath);
process.stdout.write(`MG database backup created: ${basename(backupPath)}\n`);
