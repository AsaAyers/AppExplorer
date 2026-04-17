import invariant from "tiny-invariant";

import { createDebug } from "./utils/create-debug";

const debug = createDebug("app-explorer:session-url");

const hostConfig = [
  {
    index: 0,
    appUrl: "https://appexplorer.dev",
    relayUrl: "https://appexplorer.dev",
    launchesRelay: true,
  },
  {
    index: 1,
    appUrl: "http://localhost:3000",
    relayUrl: "http://localhost:9042",
    launchesRelay: true,
  },
  {
    index: 2,
    appUrl: "http://localhost:3000",
    relayUrl: "http://localhost:3000",
    launchesRelay: true,
  },
  {
    index: 3,
    appUrl: "https://dev.appexplorer.dev",
    relayUrl: "https://dev.appexplorer.dev",
    launchesRelay: true,
  },
] as const;

export const testHosts = hostConfig
  .map((config) => config.index)
  .filter((i) => i > 0);

export const LOCAL_RELAY_HEALTH_URL = "http://localhost:9042/health";

export type HostIndex = (typeof hostConfig)[number]["index"];

export const getNormalizedHostIndex = (hostIndex: number) => {
  if (
    Number.isInteger(hostIndex) &&
    hostIndex >= 0 &&
    hostIndex < hostConfig.length
  ) {
    return hostIndex as HostIndex;
  }

  debug("Invalid host index in session URI, defaulting to 0", {
    hostIndex,
  });
  return 0 as HostIndex;
};
export function getHostConfig(hostIndex: number) {
  const i = getNormalizedHostIndex(hostIndex);
  const config = hostConfig.find((config) => config.index === i);
  invariant(config, `No host config found for index ${hostIndex}`);
  return config;
}

export const getAppHostByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).appUrl;

export const getRelayHostByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).relayUrl;

export const launchesLocalRelayByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).launchesRelay;
