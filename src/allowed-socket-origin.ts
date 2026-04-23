import { createDebug } from "@/utils/create-debug";

const allowedSocketOrigins = new Set([
  "https://appexplorer.dev",
  "https://dev.appexplorer.dev",
]);
const allowedLoopbackPorts = new Set(["3000", "3100"]);

const log = createDebug("app-explorer:allowed-socket-origin");

const isLoopbackOrigin = (origin: string) => {
  try {
    const parsedOrigin = new URL(origin);
    return (
      parsedOrigin.protocol === "http:" &&
      allowedLoopbackPorts.has(parsedOrigin.port) &&
      (parsedOrigin.hostname === "localhost" ||
        parsedOrigin.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
};

export const isAllowedSocketOrigin = (origin?: string) => {
  log("Checking socket origin:", origin);
  // Node-based clients like the VS Code extension do not send an Origin header.
  if (!origin) {
    return true;
  }

  return allowedSocketOrigins.has(origin) || isLoopbackOrigin(origin);
};

export const allowedSocketOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  callback(null, isAllowedSocketOrigin(origin));
};
