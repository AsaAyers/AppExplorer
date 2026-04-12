import assert from "node:assert";
import fs from "node:fs";

import { suite } from "mocha";
import { Browser, BrowserContext, Page } from "playwright";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import { createDebug } from "../utils/create-debug";

import { launchBrowser, createBrowserPage } from "./helpers/browser";
import {
  activateAppExplorer,
  uriForFile,
  videoDelay,
  waitFor,
} from "./helpers/test-utils";

const log = createDebug("app-explorer:create-card-test");

createDebug.log("==================================================");

const storageState = "playwright/.auth/user.json";
const storageStateExists = fs.existsSync(storageState);

const appCardSelector = "app-card";
const cardTitleSelector = ".app-card--title";
const suiteFn = storageStateExists ? suite : suite.skip;

suiteFn("Create Card", function () {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  void context;

  suiteSetup(async function () {
    this.timeout(12000);
    await fetch("http://localhost:9042/reset", { method: "POST" }).catch(
      () => null,
    );

    browser = await launchBrowser();
  });

  setup(async function () {
    this.timeout(60000);
    assert.ok(browser, "Browser should be launched in suiteSetup");
    await activateAppExplorer();
    ({ context, page } = await createBrowserPage(browser));
  });

  suiteTeardown(async function () {
    const videoPath = await page?.video()?.path();
    await videoDelay("teardown delay", 2);

    await context?.close();
    if (videoPath) {
      // Rename video to paywright/videos/{testName}.webm
      const newVideoPath = `videos/CreateCard.webm`;
      await fs.promises.rename(videoPath, newVideoPath);
      log(`Saved video to ${newVideoPath}`);
    }
  });

  test("On test board", async function () {
    this.timeout(1200000);
    invariant(page, "Page should be defined after setup");
    await openTestBoard(page);
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
    await waitFor(async () => {
      assert.equal(await sidebar.locator(appCardSelector).count(), 3);
    });
    await videoDelay("3 cards");

    await sidebar
      .locator(appCardSelector)
      .locator(cardTitleSelector)
      .getByText(/sessionId$/)
      .waitFor({ state: "visible" });

    // Step 3: Arrange the 3 stack cards vertically on canvas, starting with UserProfile at the top
    const pageWidthInPixels = await page.evaluate(() => window.innerWidth);
    const pageHeightInPixels = await page.evaluate(() => window.innerHeight);

    const centerX = pageWidthInPixels * 0.5;
    const topY = pageHeightInPixels * 0.2;
    const horizontalGap = pageWidthInPixels * 0.1;
    const verticalGap = pageHeightInPixels * 0.12;

    const userProfileXY = [centerX, topY] as const;
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

    selectMiroCardByTitle(page, /^UserProfile$/);
    await dragCardToBoard(page, "generateId", generateIdXY);
    await getModal(page).getByRole("button", { name: "Save" }).click();
    // close editors in vscode
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await videoDelay("No editors open", 2);

    // Step 5: Return to UserProfile, locate the CodeLens with app-explorer.navigate and trigger it
    await vscode.window.showTextDocument(userProfileDoc, { preview: false });
    await videoDelay("back to UserProfile", 2);

    const navigateLens = await waitFor(
      async () => {
        const codeLenses = await vscode.commands.executeCommand<
          vscode.CodeLens[]
        >("vscode.executeCodeLensProvider", userProfileURI);
        const lens = codeLenses?.find(
          (l) =>
            l.command?.command === "app-explorer.navigate" &&
            l.command.title.includes("UserProfile"),
        );
        assert.ok(
          lens,
          "Expected a CodeLens with app-explorer.navigate on UserProfile",
        );
        return lens;
      },
      { timeout: 10000 },
    );
    invariant(navigateLens.command, "CodeLens command should be defined");
    await vscode.commands.executeCommand(
      navigateLens.command.command,
      ...(navigateLens.command.arguments ?? []),
    );
    await videoDelay("triggered navigate CodeLens", 2);

    // Step 6: Back in helpers.ts, navigate to isValidEmail and drag its card below UserProfile and right of generateId
    const helpersURI = uriForFile("src/utils/helpers.ts");
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

    await dragCardToBoard(page, /isValidEmail$/, isValidEmailXY);

    log("assertions passed");
  });
});

const testFrameUrl =
  "https://miro.com/app/board/uXjVGjhWRk8=/?moveToWidget=3458764667378076158&cot=14";

async function openTestBoard(page: Page) {
  await page.goto(testFrameUrl, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Close sidebar" }).click();

  await videoDelay("before open");
  await page
    .locator("#CREATION_BAR_ROOT")
    .getByRole("button", { name: "AppExplorer" })
    .click();

  const sidebar = getSidebar(page);

  await sidebar
    .getByText("Explore your code here")
    .waitFor({ state: "visible" });
  await page.evaluate(zoomToTestFrame);
  await videoDelay("cleanFrame");
  await page.evaluate(cleanFrame);

  await videoDelay("Test Board ready");
}
async function zoomToTestFrame() {
  const testFrame = (await miro.board.get({ type: "frame" })).find(
    (f) => f.title === "Automated Test Frame",
  );
  if (!testFrame) {
    throw new Error("Missing Automated Test Frame");
  }
  miro.board.viewport.zoomTo(testFrame);
}

function getSidebar(page: Page) {
  return page.frameLocator(
    '[data-miro-app-id="3458764531189693223"][data-container-type="library"]',
  );
}

function getModal(page: Page) {
  return page.frameLocator(
    '[data-miro-app-id="3458764531189693223"][data-testid="iframe-modal-iframe"]',
  );
}

async function cleanFrame() {
  const frame = (await miro.board.get({ type: "frame" })).find(
    (f) => f.title === "Automated Test Frame",
  );
  if (!frame) {
    window.__captureLogs?.("Error: Missing Automated Test Frame");
    throw new Error("Missing Automated Test Frame");
  }

  // Sometimes cards don't seem to actually attach to the frame, so we need to find all of the items that intersect the bounding box of the frame.
  const items = await miro.board.get({
    type: ["app_card"],
  });
  const frameItems = items.filter((item) => {
    if (item.parentId === frame.id) {
      window.__captureLogs?.(
        `cleanFrame: Found item ${item.title} with parentId ${item.parentId} matching frame id ${frame.id}`,
      );
      return true;
    } else if (item.parentId === null) {
      const intersects =
        Math.abs(item.x - frame.x) < frame.width / 2 &&
        Math.abs(item.y - frame.y) < frame.height / 2;

      if (intersects) {
        window.__captureLogs?.(
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

async function selectMiroCardByTitle(page: Page, title: string | RegExp) {
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
