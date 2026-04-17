import { ManagerOptions, SocketOptions } from "socket.io-client";

import { type AppExplorerSession } from "./app-explorer-session";
import { getRelayHostByIndex } from "./host-config";

type SocketClientOptions = Partial<ManagerOptions & SocketOptions>;

export function getSocketClientOptions(
  session: AppExplorerSession,
): SocketClientOptions {
  const relayHost = new URL(getRelayHostByIndex(session.hostIndex));

  if (relayHost.hostname === "dev.appexplorer.dev") {
    return {
      rejectUnauthorized: false,
    };
  }

  return {};
}
