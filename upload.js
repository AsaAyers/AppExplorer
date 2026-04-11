/* eslint-disable no-console */
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

const STATIC_DIR = ".next/static";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getRequiredEnvAny(names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  throw new Error(
    `Missing required environment variable. Expected one of: ${names.join(", ")}`,
  );
}

function getUploadPrefixFromAssetPrefix() {
  const assetPrefix = process.env.ASSET_PREFIX?.trim();
  if (!assetPrefix) {
    return null;
  }

  try {
    const url = new URL(assetPrefix);
    const prefix = url.pathname.replace(/^\/+|\/+$/g, "");
    return prefix ? `${prefix}/_next/static` : "_next/static";
  } catch {
    return "_next/static";
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "null"}`));
    });
  });
}

async function uploadStaticAssets() {
  const uploadOnBoot = process.env.ASSET_UPLOAD_ON_BOOT?.trim();
  if (uploadOnBoot === "0" || uploadOnBoot === "false") {
    console.log(
      "[asset-upload] Skipping upload because ASSET_UPLOAD_ON_BOOT is disabled.",
    );
    return;
  }

  const uploadPrefix = getUploadPrefixFromAssetPrefix();
  if (!uploadPrefix) {
    console.log(
      "[asset-upload] Skipping upload because ASSET_PREFIX is not set.",
    );
    return;
  }

  await access(STATIC_DIR);

  const assetBucket = getRequiredEnv("ASSET_BUCKET");
  const endpointUrl = getRequiredEnv("S3_ENDPOINT_URL");
  getRequiredEnv("AWS_ACCESS_KEY_ID");
  getRequiredEnv("AWS_SECRET_ACCESS_KEY");
  getRequiredEnvAny(["AWS_REGION", "AWS_DEFAULT_REGION"]);

  // `aws s3 sync` uploads the current build artifact tree as the source of truth.
  const args = [
    "s3",
    "sync",
    STATIC_DIR,
    `s3://${assetBucket}/${uploadPrefix}`,
    "--endpoint-url",
    endpointUrl,
    "--cache-control",
    IMMUTABLE_CACHE_CONTROL,
    "--no-progress",
  ];

  console.log("[asset-upload] Uploading static assets...");
  await run("aws", args);
  console.log("[asset-upload] Upload complete.");
}

async function main() {
  await uploadStaticAssets();
  await import("./server.js");
}

main().catch((error) => {
  console.error("[asset-upload] Startup failed:", error);
  process.exit(1);
});
