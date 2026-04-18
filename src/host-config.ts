import invariant from "tiny-invariant";

const hostConfig = [
  {
    index: 0,
    appUrl: "https://appexplorer.dev",
    miroAppName: "AppExplorer",
    relayUrl: "https://appexplorer.dev",
  },
  {
    index: 3,
    appUrl: "https://dev.appexplorer.dev",
    miroAppName: "DevAppExplorer",
    relayUrl: "https://dev.appexplorer.dev",
  },
] as const;

export const testHosts = hostConfig
  .map((config) => config.index)
  .filter((i) => i > 0);

export type HostIndex = (typeof hostConfig)[number]["index"];

export function getHostConfig(hostIndex: number) {
  const config = hostConfig.find((config) => config.index === hostIndex);
  invariant(config, `No host config found for index ${hostIndex}`);
  return config;
}
