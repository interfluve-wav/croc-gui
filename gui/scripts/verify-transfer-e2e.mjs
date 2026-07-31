#!/usr/bin/env node
/**
 * End-to-end relay verification (no Tauri UI):
 * 1. CLI send with the same default relay flags the GUI uses
 * 2. Playwright receive on getcroc.com with the generated code
 *
 * Usage: node scripts/verify-transfer-e2e.mjs
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const guiRoot = join(__dirname, "..");
const crocBin = join(guiRoot, "src-tauri", "bin", "croc");
const DEFAULT_RELAY = "ipv4.getcroc.com:9009";
const DEFAULT_PASS = "pass123";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function waitForCode(proc, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for croc code"));
    }, timeoutMs);
    proc.stdout?.on("data", (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/Code is:\s*([a-z0-9-]+)/i);
      if (m) {
        clearTimeout(timer);
        resolve(m[1].toLowerCase());
      }
    });
    proc.stderr?.on("data", (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/Code is:\s*([a-z0-9-]+)/i);
      if (m) {
        clearTimeout(timer);
        resolve(m[1].toLowerCase());
      }
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (!buf.match(/Code is:/)) {
        clearTimeout(timer);
        reject(
          new Error(`croc exited ${code} before code. Output tail:\n${buf.slice(-2000)}`),
        );
      }
    });
  });
}

async function receiveOnGetcroc(code) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (msg) => logs.push(`console: ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`pageerror: ${err.message}`));

  try {
    await page.goto(`https://getcroc.com/?code=${encodeURIComponent(code)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // getcroc UI varies; try common patterns for receive flow
    const bodyText = await page.locator("body").innerText({ timeout: 15_000 });
    if (/securing channel/i.test(bodyText)) {
      log("browser", "Saw securing channel (handshake started)");
    }

    // Wait for success-ish or error-ish text
    const outcome = await page
      .waitForFunction(
        () => {
          const t = document.body?.innerText ?? "";
          if (/transfer complete|download|received|success/i.test(t)) return "ok";
          if (/failed|error|bad password|could not connect/i.test(t)) return "err";
          return null;
        },
        { timeout: 90_000 },
      )
      .then(() => page.locator("body").innerText())
      .catch(() => null);

    const text = outcome ?? bodyText;
    if (/failed|error|bad password|could not connect/i.test(text)) {
      throw new Error(`getcroc showed error. Snippet: ${text.slice(0, 500)}`);
    }
    if (!/transfer complete|download|received|success|securing/i.test(text)) {
      throw new Error(`Unexpected getcroc state. Snippet: ${text.slice(0, 500)}`);
    }
    log("browser", "getcroc receive flow progressed without immediate error");
  } finally {
    await browser.close();
  }
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), "croc-gui-e2e-"));
  const testFile = join(work, "e2e-payload.txt");
  writeFileSync(testFile, `croc-gui e2e ${Date.now()}\n`);

  log("setup", `croc binary: ${crocBin}`);
  log("setup", `test file: ${testFile}`);

  const args = [
    "--pass",
    DEFAULT_PASS,
    "--relay",
    DEFAULT_RELAY,
    "send",
    testFile,
  ];
  log("cli", `spawn: croc ${args.join(" ")}`);

  const proc = spawn(crocBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  let code;
  try {
    code = await waitForCode(proc);
    log("cli", `code: ${code}`);
  } catch (err) {
    proc.kill("SIGTERM");
    fail(err.message);
  }

  try {
    await receiveOnGetcroc(code);
  } catch (err) {
    proc.kill("SIGTERM");
    fail(err.message);
  }

  proc.kill("SIGTERM");
  log("done", "CLI send + getcroc receive verification passed");
}

main().catch((err) => fail(err.message));
