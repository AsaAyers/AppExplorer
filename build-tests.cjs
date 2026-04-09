/* eslint-disable */

const path = require("node:path");
const { readdirSync } = require("node:fs");
const esbuild = require("esbuild");
const root = path.resolve(__dirname);
const { rimraf, rimrafSync, native, nativeSync } = require("rimraf");
const testDir = path.join(root, "src", "test");
const outDir = path.join(root, ".tests-out");

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

async function main() {
  const entryPoints = findTestFiles(testDir);
  if (entryPoints.length === 0) {
    console.error("No test files found in", testDir);
    process.exit(1);
  }

  await rimraf(outDir);

  console.log(`Building ${entryPoints.length} test file(s)...`);

  await esbuild.build({
    entryPoints,
    bundle: true,
    format: "cjs",
    outExtension: { ".js": ".cjs" },
    platform: "node",
    outdir: outDir,
    outbase: testDir,
    // Externalize all node_modules (including 'vscode') so they are resolved
    // at runtime by the extension host rather than bundled.
    packages: "external",
    loader: { ".txt": "text", ".pub": "text" },
    external: ["vscode"],
    sourcemap: true,
    plugins: [],
  });

  console.log("Test build complete →", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
