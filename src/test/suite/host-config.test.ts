import * as assert from "node:assert";

import {
  getAppHostByIndex,
  getRelayHostByIndex,
  getHostConfig,
} from "@/host-config";

suite("Host config", () => {
  test("uses split app and relay hosts for local migration mode", () => {
    assert.equal(getAppHostByIndex(1), "http://localhost:3000");
    assert.equal(getRelayHostByIndex(1), "http://localhost:9042");
  });

  test("uses the app host for dev and production hosted modes", () => {
    assert.equal(getAppHostByIndex(0), "https://appexplorer.dev");
    assert.equal(getAppHostByIndex(3), "https://dev.appexplorer.dev");
  });

  test("keeps app and relay aligned when the host mode is same-origin", () => {
    for (const hostIndex of [0, 2, 3]) {
      assert.equal(
        getHostConfig(hostIndex).appUrl,
        getHostConfig(hostIndex).relayUrl,
      );
    }
  });
});
