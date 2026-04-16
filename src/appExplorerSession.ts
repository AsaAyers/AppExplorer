import invariant from "tiny-invariant";
import { z } from "zod";

export const zAppExplorerSession = z.object({
  sessionId: z.string().min(1),
  key: z.string().min(1),
  hostIndex: z
    .string()
    .nullable()
    .default("0")
    .transform((str) => {
      const index = Number(str);
      if (Number.isInteger(index) && index >= 0 && index <= 2) {
        return index;
      }
      return 0;
    }),
});

export type AppExplorerSession = z.infer<typeof zAppExplorerSession>;

export const parseSessionUri = (url: string): AppExplorerSession => {
  const uri = new URL(url);
  invariant(
    uri.host === "asa-ayers.app-explorer",
    `Unexpected AppExplorer URI host: ${uri.host}`,
  );

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
    hostIndex: uri.searchParams.get("host"),
  });
};
