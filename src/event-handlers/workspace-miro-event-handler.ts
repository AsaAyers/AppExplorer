import { CardStorage } from "@/card-storage";
import {
  EventHandler,
  MiroServerSocket,
  HandlerMethodMap,
  WorkspaceNamespace,
} from "@/event-handler";
import { logger } from "@/logger";
import { MiroServer, debug } from "@/server/server";

export class WorkspaceMiroEventHandler extends EventHandler<
  "workspace",
  "miro"
> {
  protected readonly self = "workspace" as const;
  private readonly cardStorage: CardStorage;
  private readonly workspaceNamespace: WorkspaceNamespace;
  constructor(
    socket: MiroServerSocket,
    cardStorage: CardStorage,
    workspaceNamespace: MiroServer["workspaceNamespace"],
  ) {
    super(socket);
    this.cardStorage = cardStorage;
    this.workspaceNamespace = workspaceNamespace;
  }

  protected readonly handlerMethods = {
    onLog: async ([message, ...args]) => {
      logger.log(message, ...args);
    },
    onNavigateTo: async (card) => {
      debug("🎯 MIRO EVENT: Navigate to card", {
        timestamp: new Date().toISOString(),
        boardId: card.boardId,
        cardTitle: card.title,
        cardPath: card.path,
        cardSymbol: card.type === "symbol" ? card.symbol : undefined,
        cardMiroLink: card.miroLink,
        cardStatus: card.status,
        eventSource: "miro-board",
        willBroadcastTo: "assigned-workspaces",
      });

      debug("🔄 BROADCASTING TO BOARD WORKSPACES", { boardId: card.boardId });
      this.workspaceNamespace.emit("navigateTo", card);
    },
    onSelectedCards: async (data) => {
      this.workspaceNamespace.emit("selectedCards", data);
    },
    onCard: async ({ url, card }) => {
      debug("Received card update", { url, card });
      this.workspaceNamespace.emit("card", { url, card });

      if (card) {
        this.cardStorage.setCard(card.boardId, card);
      } else {
        this.cardStorage.deleteCardByLink(url);
      }
    },
  } satisfies HandlerMethodMap<"workspace", "miro">;
}
