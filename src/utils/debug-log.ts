import baseDebug from "debug";

export function debugLog(suffix: string) {
  const envPrefix = process.env.NODE_ENV === "production" ? "" : "dev:";

  const debug = baseDebug(`${envPrefix}app-explorer:${suffix}`);

  // @ts-expect-error Maybe this changed between versions? Maybe I added a custom property?
  debug.error = (...args: unknown[]) => {
    console.error(...args);
    debug.apply(null, ["error", ...args]);
  };

  return debug;
}

if (process.env.NODE_ENV === "test") {
  // vitest captures console.log, but I think debug is trying to write to
  // stdout, which does not seem to get captures.
  // eslint-disable-next-line no-console
  baseDebug.log = console.log.bind(console);
}
debugLog.log = (...args: unknown[]) => baseDebug.log(...args);
baseDebug.enable = baseDebug.enable.bind(baseDebug);
