import { ContextProvider, createContext } from "@lit/context";
import { Task } from "@lit/task";
import "@webcomponents/webcomponentsjs";
import { ReactiveElement } from "lit";

import { AppExplorerSession } from "@/app-explorer-session";
import { SidebarSocket } from "@/event-handlers/types";
import { connectSidebarSocket } from "@/sidebar/connect-sidebar-socket";

export const socketContext = createContext<SidebarSocket>(
  Symbol("socketContext"),
);

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
