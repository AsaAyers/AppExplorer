import invariant from "tiny-invariant";
import { z } from "zod";

import { getHostConfig } from "@/host-config";

export const zAppExplorerSession = z
  .object({
    sessionId: z.string().min(1),
    key: z.string().min(1),
    insiders: z.boolean().default(false),
    hostIndex: z
      .union([z.string(), z.number()])
      .nullable()
      .default("0")
      .transform((str) => {
        const n = Number(str);
        return isNaN(n) ? 0 : n;
      }),
  })
  .brand("AppExplorerSession");

export type AppExplorerSession = z.infer<typeof zAppExplorerSession>;

export const getSocketUrl = (session: AppExplorerSession) => {
  return `/session/${session.sessionId}`;
};

export const getWorkspaceSocketUrl = (session: AppExplorerSession) => {
  return new URL(
    getSocketUrl(session),
    getHostConfig(session.hostIndex).origin,
  ).toString();
};

export const makeSessionUrl = (session: AppExplorerSession) => {
  const url = new URL("vscode://asa-ayers.app-explorer/session/");
  url.pathname += encodeURIComponent(session.sessionId);
  url.searchParams.set("key", session.key);
  if (session.hostIndex > 0) {
    url.searchParams.set("host", session.hostIndex.toString());
  }

  if (session.insiders) {
    url.protocol = "vscode-insiders:";
  }
  return url.toString();
};

export const parseSessionUri = (url: string): AppExplorerSession => {
  const uri = new URL(url);

  const pathMatch = uri.pathname.match(/^\/session\/([^/]+)$/);
  invariant(
    pathMatch?.[1],
    `Invalid AppExplorer session URI path: ${uri.pathname}`,
  );

  const key = uri.searchParams.get("key");
  invariant(key, `Missing AppExplorer session key (${url})`);

  return zAppExplorerSession.parse({
    sessionId: decodeURIComponent(pathMatch[1]),
    key,
    insiders: uri.protocol === "vscode-insiders:",
    hostIndex: uri.searchParams.get("host"),
  });
};
