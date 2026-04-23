/* eslint-disable no-console */
import assert from "node:assert";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";

import { suite } from "mocha";
import { Browser, BrowserContext, Page } from "playwright";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import { getHostConfig, testHosts, type HostIndex } from "@/host-config";
import { launchBrowser, createBrowserPage } from "@/test/helpers/browser";
import { setupTimeline } from "@/test/helpers/critical-path-timeline";
import {
  activateAppExplorer,
  getModal,
  getSidebar,
  startAppExplorerSession,
  uriForFile,
  videoDelay,
  waitFor,
} from "@/test/helpers/test-utils";
import { createDebug } from "@/utils/create-debug";

export const log = createDebug("app-explorer:create-card-test");

const storageState = "playwright/.auth/user.json";
const storageStateExists = fs.existsSync(storageState);
const developmentAppHealthUrl = "https://dev.appexplorer.dev/api/health-check";
const localServerHealthUrl = "http://127.0.0.1:3000/api/health-check";

const appCardSelector = ".app-card";
const cardTitleSelector = ".app-card--title";
const suiteFn =
  storageStateExists && !process.env.SKIP_E2E ? suite : suite.skip;

suiteFn("Create Card", function () {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let localAppServer: ChildProcess | undefined;
  void context;

  setupTimeline();
  suiteSetup(async function () {
    this.timeout(60000);

    const developmentAppServer = await ensureDevelopmentAppHost();
    if (developmentAppServer === null) {
      this.skip();
      return;
    }
    localAppServer = developmentAppServer;
    browser = await launchBrowser();
    ({ context, page } = await createBrowserPage(browser, "Create Card"));
  });

  setup(async function () {
    await activateAppExplorer();
    await vscode.commands.executeCommand("app-explorer.disconnectSession");
    invariant(page, "Page should be defined after suiteSetup");
    await page.goto("about:blank", { waitUntil: "domcontentloaded" });
  });

  suiteTeardown(async function () {
    if (page) {
      await page.screencast.stop();
    }
    await videoDelay("teardown delay", 2);

    await context?.close();
    if (localAppServer && !localAppServer.killed) {
      await stopChildProcess(localAppServer);
    }
  });

  for (const hostIndex of testHosts) {
    test("Creating and deleting a board card updates code lenses in VS Code", async function () {
      this.timeout(1200000);
      invariant(page, "Page should be defined after setup");
      await page.screencast.showChapter("Create a card from code", {
        description:
          "Choose a symbol in VS Code, add it to the board, and watch AppExplorer add and remove the matching CodeLens in the editor.",
      });
      await openTestBoard(page, hostIndex);
      await startAppExplorerSession(page, hostIndex);
      await videoDelay("plaintext card relay test start", 5);

      const helpersURI = uriForFile("src/utils/helpers.ts");
      const helpersDoc = await vscode.workspace.openTextDocument(helpersURI);
      const helpersEditor = await vscode.window.showTextDocument(helpersDoc, {
        preview: false,
      });

      log("(test)", "Selecting isValidEmail in helpers.ts");
      const isValidEmailIndex = helpersDoc
        .getText()
        .indexOf("export function isValidEmail");
      assert.notStrictEqual(
        isValidEmailIndex,
        -1,
        'Expected "isValidEmail" in helpers.ts',
      );
      const isValidEmailPosition = helpersDoc.positionAt(isValidEmailIndex);
      helpersEditor.selection = new vscode.Selection(
        isValidEmailPosition,
        isValidEmailPosition,
      );
      await videoDelay("selected isValidEmail", 2);

      await waitForAppExplorerCodeLenses(helpersURI, []);

      const pageWidthInPixels = await page.evaluate(() => window.innerWidth);
      const pageHeightInPixels = await page.evaluate(() => window.innerHeight);
      const targetXY = [
        pageWidthInPixels * 0.55,
        pageHeightInPixels * 0.3,
      ] as const;

      const title = "isValidEmail";

      log("(test)", "Dragging card to board");
      await dragCardToBoard(page, /isValidEmail$/, targetXY);
      await getModal(page).getByLabel("Title").waitFor({ state: "visible" });
      await getModal(page).getByLabel("Title").fill(title);

      await waitForAppExplorerCodeLenses(helpersURI, ["isValidEmail"]);

      log("(test)", "Rename card");
      await getModal(page).getByRole("button", { name: "Save" }).click();
      await waitForAppExplorerCodeLenses(helpersURI, [title]);

      log("(test)", "Remove card");
      await removeMiroCardByTitle(page, title);
      await waitForAppExplorerCodeLenses(helpersURI, []);
    });

    test("Builds a connected board from code and navigates through it", async function () {
      this.timeout(1200000);
      invariant(page, "Page should be defined after setup");
      await page.screencast.showChapter("Build an architecture board", {
        description:
          "Create several cards from code, connect them on the board, and verify that board actions navigate back to the right code.",
      });
      await openTestBoard(page, hostIndex);
      await startAppExplorerSession(page, hostIndex);
      await videoDelay("test start", 5);

      // Step 1: Open UserProfile.ts and jump to where generateId is called in the constructor
      const userProfileURI = uriForFile("src/components/UserProfile.ts");
      const userProfileDoc =
        await vscode.workspace.openTextDocument(userProfileURI);
      const userProfileEditor = await vscode.window.showTextDocument(
        userProfileDoc,
        { preview: false },
      );

      const sessionIdIndex = userProfileDoc
        .getText()
        .indexOf("sessionId: generateId");
      assert.notStrictEqual(
        sessionIdIndex,
        -1,
        'Expected "sessionId: generateId" to exist in UserProfile.ts',
      );
      const sessionIdPosition = userProfileDoc.positionAt(sessionIdIndex);
      userProfileEditor.selection = new vscode.Selection(
        sessionIdPosition,
        sessionIdPosition,
      );
      await videoDelay("openUserProfile", 2);

      // Step 2: Wait for 3-deep card stack: UserProfile, UserProfile/constructor, UserProfile/constructor/sessionId
      const sidebar = getSidebar(page);
      await waitFor(
        async () => {
          assert.equal(await sidebar.locator(appCardSelector).count(), 3);
        },
        {
          timeout: 10000,
          interval: 500,
          message: "Expected the sidebar symbol stack to contain 3 cards",
        },
      );
      await videoDelay("3 cards");

      await sidebar
        .locator(appCardSelector)
        .locator(cardTitleSelector)
        .getByText(/sessionId$/)
        .waitFor({ state: "visible" });

      const { scale, viewport, testFrame } =
        await page.evaluate(zoomToTestFrame);

      const frameTarget = {
        x: testFrame.x,
        y: testFrame.y - testFrame.height / 2,
      };
      const cornerScreenCoordinates = {
        x: (frameTarget.x - viewport.x) * scale,
        y: (frameTarget.y - viewport.y) * scale,
      };

      const centerX = cornerScreenCoordinates.x;
      const topY = cornerScreenCoordinates.y;
      const horizontalGap = 500 * scale;
      const verticalGap = 250 * scale;

      const userProfileXY = [centerX, topY + verticalGap] as const;
      const sessionXY = [centerX, topY + verticalGap * 2] as const;
      const generateIdXY = [
        centerX + horizontalGap,
        topY + verticalGap * 2,
      ] as const;
      const isValidEmailXY = [
        centerX + horizontalGap,
        topY + verticalGap * 3,
      ] as const;

      await dragCardToBoard(page, /^UserProfile$/, userProfileXY);
      await getModal(page).getByRole("button", { name: "Save" }).click();
      selectMiroCardByTitle(page, /^UserProfile$/);

      await dragCardToBoard(page, /sessionId$/, sessionXY);
      await getModal(page).getByRole("button", { name: "Save" }).click();

      // Step 4: Go to definition on generateId, then drag the generateId card below and left of UserProfile
      const generateIdCallIndex = userProfileDoc
        .getText()
        .indexOf("generateId(12)");
      assert.notStrictEqual(
        generateIdCallIndex,
        -1,
        'Expected "generateId(12)" in UserProfile.ts',
      );
      userProfileEditor.selection = new vscode.Selection(
        userProfileDoc.positionAt(generateIdCallIndex),
        userProfileDoc.positionAt(generateIdCallIndex),
      );
      await videoDelay("Selected generateId");
      await vscode.commands.executeCommand("editor.action.revealDefinition");
      await videoDelay("goToDefinition generateId", 2);

      await selectMiroCardByTitle(page, /^UserProfile$/);
      await dragCardToBoard(page, "generateId", generateIdXY);
      await getModal(page).getByRole("button", { name: "Save" }).click();
      const helpersURI = uriForFile("src/utils/helpers.ts");
      await waitForAppExplorerCodeLenses(helpersURI, ["generateId"]);

      // close editors in vscode
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await selectMiroCardByTitle(page, null);
      await videoDelay("No editors open", 2);

      await page.evaluate(zoomToTestFrame);

      // Step 6: Back in helpers.ts, navigate to isValidEmail and drag its card below UserProfile and right of generateId
      const helpersDoc = await vscode.workspace.openTextDocument(helpersURI);
      const helpersEditor = await vscode.window.showTextDocument(helpersDoc, {
        preview: false,
      });

      const isValidEmailIndex = helpersDoc
        .getText()
        .indexOf("export function isValidEmail");
      assert.notStrictEqual(
        isValidEmailIndex,
        -1,
        'Expected "isValidEmail" in helpers.ts',
      );
      helpersEditor.selection = new vscode.Selection(
        helpersDoc.positionAt(isValidEmailIndex),
        helpersDoc.positionAt(isValidEmailIndex),
      );
      await videoDelay("navigated to isValidEmail", 2);

      await waitForAppExplorerCodeLenses(helpersDoc.uri, ["generateId"]);

      await dragCardToBoard(page, /isValidEmail$/, isValidEmailXY);
      await getModal(page).getByRole("button", { name: "Save" }).click();
      await waitForAppExplorerCodeLenses(helpersDoc.uri, [
        "generateId",
        "isValidEmail",
      ]);

      await removeMiroCardByTitle(page, "isValidEmail");
      await waitForAppExplorerCodeLenses(helpersDoc.uri, ["generateId"]);

      log("assertions passed");
    });
  }
});

