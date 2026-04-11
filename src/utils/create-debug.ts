import baseDebug from "debug";

const envPrefix = process.env.NODE_ENV === "production" ? "" : "dev:";

export function createDebug(namespace: `app-explorer:${string}`) {
  const debug = baseDebug(`${envPrefix}${namespace}`);
  return debug;
}
createDebug.enable = baseDebug.enable.bind(baseDebug);
createDebug.log = (...args: unknown[]) => baseDebug.log(...args);
