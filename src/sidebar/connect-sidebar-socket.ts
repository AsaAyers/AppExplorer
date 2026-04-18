import { io as socketIO } from "socket.io-client";

import { AppExplorerSession, getSocketUrl } from "@/app-explorer-session";
import type { CardData } from "@/card-data";
import { SidebarClientEventHandler } from "@/event-handlers/sidebar-client-event-handler";
import { SidebarSocket } from "@/event-handlers/types";
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

export async function connectSidebarSocket(session: AppExplorerSession) {
  const clientEventHandler = await connectSidebarHandler(session);
  const socket = clientEventHandler.socketClient;

  const cardsAroundCursorListeners = new Map<
    (cards: CardData[]) => void,
    { dispose(): void }
  >();
  const sessionShutdownListeners = new Map<() => void, { dispose(): void }>();

  const adaptedSocket = Object.assign(socket, {
    on(eventName: string, listener: (...args: unknown[]) => unknown) {
      if (eventName === "cardsAroundCursor") {
        const typedListener = listener as (cards: CardData[]) => void;
        cardsAroundCursorListeners.set(
          typedListener,
          clientEventHandler.cardsAroundCursorEvent(typedListener),
        );
        return adaptedSocket;
      }

      if (eventName === "sessionShutdown") {
        const typedListener = listener as () => void;
        sessionShutdownListeners.set(
          typedListener,
          clientEventHandler.sessionShutdownEvent(typedListener),
        );
        return adaptedSocket;
      }

      socket.on(eventName as never, listener as never);
      return adaptedSocket;
    },
    off(eventName: string, listener: (...args: unknown[]) => unknown) {
      if (eventName === "cardsAroundCursor") {
        cardsAroundCursorListeners
          .get(listener as (cards: CardData[]) => void)
          ?.dispose();
        cardsAroundCursorListeners.delete(
          listener as (cards: CardData[]) => void,
        );
        return adaptedSocket;
      }

      if (eventName === "sessionShutdown") {
        sessionShutdownListeners.get(listener as () => void)?.dispose();
        sessionShutdownListeners.delete(listener as () => void);
        return adaptedSocket;
      }

      socket.off(eventName as never, listener as never);
      return adaptedSocket;
    },
  });

  return adaptedSocket;
}
