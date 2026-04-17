export const APP_EXPLORER_SESSION_ID = "local" as const;
export const APP_EXPLORER_SESSION_NAMESPACE = /\/session\/([^/]+)/;

export const appExplorerSessionRoles = [
  "miro",
  "sidebar",
  "workspace",
] as const;

export type AppExplorerSessionRole = (typeof appExplorerSessionRoles)[number];
