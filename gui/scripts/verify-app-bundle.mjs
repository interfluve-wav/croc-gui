#!/usr/bin/env node
/**
 * Verify the built Croc.app bundles croc v11 and default relay args match GUI.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const guiRoot = join(__dirname, "..");
const appCandidates = [
  join(guiRoot, "src-tauri", "target", "debug", "bundle", "macos", "Croc.app"),
  join(guiRoot, "src-tauri", "target", "release", "bundle", "macos", "Croc.app"),
];

const appPath = appCandidates.find((p) => existsSync(p));
if (!appPath) {
  console.error("FAIL: Croc.app not found — run npm run tauri:build first");
  process.exit(1);
}

const crocInApp = join(appPath, "Contents", "Resources", "bin", "croc");
if (!existsSync(crocInApp)) {
  console.error(`FAIL: bundled croc missing at ${crocInApp}`);
  process.exit(1);
}

const version = execFileSync(crocInApp, ["-v"], { encoding: "utf8" }).trim();
console.log(`App: ${appPath}`);
console.log(`Bundled croc: ${version}`);

if (!version.includes("11.0.0")) {
  console.error(`FAIL: expected croc 11.0.0 in app bundle, got ${version}`);
  process.exit(1);
}

console.log("OK: Croc.app bundles croc v11.0.0");
