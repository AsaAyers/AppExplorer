/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */
const esbuild = require("esbuild");
const rawPlugin = require("esbuild-raw-plugin").raw({});
const path = require("node:path");
const { readdirSync } = require("node:fs");

const { rimraf } = require("rimraf");
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

function findTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (entry.name.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      });
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const context = [];

  const baseConfig = {
    bundle: true,
    minify: production,
    sourcemap: !production,
    loader: { ".txt": "text", ".pub": "text", ".css": "text" },
    logLevel: "silent",
    sourcesContent: false,
    plugins: [rawPlugin, esbuildProblemMatcherPlugin],
  };

  const root = path.resolve(__dirname);
  const testDir = path.join(root, "src", "test");
  const testsOut = path.join(root, ".tests-out");

  context.push(
    await esbuild.context({
      ...baseConfig,
      entryPoints: ["src/extension.ts"],
      format: "cjs",
      platform: "node",
      outfile: "app-explorer.cjs",
      external: ["vscode"],
    }),
  );
  context.push(
    await esbuild.context({
      ...baseConfig,
      entryPoints: ["src/miro.ts"],
      format: "esm",
      platform: "browser",
      outfile: "public/miro.js",
    }),
  );
  context.push(
    await esbuild.context({
      ...baseConfig,
      entryPoints: ["src/lit.ts"],
      format: "esm",
      platform: "browser",
      outfile: "public/lit.js",
    }),
  );

  const entryPoints = findTestFiles(testDir);
  await rimraf(testsOut);
  context.push(
    await esbuild.context({
      ...baseConfig,
      entryPoints,
      format: "cjs",
      platform: "node",
      minify: false,
      sourcemap: true,
      outExtension: { ".js": ".cjs" },
      outdir: testsOut,
      outbase: testDir,
      packages: "external",
    }),
  );
  if (watch) {
    await Promise.all(context.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(context.map((ctx) => ctx.rebuild()));
    await Promise.all(context.map((ctx) => ctx.dispose()));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
