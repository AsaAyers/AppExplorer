import * as assert from "node:assert";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import * as vscode from "vscode";

import { screenshot, waitFor } from "./test-utils";

export type BrowserPage = {
  context: BrowserContext;
  page: Page;
};

export async function launchBrowser() {
  const HEADLESS = process.env.HEADLESS || "true";
  return chromium.launch({ headless: HEADLESS === "true" });
}

let blockSessionLink = false;

export function blockSessionLinkCapture(block: boolean) {
  blockSessionLink = block;
}

declare global {
  var playwrightPage: Page;
  var testName: string;
  var screenshotIndex: number;
}

export async function createBrowserPage(
  browser: Browser,
): Promise<BrowserPage> {
  const context = await browser.newContext();
  // Enable access to local resources
  await context.grantPermissions([
    "camera",
    "microphone",
    "local-network-access",
  ]);

  const page = await context.newPage();
  globalThis.playwrightPage = page;
  blockSessionLinkCapture(false);

  const debugValue = process.env.DEBUG || "";
  await page.exposeBinding("getDebugNamespace", () => debugValue);
  await page.exposeFunction("captureBrowserLogs", (message: string) => {
    // eslint-disable-next-line no-console
    console.log("[Browser Log]", message);
  });

  // Inject a global captureSessionLink function to capture the URL to extract the ID and key when it is clicked.
  await page.exposeFunction("captureSessionLink", (url: URL) => {
    if (blockSessionLink) {
      return;
    }
    const id = url.searchParams.get("id");
    const key = url.searchParams.get("key");
    assert.ok(id, "Session ID should be present in the URL");
    assert.ok(key, "Session key should be present in the URL");

    // The extension handles vscode:// URLS. Pass the captured URL into
    // VSCode, not using a custom event but by triggering a built in command
    // that will route it to the correct handler.
    vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.parse(url.toString()),
    );
  });

  return { context, page };
}

export async function closeBrowser(browser: Browser | undefined) {
  if (browser) {
    await browser.close();
  }
}

export async function closeBrowserContext(
  mochaContext: Mocha.Context,
  context: BrowserContext | undefined,
) {
  if (context) {
    const didPass = mochaContext.currentTest?.state === "passed";
    if (!didPass) {
      await screenshot(`${mochaContext.currentTest?.title}_FAIL.png`);
    }

    await context.close();
  }
}

export async function establishBrowserSession() {
  const page = globalThis.playwrightPage;
  assert.ok(page, "Page should be available for the test");

  await page.goto("https://dev.appexplorer.dev/test", {
    waitUntil: "domcontentloaded",
  });

  const shouldUseInsidersProtocol = vscode.env.appName
    .toLowerCase()
    .includes("insider");
  const startSessionButton = shouldUseInsidersProtocol
    ? page.locator("text=VSCode Insiders")
    : page.locator("text=Start Session");
  await startSessionButton.waitFor({ state: "visible" });

  // Make sure the iframe has loaded before clicking the session button.
  const miroIframe = page.frameLocator("iframe");
  await miroIframe.locator("text=Miro opens this page").waitFor({
    state: "visible",
  });

  // 1) Click the button to start a session.
  await startSessionButton.click();

  // 2) Wait for the start button to disappear.
  await waitFor(async () => {
    const count = await page?.locator("text=Start Session").count();
    assert.equal(count, 0, "Start Session button should be removed");
  });

  const sessionConnected = page.locator('span:has-text("Session Connected:")');
  await sessionConnected.waitFor({ state: "visible" });
}
