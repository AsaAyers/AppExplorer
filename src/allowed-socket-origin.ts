const allowedLocalOrigins = new Set([
  "https://appexplorer.dev",
  "https://dev.appexplorer.dev",
]);

export const isAllowedSocketOrigin = (origin?: string) => {
  // Node-based clients like the VS Code extension do not send an Origin header.
  if (!origin) {
    return true;
  }

  return allowedLocalOrigins.has(origin);
};

export const allowedSocketOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  callback(null, isAllowedSocketOrigin(origin));
};
