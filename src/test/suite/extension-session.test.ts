import * as assert from "node:assert";

import { getNormalizedHostIndex } from "@/appExplorerDevHost";
import { parseSessionUri } from "@/appExplorerSession";

suite("Extension session URLs", () => {
  test("parses dev-host session URLs", () => {
    const session = parseSessionUri(
      "vscode://asa-ayers.app-explorer/session/dev-session?key=secret&host=1",
    );

    assert.deepStrictEqual(session, {
      sessionId: "dev-session",
      key: "secret",
      hostIndex: getNormalizedHostIndex(1),
    });
  });

  test("parses production session URLs", () => {
    const session = parseSessionUri(
      "vscode://asa-ayers.app-explorer/session/prod-session?key=secret",
    );

    assert.deepStrictEqual(session, {
      sessionId: "prod-session",
      key: "secret",
      hostIndex: getNormalizedHostIndex(0),
    });
  });

  test("parses future relay-host session URLs", () => {
    const session = parseSessionUri(
      "vscode://asa-ayers.app-explorer/session/future-session?key=secret&host=2",
    );

    assert.deepStrictEqual(session, {
      sessionId: "future-session",
      key: "secret",
      hostIndex: getNormalizedHostIndex(2),
    });
  });
});
