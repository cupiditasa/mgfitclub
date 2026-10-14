import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const releaseId = process.argv[2];
if (!/^[a-z0-9-]{8,48}$/i.test(releaseId || "")) {
  throw new Error("Pass a safe release identifier, for example mg-20261014-01.");
}

const paths = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const segments = (path) => path.split("/");
const excludeShared = (path) => segments(path).some((part) => ["node_modules", ".wrangler", ".private-backups", ".playwright-cli"].includes(part));
const staticPaths = paths.filter((path) =>
  !path.startsWith("backend/") &&
  !path.startsWith("docs/") &&
  !path.startsWith("tools/") &&
  !path.startsWith("attendance-bridge/") &&
  !excludeShared(path) &&
  !/\.(?:env|sql|sqlite|sqlite3|db)(?:$|\.)/i.test(path)
);
const backendPaths = paths.filter((path) => path.startsWith("backend/") && !excludeShared(path));
if (!staticPaths.includes("index.html") || !backendPaths.includes("backend/worker.js")) {
  throw new Error("Release inputs are incomplete.");
}

const outputDirectory = process.env.MG_RELEASE_OUTPUT_DIR || tmpdir();
const staticArchive = join(outputDirectory, `${releaseId}-site.tar.gz`);
const backendArchive = join(outputDirectory, `${releaseId}-backend.tar.gz`);
for (const output of [staticArchive, backendArchive]) {
  try { statSync(output); throw new Error(`Refusing to overwrite ${output}.`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

execFileSync("git", ["archive", "--format=tar.gz", "--output", staticArchive, "HEAD", "--", ...staticPaths], { cwd: repoRoot, stdio: "inherit" });
execFileSync("git", ["archive", "--format=tar.gz", "--output", backendArchive, "HEAD", "--", ...backendPaths], { cwd: repoRoot, stdio: "inherit" });
process.stdout.write(JSON.stringify({
  releaseId,
  staticFiles: staticPaths.length,
  backendFiles: backendPaths.length,
  staticBytes: statSync(staticArchive).size,
  backendBytes: statSync(backendArchive).size,
  archives: [staticArchive, backendArchive],
}) + "\n");
