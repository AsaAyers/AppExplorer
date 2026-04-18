import * as assert from "node:assert";

import { isAllowedSocketOrigin } from "@/allowed-socket-origin";

suite("Socket origin allow list", () => {
  test("forbids removed relay origins", () => {
    assert.equal(isAllowedSocketOrigin("http://localhost:9042"), false);
    assert.equal(isAllowedSocketOrigin("http://localhost:3000"), false);
  });

  test("allows production and proxied dev app origins", () => {
    assert.equal(isAllowedSocketOrigin("https://appexplorer.dev"), true);
    assert.equal(isAllowedSocketOrigin("https://dev.appexplorer.dev"), true);
  });

  test("allows node clients without an origin header", () => {
    assert.equal(isAllowedSocketOrigin(undefined), true);
  });

  test("rejects unsupported origins", () => {
    assert.equal(isAllowedSocketOrigin("http://appexplorer.dev"), false);
    assert.equal(isAllowedSocketOrigin("https://example.com"), false);
    assert.equal(isAllowedSocketOrigin("notaurl"), false);
  });
});
