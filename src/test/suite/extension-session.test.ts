import * as assert from "node:assert";

import {
  makeSessionToken,
  makeSessionUrl,
  parseSessionUri,
  zAppExplorerSession,
} from "@/app-explorer-session";
import { testHosts } from "@/host-config";
import { randomHex } from "@/utils/to-hex";

suite("Extension session URLs", () => {
  for (const hostIndex of testHosts) {
    for (const insiders of [true, false]) {
      test(`parses session URLs with hostIndex=${hostIndex} and insiders=${insiders}`, async () => {
        const sessionConfig = zAppExplorerSession.parse({
          sessionToken: await makeSessionToken(),
          key: randomHex(512),
          insiders,
          hostIndex,
        });

        const session = parseSessionUri(makeSessionUrl(sessionConfig));

        assert.deepStrictEqual(session, sessionConfig);
      });
    }
  }

  test("omits the host query parameter for production sessions", async () => {
    const sessionConfig = zAppExplorerSession.parse({
      sessionToken: await makeSessionToken(),
      key: randomHex(512),
      hostIndex: 0,
    });

    const url = new URL(makeSessionUrl(sessionConfig));

    assert.equal(url.searchParams.has("host"), false);
  });
});
