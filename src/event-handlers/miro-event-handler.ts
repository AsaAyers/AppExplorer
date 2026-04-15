import type { Tag } from "@mirohq/websdk-types/stable/features/widgets/tag";
import invariant from "tiny-invariant";

import { HandlerMethodMap } from "./types";

import type { CardData, AppExplorerTag } from "@/EventTypes";
import { EventHandler } from "@/event-handlers/event-handler";
import { extractCardData, newCard, debug, zoomIntoCards, isTag } from "@/miro";
import { isAppCard } from "@/miro/isAppCard";
import { updateCard } from "@/miro/updateCard";
import { notEmpty } from "@/utils/notEmpty";

export class MiroEventHandler extends EventHandler<"miro"> {
  protected readonly self = "miro" as const;

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
    onSetBoardName: async (routedBoardId, name) => {
      const boardId = await this.getBoardId();
      invariant(routedBoardId === boardId, "Board ID mismatch");
      await miro.board.setAppData("name", name);
      return true;
    },
    onGetBoardInfo: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      // The boardID might not be known by the client yet, so an empty string is passed as a placeholder.
      invariant(
        routedBoardId === "" || boardId === routedBoardId,
        "Board ID mismatch",
      );
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
    onNewCards: async (routedBoardId, cards, options) => {
      try {
        const boardId = await this.getBoardId();
        invariant(routedBoardId === boardId, "Board ID mismatch");
        await newCard(cards, options).then(async (cards) => {
          const selection = await miro.board.getSelection();
          await miro.board.deselect({
            id: selection.map((c) => c.id),
          });
          if (cards.length > 0) {
            await miro.board.select({ id: cards.map((c) => c.id) });
          }
        });
        return true;
      } catch (error) {
        debug("AppExplorer: Error creating new cards", error);
        return false;
      }
    },
    onGetIdToken: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      invariant(routedBoardId === boardId, "Board ID mismatch");
      return miro.board.getIdToken();
    },
    onAttachCard: async (routedBoardId, cardData) => {
      try {
        const boardId = await this.getBoardId();
        invariant(routedBoardId === boardId, "Board ID mismatch");
        const selection = await miro.board.getSelection();
        const card = selection[0];
        if (selection.length === 1 && isAppCard(card)) {
          const updatedCard = await updateCard(card, cardData);
          updatedCard.status = "connected";
          await updatedCard.sync();
          await miro.board.deselect({
            id: selection.map((c) => c.id),
          });
          await miro.board.select({ id: card.id });
          const data = await extractCardData(updatedCard);
          if (data && data.miroLink) {
            await this.emit("card", { url: data.miroLink, card: data });
            miro.board.notifications.showInfo(`Updated card: ${data.title}`);
          }
        }
        return true;
      } catch (error) {
        debug("AppExplorer: Error attaching card", error);
        return false;
      }
    },
    onHoverCard: async (routedBoardId, cardUrl) => {
      try {
        const boardId = await this.getBoardId();
        invariant(routedBoardId === boardId, "Board ID mismatch");
        const url = new URL(cardUrl);
        const id = url.searchParams.get("moveToWidget")!;

        const card = await miro.board.getById(id);
        invariant(isAppCard(card), "card must be an app_card");
        await zoomIntoCards([card]);
        return true;
      } catch (error) {
        debug("AppExplorer: Error hovering card", error);
        return false;
      }
    },
    onCards: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      invariant(routedBoardId === boardId, "Board ID mismatch");
      return this.getCardsForBoard();
    },
    onSelectCard: async (routedBoardId, cardUrl) => {
      try {
        const boardId = await this.getBoardId();
        invariant(routedBoardId === boardId, "Board ID mismatch");
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
          await this.emit("card", { url: cardUrl, card: null });
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
        invariant(routedBoardId === boardId, "Board ID mismatch");
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
    onTags: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      invariant(routedBoardId === boardId, "Board ID mismatch");
      const selection = await miro.board.get({ type: "tag" });
      return Promise.all(
        selection.map((tag) => ({
          id: tag.id,
          title: tag.title,
          color: tag.color as AppExplorerTag["color"],
        })),
      );
    },
    onTagCards: async (routedBoardId, { miroLink: links, tag }) => {
      try {
        const boardId = await this.getBoardId();
        invariant(routedBoardId === boardId, "Board ID mismatch");
        let tagObject: Tag | undefined;
        if (typeof tag === "string") {
          const tmp = await miro.board.getById(tag);
          if (tmp && isTag(tmp)) {
            tagObject = tmp;
          }
        } else {
          tagObject = await miro.board.createTag({
            color: tag.color,
            title: tag.title,
          });
        }
        invariant(tagObject, "Tag not found");

        await links.reduce(async (p, miroLink) => {
          await p;
          const url = new URL(miroLink);
          const id = url.searchParams.get("moveToWidget")!;
          const card = await miro.board.getById(id);
          invariant(isAppCard(card), "card must be an app_card");

          if (card.tagIds.includes(tagObject.id)) {
            card.tagIds = card.tagIds.filter((id) => id !== tagObject.id);
          } else {
            card.tagIds.push(tagObject.id);
          }
          await card.sync();
        }, Promise.resolve());

        return true;
      } catch (error) {
        debug("AppExplorer: Error tagging cards", error);
        return false;
      }
    },
    onSelected: async (routedBoardId) => {
      const boardId = await this.getBoardId();
      invariant(routedBoardId === boardId, "Board ID mismatch");
      const selection = await miro.board.getSelection();
      return (await Promise.all(selection.map(extractCardData))).filter(
        notEmpty,
      );
    },
  } satisfies HandlerMethodMap<"miro">;
}
