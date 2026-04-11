import * as assert from "node:assert";

import { Page } from "playwright";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import { ExtensionApi } from "../../extension";

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

export async function videoDelay(_label: string, multiplier = 1) {
  if (process.env.XVFB_FFMPEG_PID) {
    const ms = 100 * multiplier;
    await delay(ms);
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

  extension.exports.__watchOutput(debugValue, (line) =>
    // eslint-disable-next-line no-console
    console.log("[Extension Log]", line),
  );

  return extension.exports;
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
