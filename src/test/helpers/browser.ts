import * as assert from "node:assert";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import * as vscode from "vscode";

import { getAppHostByIndex } from "../../host-config";

import { colorText } from "./colors";
import {
  isBrowserSpam,
  isCriticalPath,
  timeline,
} from "./critical-path-timeline";
import { isHeadless, isRecording } from "./is-recording";
import { screenshot, waitFor } from "./test-utils";

export type BrowserPage = {
  context: BrowserContext;
  page: Page;
};

export async function launchBrowser({
  headless = isHeadless,
}: {
  headless?: boolean;
} = {}) {
  return chromium.launch({ headless, slowMo: headless ? 0 : 50 });
}

let blockSessionLink = false;

export function blockSessionLinkCapture(block: boolean) {
  blockSessionLink = block;
}

declare global {
  var playwrightPage: Page;
  var testName: string;
  var screenshotIndex: number;
  var captureSessionLink: ((url: string) => void) | undefined;
}

export async function createBrowserPage(
  browser: Browser,
): Promise<BrowserPage> {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: "playwright/.auth/user.json",
    viewport: { width: 1440, height: 900 },
    recordVideo:
      isRecording && isHeadless
        ? {
            dir: "playwright/videos",
            showActions: {},
          }
        : undefined,
  });

  context.on("console", (msg) => {
    const txt = msg.text().replaceAll(/%c| color: [\w#]+/g, "");

    // Suppress known platform/Miro spam without recording or printing.
    if (isBrowserSpam(txt)) {
      return;
    }

    // Record critical-path events to the per-test timeline.
    const msgType = msg.type() === "error" ? "error" : "log";
    if (isCriticalPath(txt)) {
      timeline.record("browser", msgType, txt);
    }

    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.log(colorText("error", "[Browser]"), txt);
    } else {
      // eslint-disable-next-line no-console
      console.log(colorText("browserLog", "[Browser]"), txt);
    }
  });

  context.on("weberror", (error) => {
    // eslint-disable-next-line no-console
    console.log(colorText("error", "[Browser] WebError:"), error.error());
  });
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

  // Inject a global captureSessionLink function so the real Next app can hand
  // the extension its vscode:// session URL.
  await page.exposeFunction("captureSessionLink", (url: string) => {
    if (blockSessionLink) {
      return;
    }
    const parsedUrl = new URL(url);
    const sessionId = parsedUrl.pathname.match(/\/session\/([^/]+)$/)?.[1];
    const key = parsedUrl.searchParams.get("key");
    assert.ok(sessionId, "Session ID should be present in the URL path");
    assert.ok(key, "Session key should be present in the URL");

    vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.parse(parsedUrl.toString()),
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
  const host = getAppHostByIndex(1);

  await page.goto(new URL("/test", `${host}/`).toString(), {
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
