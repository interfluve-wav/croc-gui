#!/usr/bin/env node
/**
 * Copy a platform-native croc binary into gui/src-tauri/bin/
 * for Tauri resource bundling.
 *
 * Usage:
 *   node scripts/bundle-croc.mjs              # from PATH or CROC_BIN
 *   node scripts/bundle-croc.mjs --download   # fetch latest GitHub release
 *   CROC_BIN=/path/to/croc node scripts/bundle-croc.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const binDir = join(root, "src-tauri", "bin");
const isWin = process.platform === "win32";
const destName = isWin ? "croc.exe" : "croc";
const dest = join(binDir, destName);

const wantDownload = process.argv.includes("--download");

function which(cmd) {
  const probe = isWin ? "where" : "command";
  const args = isWin ? [cmd] : ["-v", cmd];
  const result = spawnSync(probe, args, { encoding: "utf8" });
  if (result.status !== 0) return null;
  const line = (result.stdout || "").split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || null;
}

function ensureBinDir() {
  mkdirSync(binDir, { recursive: true });
}

function finalize(source) {
  ensureBinDir();
  copyFileSync(source, dest);
  if (!isWin) {
    chmodSync(dest, 0o755);
  }
  // Remove the other OS name if present so resources stay unambiguous.
  const other = join(binDir, isWin ? "croc" : "croc.exe");
  if (existsSync(other)) {
    try {
      rmSync(other);
    } catch {
      /* ignore */
    }
  }
  console.log(`Bundled ${source} → ${dest}`);
}

function findInDir(dir, names) {
  for (const name of names) {
    const p = join(dir, name);
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = findInDir(join(dir, entry.name), names);
    if (nested) return nested;
  }
  return null;
}

function assetForHost() {
  const arch = process.arch; // arm64 | x64 | ia32
  if (process.platform === "darwin") {
    return arch === "arm64"
      ? "macOS-ARM64.tar.gz"
      : "macOS-64bit.tar.gz";
  }
  if (process.platform === "win32") {
    if (arch === "arm64") return "Windows-ARM64.zip";
    return "Windows-64bit.zip";
  }
  // linux and others
  if (arch === "arm64") return "Linux-ARM64.tar.gz";
  return "Linux-64bit.tar.gz";
}

function downloadLatest() {
  const suffix = assetForHost();
  const api = "https://api.github.com/repos/schollz/croc/releases/latest";
  console.log("Fetching latest croc release metadata…");
  const metaRaw = execFileSync("curl", ["-fsSL", api], { encoding: "utf8" });
  const meta = JSON.parse(metaRaw);
  const asset = (meta.assets || []).find((a) =>
    String(a.name).endsWith(`_${suffix}`),
  );
  if (!asset) {
    throw new Error(
      `No release asset ending with _${suffix} in ${meta.tag_name || "latest"}`,
    );
  }

  const tmp = mkdtempSync(join(tmpdir(), "croc-gui-"));
  const archive = join(tmp, asset.name);
  console.log(`Downloading ${asset.name}…`);
  execFileSync("curl", ["-fsSL", "-o", archive, asset.browser_download_url], {
    stdio: "inherit",
  });

  if (asset.name.endsWith(".zip")) {
    execFileSync("unzip", ["-qo", archive, "-d", tmp], { stdio: "inherit" });
  } else {
    execFileSync("tar", ["-xzf", archive, "-C", tmp], { stdio: "inherit" });
  }

  const found = findInDir(tmp, ["croc", "croc.exe"]);
  if (!found) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error("Downloaded archive did not contain a croc binary");
  }

  // Move into place then clean temp
  ensureBinDir();
  const staged = join(tmp, destName);
  if (found !== staged) {
    copyFileSync(found, staged);
  }
  finalize(staged);
  rmSync(tmp, { recursive: true, force: true });
}

function fromPathOrEnv() {
  const fromEnv = process.env.CROC_BIN;
  if (fromEnv) {
    if (!existsSync(fromEnv) || !statSync(fromEnv).isFile()) {
      throw new Error(`CROC_BIN is set but not a file: ${fromEnv}`);
    }
    finalize(fromEnv);
    return;
  }

  const found = which("croc") || which("croc.exe");
  if (!found) {
    throw new Error(
      "croc not found on PATH. Install croc, set CROC_BIN, or run with --download.",
    );
  }
  finalize(found);
}

try {
  if (wantDownload) {
    downloadLatest();
  } else {
    fromPathOrEnv();
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
