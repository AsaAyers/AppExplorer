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
    onConnectedBoards: async (boardIds) => {
      return this.storage.connectedBoards(boardIds);
    },
    onBoardUpdate: async (board) => {
      return this.storage.boardUpdate(board);
    },
    onCardUpdate: async (url, card) => {
      return this.storage.cardUpdate(url, card);
    },
    onSelectedCards: async (cards) => {
      return this.storage.selectedCards(cards);
    },
    onNavigateTo: async (card) => {
      await this.storage.navigateTo(card);
    },
    onCard: async (event) => {
      return this.storage.card(event);
    },
    onLog: async (_args) => {
      return this.storage.log();
    },
  } satisfies HandlerMethodMap<"workspace">;
}
