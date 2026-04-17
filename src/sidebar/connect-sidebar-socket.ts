import { io as socketIO } from "socket.io-client";

import {
  SidebarClientEventHandler,
  SidebarSocketBridge,
} from "@/event-handlers/sidebar-client-event-handler";
import { SidebarSocket } from "@/event-handlers/types";
import { getSocketClientOptions } from "@/socket-client-options";
import { AppExplorerSession, getSocketUrl } from "@/app-explorer-session";
import { createDebug } from "@/utils/create-debug";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const log = createDebug("app-explorer:miro:sidebar");

export async function connectSidebarSocket(session: AppExplorerSession) {
  log("(sidebar_socket_connecting)");
  await delay(100);

  const connectionTimeout = 10000;
  const socket: SidebarSocket = socketIO(getSocketUrl(session), {
    auth: {
      role: "sidebar",
    },
    transports: ["websocket"],
    timeout: connectionTimeout,
    reconnection: true,
    forceNew: false,
    ...getSocketClientOptions(session),
  });

  const clientEventHandler = SidebarClientEventHandler.create(socket as never);
  clientEventHandler.attachSession(session);
  const bridgedSocket = new SidebarSocketBridge(socket, clientEventHandler);

  let connected = false;
  const onConnect = async () => {
    log("(sidebar_socket_connect)");
    connected = true;
  };

  socket.on("connect", onConnect);
  socket.on("disconnect", (reason) => {
    log("(sidebar_socket_disconnect)", reason);
    if (reason === "transport close") {
      log("(sidebar_socket_retry)");
      const i = setInterval(() => {
        log(
          "(sidebar_socket_reconnecting)",
          socket.connected,
          socket.disconnected,
          socket.recovered,
        );
        if (socket.connected) {
          clearInterval(i);
          void onConnect();
          return;
        }
        socket.connect();
      }, 1000);
    } else {
      log("(sidebar_socket_disconnect_permanent)", reason);
    }
  });

  while (!connected) {
    await delay(100);
  }

  return bridgedSocket as unknown as SidebarSocket;
}
