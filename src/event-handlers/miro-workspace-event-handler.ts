import invariant from "tiny-invariant";

import { WorkspaceServerSocket, HandlerMethodMap } from "./types";

import { CardStorage, BoardInfo } from "@/card-storage";
import { EventHandler } from "@/event-handlers/event-handler";
import { debug } from "@/server/server";

export class MiroWorkspaceEventHandler extends EventHandler<
  "miro",
  "workspace"
> {
  protected readonly selfName = "miro" as const;
  private readonly cardStorage: CardStorage;

  constructor(socket: WorkspaceServerSocket, cardStorage: CardStorage) {
    super(socket);
    this.cardStorage = cardStorage;
  }

  protected readonly handlerMethods = {
    onCardStatus: async (boardId, data) => {
      debug("Workspace cardStatus request", { data });
      const boardSocket = this.cardStorage.getBoardSocket(boardId);

      if (!boardSocket) {
        debug("Board not connected", { boardId });
        return false;
      }

      try {
        const card = this.cardStorage.getCardByLink(data.miroLink);
        invariant(card, "Card not found in storage");
        this.cardStorage.setCard(card.boardId, {
          ...card,
          status: data.status,
          codeLink: data.codeLink,
        });

        const success = await boardSocket.emitWithAck(
          "cardStatus",
          boardId,
          data,
        );
        debug("cardStatus routed to board successfully", { boardId, success });
        return success;
      } catch (error) {
        debug("Failed to route cardStatus to board", { boardId, error });
        return false;
      }
    },
    onGetBoardInfo: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        const info = await boardSocket.emitWithAck("getBoardInfo", boardId);
        let boardInfo = this.cardStorage.getBoard(info.boardId);

        if (!boardInfo) {
          boardInfo = await this.cardStorage.addBoard(info.boardId, info.name);
        } else if (boardInfo.name !== info.name) {
          this.cardStorage.setBoardName(info.boardId, info.name);
        }

        debug("boardInfo retrieved", { boardId, info });
        return info;
      } catch (_error) {
        return undefined as unknown as BoardInfo;
      }
    },
    onSelectCard: async (boardId, miroLink) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      this.cardStorage.selectedCards([
        this.cardStorage.getCardByLink(miroLink)!,
      ]);
      return boardSocket
        .emitWithAck("selectCard", boardId, miroLink)
        .then((success) => success as boolean)
        .catch(() => false);
    },
    onCards: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        const cards = await boardSocket.emitWithAck("cards", boardId);
        this.cardStorage.setBoardCards(boardId, cards);
        return cards;
      } catch (_error) {
        return [];
      }
    },
  } satisfies HandlerMethodMap<"miro", "workspace">;
}
