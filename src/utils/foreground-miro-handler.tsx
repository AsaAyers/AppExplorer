"use client";

import React from "react";
import invariant from "tiny-invariant";
import z from "zod";

import { getRedirectUrl } from "@/app/(miro)/auth/getRedirectUrl";
import { AppEventHandler } from "@/extension/app-event-handler";
import { EventCardsAroundCursor, zNewCard } from "@/extension/app-events";
import { CardData } from "@/extension/types";
import { delay } from "@/extension/utils/delay";
import { AppExplorerChannel, useBoardId } from "@/utils/broadcast-channel";
import { debugLog } from "@/utils/debug-log";
import { CreateConnectorInput, getMiroAdapter } from "@/utils/miro/adapter";

const log = debugLog("handler:foreground");

export class ForegroundMiroHandler extends AppEventHandler<"miro", "channel"> {
  openUpgradeModal() {
    return this.miroAdapter.openModal({
      url: "/upgrade",
      fullscreen: true,
    });
  }
  useDemoState(): { selected?: CreateConnectorInput & { id: string } } {
    return {};
  }
  miroAdapter = getMiroAdapter();
  setConnectSelectedCards(value: boolean) {
    this.snapshot.connectSelectedCards = value;
    this.notify();
  }

  useChannelData() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return React.useSyncExternalStore(
      this.subscribe,
      this.getSnapshot,
      this.getSnapshot,
    );
  }

  openAuthModal = async () => {
    const [modalData, panelData, { authUrl, path }] = await Promise.all([
      this.miroAdapter.getModalData().catch(() => null),
      this.miroAdapter.getPanelData().catch(() => null),
      getRedirectUrl(),
    ]);

    invariant(this.channel, "Missing channel");
    this.channel.postMessage({
      type: "openAuthModal",
      source: "foreground",
      redirectUrl: authUrl,
      returnPath: path,
      modalData,
      panelData,
    });
  };
  newCard(data: Omit<z.infer<typeof zNewCard>, "type">) {
    this.channel?.postMessage({
      type: "newCard",
      ...data,
    });
  }
  snapshot: {
    cardsAroundCursor: CardData[] | null;
    path: string;
    sessionId: string | null;
    selected: CardData[];
    connectSelectedCards: boolean;
  } = {
    cardsAroundCursor: [],
    path: "",
    sessionId: null,
    selected: [],
    connectSelectedCards: false,
  };

  constructor(boardId: string) {
    super("miro", "channel");
    this.channel = new AppExplorerChannel(boardId);

    this.attachChannel(this.channel);
  }
  subscribers = [] as (() => void)[];
  subscribe = (l: () => void) => {
    this.subscribers = [...this.subscribers, l];
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== l);
    };
  };
  notify() {
    this.snapshot = {
      ...this.snapshot,
      cardsAroundCursor: this.cardsAroundCusor.cards,
      path: this.cardsAroundCusor.path,
      sessionId: this.sessionId,
      connectSelectedCards: this.snapshot.connectSelectedCards,
    };
    log("notify", this.snapshot.sessionId);
    for (const listener of this.subscribers) {
      listener();
    }
  }

  async startSession(id: string, key: string) {
    invariant(this.channel, "Missing channel");
    this.channel.postMessage({
      type: "startSession",
      id,
      key,
    });
    let tries = 1;
    while (this.snapshot.sessionId !== id && tries++ < 100) {
      await delay(100);
    }

    if (this.snapshot.sessionId !== id) {
      throw new Error("Timeout starting session");
    }
  }

  getSnapshot = () => this.snapshot;

  handlers = this.makeHandlers({
    onCardsAroundCursor: (e) => {
      this.cardsAroundCusor = e;
      this.notify();
    },
    onSocketStatus: (e) => {
      this.sessionId = e.sessionId;
      log("onSocketStatus", this.sessionId);
      this.notify();
    },
    onNavigateToCode: (_e) => {
      //
    },
  });
  sessionId: string | null = null;

  cardsAroundCusor: EventCardsAroundCursor = {
    cards: [],
    path: "",
    source: "background",
    type: "cardsAroundCursor",
  };

  zoomIntoCards(cards: CardData[]) {
    this.channel?.postMessage({
      type: "zoomIntoCards",
      cards,
    });
  }
}

let singleton: ForegroundMiroHandler;
export function useForegroundMiro() {
  const boardId = useBoardId();
  singleton ??= new ForegroundMiroHandler(boardId);
  return singleton;
}