const testFrameUrl =
  "https://miro.com/app/board/uXjVGjhWRk8=/?moveToWidget=3458764667378076158&cot=14";

async function openTestBoard(page: Page, hostIndex: HostIndex) {
  await page.goto(testFrameUrl, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Close sidebar" }).click();

  await videoDelay("before open");
  await page
    .locator("#CREATION_BAR_ROOT")
    .getByRole("button", {
      name: getHostConfig(hostIndex).miroAppName,
      exact: true,
    })
    .click();

  const sidebar = getSidebar(page);

  await sidebar
    .getByRole("link", { name: "Start VSCode session", exact: true })
    .waitFor({ state: "visible" });

  await sidebar
    .getByText("Explore your code here")
    .waitFor({ state: "visible" });
  await page.evaluate(zoomToTestFrame);
  await videoDelay("cleanFrame");
  await page.evaluate(cleanFrame);

  await videoDelay("Test Board ready");
}

async function isHealthy(url: string) {
  return fetch(url)
    .then((response) => response.ok)
    .catch(() => false);
}

async function ensureDevelopmentAppHost() {
  if (await isHealthy(developmentAppHealthUrl)) {
    return undefined;
  }

  const child = spawn("npm", ["dev"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "3000",
    },
    stdio: "ignore",
  });

  const localServerReady = await waitFor(
    async () => {
      const response = await fetch(localServerHealthUrl).catch(() => undefined);
      assert.equal(response?.status, 200);
    },
    {
      timeout: 15000,
      interval: 500,
      message: localServerHealthUrl + " did not start",
    },
  )
    .then(() => true)
    .catch(() => false);

  if (!localServerReady) {
    await stopChildProcess(child);
    return null;
  }

  const proxiedHostReady = await waitFor(
    async () => {
      const response = await fetch(developmentAppHealthUrl).catch(
        () => undefined,
      );
      assert.equal(response?.status, 200);
    },
    {
      timeout: 5000,
      interval: 500,
      message: developmentAppHealthUrl + " did not start",
    },
  )
    .then(() => true)
    .catch(() => false);

  if (!proxiedHostReady) {
    await stopChildProcess(child);
    return null;
  }

  return child;
}

