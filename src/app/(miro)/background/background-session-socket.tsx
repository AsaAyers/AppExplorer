"use client";

import { Text } from "@mirohq/websdk-types";
import removeMarkdown from "remove-markdown";
import socketIO, {
  Socket,
  type ManagerOptions,
  type SocketOptions,
} from "socket.io-client";
import invariant from "tiny-invariant";

import { AppEventHandler, NamedSocket } from "@/extension/app-event-handler";
import { AppEventDestinations, HandlersFor } from "@/extension/app-events";
import { EventsTo, CardData } from "@/extension/types";
import { hexToKey } from "@/extension/utils/hex-to-key";
import { AppExplorerChannel } from "@/utils/broadcast-channel";
import { debugLog } from "@/utils/debug-log";
import { isAppCard } from "@/utils/is-app-card";
import {
  getMiroAdapter,
  MiroAdapter,
  MiroCollection,
} from "@/utils/miro/adapter";
import { updateCard } from "@/utils/update-card";
import { zoomIntoCards } from "@/utils/zoom-into-cards";

const log = debugLog("app-explorer:miro:background:session");

export type TextLinkCollection = MiroCollection;

export type BrowserSocketFactory = (
  sessionId: string,
  options: Partial<ManagerOptions & SocketOptions>,
) => NamedSocket<"miroBackground">;

export type BrowserSessionSocketOptions = {
  socketFactory?: BrowserSocketFactory;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
  miroAdapter?: MiroAdapter;
};

export class BackgroundSessionSocket extends AppEventHandler<"miroBackground"> {
  SocketType = Socket<
    HandlersFor<"miroBackground">,
    EventsTo<Exclude<AppEventDestinations, "miroBackground">>
  >;

  static createSession(
    id: string,
    key: string,
    boardId: string,
    channel: AppExplorerChannel,
    options: BrowserSessionSocketOptions,
  ) {
    return new BackgroundSessionSocket(id, key, boardId, channel, options);
  }

  private textLinks: TextLinkCollection;
  private miroAdapter: MiroAdapter;
  onDisconnect(_callback: () => void) {}
  public readonly id: string;
  boardIdPromise: Promise<string>;

  #cardsAroundCursor: CardData[] | null = [];
  #cardsAroundCursorPath = "";
  private boardId: string;
  public readonly channel: AppExplorerChannel;
  constructor(
    id: string,
    hexKey: string,
    boardId: string,
    channel: AppExplorerChannel,
    options: BrowserSessionSocketOptions = {},
  ) {
    super("miroBackground", "socket");
    this.boardId = boardId;
    this.channel = channel;
    this.id = id;
    this.miroAdapter = options.miroAdapter ?? getMiroAdapter();
    this.textLinks = this.miroAdapter.getCollection("textLinks");
    this.boardIdPromise = this.miroAdapter.getBoardId();

    this.key = hexToKey(hexKey);
    const socketFactory =
      options.socketFactory ??
      ((sessionId, socketOptions) =>
        socketIO(`/session/${sessionId}`, socketOptions));
    const customSocketOptions = options.socketOptions ?? {};
    const auth = {
      role: "miro",
      ...(typeof customSocketOptions.auth === "object"
        ? customSocketOptions.auth
        : {}),
    };
    this.socket = this.attachSocket(
      socketFactory(id, {
        ...customSocketOptions,
        retries: 3,
        withCredentials: true,
        auth,
        timeout: 1000,
        ackTimeout: 5000,
        reconnectionAttempts: 5,
      }),
    );
    this.socket.connect();

    this.socket.on("disconnect", () => {
      log("socket disconnected");
      this.emitStatusOverChannel();
    });
    this.socket.on("connect", this.onConnect);
    this.socket.onAnyOutgoing((...args) => log("outgoing", ...args));
    this.socket.onAny((...args) => log("[Event]", args[0].type));
  }

  get isConnected() {
    return !!this.socket?.connected;
  }

  disconnect() {
    this.socket?.disconnect();
  }
  onConnect = async () => {
    log("socket connected");
    this.boardIdPromise = this.miroAdapter.getBoardId();

    this.emitStatusOverChannel();
  };

