import * as assert from "node:assert";

import baseDebug from "debug";
import { Page } from "playwright";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import { ExtensionApi } from "../../extension";
import { LOCAL_RELAY_HEALTH_URL, type HostIndex } from "../../host-config";

import { colorText } from "./colors";
import { isCriticalPath, timeline } from "./critical-path-timeline";
import { isRecording } from "./is-recording";

import { makeSessionUrl, parseSessionUri } from "@/app-explorer-session";
import { createDebug } from "@/utils/create-debug";

const debug = createDebug("app-explorer:test-utils");

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type Options = {
  name?: string;
  timeout?: number;
  interval?: number;
  message?: string;
  page?: Page;
};

export async function waitForValue<T>(
  getValue: () => T | undefined,
  {
    name = "Value",
    timeout = 25000,
    interval = 500,
    message = `${name} not found within timeout period`,
  }: Options = {},
) {
  return waitFor(
    async () => {
      const value = await getValue();
      assert.ok(value !== undefined, message);
      return value;
    },
    { timeout, interval, message },
  );
}

export async function waitFor<T>(
  assertion: () => Promise<T> | T,
  { timeout = 1000, interval = 250, message }: Options = {},
): Promise<T> {
  const start = Date.now();

  while (true) {
    try {
      const result = await assertion();
      return result;
    } catch (e) {
      if (Date.now() - start >= timeout) {
        if (message) {
          throw new assert.AssertionError({
            message: `${message}\nLast error: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
        throw e;
      }
      await delay(interval);
    }
  }
}

export async function screenshot(
  label = `${globalThis.testName}_${globalThis.screenshotIndex++}`,
) {
  const page = globalThis.playwrightPage as Page;
  invariant(page, "Page should be defined for screenshot");
  await page.screenshot({
    path: `screenshots/${label}.png`,
    type: "png",
  });
}

export async function videoDelay(label: string, multiplier = 1) {
  if (isRecording) {
    debug(`Video delay: ${label} (multiplier: ${multiplier})`);
    const ms = 100 * multiplier;
    await delay(ms);
  } else {
    debug(`No delay: ${label}`);
  }
}

export async function activateAppExplorer() {
  // Ensure extension is activated
  const extension = vscode.extensions.getExtension<ExtensionApi>(
    "asa-ayers.app-explorer",
  );
  assert.ok(extension, "Extension should be found");
  if (extension && !extension.isActive) {
    await extension.activate();
  }
  const debugValue = process.env.DEBUG || "";

  baseDebug.enable(debugValue);
  baseDebug.log(`Activated extension with DEBUG=${debugValue}`);
  extension.exports.__watchOutput(debugValue, (line) => {
    // eslint-disable-next-line no-console
    console.log(colorText("extensionLog", "[Extension Log]"), line);
    // Record critical-path extension log lines to the per-test timeline.
    if (isCriticalPath(line)) {
      timeline.record("extension", "log", line);
    }
  });

  await waitForLegacyRelayHealth();
  return extension.exports;
}

export async function waitForLegacyRelayHealth() {
  await waitFor(
    async () => {
      const response = await fetch(LOCAL_RELAY_HEALTH_URL);
      assert.equal(response.status, 200);
    },
    {
      timeout: 15000,
      interval: 500,
      message: "AppExplorer server did not start after session launch",
    },
  );
}

export async function startAppExplorerSession(
  page: Page,
  hostIndex: HostIndex = 1,
) {
  await activateAppExplorer();

  const sidebar = getSidebar(page);
  const sessionButton = sidebar.getByRole("link", {
    name: "Start VSCode session",
    exact: true,
  });
  await sessionButton.waitFor({ state: "visible" });
  await sessionButton.getAttribute("href").then((href) => {
    invariant(href, "Session button href should be defined");
    const session = parseSessionUri(href);
    session.hostIndex = hostIndex;
    const newHref = makeSessionUrl(session);
    return sessionButton.evaluate(
      (el, newHref) => el.setAttribute("href", newHref),
      newHref,
    );
  });

  await sessionButton.click();
}

export function uriForFile(filePath: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  assert.equal(
    workspaceFolders?.length,
    1,
    "Expected exactly 1 workspace folder",
  );
  const workspaceUri = workspaceFolders?.[0].uri;
  invariant(workspaceUri, "Workspace URI should be defined");

  const exampleUri = vscode.Uri.joinPath(workspaceUri, filePath);
  return exampleUri;
}
export function getSidebar(page: Page) {
  return page.frameLocator('[data-container-type="library"]:visible');
}
export function getModal(page: Page) {
  return page.frameLocator('[data-testid="iframe-modal-iframe"]:visible');
}
