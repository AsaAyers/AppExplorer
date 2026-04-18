import { HandlerMethodMap } from "./types";

import type { CardData } from "@/card-data";
import { EventHandler } from "@/event-handlers/event-handler";
import { extractCardData, debug, zoomIntoCards } from "@/miro";
import { isAppCard } from "@/miro/is-app-card";
import { notEmpty } from "@/utils/not-empty";

export class MiroEventHandler extends EventHandler<"miro"> {
  protected readonly selfName = "miro" as const;

  private async getBoardId() {
    return miro.board.getInfo().then((info) => info.id);
  }

  private async getCardsForBoard() {
    const cards = (
      await miro.board.get({
        type: ["app_card"],
      })
    ).filter((c) => c.type === "app_card");
    return (await Promise.all(cards.map(extractCardData))).filter(notEmpty);
  }

  protected readonly handlerMethods = {
    onGetBoardInfo: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      // The boardID might not be known by the client yet, so an empty string is passed as a placeholder.
      if (routedBoardId !== "" && boardId !== routedBoardId) {
        return this.optOut();
      }
      const name = (await miro.board.getAppData("name")) as string;
      const cardArray = await this.getCardsForBoard();
      return {
        boardId,
        name,
        cards: cardArray.reduce(
          (acc: Record<string, CardData>, c: CardData) => {
            acc[c.miroLink!] = c;
            return acc;
          },
          {} as Record<string, CardData>,
        ),
      };
    },
    onCards: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      if (routedBoardId !== boardId) {
        return this.optOut();
      }
      return this.getCardsForBoard();
    },
    onSelectCard: async (routedBoardId, cardUrl) => {
      try {
        const boardId = await this.getBoardId();
        if (routedBoardId !== boardId) {
          return this.optOut();
        }
        const url = new URL(cardUrl);
        const id = url.searchParams.get("moveToWidget")!;
        const card = await miro.board.getById(id);
        if (card && isAppCard(card)) {
          const selection = await miro.board.getSelection();
          await miro.board.deselect({
            id: selection.map((c) => c.id),
          });
          await miro.board.select({ id: card.id });
          await zoomIntoCards([card]);
          miro.board.notifications.showInfo(`Selected card: ${card.title}`);
        } else {
          await this.emitEncrypted("card", { url: cardUrl, card: null });
          miro.board.notifications.showError(`Card not found ${cardUrl}`);
        }
        return true;
      } catch (error) {
        debug("AppExplorer: Error selecting card", error);
        miro.board.notifications.showError(
          `AppExplorer: Error selecting card ${error}`,
        );
        return false;
      }
    },
    onCardStatus: async (routedBoardId, { miroLink, status, codeLink }) => {
      try {
        const boardId = await this.getBoardId();
        if (routedBoardId !== boardId) {
          return this.optOut();
        }
        const url = new URL(miroLink);
        const id = url.searchParams.get("moveToWidget")!;
        const card = await miro.board.getById(id);

        if (isAppCard(card)) {
          card.status = status;
          if (codeLink) {
            card.linkedTo = codeLink;
          }
          await card.sync();
        }
      } catch (error) {
        debug("AppExplorer: Error updating card status", error);
      }
      return true;
    },
    onSessionShutdown: async () => {
      miro.board.notifications.showInfo(
        "Session ended. Disconnecting AppExplorer.",
      );
      this.socket.disconnect();
    },
  } satisfies HandlerMethodMap<"miro">;
}
