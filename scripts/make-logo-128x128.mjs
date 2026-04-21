import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const SIZE = 128;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "public", "AppExplorer.svg");
const outputPath = path.join(rootDir, "public", `logo-${SIZE}x${SIZE}.png`);

async function main() {
  const svg = await readFile(sourcePath, "utf8");
  await mkdir(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: SIZE, height: SIZE },
      deviceScaleFactor: 1,
    });

    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    await page.setContent(
      `<!doctype html>
      <html>
        <body style="margin:0;background:transparent;overflow:hidden;">
          <img
            src="${svgDataUrl}"
            width="${SIZE}"
            height="${SIZE}"
            style="display:block"
          />
        </body>
      </html>`,
    );

    await page.screenshot({
      path: outputPath,
      omitBackground: true,
    });
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
