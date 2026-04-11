import baseDebug from "debug";

const envPrefix = process.env.NODE_ENV === "production" ? "" : "dev:";
const debug = baseDebug(`${envPrefix}app-explorer`);

export function debugLog(suffix: string) {
  return debug.extend(suffix);
}

debugLog.log = (...args: unknown[]) => baseDebug.log(...args);
baseDebug.enable = baseDebug.enable.bind(baseDebug);
