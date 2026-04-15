import { WorkspaceInfo } from "../EventTypes";
import { BoardInfo, CardStorage } from "../card-storage";
import {
  DocumentSymbolTracker,
  getDocumentSymbolTracker,
} from "../document-symbol-tracker";
import { LocationFinder } from "../location-finder";
import { createDebug } from "../utils/create-debug";

import { ServerSidebarEventHandler } from "@/event-handlers/server-sidebar-event-handler";
import {
  SidebarNamespace,
  SidebarServerSocket,
  WorkspaceNamespace,
} from "@/event-handlers/types";
import { WorkspaceSidebarEventManager } from "@/event-handlers/workspace-sidebar-event-handler";
export const debug = createDebug("app-explorer:server:sidebar");

export class SidebarServer {
  private sidebarNamespace: SidebarNamespace;
  private cardStorage: CardStorage;

  private connectedWorkspaces: Map<string, WorkspaceInfo>;
  #instanceId = `sidebar-${Math.random().toString(36).substring(2, 15)}`;
  subscriptions: { dispose(): void }[] = [];
  symbolTracker: DocumentSymbolTracker;

  private workspaceNamespace: WorkspaceNamespace;
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
    const serverEventHandler = ServerSidebarEventHandler.create(
      socket,
      this.#instanceId,
    );
    WorkspaceSidebarEventManager.create(socket, this.workspaceNamespace);
    socket.onAnyOutgoing((event) => {
      debug("outgoing", event);
    });

    this.subscriptions.push(
      this.symbolTracker.event((event) => {
        if (event.type === "symbolsChanged") {
          void serverEventHandler.emitEncrypted(
            "cardsAroundCursor",
            event.symbols,
          );
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
