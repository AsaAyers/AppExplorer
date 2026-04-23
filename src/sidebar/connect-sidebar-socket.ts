import { AppExplorerSession, getSocketUrl } from "@/app-explorer-session";
import { SidebarClientEventHandler } from "@/event-handlers/sidebar-client-event-handler";
import { SidebarSocket } from "@/event-handlers/types";
import { socketIO } from "@/socketio";
import { createDebug } from "@/utils/create-debug";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const log = createDebug("app-explorer:miro:sidebar");

export async function connectSidebarHandler(session: AppExplorerSession) {
  log("(sidebar_socket_connecting)");
  await delay(100);

  const connectionTimeout = 10000;
  const socket: SidebarSocket = socketIO(getSocketUrl(session), {
    auth: {
      role: "sidebar",
    },
    transports: ["websocket"],
    timeout: connectionTimeout,
    reconnection: false,
    forceNew: false,
  });

  const clientEventHandler = SidebarClientEventHandler.create(socket);
  clientEventHandler.attachSession(session);

  let timeout = false;
  delay(connectionTimeout).then(() => {
    timeout = true;
  });
  while (!socket.connected) {
    if (timeout) {
      throw new Error(
        `Failed to connect to sidebar socket within ${connectionTimeout}ms`,
      );
    }
    await delay(100);
  }

  socket.on("connect", () => {
    log("(sidebar_socket_connect)");
  });
  socket.on("disconnect", (reason) => {
    log("(sidebar_socket_disconnect)", reason);
  });

  return clientEventHandler;
}
