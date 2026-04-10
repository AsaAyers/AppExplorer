"use client";
import type { Item } from "@mirohq/websdk-types";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Image from "next/image";
import React from "react";

import appExplorerLogo from "@/assets/app-explorer.svg";
import { AppExplorerCard } from "@/components/app-explorer-card";
import { CardData } from "@/EventTypes";
import { notEmpty } from "@/extension/utils/not-empty";
import { debugLog } from "@/utils/debug-log";
import { extractCardData } from "@/utils/extract-card-data";
import { useForegroundMiro } from "@/utils/foreground-miro-handler";

const log = debugLog("app-explorer:cards-around-cursor");

export function CardsAroundCursor({
  draggable = false,
}: {
  draggable?: boolean;
}) {
  const foreground = useForegroundMiro();
  const channelData = foreground.useChannelData();

  const [selectedCards, setSelectedCards] = React.useState([] as CardData[]);
  const [connectSelectedCards, setConnectCards] = React.useState(true);

  React.useEffect(() => {
    async function selectionUpdate(event: { items: Item[] }) {
      try {
        const selectedItems = event.items;
        const data = (
          await Promise.all(selectedItems.map((item) => extractCardData(item)))
        ).filter(notEmpty);

        setSelectedCards(data);
      } catch (error) {
        log("AppExplorer: Notifying VSCode of updated selection", error);
      }
    }

    const onDrop = async ({
      x,
      y,
      target,
    }: {
      x: number;
      y: number;
      target: HTMLElement;
    }) => {
      const cardData = JSON.parse(target.dataset.card!) as CardData;
      cardData.boardId = (await miro.board.getInfo()).id;
      const attachSelected = target.dataset.attachSelected === "true";
      foreground.newCard({
        x,
        y,
        attachSelected,
        cardData,
      });
    };

    let cancelled = false;
    async function run() {
      await miro.board.ui.on("selection:update", selectionUpdate);
      if (cancelled) {
        await miro.board.ui.off("selection:update", selectionUpdate);
        return;
      }

      await miro.board.ui.on("drop", onDrop);
      if (cancelled) {
        await miro.board.ui.off("drop", onDrop);
      }
    }
    run();
    return () => {
      cancelled = true;
      miro.board.ui.off("selection:update", selectionUpdate);
      miro.board.ui.off("drop", onDrop);
    };
  }, [foreground]);

  const hasCards = (channelData.cardsAroundCursor?.length ?? 0) > 0;

  return (
    <>
      <div className="m-2">
        <label className="p-2">
          <input
            type="checkbox"
            className="mr-1"
            checked={connectSelectedCards}
            onChange={(e) => setConnectCards(e.target.checked)}
          />
          Add connecting lines from selected cards to new cards (
          {selectedCards.length} cards)
        </label>
        {hasCards ? (
          <>
            <h2>Code Symbols</h2>
            <div className="m2">{channelData.path}</div>
          </>
        ) : null}
      </div>
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {hasCards ? (
            channelData.cardsAroundCursor?.map((card) => (
              <motion.div
                layout
                exit={{ opacity: 0 }}
                key={card.miroLink || card.title}
              >
                <AppExplorerCard
                  connectSelectedCards={connectSelectedCards}
                  cardData={card}
                  miroDraggable={draggable}
                />
              </motion.div>
            ))
          ) : (
            <motion.div
              layout
              exit={{ opacity: 0 }}
              className="p-2 flex flex-col items-center gap-4"
            >
              <Image
                width="48"
                height="48"
                className="animate-pulse"
                src={appExplorerLogo}
                alt="AppExplorer Logo"
              />
              {channelData.path && channelData.cardsAroundCursor === null ? (
                <p>No symbols found in {channelData.path}</p>
              ) : (
                <>
                  <p>
                    Waiting for code symbols. Open a file in VSCode to populate
                    this panel.
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </>
  );
}
