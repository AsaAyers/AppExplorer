"use client";

import { Item, SelectionUpdateEvent, Text } from "@mirohq/websdk-types";
import { Listener } from "@mirohq/websdk-types/core/features/eventManager";
import removeMarkdown from "remove-markdown";
import invariant from "tiny-invariant";

import {
  BackgroundSessionSocket,
  BrowserSessionSocketOptions,
  TextLinkCollection,
} from "@/app/(miro)/background/background-session-socket";
import { AppEventHandler } from "@/extension/app-event-handler";
import { AppEventUnion, CardData } from "@/extension/types";
import { delay } from "@/extension/utils/delay";
import { AppExplorerChannel } from "@/utils/broadcast-channel";
import { debugLog } from "@/utils/debug-log";
import {
  extractCardData,
  extractCardDataWithAdapter,
} from "@/utils/extract-card-data";
import { isAppCard } from "@/utils/is-app-card";
import { getMiroAdapter, MiroAdapter } from "@/utils/miro/adapter";
import { toCardSelectedSocketEvent } from "@/utils/miro/contracts";
import { updateCard } from "@/utils/update-card";

const log = debugLog("handler:background");

type BackgroundMiroOptions = {
  createSession?: typeof BackgroundSessionSocket.createSession;
  sessionOptions?: BrowserSessionSocketOptions;
  miroAdapter?: MiroAdapter;
};

export class BackgroundMiroHandler extends AppEventHandler<
  "miroBackground",
  "channel"
