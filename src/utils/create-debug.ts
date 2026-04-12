import baseDebug from "debug";

export function createDebug(namespace: `app-explorer:${string}`) {
  const debug = baseDebug(namespace);
  return debug;
}
createDebug.enable = baseDebug.enable.bind(baseDebug);

declare global {
  interface Window {
    __captureLogs?: (...args: unknown[]) => void;
  }
}

const baseLog = baseDebug.log;
baseDebug.log = (...args: unknown[]) => {
  if (
    typeof window !== "undefined" &&
    typeof window.__captureLogs === "function"
  ) {
    window.__captureLogs?.(...args);
  }
  return baseLog(...args);
};

createDebug.log = (...args: unknown[]) => baseDebug.log(...args);