  emitStatusOverChannel = () => {
    this.channel!.postMessage({
      type: "socketStatus",

      sessionId: this.socket?.connected ? this.id : null,
    });
  };

  handlers = this.makeHandlers({
    onStartSession: async () => {},
    onEncryptedEvent: (e, done) =>
      this.handleEncryptedEvent(this.key!, e, done),
    onSelectCard: async (e, done) => {
      const cardUrl = e.miroLink;
      try {
        const url = new URL(cardUrl);
        const match = url.pathname.match(/\/board\/([\w]+)\/\?/);

        if (match?.[1] !== (await this.boardIdPromise)) {
          return;
        }

        const id = url.searchParams.get("moveToWidget")!;
        const card = await this.miroAdapter.getBoardItemById(id);
        if (isAppCard(card)) {
          const selection = await this.miroAdapter.getSelection();
          await this.miroAdapter.deselectByIds(selection.map((c) => c.id));
          await this.miroAdapter.selectByIds([card.id]);
          await zoomIntoCards([card]);
          this.miroAdapter.showInfo(`Selected card: ${card.title}`);
        } else {
          throw new Error(`Card not found ${cardUrl}`);
        }
        done({ success: true });
      } catch {
        this.miroAdapter.showError(
          `AppExplorer: Unable to select card ${cardUrl}`,
        );
        done({ success: false });
      }
    },
    // getBoardInfo: async ({ boardId }, done) => {
    //   // The boardID might not be known by the client yet, so an empty string is passed as a placeholder.
    //   invariant(
    //     boardId === "" || (await this.boardIdPromise) === boardId,
    //     "Board ID mismatch",
    //   );
    //   const name = (await miro.board.getAppData("name")) as string;

    //   const appCards = (
    //     await miro.board.get({
    //       type: ["app_card"],
    //     })
    //   ).filter(isAppCard);

    //   const cards = (await Promise.all(appCards.map(extractCardData))).filter(
    //     notEmpty,
    //   );
    //   log("getBoardInfo", name, { appCards, cards });

    //   done({
    //     boardId: await this.boardIdPromise,
    //     name,
    //     cards: cards.reduce(
    //       (acc: Record<string, CardData>, c: CardData) => {
    //         acc[c.id] = c;
    //         return acc;
    //       },
    //       {} as Record<string, CardData>,
    //     ),
    //   });
    // },
    onCardsAroundCursor: ({ cards, path }): void => {
      log("cardsAroundCursor", cards, path);
      this.#cardsAroundCursor = cards;
      this.#cardsAroundCursorPath = path;
      this.channel.postMessage({
        type: "cardsAroundCursor",

        source: "background",
        cards,
        path,
      });
    },

    onAttachDescription: async ({ cardId, description }) => {
      log("attachDescription", cardId);
      const card = await this.miroAdapter.getBoardItemById(cardId);
      invariant(isAppCard(card), "Invalid ID " + cardId);

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
    onRequestSocketStatus: this.emitStatusOverChannel,
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
        if (isAppCard(card)) {
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

    /**
     * This is used by useCardsAroundCursor so that modals or sidebars get an
     * update event ASAP.
     */
    onRequestCardsAroundCursor: (_data) => {
      this.channel.postMessage({
        type: "cardsAroundCursor",
        source: "background",
        cards: this.#cardsAroundCursor,
        path: this.#cardsAroundCursorPath,
      });
    },

    /**
     * The panel or modal has stored its data in localStorage. This needs to close
     * whatever is open and trigger the modal for authentication with Miro.
     */
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
      log({ result });

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

    onZoomIntoCards: async ({ cards }) => {
      const zoomItems = (
        await Promise.all(
          cards.map(async (cardData) => {
            const card = await this.miroAdapter.getBoardItemById(cardData.id);
            if (!card) {
              return null;
            }
            if (
              card.type === "app_card" &&
              "parentId" in card &&
              card.parentId
            ) {
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
          type: "attachDescription",
          source: "foreground",
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
  });
}
