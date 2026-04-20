"use client";

import React from "react";

import {
  AppExplorerSession,
  makeSessionUrl,
  parseSessionUri,
  zAppExplorerSession,
} from "@/app-explorer-session";
import type { CardData } from "@/card-data";
import { AppExplorerCard } from "@/components/app-explorer-card";
import { AppExplorerOnboarding } from "@/components/app-explorer-onboarding";
import { SidebarClientEventHandler } from "@/event-handlers/sidebar-client-event-handler";
import { getIndexFromOrigin } from "@/host-config";
import { isAppCard } from "@/miro/is-app-card";
import { updateCard } from "@/miro/update-card";
import { connectSidebarHandler } from "@/sidebar/connect-sidebar-socket";
import { randomHex } from "@/utils/to-hex";

function getCaptureSessionLink() {
  return (
    globalThis as typeof globalThis & {
      captureSessionLink?: (url: string) => void;
    }
  ).captureSessionLink;
}

function makeFreshSession(
  base: null | Partial<AppExplorerSession> = null,
): AppExplorerSession {
  return zAppExplorerSession.parse({
    sessionId: base?.sessionId ?? crypto.randomUUID(),
    key: base?.key ?? randomHex(512),
    insiders: base?.insiders ?? false,
    hostIndex: base?.hostIndex ?? getIndexFromOrigin(location.origin),
  });
}

export function AppExplorerSidebar() {
  const [session, setSession] = React.useState<null | AppExplorerSession>(null);
  React.useEffect(() => {
    setSession(makeFreshSession());
  }, []);
  const [activeSession, setActiveSession] = React.useState<
    AppExplorerSession | undefined
  >();
  const [sidebarHandler, setSidebarHandler] = React.useState<
    SidebarClientEventHandler | undefined
  >();
  const [cardsAroundCursor, setCardsAroundCursor] = React.useState<CardData[]>(
    [],
  );
  const [attachSelected, setAttachSelected] = React.useState(true);
  const [selectedCardCount, setSelectedCardCount] = React.useState(0);

  React.useEffect(() => {
    if (!activeSession) {
      return;
    }

    const abortController = new AbortController();
    let connectedHandler: SidebarClientEventHandler | undefined;

    void connectSidebarHandler(activeSession).then((nextHandler) => {
      if (abortController.signal.aborted) {
        nextHandler.dispose();
        nextHandler.socketClient.disconnect();
        return;
      }
      connectedHandler = nextHandler;
      setSidebarHandler((previous) => {
        previous?.dispose();
        previous?.socketClient.disconnect();
        return nextHandler;
      });
    });

    return () => {
      abortController.abort();
      connectedHandler?.dispose();
      connectedHandler?.socketClient.disconnect();
      setSidebarHandler((previous) =>
        previous === connectedHandler ? undefined : previous,
      );
    };
  }, [activeSession]);

  React.useEffect(() => {
    if (!sidebarHandler) {
      return;
    }

    setCardsAroundCursor(sidebarHandler.latestCardsAroundCursor ?? []);

    const handleCardsAroundCursor = (cards: CardData[]) => {
      setCardsAroundCursor(cards);
    };
    const handleSessionShutdown = () => {
      setCardsAroundCursor([]);
      setSidebarHandler(undefined);
      setActiveSession(undefined);
      setSession((previous) => makeFreshSession(previous));
      sidebarHandler.dispose();
      sidebarHandler.socketClient.disconnect();
    };

    const cardsSubscription = sidebarHandler.cardsAroundCursorEvent(
      handleCardsAroundCursor,
    );
    const shutdownSubscription = sidebarHandler.sessionShutdownEvent(
      handleSessionShutdown,
    );

    return () => {
      cardsSubscription.dispose();
      shutdownSubscription.dispose();
    };
  }, [sidebarHandler]);

  React.useEffect(() => {
    const handleSelectionUpdate = async () => {
      const count = (await miro.board.getSelection()).filter(isAppCard).length;
      setSelectedCardCount(count);
    };
    const handleDrop = async ({
      x,
      y,
      target,
    }: {
      x: number;
      y: number;
      target: HTMLElement;
    }) => {
      const source = target.closest<HTMLElement>("[data-card]");
      const serializedCard = source?.dataset.card;
      if (!serializedCard) {
        return;
      }

      const cardData = JSON.parse(serializedCard) as CardData;
      cardData.boardId = (await miro.board.getInfo()).id;

      const card = await updateCard(
        await miro.board.createAppCard({
          x,
          y,
          title: cardData.title,
          status: "connected",
        }),
        cardData,
      );

      if (source.dataset.attachSelected === "true") {
        const selection = (await miro.board.getSelection()).filter(isAppCard);
        await selection.reduce(async (promise, item) => {
          await promise;
          await miro.board.createConnector({
            start: { item: item.id },
            end: { item: card.id },
            shape: "curved",
            style: {
              startStrokeCap: "none",
              endStrokeCap: "arrow",
            },
          });
        }, Promise.resolve());
      }
    };

    void handleSelectionUpdate();
    miro.board.ui.on("drop", handleDrop);
    miro.board.ui.on("selection:update", handleSelectionUpdate);

    return () => {
      miro.board.ui.off("drop", handleDrop);
      miro.board.ui.off("selection:update", handleSelectionUpdate);
    };
  }, []);

  const startSession = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const nextSession = parseSessionUri(event.currentTarget.href);
      setSession(nextSession);
      setActiveSession(nextSession);

      for (let i = 0; i < (window.top?.length ?? 0); i++) {
        window.top?.[i].postMessage(
          {
            type: "attachSession",
            session: nextSession,
          },
          window.origin,
        );
      }

      const captureSessionLink = getCaptureSessionLink();
      if (captureSessionLink) {
        captureSessionLink(event.currentTarget.href);
        event.preventDefault();
      }
    },
    [],
  );

  const hasConnectedSession = sidebarHandler !== undefined;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 p-4">
        {!hasConnectedSession && session ? (
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <a
              className="text-blue-600 underline"
              href={makeSessionUrl(session)}
              onClick={startSession}
            >
              Start VSCode session
            </a>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                checked={session.insiders}
                onChange={(event) => {
                  const insiders = event.target.checked;
                  setSession((previous) => ({
                    ...makeFreshSession(previous),
                    ...previous,
                    insiders,
                  }));
                }}
                type="checkbox"
              />
              <span>Use VSCode Insiders</span>
            </label>
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-sm text-slate-700">
          <input
            checked={attachSelected}
            id="attach-selected"
            onChange={(event) => {
              setAttachSelected(event.target.checked);
            }}
            type="checkbox"
          />
          <label htmlFor="attach-selected">
            Add connecting lines from selected cards to new cards (
            {selectedCardCount} cards)
          </label>
        </div>

        {cardsAroundCursor.length === 0 ? (
          <AppExplorerOnboarding />
        ) : (
          <div className="flex flex-col gap-3">
            {cardsAroundCursor.map((card) => (
              <AppExplorerCard
                key={card.id}
                cardData={card}
                connectSelectedCards={attachSelected}
                hideTags
                miroDraggable
                showStatusButton={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
