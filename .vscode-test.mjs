import env from "@next/env";
import { defineConfig } from "@vscode/test-cli";

const projectDir = process.cwd();
env.loadEnvConfig(projectDir);
const DEBUG = "app-explorer:*";

const skipTests = process.env.SKIP_TESTS === "true";

export default defineConfig({
  files: skipTests ? "skip-tests/*.cjs" : ".tests-out/**/*.test.cjs",
  workspaceFolder: "./sample-workspace",
  env: {
    DEBUG,
    NODE_ENV: "test",
    MIRO_TEST_EMAIL: process.env.MIRO_TEST_EMAIL,
    MIRO_TEST_PASSWORD: process.env.MIRO_TEST_PASSWORD,
  },
  coverage: {
    reporter: ["json"],
  },
  mocha: {
    timeout: 30000, // 30 seconds timeout for all tests
    slow: 10000, // Mark tests as slow if they take more than 10 seconds
  },
});
