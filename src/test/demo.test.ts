/* eslint-disable no-console */
import assert from "node:assert";
import { ChildProcess, spawn } from "node:child_process";

import { Browser, BrowserContext, JSHandle, Page } from "playwright";

import { launchBrowser, createBrowserPage } from "./helpers/browser";
import { setupTimeline } from "./helpers/critical-path-timeline";
import { videoDelay, waitFor } from "./helpers/test-utils";

const appUrl = "http://127.0.0.1:3100";
const healthUrl = `${appUrl}/api/health-check`;

suite("Demo walkthrough", function () {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let localAppServer: ChildProcess | undefined;

  setupTimeline();

  suiteSetup(async function () {
    this.timeout(120000);

    localAppServer = await ensureLocalAppHost();
    browser = await launchBrowser();
    ({ context, page } = await createBrowserPage(browser, {
      storageState: undefined,
    }));
  });

  suiteTeardown(async function () {
    await context?.close();
    await browser?.close();
    if (localAppServer) {
      await stopChildProcess(localAppServer);
    }
  });

  test("completes the interactive tutorial from the home page", async function () {
    this.timeout(120000);
    assert.ok(page, "Expected Playwright page to be initialized");
    const demoPage = page;

    await demoPage.addInitScript(() => {
      const globalWithMiro = globalThis as typeof globalThis & {
        miro?: {
          board: {
            getInfo: () => Promise<{ id: string }>;
            ui: {
              openModal: () => Promise<{ waitForClose: () => Promise<null> }>;
            };
          };
        };
      };

      globalWithMiro.miro ??= {
        board: {
          getInfo: async () => ({ id: "demo-board" }),
          ui: {
            openModal: async () => ({
              waitForClose: async () => null,
            }),
          },
        },
      } as never;
    });

    await demoPage.goto(appUrl, { waitUntil: "domcontentloaded" });
    await demoPage.getByRole("link", { name: "Open interactive demo" }).click();
    await demoPage.waitForURL(/\/demo/);
    await videoDelay("demo page load", 2);

    await demoPage.getByRole("heading", { name: "Tutorial" }).waitFor();

    await dragCardToBoard(demoPage, "saveDoc", 900, 300);
    await expectTaskCompleted(demoPage, "Add any card to board");
    await expectTaskCompleted(demoPage, "Add saveDoc card to board");
    await waitFor(async () => {
      assert.equal(await demoPage.locator("#MockBoard .app-card").count(), 1);
    });

    await openDemoFile(demoPage, "emit.ts");
    await dragCardToBoard(demoPage, "emit", 1200, 460);
    await waitFor(async () => {
      assert.equal(await demoPage.locator("#MockBoard .app-card").count(), 2);
    });
    const disconnectedEmitCardId = await getBoardCard(
      demoPage,
      "emit",
    ).getAttribute("id");
    assert.ok(
      disconnectedEmitCardId,
      "Expected dragged emit card to have an id",
    );

    await focusBoardCard(demoPage, "saveDoc");
    await demoPage.locator(".tab-active").getByText("saveDoc.ts").waitFor();
    await expectTaskCompleted(
      demoPage,
      "Select a card to navigate between files",
    );

    await demoPage
      .getByLabel("Attach new cards to selected card")
      .check({ force: true });

    await openDemoFile(demoPage, "emit.ts");
    await dragCardToBoard(demoPage, "emit", 900, 150);
    await expectTaskCompleted(demoPage, "Attach new cards to selected card");
    await waitFor(async () => {
      assert.ok((await demoPage.locator("#MockBoard svg line").count()) >= 1);
    });

    await focusBoardCardById(demoPage, disconnectedEmitCardId);
    await demoPage.keyboard.press("Delete");
    await waitFor(async () => {
      assert.equal(await demoPage.locator("#MockBoard .app-card").count(), 2);
    });

    await focusBoardCard(demoPage, "saveDoc");
    await moveBoardCard(demoPage, "saveDoc", 900, 600);
    await expectTaskCompleted(demoPage, "Move any card on the board");

    await focusBoardCard(demoPage, "emit");
    await selectSymbol(demoPage, "OUT");
    await dragCardToBoard(demoPage, "OUT", 1200, 450);
    await waitFor(async () => {
      assert.equal(await demoPage.locator("#MockBoard .app-card").count(), 3);
    });
  });
});

