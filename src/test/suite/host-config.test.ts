import * as assert from "node:assert";

import {
  getAppHostByIndex,
  getMiroAppName,
  getRelayHostByIndex,
  getHostConfig,
} from "@/host-config";

suite("Host config", () => {
  test("uses split app and relay hosts for local migration mode", () => {
    assert.equal(getAppHostByIndex(1), "http://localhost:9042");
    assert.equal(getRelayHostByIndex(1), "http://localhost:9042");
  });

  test("uses the configured app host for every supported mode", () => {
    assert.equal(getAppHostByIndex(0), "https://appexplorer.dev");
    assert.equal(getAppHostByIndex(2), "http://localhost:9042");
    assert.equal(getAppHostByIndex(3), "https://dev.appexplorer.dev");
  });

  test("keeps app and relay aligned when the host mode is same-origin", () => {
    for (const hostIndex of [0, 1, 3]) {
      assert.equal(
        getHostConfig(hostIndex).appUrl,
        getHostConfig(hostIndex).relayUrl,
      );
    }
  });

  test("uses the expected Miro app button names", () => {
    assert.equal(getMiroAppName(1), "AppExplorer");
    assert.equal(getMiroAppName(2), "AppExplorer");
    assert.equal(getMiroAppName(3), "DevAppExplorer");
  });
});
