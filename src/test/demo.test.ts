import assert from "node:assert";
import { ChildProcess, spawn } from "node:child_process";

import { Browser, BrowserContext, Page } from "playwright";

import { launchBrowser, createBrowserPage } from "@/test/helpers/browser";
import { setupTimeline, timeline } from "@/test/helpers/critical-path-timeline";
import {
  activateAppExplorer,
  videoDelay,
  waitFor,
} from "@/test/helpers/test-utils";
import { createDebug } from "@/utils/create-debug";

const log = createDebug("app-explorer:demo-test");
const appUrl = "https://dev.appexplorer.dev";
const healthUrl = `${appUrl}/api/health-check`;
const localServerHealthUrl = "http://127.0.0.1:3000/api/health-check";

suite("Demo walkthrough", function () {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let localAppServer: ChildProcess | null | undefined;

  suiteSetup(async function () {
    this.timeout(120000);

    localAppServer = await ensureLocalAppHost();
    if (localAppServer === null) {
      this.skip();
      return;
    }
    browser = await launchBrowser({});
    ({ context, page } = await createBrowserPage(browser, "demo-test", {
      storageState: null,
    }));
    await activateAppExplorer();
  });

  suiteTeardown(async function () {
    if (page) {
      await page.screencast.stop();
    }
    timeline.print();
    await context?.close();
    await browser?.close();
    if (localAppServer) {
      await stopChildProcess(localAppServer);
    }
  });

  setupTimeline();
  test("completes the interactive tutorial from the home page", async function () {
    this.timeout(120000);
    assert.ok(page, "Expected Playwright page to be initialized");
    const demoPage = page;
    await page.screencast.showChapter("Demo walkthrough");

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
    await waitForDemoCodeReady(demoPage);

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
    await demoPage.waitForSelector(
      '.tab.tab-active:has(a:has-text("saveDoc.ts"))',
    );
    await expectTaskCompleted(
      demoPage,
      "Select a card to navigate between files",
    );

    await page.screencast.showChapter("Attach Cards");
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
  });
});

async function ensureLocalAppHost() {
  if (await isHealthy(healthUrl)) {
    return undefined;
  }

  const child = spawn("npm", ["dev"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ASSET_PREFIX: "",
      DEBUG: "*app-explorer:*",
      NODE_ENV: "production",
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
      message: `${localServerHealthUrl} did not start`,
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
      const response = await fetch(healthUrl).catch(() => undefined);
      assert.equal(response?.status, 200);
    },
    {
      timeout: 5000,
      interval: 500,
      message: `${healthUrl} did not start`,
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

    .filter({
      hasText: cardTitle,
      has: page.locator(".app-card--title").filter({ hasText: cardTitle }),
    })

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

async function openDemoFile(page: Page, fileName: string) {
  const fileTab = page
    .locator(".tabs-header-list")
    .getByRole("link", { name: fileName, exact: true });
  await fileTab.click();
  await page.waitForURL(new RegExp(`path=${fileName.replace(".", "\\.")}`));
  await waitForDemoCodeReady(page);
}

async function waitForDemoCodeReady(page: Page) {
  await waitFor(
    async () => {
      const code = page.locator(".demo-code");
      const activeTab = page.locator(".tab-active").first();
      const symbols = code.locator(".symbol");
      const screenTooSmall = page.getByRole("heading", {
        name: "Screen Too Small",
      });

      const diagnostics = {
        codeVisible: await code.isVisible().catch(() => false),
        screenTooSmallVisible: await screenTooSmall
          .isVisible()
          .catch(() => false),
        activeTabVisible: await activeTab.isVisible().catch(() => false),
        activeTab:
          ((await activeTab.textContent().catch(() => null)) ?? "").trim() ||
          null,
        symbolCount: await symbols.count(),
        firstSymbolVisible: await symbols
          .first()
          .isVisible()
          .catch(() => false),
        codeTextLength: (
          (await code.textContent().catch(() => null)) ?? ""
        ).trim().length,
      };

      assert.ok(
        !diagnostics.screenTooSmallVisible,
        `Demo small-screen fallback is visible: ${JSON.stringify(diagnostics)}`,
      );
      assert.ok(
        diagnostics.codeVisible,
        `Demo code pane not visible: ${JSON.stringify(diagnostics)}`,
      );
      assert.ok(
        diagnostics.activeTabVisible,
        `Demo file tabs not visible: ${JSON.stringify(diagnostics)}`,
      );
      assert.ok(
        diagnostics.codeTextLength > 0,
        `Demo code is empty: ${JSON.stringify(diagnostics)}`,
      );
      assert.ok(
        diagnostics.symbolCount > 0 && diagnostics.firstSymbolVisible,
        `Demo symbols not rendered: ${JSON.stringify(diagnostics)}`,
      );
    },
    {
      timeout: 10_000,
      interval: 250,
      message: "Demo code pane did not render",
    },
  );
}

async function dragCardToBoard(
  page: Page,
  cardTitle: string,
  clientX: number,
  clientY: number,
) {
  await page.screencast.showChapter(`New Card: ${cardTitle}`, {
    description: `Drag ${cardTitle} card to board at (${clientX}, ${clientY})`,
  });
  const card = getDemoCard(page, cardTitle);
  await card.waitFor();
  const board = page.locator("#MockBoard");
  const boardBox = await board.boundingBox();
  assert.ok(boardBox, "Expected demo board to be visible");
  await card.dragTo(board, {
    steps: 50,
    timeout: 10000,
    targetPosition: {
      x: clientX - boardBox.x,
      y: clientY - boardBox.y,
    },
  });
}

async function moveBoardCard(
  page: Page,
  cardTitle: string,
  clientX: number,
  clientY: number,
) {
  const card = getBoardCard(page, cardTitle);
  const board = page.locator("#MockBoard");
  const boardBox = await board.boundingBox();
  assert.ok(boardBox, "Expected demo board to be visible");
  await card.dragTo(board, {
    steps: 50,
    timeout: 10000,
    targetPosition: {
      x: clientX - boardBox.x,
      y: clientY - boardBox.y,
    },
  });
}