async function stopChildProcess(child: ChildProcess) {
  if (child.killed) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}
async function zoomToTestFrame() {
  const testFrame = (await miro.board.get({ type: "frame" })).find(
    (f) => f.title === "Automated Test Frame",
  );
  if (!testFrame) {
    throw new Error("Missing Automated Test Frame");
  }
  await miro.board.viewport.zoomTo(testFrame);
  const viewport = await miro.board.viewport.get();
  const scale = await miro.board.viewport.getZoom();

  return {
    scale,
    viewport,
    testFrame: {
      x: testFrame.x,
      y: testFrame.y,
      width: testFrame.width,
      height: testFrame.height,
    },
  };
}

async function cleanFrame() {
  const frame = (await miro.board.get({ type: "frame" })).find(
    (f) => f.title === "Automated Test Frame",
  );
  if (!frame) {
    console.log("Error: Missing Automated Test Frame");
    throw new Error("Missing Automated Test Frame");
  }

  // Sometimes cards don't seem to actually attach to the frame, so we need to find all of the items that intersect the bounding box of the frame.
  const items = await miro.board.get({
    type: ["app_card"],
  });
  const frameItems = items.filter((item) => {
    if (item.parentId === frame.id) {
      console.log(
        `cleanFrame: Found item ${item.title} with parentId ${item.parentId} matching frame id ${frame.id}`,
      );
      return true;
    } else if (item.parentId === null) {
      const intersects =
        Math.abs(item.x - frame.x) < frame.width / 2 &&
        Math.abs(item.y - frame.y) < frame.height / 2;

      if (intersects) {
        console.log(
          `cleanFrame: Found item ${item.title} intersecting with frame: item (${item.x}, ${item.y}), frame (${frame.x}, ${frame.y}, ${frame.width}, ${frame.height})`,
        );
      }
      return intersects;
    }
    return false;
  });

  await Promise.all(frameItems.map((item) => miro.board.remove(item)));
}

