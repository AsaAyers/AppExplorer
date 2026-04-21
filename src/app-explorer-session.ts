import invariant from "tiny-invariant";
import { z } from "zod";

import { getHostConfig } from "@/host-config";
import { encryptUuidToken } from "@/utils/uuid-token";

export const zSessionToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "Session token must be URL-safe");

export const zAppExplorerSession = z
  .object({
    sessionToken: zSessionToken,
    key: z.string().min(1),
    insiders: z.boolean().default(false),
    hostIndex: z.number().int().min(0).default(0),
  })
  .brand("AppExplorerSession");

export const zAppExplorerSessionUri = z.codec(z.string(), zAppExplorerSession, {
  encode(session) {
    const parsedSession = zAppExplorerSession.parse(session);
    const url = new URL("vscode://AsaAyers.app-explorer/session/");
    url.pathname += encodeURIComponent(parsedSession.sessionToken);
    url.searchParams.set("key", parsedSession.key);
    if (parsedSession.hostIndex > 0) {
      url.searchParams.set("host", parsedSession.hostIndex.toString());
    }

    if (parsedSession.insiders) {
      url.protocol = "vscode-insiders:";
    }

    return url.toString();
  },
  decode(url) {
    const uri = new URL(url);

    const pathMatch = uri.pathname.match(/^\/session\/([^/]+)$/);
    invariant(
      pathMatch?.[1],
      `Invalid AppExplorer session URI path: ${uri.pathname}`,
    );

    const key = uri.searchParams.get("key");
    invariant(key, `Missing AppExplorer session key (${url})`);
    const hostIndex = Number(uri.searchParams.get("host"));

    return zAppExplorerSession.parse({
      sessionToken: decodeURIComponent(pathMatch[1]),
      key,
      insiders: uri.protocol === "vscode-insiders:",
      hostIndex: Number.isNaN(hostIndex) ? 0 : hostIndex,
    });
  },
});
export type AppExplorerSession = z.infer<typeof zAppExplorerSession>;
const zSessionTokenResponse = z.object({ sessionToken: zSessionToken });

export const requestSessionToken = async (signal?: AbortSignal) => {
  const response = await fetch("/api/session-token", {
    cache: "no-store",
    signal,
  });
  invariant(response.ok, `Failed to create session token (${response.status})`);
  return zSessionTokenResponse.parse(await response.json()).sessionToken;
};

export const getSocketUrl = (session: AppExplorerSession) => {
  return `/session/${session.sessionToken}`;
};

export const getWorkspaceSocketUrl = (session: AppExplorerSession) => {
  return new URL(
    getSocketUrl(session),
    getHostConfig(session.hostIndex).origin,
  ).toString();
};

export const makeSessionUrl = (session: AppExplorerSession) => {
  return zAppExplorerSessionUri.encode(session);
};

export const parseSessionUri = (url: string): AppExplorerSession => {
  return zAppExplorerSessionUri.decode(url);
};
export const makeSessionToken = () =>
  encryptUuidToken(crypto.randomUUID(), process.env.SESSION_SECRET);
