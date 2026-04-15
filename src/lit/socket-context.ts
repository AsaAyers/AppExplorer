import { ContextProvider, createContext } from "@lit/context";
import { Task } from "@lit/task";
import "@webcomponents/webcomponentsjs";
import { ReactiveElement } from "lit";
import { io as socketIO } from "socket.io-client";

import {
  SidebarClientEventHandler,
  SidebarSocketBridge,
} from "../event-handlers/sidebar-client-event-handler";
import { APP_EXPLORER_SESSION_NAMESPACE } from "../session-transport";
import { createDebug } from "../utils/create-debug";

import { SidebarSocket } from "@/event-handlers/types";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const debug = createDebug("app-explorer:miro:sidebar");

export const socketContext = createContext<SidebarSocket>(
  Symbol("socketContext"),
);

export async function connectSidebarSocket() {
  debug("connectSidebarSocket");
  await new Promise((resolve) => setTimeout(resolve, 100));

  const connectionTimeout = 10000;
  const socket: SidebarSocket = socketIO(APP_EXPLORER_SESSION_NAMESPACE, {
    auth: {
      role: "sidebar",
    },
    transports: ["websocket"],
    timeout: connectionTimeout,
    reconnection: true,
    forceNew: false,
  });

  const clientEventHandler = SidebarClientEventHandler.create(socket as never);
  const bridgedSocket = new SidebarSocketBridge(socket, clientEventHandler);

  let connected = false;
  const onConnect = async () => {
    debug("onConnect");
    connected = true;
  };

  socket.on("connect", onConnect);
  socket.on("disconnect", (reason) => {
    debug("disconnected", reason);
    if (reason === "transport close") {
      debug("retry");
      const i = setInterval(() => {
        debug(
          "Reconnecting socket...",
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
      debug("Socket disconnected");
    }
  });

  while (!connected) {
    await delay(100);
  }

  return bridgedSocket as unknown as SidebarSocket;
}

export class SocketProvider extends ContextProvider<
  { __context__: SidebarSocket },
  ReactiveElement
> {
  constructor(
    host: ReactiveElement,
    onComplete?: (value: SidebarSocket) => void,
  ) {
    super(host, {
      context: socketContext,
    });
    new Task(this.host, {
      args: () => [],
      task: connectSidebarSocket,
      onComplete: (socket) => {
        this.setValue(socket);
        onComplete?.(socket);
      },
    });
  }
}
