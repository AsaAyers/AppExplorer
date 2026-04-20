import * as assert from "node:assert";

import * as vscode from "vscode";

import { getRelativePath } from "@/get-relative-path";
import { uriForFile } from "@/test/suite/test-utils";

suite("getRelativePath", () => {
  let targetUri: vscode.Uri;

  suiteSetup(async () => {
    targetUri = uriForFile("example.ts");
  });

  test("resolves path within workspace root", () => {
    assert.strictEqual(getRelativePath(targetUri), "example.ts");
  });
});