async function dragCardToBoard(
  page: Page,
  name: string | RegExp,
  [x, y]: readonly [number, number],
) {
  await page.screencast.showChapter(`Add ${String(name)} to the board`, {
    description: `Drag the ${String(name)} symbol from the AppExplorer sidebar onto the board.`,
  });
  // Wait for generateId card to appear in sidebar (helpers.ts is now active)
  const card = await waitFor(
    async () => {
      const card = selectSidebarCardByTitle(page!, name);
      await card.waitFor({ state: "visible" });

      return card;
    },
    { timeout: 10000 },
  );
  await videoDelay(`${name} sidebar ready`);

  await card.screenshot({
    path: `screenshots/card_${name.toString().replace(/[^a-z0-9]+/gi, "_")}.png`,
  });
  const canvas = page.locator("#main-canvas");
  await page.evaluate(zoomToTestFrame);
  const isXYOnCanvas = await canvas.evaluate(
    (canvas, { x, y }) => {
      const rect = canvas.getBoundingClientRect();
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    },
    { x, y },
  );

  if (!isXYOnCanvas) {
    throw new Error(`Target position (${x}, ${y}) is outside of the canvas`);
  }

  await card.dragTo(canvas, {
    steps: 50,
    timeout: 10000,
    targetPosition: {
      x,
      y,
    },
  });
  await videoDelay("dragged " + name);
}

async function removeMiroCardByTitle(page: Page, title: string | RegExp) {
  await page.screencast.showChapter(`Remove ${String(title)} from the board`, {
    description: `Delete the ${String(title)} card from the board and confirm the editor updates to match.`,
  });
  await page.evaluate(async (title: string | RegExp) => {
    const cards = await miro.board.get({ type: "app_card" });
    const card = cards.find((c) =>
      typeof title === "string"
        ? c.title === title
        : c.title.match(new RegExp(title)),
    );
    if (!card) {
      throw new Error(`Card with title ${title} not found`);
    }
    await miro.board.remove(card);
  }, title);
  await videoDelay(`Removed card ${title}`, 2);
}

async function getAppExplorerCodeLensTitles(documentUri: vscode.Uri) {
  const codeLenses =
    (await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      documentUri,
    )) ?? [];

  return codeLenses
    .map((lens) => lens.command?.title)
    .filter(
      (title): title is string =>
        title?.startsWith("$(app-explorer) ") ?? false,
    )
    .map((title) => title.replace("$(app-explorer) ", ""))
    .filter((title, index, titles) => titles.indexOf(title) === index)
    .sort();
}

async function waitForAppExplorerCodeLenses(
  documentUri: vscode.Uri,
  expectedTitles: string[],
) {
  const sortedExpectedTitles = [...expectedTitles].sort();
  await waitFor(
    async () => {
      const titles = await getAppExplorerCodeLensTitles(documentUri);
      assert.deepEqual(titles, sortedExpectedTitles);
    },
    {
      timeout: 15000,
      interval: 500,
      message: `Expected CodeLens titles ${sortedExpectedTitles.join(", ")}`,
    },
  );
}

async function selectMiroCardByTitle(
  page: Page,
  title: null | string | RegExp,
) {
  await page.screencast.showChapter(
    title === null
      ? "Clear the current board selection"
      : `Select ${String(title)} on the board`,
    {
      description:
        title === null
          ? "Deselect the current board card so the next card can be added on its own."
          : `Focus the ${String(title)} card on the board so the test can continue from that card.`,
    },
  );
  await page.evaluate(async (title: null | string | RegExp) => {
    if (title === null) {
      miro.board.deselect();
      return;
    }
    const cards = await miro.board.get({ type: "app_card" });
    const card = cards.find((c) =>
      typeof title === "string"
        ? c.title === title
        : c.title.match(new RegExp(title)),
    );
    if (!card) {
      throw new Error(`Card with title ${title} not found`);
    }
    await miro.board.select({
      id: card.id,
    });
  }, title);
  await videoDelay(`Selected card ${title}`);
}
function selectSidebarCardByTitle(page: Page, title: string | RegExp) {
  const sidebar = getSidebar(page);
  return sidebar.locator(appCardSelector).filter({
    has: sidebar.locator(cardTitleSelector).getByText(title),
  });
}
