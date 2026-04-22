/* eslint-disable no-console */
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import istanbulCoverage from "istanbul-lib-coverage";
import istanbulReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const { createCoverageMap, createFileCoverage } = istanbulCoverage;
const { createContext } = istanbulReport;

const COVERAGE_DIR = path.join(process.cwd(), "coverage");
const COVERAGE_JSON_PATH = path.join(COVERAGE_DIR, "coverage-final.json");
const DEFAULT_COVERAGE_BASE_URL = "http://localhost:3000";
const PROJECT_ROOT = process.cwd().replace(/\\/g, "/").replace(/\/+$/, "");
const PROJECT_ROOT_NO_SLASH = PROJECT_ROOT.replace(/^\/+/, "");

function normalizeCoveragePath(inputPath) {
  if (!inputPath) {
    return null;
  }

  let normalized = String(inputPath)
    .replace(/^file:\/\//, "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (normalized.startsWith("root/")) {
    normalized = normalized.slice(5);
  }

  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  if (normalized.startsWith(`${PROJECT_ROOT_NO_SLASH}/`)) {
    normalized = normalized.slice(PROJECT_ROOT_NO_SLASH.length + 1);
  }

  if (normalized.includes("/src/")) {
    normalized = normalized.slice(normalized.indexOf("/src/") + 1);
  }

  if (
    normalized.includes("/node_modules/") ||
    normalized.startsWith("node_modules/")
  ) {
    return null;
  }

  if (!normalized.startsWith("src/")) {
    return null;
  }

  return normalized;
}

function sanitizeCoverageMap(coverageMap) {
  const sanitized = createCoverageMap({});
  const seen = new Set();
  let kept = 0;
  let dropped = 0;

  for (const originalPath of coverageMap.files()) {
    const normalizedPath = normalizeCoveragePath(originalPath);
    if (!normalizedPath) {
      dropped += 1;
      continue;
    }

    // Keep only files that exist in this local workspace under src/.
    if (!existsSync(path.join(PROJECT_ROOT, normalizedPath))) {
      dropped += 1;
      continue;
    }

    const fileCoverageJson = coverageMap.fileCoverageFor(originalPath).toJSON();
    fileCoverageJson.path = normalizedPath;

    if (seen.has(normalizedPath)) {
      sanitized
        .fileCoverageFor(normalizedPath)
        .merge(createFileCoverage(fileCoverageJson));
    } else {
      sanitized.addFileCoverage(fileCoverageJson);
      seen.add(normalizedPath);
    }

    kept += 1;
  }

  return {
    map: sanitized,
    kept,
    dropped,
    unique: sanitized.files().length,
  };
}

async function loadLocalCoverageMap() {
  const raw = await fs.readFile(COVERAGE_JSON_PATH, "utf8");
  return createCoverageMap(JSON.parse(raw));
}

async function loadRemoteCoverage() {
  const base =
    process.env.APP_EXPLORER_COVERAGE_BASE_URL || DEFAULT_COVERAGE_BASE_URL;
  const endpoint = new URL("/__coverage__", base).toString();

  let response;

  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  } catch (error) {
    console.warn(`[coverage] Failed to fetch ${endpoint}:`, error);
    return null;
  }

  if (!response.ok) {
    console.warn(
      `[coverage] Coverage endpoint returned ${response.status} for ${endpoint}`,
    );
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    console.warn(`[coverage] Invalid JSON from ${endpoint}:`, error);
    return null;
  }

  if (!payload || typeof payload !== "object" || !payload.coverage) {
    console.warn(`[coverage] No coverage payload found at ${endpoint}`);
    return null;
  }

  return {
    coverage: payload.coverage,
    endpoint,
  };
}

async function writeMergedReports(coverageMap) {
  await fs.mkdir(COVERAGE_DIR, { recursive: true });
  await fs.writeFile(
    COVERAGE_JSON_PATH,
    JSON.stringify(coverageMap.toJSON()),
    "utf8",
  );

  const context = createContext({
    dir: COVERAGE_DIR,
    coverageMap,
    defaultSummarizer: "pkg",
  });

  for (const name of ["html", "lcovonly", "json", "text-summary"]) {
    reports.create(name).execute(context);
  }
}

async function main() {
  let coverageMap;

  try {
    coverageMap = await loadLocalCoverageMap();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[coverage] Skipping merge: ${message}`);
    return;
  }

  const sanitizedLocal = sanitizeCoverageMap(coverageMap);
  coverageMap = sanitizedLocal.map;

  const remoteCoverageResult = await loadRemoteCoverage();
  if (remoteCoverageResult) {
    const remoteCoverageMap = createCoverageMap(remoteCoverageResult.coverage);
    const sanitizedRemote = sanitizeCoverageMap(remoteCoverageMap);
    coverageMap.merge(sanitizedRemote.map);

    console.log(
      `[coverage] Merged remote coverage from ${remoteCoverageResult.endpoint} (kept=${sanitizedRemote.kept}, dropped=${sanitizedRemote.dropped}, unique=${sanitizedRemote.unique})`,
    );
  } else {
    console.log("[coverage] No remote coverage merged.");
  }

  await writeMergedReports(coverageMap);

  console.log(
    `[coverage] Wrote sanitized coverage to ${COVERAGE_JSON_PATH} (local kept=${sanitizedLocal.kept}, local dropped=${sanitizedLocal.dropped}, unique=${coverageMap.files().length})`,
  );
}

main().catch((error) => {
  console.error("[coverage] Failed to merge coverage:", error);
  process.exitCode = 1;
});
