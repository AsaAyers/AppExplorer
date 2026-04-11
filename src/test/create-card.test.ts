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

const storageState = "playwright/.auth/user.json";
const storageStateExists = fs.existsSync(storageState);

const suiteFn = storageStateExists ? suite : suite.skip;

suiteFn("Create Card", function () {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  void context;

  suiteSetup(async function () {
    this.timeout(120000);
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
    this.timeout(120000);
    invariant(page, "Page should be defined after setup");
    await openTestBoard(page);

    const URI = uriForFile("src/utils/helpers.ts");
    const doc = await vscode.workspace.openTextDocument(URI);
    const helpersFile = await vscode.window.showTextDocument(doc, {
      preview: false,
    });

    // move the cursor to where "func.apply" appears in the file
    const funcApplyIndex = doc.getText().indexOf("func.apply");
    assert.notStrictEqual(
      funcApplyIndex,
      -1,
      'Expected "func.apply" to exist in src/utils/helpers.ts',
    );
    const position = doc.positionAt(funcApplyIndex);
    helpersFile.selection = new vscode.Selection(position, position);
    await videoDelay("openHelpersFile", 2);

    const sidebar = getSidebar(page);
    const appCardSelector = "app-card";
    await waitFor(async () => {
      assert.equal(await sidebar.locator(appCardSelector).count(), 3);
    });
    await videoDelay("3 cards");

    const cardTitleSelector = ".app-card--title";
    await sidebar
      .locator(appCardSelector)
      .locator(cardTitleSelector)
      .getByText(/callback$/)
      .waitFor({ state: "visible" });

    const card = sidebar.locator(appCardSelector).filter({
      has: sidebar.locator(cardTitleSelector).getByText(/callback$/),
    });

    await videoDelay("sidebar ready");

    // Drag the card onto the board
    const cardBoundingBox = await card.boundingBox();
    invariant(cardBoundingBox, "Card bounding box should be available");

    const pageWidthInPixels = await page.evaluate(() => window.innerWidth);
    const pageHeightInPixels = await page.evaluate(() => window.innerHeight);

    const canvas = page.locator("#main-canvas");

    await videoDelay("beforeDrag");
    await card.dragTo(canvas, {
      steps: 50,
      targetPosition: {
        x: pageWidthInPixels * 0.75,
        y: pageHeightInPixels * 0.5,
      },
    });
    await videoDelay("newCard");

    const modal = getModal(page);
    // In VSCode, close the currently open file.
    log("close active editor");
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    // modal.getByLabel("Title").fill("Debounce Callback");
    await videoDelay("Jump to code");
    log("jump to code");
    await modal.getByRole("button", { name: "Jump To Code" }).click();

    await waitFor(
      () => {
        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(
          activeEditor,
          "There should be an active editor after clicking Jump To Code",
        );
        const activeFileName = activeEditor.document.fileName;
        assert.ok(
          activeFileName.endsWith("helpers.ts"),
          `Active file should be helpers.ts, but got ${activeFileName}`,
        );
      },
      {
        timeout: 10000,
      },
    );

    await videoDelay("helpers reopened", 2);
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
    throw new Error("Missing Automated Test Frame");
  }

  // Sometimes cards don't seem to actually attach to the frame, so we need to find all of the items that intersect the bounding box of the frame.
  const items = await miro.board.get({
    type: ["app_card"],
  });
  const frameItems = items.filter((item) => {
    if (item.parentId === frame.id) {
      return true;
    } else if (item.parentId === null) {
      const intersects =
        Math.abs(item.x - frame.x) < frame.width / 2 &&
        Math.abs(item.y - frame.y) < frame.height / 2;

      return intersects;
    }
    return false;
  });

  await Promise.all(frameItems.map((item) => miro.board.remove(item)));
}
