import baseDebug from "debug";

export function createDebug(namespace: `app-explorer:${string}`) {
  const debug = baseDebug(namespace);
  return debug;
}
createDebug.enable = baseDebug.enable.bind(baseDebug);

const baseLog = baseDebug.log;
baseDebug.log = (...args: unknown[]) => {
  return baseLog(...args);
};

createDebug.log = (...args: unknown[]) => baseDebug.log(...args);
