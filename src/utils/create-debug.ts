import baseDebug from "debug";

export function createDebug(namespace: `app-explorer:${string}`) {
  const debug = baseDebug(namespace);
  return debug;
}
createDebug.enable = baseDebug.enable.bind(baseDebug);
createDebug.log = (...args: unknown[]) => baseDebug.log(...args);
