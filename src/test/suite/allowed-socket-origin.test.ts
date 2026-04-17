import * as assert from "node:assert";

import { isAllowedSocketOrigin } from "@/allowed-socket-origin";

suite("Socket origin allow list", () => {
  test("allows local transition origins", () => {
    assert.equal(isAllowedSocketOrigin("http://localhost:9042"), true);
    assert.equal(isAllowedSocketOrigin("http://localhost:3000"), true);
  });

  test("allows production and dev appexplorer domains", () => {
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