> {
  readonly target: "miroBackground" = "miroBackground" as const;
  readonly transport: "channel" = "channel" as const;
  channel: AppExplorerChannel;
  isPaid: boolean;
  textLinks: TextLinkCollection;
  miroAdapter: MiroAdapter;
  session: BackgroundSessionSocket | null = null;
  cardsAroundCursor = { cards: [] as CardData[] | null, path: "" };

  constructor(
    isPaid: boolean,
    private boardId: string,
    private options: BackgroundMiroOptions = {},
  ) {
    super("miroBackground", "channel");
    this.isPaid = isPaid;
    this.miroAdapter = options.miroAdapter ?? getMiroAdapter();
    this.channel = new AppExplorerChannel(boardId);
    this.textLinks = this.miroAdapter.getCollection("textLinks");

    this.attachMiroBoardUIEvents();
    this.attachChannel(this.channel);
  }

  get isReady() {
    return !!this.session?.isConnected;
  }

  onHandlerCalled(str: string, event: AppEventUnion): void {
    super.onHandlerCalled(str, event);
    this.log("postMessage", event.type);
    this.channel.postMessage(event);
  }

  emitStatusOverChannel = () => {
    this.channel?.postMessage({
      type: "socketStatus",
      sessionId: this.session?.id || null,
      transport: "channel",
    });
  };

  handlers = this.makeHandlers({
    onOpenAuthModal: async (data) => {
      log("data", data);
      const { modalData, panelData, returnPath, redirectUrl } = data;
      const closedPanel = await this.miroAdapter
        .closePanel()
        .then(() => true)
        .catch(() => false);
      const closedModal = await this.miroAdapter
        .closeModal()
        .then(() => true)
        .catch(() => false);
      invariant(
        closedModal !== closedPanel,
        "Unable to determine if user should be returned to a panel or a modal",
      );
      // userInfo.id
      const { waitForClose } = await this.miroAdapter.openModal({
        url: redirectUrl,
        height: 800,
      });
      const result = await waitForClose();
      log("authModal", { result });
      if (!result) {
        // User closed with the X button
      } else if (closedPanel) {
        await this.miroAdapter.openPanel({ url: returnPath, data: panelData });
        await this.miroAdapter.closeModal();
      } else if (closedModal) {
        await this.miroAdapter.closeModal();
        await this.miroAdapter.openModal({
          url: returnPath,
          data: modalData,
          width: 400,
        });
      }
    },
    onStartSession: (event) => {
      const { id, key } = event;

      const createSession =
        this.options.createSession ?? BackgroundSessionSocket.createSession;
      const sessionOptions = {
        ...this.options.sessionOptions,
        miroAdapter:
          this.options.sessionOptions?.miroAdapter ?? this.miroAdapter,
      };
      this.session = createSession(
        id,
        key,
        this.boardId,
        this.channel,
        sessionOptions,
      );
      const i = setInterval(() => {
        this.emitStatusOverChannel();
        if (!this.session) {
          log("Session closed");
          clearInterval(i);
        }
      }, 10000);
      this.emitStatusOverChannel();
      this.session.onDisconnect(() => {
        this.emitStatusOverChannel();
      });
    },

    /**
     * The background client has access to the socket, so modal and panels need to
     * trigger the event over the shared AppExplorerChannel so that it can be
     * relayed over the socket.
     *
     * This function waits to see if it was successful, so that it can update the
     * status and/or permalink of the card.
     */
    onNavigateToCode: async (event) => {
      log("emitWithAck navigateToCode");
      try {
        const { success, link } = await this.emit("navigateToCode", event);

        log("navigate", { success, link });
        const card = await this.miroAdapter.getBoardItemById(event.cardData.id);
        if (card && isAppCard(card)) {
          card.status = success ? "connected" : "disconnected";
          if (link) {
            card.linkedTo = link;
          }
          await card.sync();
        }
      } catch (e) {
        log("ERROR: Unable to naviage", event.cardData.id, e);
      }
    },

    onCardsAroundCursor: ({ cards, path }): void => {
      log("cardsAroundCursor", cards, path);
      this.cardsAroundCursor = { cards, path };
      this.emitCardsAroundCursor();
    },

    onRequestSocketStatus: this.emitStatusOverChannel,

    onAttachDescription: async ({ cardId, description }) => {
      log("attachDescription", cardId);
      const card = await this.miroAdapter.getBoardItemById(cardId);
      log("CARD", card);
      invariant(card && isAppCard(card), "Invalid ID " + cardId);

      const labelId = await this.textLinks.get<string>(card.id);

      let shape;
      if (labelId) {
        shape = (await this.miroAdapter
          .getBoardItemById(labelId)
          .catch(() => null)) as Text;
      }
      log({ shape });

      const content = removeMarkdown(description);

      if (!shape) {
        shape = await this.miroAdapter.createText({
          content: content,
          width: card.width,
          x: card.x,
          y: card.y + card.height,
        });
        await this.textLinks.set(card.id, shape.id);
      } else {
        shape.content = content;
        await shape.sync();
      }

      shape.x = card.x - card.width / 2 + shape.width / 2;
      shape.y = card.y + card.height / 2 + shape.height / 2;
      await shape.sync();
    },

    onNewCard: async (data) => {
      const { x, y, attachSelected, cardData } = data;

      const permission = { allowed: true, message: "" };

      // if (!this.isPaid) {
      //   permission = {
      //     allowed: false,
      //     message: "You need a subscription to create cards",
      //   };
      // }

      if (!permission.allowed) {
        if (permission.message) {
          this.miroAdapter.showError(permission.message);
        }
        return;
      } else if (permission.message) {
        this.miroAdapter.showInfo(permission.message);
      }

      const card = await updateCard(
        await this.miroAdapter.createAppCard({
          x,
          y,
          title: cardData.title,
          status: "connected",
        }),
        cardData,
      );
      if (cardData.description) {
        this.handlers.onAttachDescription({
          source: "foreground",
          type: "attachDescription",
          cardId: card.id,
          description: cardData.description,
        });
      }

      if (attachSelected) {
        const selection = (await this.miroAdapter.getSelection()).filter(
          isAppCard,
        );

        if (selection.length > 0) {
          await selection.reduce(async (promise, item) => {
            await this.miroAdapter.createConnector({
              start: { item: item.id },
              end: { item: card.id },
              shape: "curved",
              style: {
                startStrokeCap: "none",
                endStrokeCap: "arrow",
              },
            });
            return promise;
          }, Promise.resolve(null));
        }
      }
    },
    onZoomIntoCards: async ({ cards }) => {
      const zoomItems = (
        await Promise.all(
          cards.map(async (cardData) => {
            const card = await this.miroAdapter.getBoardItemById(cardData.id);
            if (!card) {
              return null;
            }
            if (card.type === "app_card" && card.parentId) {
              const frame = await this.miroAdapter.getBoardItemById(
                card.parentId,
              );
              if (frame?.type === "frame") {
                return frame;
              }
            }
            return card;
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => item != null);

      await this.miroAdapter.zoomTo(zoomItems);
    },

    /**
     * This is used by useCardsAroundCursor so that modals or sidebars get an
     * update event ASAP.
     */
    onRequestCardsAroundCursor: (_data) => {
      this.emitCardsAroundCursor();
    },
  });

  emitCardsAroundCursor = () => {
    this.channel.postMessage({
      ...this.cardsAroundCursor,
      type: "cardsAroundCursor",
      source: "background",
    });
  };

  async attachMiroBoardUIEvents() {
    await this.miroAdapter.onSelectionUpdate(this.selectionUpdate);

    await this.miroAdapter.onIconClick(this.iconClick);
    await this.miroAdapter.onAppCardOpen(this.openCard);
    await this.miroAdapter.onAppCardConnect(this.openCard);
    await this.miroAdapter.onItemsUpdate(this.onUpdate);
    await this.miroAdapter.onItemsDelete(this.onDelete);
  }

  selectionUpdate = async (e: SelectionUpdateEvent) => {
    if (e.items.length === 1) {
      const item = e.items[0];
      const cardData = await extractCardDataWithAdapter(item, this.miroAdapter);
      if (cardData) {
        log("cardSelected", cardData);
        this.emit("cardSelected", toCardSelectedSocketEvent(cardData));
      }
    }
  };
  iconClick: Listener = async () => {
    await this.miroAdapter.openPanel({ url: "/sidebar/overview" });
  };

  openCard: Listener = async (event) => {
    const card: CardData | null = await extractCardData(event.appCard);
    invariant(card != null, "Missing Card Data");
    await this.miroAdapter.openModal({
      url: `/card/${this.boardId}/${event.appCard.id}`,
      data: card,
      width: 400,
    });
  };

  onDelete = async (event: { items: Item[] }) => {
    log("onDelete", event);
    for (const item of event.items) {
      if (isAppCard(item)) {
        const labelId = await this.textLinks.get<string>(item.id);

        if (labelId) {
          const textField = await this.miroAdapter
            .getBoardItemById(labelId)
            .catch(() => null);
          if (textField) {
            log("textField", textField.id);
            await this.miroAdapter.removeItem(textField);
          }
        }
      }
    }
  };

  onUpdate = async (event: { items: Item[] }) => {
    for (const item of event.items) {
      log("onUpdate", item.id);
      if (isAppCard(item)) {
        const labelId = await this.textLinks.get<string>(item.id);
        if (labelId) {
          this.attachDescription({
            cardId: item.id,
            description: item.description.trim(),
          });
        }
      }
    }
  };

  async joinSession(id: string, key: string) {
    this.handlers.onStartSession({
      type: "startSession",
      id,
      key,
    });

    for (let i = 0; i < 10; i++) {
      if (this.session?.isConnected) {
        return;
      }
      await delay(200);
    }
  }

  attachDescription = async ({
    cardId,
    description,
  }: {
    cardId: string;
    description: string;
  }) => {
    log("attachDescription", cardId);
    const card = await this.miroAdapter.getBoardItemById(cardId);
    invariant(isAppCard(card), "Invalid ID " + cardId);

    const labelId = await this.textLinks?.get<string>(card.id);

    let shape;
    if (labelId) {
      shape = (await this.miroAdapter
        .getBoardItemById(labelId)
        .catch(() => null)) as Text;
    }
    log({ shape });

    const content = removeMarkdown(description);

    if (!shape) {
      shape = await this.miroAdapter.createText({
        content: content,
        width: card.width,
        x: card.x,
        y: card.y + card.height,
      });
      await this.textLinks?.set(card.id, shape.id);
    } else {
      shape.content = content;
      await shape.sync();
    }

    shape.x = card.x - card.width / 2 + shape.width / 2;
    shape.y = card.y + card.height / 2 + shape.height / 2;
    await shape.sync();
  };
}
