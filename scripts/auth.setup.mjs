#!/usr/bin/env node

import fs from "node:fs/promises";

import { chromium } from "playwright";

// eslint-disable-next-line no-console
const log = console.log.bind(console);

log("Starting authentication setup...");

export async function setup() {
  const browser = await chromium.launch({ headless: false });

  const storageState = "playwright/.auth/user.json";

  if (await fs.stat(storageState).catch(() => false)) {
    log("Using existing authentication state from", storageState);
    const context = await browser.newContext({
      storageState,
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    log("Waiting for dashboard");
    await page.goto("https://miro.com/app/dashboard/", {
      waitUntil: "domcontentloaded",
    });
    log("done");

    return;
  }

  log("No existing authentication state found. Please log in to Miro.");
  const context = await browser.newContext({});
  const page = await context.newPage();

  await page.goto("https://miro.com/login", {
    waitUntil: "domcontentloaded",
  });

  log("Waiting for dashboard");
  await page.waitForURL("https://miro.com/app/dashboard/", {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });

  log("Saving authentication state to", storageState);
  await context.storageState({ path: "playwright/.auth/user.json" });

  log("close browser");
  await context.close();
}

setup()
  .catch((error) => {
    console.error("Error during auth setup:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
