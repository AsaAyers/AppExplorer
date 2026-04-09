"use client";
import React from "react";
import invariant from "tiny-invariant";

import { AppEventUnion, CardData } from "@/extension/types";
import { Disposable } from "@/extension/vscode-adapter/adapter";
import { debugLog } from "@/utils/debug-log";
import { useForegroundMiro } from "@/utils/foreground-miro-handler";
import { getMiroAdapter } from "@/utils/miro/adapter";

export const log = debugLog(`channel`);

/**
 * This connects all of the local iframes running in a browser. It cannot be
 * replaced with miro.board.events because that sends to all Miro users on the
 * board.
 */
export class AppExplorerChannel implements Disposable {
  private channel: BroadcastChannel;

  constructor(private boardId: string) {
    this.channel = new BroadcastChannel(boardId);
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "node";
    this.channel.addEventListener("message", (e) =>
      log(pathname, "[Event]", e.data.type),
    );
  }

  /**
   * This does NOT close the channel, because vitest runs both sides of the
   * chanel in the same JS engine. Closing it too early causes an error in the
   * tests because both instances of AppExplorerChannel are sharing the same
   * BroadcastChannel instance.
   */
  dispose() {}

  addEventListener(
    type: "message" | "messageerror",
    listener: (event: MessageEvent<AppEventUnion>) => void,
  ) {
    return this.channel.addEventListener(type, listener);
  }
  removeEventListener(
    type: "message" | "messageerror",
    listener: (event: MessageEvent<AppEventUnion>) => void,
  ) {
    return this.channel.removeEventListener(type, listener);
  }

  postMessage(message: AppEventUnion) {
    try {
      return this.channel.postMessage(message);
    } catch (e) {
      log("ERROR", this.boardId, e);
      throw e;
    }
  }
}

export const ChannelContext = React.createContext<AppExplorerChannel | null>(
  null,
);

export const ProvideChannelContext = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const boardId = useBoardId();
  const channel = React.useMemo(
    () => new AppExplorerChannel(boardId),
    [boardId],
  );

  return (
    <ChannelContext.Provider value={channel}>
      {children}
    </ChannelContext.Provider>
  );
};

export function useBroadcastChannel() {
  const channel = React.use(ChannelContext);
  invariant(
    channel != null,
    "useBroadcastChannel must be used inside a ChannelContext",
  );

  return channel;
}

export type ChannelData = {
  socketStatus: boolean;
  sessionId?: string;
  cardsAroundCursor: CardData[];
};

const serverSnapshot = {
  cardsAroundCursor: [],
  path: "",
  sessionId: null,
  connectSelectedCards: false,
  selected: [],
  connections: [],
  _testBoardItems: [],
};

// TODO: Remove this in favor of frontendHandler.useChannelData
export function useChannelData() {
  const miroChannelHandler = useForegroundMiro();
  const { cardsAroundCursor, path, sessionId } = React.useSyncExternalStore(
    miroChannelHandler.subscribe,
    miroChannelHandler.getSnapshot,
    () => serverSnapshot,
  );

  return { socketStatus: !!sessionId, cardsAroundCursor, sessionId, path };
}

const miro = getMiroAdapter();
const boardIdPromise = miro.getBoardId();
export function useBoardId() {
  return React.use(boardIdPromise);
}
