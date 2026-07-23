#!/usr/bin/env node
/**
 * Capture Croc GUI UI states via Vite dev server (Playwright).
 * Used when native Tauri window automation is unavailable.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../docs/images/screenshots");
const BASE_URL = process.env.CROC_GUI_URL ?? "http://localhost:1420";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 720, height: 640 } });
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  const shot = async (name) => {
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("captured", file);
  };

  // Send (default)
  await shot("send-web");

  // Receive tab
  await page.getByRole("button", { name: "Receive" }).click();
  await page.waitForTimeout(300);
  await shot("receive");

  // About dialog
  await page.getByRole("button", { name: "About" }).click();
  await page.waitForTimeout(300);
  await shot("about");
  await page.keyboard.press("Escape");

  // Options expanded (Send tab)
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: /options/i }).click();
  await page.waitForTimeout(300);
  await shot("options-web");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
