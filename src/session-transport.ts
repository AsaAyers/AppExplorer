export const APP_EXPLORER_SESSION_ID = "local" as const;
export const APP_EXPLORER_SESSION_NAMESPACE =
  `/session/${APP_EXPLORER_SESSION_ID}` as const;
const APP_EXPLORER_SESSION_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const REQUIRED_KEY_BYTES = 64;

export const appExplorerSessionRoles = [
  "miro",
  "sidebar",
  "workspace",
] as const;

export type AppExplorerSessionRole = (typeof appExplorerSessionRoles)[number];

let appExplorerSessionKey: Uint8Array<ArrayBuffer> | undefined;

export const getAppExplorerSessionKey = () => {
  if (!appExplorerSessionKey) {
    const hexValues = APP_EXPLORER_SESSION_KEY_HEX.match(/.{2}/g)?.map((byte) =>
      parseInt(byte, 16),
    );

    if (!hexValues || hexValues.length !== REQUIRED_KEY_BYTES) {
      throw new Error("Invalid AppExplorer session transport key");
    }

    appExplorerSessionKey = new Uint8Array(hexValues);
  }

  return appExplorerSessionKey;
};
