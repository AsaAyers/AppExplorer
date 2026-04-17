import { ContextProvider, createContext } from "@lit/context";
import { Task } from "@lit/task";
import "@webcomponents/webcomponentsjs";
import { ReactiveElement } from "lit";
import { io as socketIO } from "socket.io-client";

import {
  SidebarClientEventHandler,
  SidebarSocketBridge,
} from "../event-handlers/sidebar-client-event-handler";
import { getSocketClientOptions } from "../socket-client-options";
import { createDebug } from "../utils/create-debug";

import { AppExplorerSession, getSocketUrl } from "@/app-explorer-session";
import { SidebarSocket } from "@/event-handlers/types";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const log = createDebug("app-explorer:miro:sidebar");

export const socketContext = createContext<SidebarSocket>(
  Symbol("socketContext"),
);

export async function connectSidebarSocket(session: AppExplorerSession) {
  log("(sidebar_socket_connecting)");
  await new Promise((resolve) => setTimeout(resolve, 100));

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

export class SocketProvider extends ContextProvider<
  { __context__: SidebarSocket },
  ReactiveElement
> {
  session?: AppExplorerSession;
  private currentSocket?: SidebarSocket;
  onSocketConnectionComplete: (value: SidebarSocket) => void;

  private readonly connectTask: Task<
    [AppExplorerSession | undefined],
    SidebarSocket | undefined
  >;

  constructor(
    host: ReactiveElement,
    onSocketConnectionComplete?: (value: SidebarSocket) => void,
  ) {
    super(host, { context: socketContext });
    this.onSocketConnectionComplete =
      onSocketConnectionComplete ?? ((_s: SidebarSocket) => {});

    this.connectTask = new Task(this.host, {
      // Runs only when hostIndex changes
      args: () => [this.session],
      task: async ([session]) => {
        if (session === undefined) return undefined; // no session yet => do nothing
        return connectSidebarSocket(session);
      },
      onComplete: (socket) => {
        if (!socket) return;
        // Optional: disconnect previous socket if host changed
        this.currentSocket?.disconnect?.();
        this.currentSocket = socket;

        this.setValue(socket);
        this.onSocketConnectionComplete(socket);
      },
    });
  }

  setHostIndex(session: AppExplorerSession | undefined) {
    this.session = session;
    // Task re-evaluates args on host update
    this.host.requestUpdate();
  }

  disconnect() {
    this.currentSocket?.disconnect();
    this.currentSocket = undefined;
    this.setValue(undefined as never);
    this.host.requestUpdate();
  }
}