async function ensureLocalAppHost() {
  if (await isHealthy(healthUrl)) {
    return undefined;
  }

  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ASSET_PREFIX: "",
      DEBUG: "*app-explorer:*",
      NODE_ENV: "production",
      PORT: "3100",
    },
    stdio: "ignore",
  });

  await waitFor(
    async () => {
      const response = await fetch(healthUrl).catch(() => undefined);
      assert.equal(response?.status, 200);
    },
    {
      timeout: 90000,
      interval: 500,
      message: `${healthUrl} did not start`,
    },
  );

  return child;
}

async function isHealthy(url: string) {
  return fetch(url)
    .then((response) => response.ok)
    .catch(() => false);
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

async function expectTaskCompleted(page: Page, taskLabel: string) {
  const task = page.locator("li").filter({ hasText: taskLabel }).first();
  await task.waitFor();
  await waitFor(async () => {
    const taskText = await task.textContent();
    assert.ok(taskText?.includes("✓"), `Task ${taskLabel} should be complete`);
  });
}

function getDemoCard(page: Page, cardTitle: string) {
  return page
    .locator("#demo-cards .app-card")
    .filter({ hasText: cardTitle })
    .first();
}

function getBoardCard(page: Page, cardTitle: string) {
  return page
    .locator("#MockBoard .app-card")
    .filter({ hasText: cardTitle })
    .first();
}

function getBoardCardContainer(page: Page, cardTitle: string) {
  return page
    .locator("#MockBoard > div")
    .filter({
      has: page.locator(".app-card").filter({ hasText: cardTitle }).first(),
    })
    .first();
}

async function focusBoardCard(page: Page, cardTitle: string) {
  const card = getBoardCardContainer(page, cardTitle);
  await card.focus();
  await waitFor(async () => {
    const className = await card.locator(".app-card").getAttribute("class");
    assert.ok(className?.includes("is-selected"));
  });
}

async function focusBoardCardById(page: Page, cardId: string) {
  const card = page.locator(`#${cardId}`).locator("xpath=..");
  await card.focus();
  await waitFor(async () => {
    const className = await card.locator(".app-card").getAttribute("class");
    assert.ok(className?.includes("is-selected"));
  });
}

async function selectSymbol(page: Page, name: string) {
  const symbol = page.locator(`[data-symbol="${name}"] > .symbol`);
  await symbol.waitFor();
  await symbol.click();
}

async function openDemoFile(page: Page, fileName: string) {
  const fileTab = page
    .locator(".tabs-header-list")
    .getByRole("link", { name: fileName, exact: true });
  await fileTab.click();
  await page.waitForURL(new RegExp(`path=${fileName.replace(".", "\\.")}`));
}

async function dragCardToBoard(
  page: Page,
  cardTitle: string,
  clientX: number,
  clientY: number,
) {
  const dataTransfer = await createDataTransfer(page);
  const card = getDemoCard(page, cardTitle);
  await card.waitFor();
  const box = await card.boundingBox();
  assert.ok(box, `Expected ${cardTitle} sidebar card to be visible`);

  await card.dispatchEvent("dragstart", {
    dataTransfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });

  const board = page.locator("#MockBoard");
  await board.dispatchEvent("dragover", {
    dataTransfer,
    clientX,
    clientY,
  });
  await board.dispatchEvent("drop", {
    dataTransfer,
    clientX,
    clientY,
  });
  await card.dispatchEvent("dragend", { dataTransfer });
  await dataTransfer.dispose();
}

async function moveBoardCard(
  page: Page,
  cardTitle: string,
  clientX: number,
  clientY: number,
) {
  const dataTransfer = await createDataTransfer(page);
  const card = getBoardCard(page, cardTitle);
  const box = await card.boundingBox();
  assert.ok(box, `Expected ${cardTitle} board card to be visible`);

  await card.dispatchEvent("dragstart", {
    dataTransfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });

  const board = page.locator("#MockBoard");
  await board.dispatchEvent("dragover", {
    dataTransfer,
    clientX,
    clientY,
  });
  await board.dispatchEvent("drop", {
    dataTransfer,
    clientX,
    clientY,
  });
  await card.dispatchEvent("dragend", { dataTransfer });
  await dataTransfer.dispose();
}

async function createDataTransfer(page: Page): Promise<JSHandle<DataTransfer>> {
  return page.evaluateHandle(() => new DataTransfer());
}
