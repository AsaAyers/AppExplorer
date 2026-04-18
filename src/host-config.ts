import invariant from "tiny-invariant";

import { createDebug } from "./utils/create-debug";

const log = createDebug("app-explorer:host-config");

const hostConfig = [
  {
    index: 0,
    origin: "https://appexplorer.dev",
    miroAppName: "AppExplorer",
  },
  {
    index: 1,
    origin: "https://dev.appexplorer.dev",
    miroAppName: "DevAppExplorer",
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

export function getIndexFromOrigin(origin: string) {
  const index = hostConfig.find((config) => config.origin === origin)?.index;

  log(`Determined host index ${index} from origin ${origin}`);

  return index ?? 0;
}
