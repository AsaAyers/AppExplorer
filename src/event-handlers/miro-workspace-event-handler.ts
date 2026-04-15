import invariant from "tiny-invariant";

import { AppExplorerTag } from "@/EventTypes";
import { CardStorage, BoardInfo } from "@/card-storage";
import {
  EventHandler,
  WorkspaceServerSocket,
  HandlerMethodMap,
} from "@/event-handler";
import { debug } from "@/server/server";

export class MiroWorkspaceEventHandler extends EventHandler<
  "miro",
  "workspace"
> {
  protected readonly self = "miro" as const;
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
    onGetIdToken: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("getIdToken", boardId)
        .then((id) => id as string)
        .catch(() => "" as string);
    },
    onSetBoardName: async (boardId, name) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      this.cardStorage.setBoardName(boardId, name);
      return boardSocket
        .emitWithAck("setBoardName", boardId, name)
        .then((success) => success as boolean)
        .catch(() => false);
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
    onTags: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("tags", boardId)
        .then((tags) => tags as AppExplorerTag[])
        .catch(() => []);
    },
    onAttachCard: async (boardId, data) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("attachCard", boardId, data)
        .then((success) => success as boolean)
        .catch(() => false);
    },
    onTagCards: async (boardId, data) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("tagCards", boardId, data)
        .then((success) => success as boolean)
        .catch(() => false);
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
    onSelected: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        const selected = await boardSocket.emitWithAck("selected", boardId);
        this.cardStorage.selectedCards(selected);
        return selected;
      } catch (_error) {
        return [];
      }
    },
    onNewCards: async (boardId, data, options) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        return await boardSocket.emitWithAck(
          "newCards",
          boardId,
          data,
          options,
        );
      } catch (_error) {
        return false;
      }
    },
    onHoverCard: async (boardId, miroLink) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("hoverCard", boardId, miroLink)
        .then((success) => success as boolean)
        .catch(() => false);
    },
  } satisfies HandlerMethodMap<"miro", "workspace">;
}
