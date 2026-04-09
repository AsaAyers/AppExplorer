"use client";

import classNames from "classnames";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import React from "react";

import { DistanceToCard } from "@/app/(miro)/sidebar/list/distance-to-card";
import { AppExplorerCard } from "@/components/app-explorer-card";
import { CardData } from "@/extension/types";
import { debugLog } from "@/utils/debug-log";
import { useForegroundMiro } from "@/utils/foreground-miro-handler";
import { getMiroAdapter } from "@/utils/miro/adapter";

const log = debugLog("app-explorer:list");

export default React.memo(function SidebarList({
  searchParams,
}: PageProps<"/sidebar/list">) {
  const after = parseInt(
    (React.use(searchParams)["after"] as string) ?? "0",
    10,
  );

  const miroAdapter = React.useMemo(() => getMiroAdapter(), []);

  const [center, setCenter] = React.useState({ x: 0, y: 0 });
  const [viewportTrigger, updateViewport] = React.useReducer((n) => {
    return n + 1;
  }, 1);
  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      await miroAdapter.onSelectionUpdate(updateViewport);
      if (cancelled) cleanup();
    }
    function cleanup() {
      cancelled = true;
      miroAdapter.offSelectionUpdate(updateViewport);
    }
    run();
    return cleanup;
  }, [miroAdapter]);
  React.useEffect(() => {
    async function findCenter() {
      log("findCenter");
      setCenter(await miroAdapter.getViewportCenter());
    }
    // This is always true, its only here to trigger the effect.
    if (viewportTrigger > 1) {
      findCenter();
    }
  }, [miroAdapter, viewportTrigger]);

  const foreground = useForegroundMiro();

  const [cards, setCards] = React.useState<CardData[]>([]);

  React.useEffect(() => {
    miroAdapter.getCards(after, center).then(setCards);
  }, [after, center, miroAdapter]);

  const [toCard, setToCard] = React.useState<null | string>(null);

  return (
    <>
      <div className="p-2 cs1 ce12" onClick={updateViewport}>
        Cards are sorted by distance from the center of the viewport
      </div>

      <motion.div className="cs1 ce12">
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {cards.map((cardData) => (
              <motion.div
                layout
                exit={{ opacity: 0 }}
                key={cardData.id}
                className={classNames("relative", {})}
              >
                <AppExplorerCard key={cardData.id} cardData={cardData} />
                <div
                  className={classNames("absolute left-0 top-0 rounded-xl ", {
                    "ring-4 ring-secondary": cardData.id === toCard,
                  })}
                >
                  <DistanceToCard
                    center={center}
                    cardData={cardData}
                    action={() => {
                      setToCard(cardData.id);
                      foreground.zoomIntoCards([cardData]);
                      setTimeout(() => {
                        updateViewport();
                        setToCard(null);
                      }, 500);
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>
    </>
  );
});
