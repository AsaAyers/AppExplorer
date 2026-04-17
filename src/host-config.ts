import invariant from "tiny-invariant";

import { createDebug } from "./utils/create-debug";

const debug = createDebug("app-explorer:session-url");

const hostConfig = [
  {
    index: 0,
    relayUrl: "https://appexplorer.dev",
    healthUrl: "/api/health-check",
    launchesRelay: true,
  },
  {
    index: 1,
    relayUrl: "http://localhost:9042",
    launchesRelay: true,
    healthUrl: "http://localhost:9042/health",
  },
  {
    index: 2,
    relayUrl: "http://localhost:3000",
    launchesRelay: true,
    healthUrl: "http://localhost:9042/api/health-check",
  },
  {
    index: 3,
    relayUrl: "https://dev.appexplorer.dev",
    launchesRelay: true,
    healthUrl: "http://localhost:9042/api/health-check",
  },
] as const;

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

export const getHostByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).relayUrl;

export const getRelayHostByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).relayUrl;

export const getHealthUrlByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).healthUrl;

export const launchesLocalRelayByIndex = (hostIndex: number) =>
  getHostConfig(hostIndex).launchesRelay;
