import { createDebug } from "./utils/create-debug";

const debug = createDebug("app-explorer:session-url");

const hostConfig = [
  {
    index: 0,
    relayUrl: "https://appexplorer.dev",
    healthPath: "/api/health-check",
    launchesRelay: true,
  },
  {
    index: 1,
    relayUrl: "http://localhost:9042",
    launchesRelay: true,
    healthPath: "/health",
  },
  {
    index: 2,
    relayUrl: "http://localhost:3000",
    launchesRelay: true,
    healthPath: "/api/health-check",
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

export function getHostByIndex(hostIndex: number) {
  return hostConfig[getNormalizedHostIndex(hostIndex)].relayUrl;
}

export function getRelayHostByIndex(hostIndex: number) {
  return hostConfig[getNormalizedHostIndex(hostIndex)].relayUrl;
}

export function getHealthPathByIndex(hostIndex: number) {
  return hostConfig[getNormalizedHostIndex(hostIndex)].healthPath;
}

export function getHealthUrlByIndex(hostIndex: number) {
  return new URL(
    getHealthPathByIndex(hostIndex),
    `${getRelayHostByIndex(hostIndex)}/`,
  ).toString();
}

export function launchesLocalRelayByIndex(hostIndex: number) {
  return hostConfig[getNormalizedHostIndex(hostIndex)].launchesRelay;
}
