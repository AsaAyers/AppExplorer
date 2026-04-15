import { Namespace } from "socket.io";

import { WorkspaceInfo } from "../EventTypes";
import { BoardInfo, CardStorage } from "../card-storage";
import {
  DocumentSymbolTracker,
  getDocumentSymbolTracker,
} from "../document-symbol-tracker";
import {
  EventHandler,
  HandlerMethodMap,
  SidebarServerSocket,
} from "../event-handler";
import { LocationFinder } from "../location-finder";
import { EventsFrom, EventsTo, RoutedEvents } from "../socket-events";
import { createDebug } from "../utils/create-debug";
const debug = createDebug("app-explorer:server:sidebar");

type SidebarNamespace = Namespace<EventsFrom<"sidebar">, EventsTo<"sidebar">>;

export class SidebarServer {
  private sidebarNamespace: SidebarNamespace;
  private cardStorage: CardStorage;

  private connectedWorkspaces: Map<string, WorkspaceInfo>;
  #instanceId = `sidebar-${Math.random().toString(36).substring(2, 15)}`;
  subscriptions: { dispose(): void }[] = [];
  symbolTracker: DocumentSymbolTracker;

  private workspaceNamespace: Namespace<
    RoutedEvents<"workspace", "miro">,
    EventsTo<"workspace">
  >;
  constructor(
    namespace: SidebarNamespace,
    cardStorage: CardStorage,
    connectedWorkspaces: Map<string, WorkspaceInfo>,
    workspaceNamespace: SidebarServer["workspaceNamespace"],
  ) {
    this.workspaceNamespace = workspaceNamespace;
    this.sidebarNamespace = namespace.use((socket, next) => {
      socket.onAny((event) => {
        debug("sidebar event", { event });
      });

      next();
    });
    this.cardStorage = cardStorage;
    this.connectedWorkspaces = connectedWorkspaces;

    this.sidebarNamespace.on("connection", this.onSidebarConnection);

    this.cardStorage.on("boardUpdate", this.emitServerStatus);
    this.cardStorage.on("connectedBoards", this.emitServerStatus);
    this.cardStorage.on("workspaceBoards", this.emitServerStatus);

    this.subscriptions.push({
      dispose: () => {
        this.sidebarNamespace.off("connection", this.onSidebarConnection);
        this.cardStorage.off("boardUpdate", this.emitServerStatus);
        this.cardStorage.off("connectedBoards", this.emitServerStatus);
        this.cardStorage.off("workspaceBoards", this.emitServerStatus);
      },
    });

    this.symbolTracker = getDocumentSymbolTracker(new LocationFinder());
    this.subscriptions.push(this.symbolTracker);
  }

  dispose() {
    this.subscriptions.forEach((d) => d.dispose());
  }

  onSidebarConnection = (socket: SidebarServerSocket) => {
    debug("New sidebar connection", { socketId: socket.id });
    SidebarServerEventHandler.create(socket, this.#instanceId);
    SidebarWorkspaceEventHandler.create(socket, this.workspaceNamespace);
    socket.onAnyOutgoing((event) => {
      debug("outgoing", event);
    });

    this.subscriptions.push(
      this.symbolTracker.event((event) => {
        if (event.type === "symbolsChanged") {
          socket.emit("cardsAroundCursor", event.symbols);
        }
      }),
    );

    setTimeout(() => {
      this.emitServerStatus();
      this.symbolTracker.fire({ type: "symbolRequest" });
    }, 250);
  };

  getServerStatus = () => {
    const cardsByBoard = this.cardStorage.getCardsByBoard();
    const allBoards = Object.keys(cardsByBoard)
      .map((id) => this.cardStorage.getBoard(id))
      .filter((board): board is BoardInfo => board !== null);
    return {
      allBoards,
      connectedWorkspaces: Array.from(this.connectedWorkspaces.values()).map(
        (workspace) => ({
          ...workspace,
          socket: undefined,
        }),
      ),
      connectedBoardIds: this.cardStorage.getConnectedBoards(),
      cardsPerBoard: Object.fromEntries(
        Object.entries(cardsByBoard).map(([boardId, cards]) => [
          boardId,
          cards.length,
        ]),
      ),
    };
  };
  emitServerStatus = () => {
    debug("Emitting server status");
    this.sidebarNamespace.emit("serverStatus", this.getServerStatus());
  };
}

class SidebarServerEventHandler extends EventHandler<"server", "sidebar"> {
  protected readonly self = "server" as const;
  private readonly instanceId: string;

  constructor(socket: SidebarServerSocket, instanceId: string) {
    super(socket);
    this.instanceId = instanceId;
  }

  protected readonly handlerMethods = {
    onGetInstanceId: async () => {
      debug("getInstanceId", this.instanceId);
      return this.instanceId;
    },
  } satisfies HandlerMethodMap<"server", "sidebar">;
}

class SidebarWorkspaceEventHandler extends EventHandler<
  "workspace",
  "sidebar"
> {
  protected readonly self = "workspace" as const;
  private readonly workspaceNamespace: Namespace<
    RoutedEvents<"workspace", "miro">,
    EventsTo<"workspace">
  >;

  constructor(
    socket: SidebarServerSocket,
    workspaceNamespace: SidebarServer["workspaceNamespace"],
  ) {
    super(socket);
    this.workspaceNamespace = workspaceNamespace;
  }

  protected readonly handlerMethods = {
    onNavigateTo: async (card) => {
      this.workspaceNamespace.emit("navigateTo", card);
    },
  } satisfies HandlerMethodMap<"workspace", "sidebar">;
}
