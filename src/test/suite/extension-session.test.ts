import * as assert from "node:assert";

import {
  makeSessionUrl,
  parseSessionUri,
  zAppExplorerSession,
} from "@/app-explorer-session";
import { randomHex } from "@/utils/to-hex";

suite("Extension session URLs", () => {
  for (const hostIndex of [0, 1, 2]) {
    for (const insiders of [true, false]) {
      test(`parses session URLs with hostIndex=${hostIndex} and insiders=${insiders}`, () => {
        const sessionConfig = zAppExplorerSession.parse({
          sessionId: crypto.randomUUID(),
          key: randomHex(512),
          insider: insiders,
          hostIndex,
        });

        const session = parseSessionUri(makeSessionUrl(sessionConfig));

        assert.deepStrictEqual(session, sessionConfig);
      });
    }
  }
});
