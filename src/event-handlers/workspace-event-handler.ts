import { WorkspaceSocket, HandlerMethodMap } from "./types";

import { EventHandler } from "@/event-handlers/event-handler";
import { WorkspaceCardStorage } from "@/workspace-card-storage";

export class WorkspaceEventHandler extends EventHandler<"workspace"> {
  protected readonly selfName = "workspace" as const;
  private readonly storage: WorkspaceCardStorage;

  constructor(socket: WorkspaceSocket, storage: WorkspaceCardStorage) {
    super(socket);
    this.storage = storage;
  }

  protected readonly handlerMethods = {
    onBoardUpdate: async (board) => {
      return this.storage.boardUpdate(board);
    },
    onSelectedCards: async (cards) => {
      return this.storage.selectedCards(cards);
    },
    onNavigateTo: async (card) => {
      await this.storage.navigateTo(card);
    },
    onRequestCardsAroundCursor: async () => {
      this.storage.requestCurrentCardsAroundCursor();
    },
    onCard: async (event) => {
      return this.storage.card(event);
    },
    onLog: async (_args) => {
      return this.storage.handleLogEvent();
    },
  } satisfies HandlerMethodMap<"workspace">;
}
