export const APP_EXPLORER_SESSION_ID = "local" as const;
export const APP_EXPLORER_SESSION_NAMESPACE = /^\/session\/([A-Za-z0-9_-]+)$/;

export const getSessionTokenFromNamespace = (namespace: string) => {
  return APP_EXPLORER_SESSION_NAMESPACE.exec(namespace)?.[1] ?? null;
};

export const appExplorerSessionRoles = [
  "miro",
  "sidebar",
  "workspace",
] as const;

export type AppExplorerSessionRole = (typeof appExplorerSessionRoles)[number];
