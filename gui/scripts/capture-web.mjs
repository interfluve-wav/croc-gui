#!/usr/bin/env node
/** Capture Croc GUI docs screenshots via Vite dev + ?capture= query (Playwright). */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../docs/images/screenshots");
const BASE_URL = process.env.CROC_GUI_URL ?? "http://localhost:1420";

const shots = [
  { name: "send", query: "capture=send" },
  { name: "receive", query: "capture=receive" },
  { name: "options", query: "capture=options" },
  { name: "about", query: "capture=about" },
  { name: "progress", query: "capture=progress" },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 720, height: 640 } });

  for (const { name, query } of shots) {
    await page.goto(`${BASE_URL}/?${query}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(name === "progress" ? 800 : 400);
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("captured", file);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
