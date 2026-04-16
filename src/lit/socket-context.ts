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

import { AppExplorerSession } from "@/app-explorer-session";
import { SidebarSocket } from "@/event-handlers/types";
import { getHostByIndex } from "@/host-config";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const debug = createDebug("app-explorer:miro:sidebar");

export const socketContext = createContext<SidebarSocket>(
  Symbol("socketContext"),
);

export async function connectSidebarSocket(hostIndex: number) {
  debug("connectSidebarSocket");
  await new Promise((resolve) => setTimeout(resolve, 100));

  const host = getHostByIndex(hostIndex);
  const connectionTimeout = 10000;
  const socket: SidebarSocket = socketIO(
    host + APP_EXPLORER_SESSION_NAMESPACE,
    {
      auth: {
        role: "sidebar",
      },
      transports: ["websocket"],
      timeout: connectionTimeout,
      reconnection: true,
      forceNew: false,
    },
  );

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
  session?: AppExplorerSession;
  private currentSocket?: SidebarSocket;
  onSocketConnectionComplete: (value: SidebarSocket) => void;

  private readonly connectTask: Task<
    [number | undefined],
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
      args: () => [this.session?.hostIndex],
      task: async ([hostIndex]) => {
        if (hostIndex === undefined) return undefined; // no session yet => do nothing
        return connectSidebarSocket(hostIndex);
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
}
