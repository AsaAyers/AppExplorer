import * as assert from "node:assert";
import fs from "node:fs";

import baseDebug from "debug";
import { Page } from "playwright";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import { makeSessionUrl, parseSessionUri } from "@/app-explorer-session";
import { ExtensionApi } from "@/extension";
import { type HostIndex } from "@/host-config";
import { colorText } from "@/test/helpers/colors";
import {
  isCriticalPath,
  timeline,
} from "@/test/helpers/critical-path-timeline";
import { isRecording } from "@/test/helpers/is-recording";
import { createDebug } from "@/utils/create-debug";

const debug = createDebug("app-explorer:test-utils");
const testDebugValue = process.env.DEBUG || "app-explorer:*";

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
    "AsaAyers.app-explorer",
  );
  assert.ok(extension, "Extension should be found");
  if (extension && !extension.isActive) {
    await extension.activate();
  }
  baseDebug.enable(testDebugValue);
  baseDebug.log(`Activated extension with DEBUG=${testDebugValue}`);
  extension.exports.__watchOutput(testDebugValue, (line) => {
    // eslint-disable-next-line no-console
    console.log(colorText("extensionLog", "[Extension Log]"), line);
    // Record critical-path extension log lines to the per-test timeline.
    if (isCriticalPath(line)) {
      timeline.record("extension", "log", line);
    }
  });

  return extension.exports;
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
    return sessionButton
      .evaluate((el, nextHref) => {
        el.setAttribute("href", nextHref);
        globalThis.captureSessionLink = () => undefined;
        return nextHref;
      }, newHref)
      .then(async (nextHref) => {
        await sessionButton.click();
        await vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.parse(nextHref),
        );
      });
  });
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
export async function saveVideo(page: Page | undefined, newVideoPath: string) {
  const videoPath = await page?.video()?.path();
  if (videoPath) {
    // Rename video to paywright/videos/{testName}.webm
    await fs.promises.rename(videoPath, newVideoPath);
  }
}
