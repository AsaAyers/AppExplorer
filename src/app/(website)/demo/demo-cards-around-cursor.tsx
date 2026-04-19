"use client";
import classNames from "classnames";
import { useSearchParams } from "next/navigation";
import React from "react";

import { useDemoBoardStorage } from "@/app/(website)/demo/demo-storage";
import { useDemoSessionTransport } from "@/app/(website)/demo/demo-session";
import { demoTextFiles } from "@/app/(website)/demo/demo-text-files";
import { useLastTaskHelper } from "@/app/(website)/demo/tasks";
import { AppExplorerCard } from "@/components/app-explorer-card";

export function DemoCardsAroundCursor({ className }: { className?: string }) {
  const lastTaskHelper = useLastTaskHelper();
  const [{ connectSelectedCards, selectionStart, selected }, dispatch] =
    useDemoBoardStorage();
  const { cardsAroundCursor } = useDemoSessionTransport();

  const topLevelSymbols = React.useMemo(() => {
    return (
      selectionStart <= 0 ||
      cardsAroundCursor.every((card) => !card.symbol.includes("/"))
    );
  }, [cardsAroundCursor, selectionStart]);
  return (
    <>
      <section className={classNames(className, "p-3 space-y-4")}>
        <label
          className={classNames(
            "p-2 flex items-center gap-2 bg-white rounded-sm",
            {
              "animate-pulse":
                lastTaskHelper === "connected" && !connectSelectedCards,
            },
          )}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={connectSelectedCards}
            onChange={(e) =>
              dispatch({
                type: "connectSelectedCards",
                value: e.target.checked,
              })
            }
          />
          <span className="text-xs">Attach new cards to selected card</span>
        </label>
        <div>
          <div
            id="demo-cards"
            className={classNames({
              "has-selection": selected,
            })}
          >
            {cardsAroundCursor.map((cardData) => (
              <AppExplorerCard
                key={cardData.id}
                cardData={cardData}
                connectSelectedCards={connectSelectedCards}
                miroDraggable
              />
            ))}
          </div>
          {topLevelSymbols ? (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-900">
                Showing the top-level symbol in this file. Click on code to see
                nested symbols.
              </p>
            </div>
          ) : null}
          <div id="after-cards"></div>
        </div>
      </section>
    </>
  );
}
export function useDemoFile() {
  const searchParams = useSearchParams();
  const searchPath = searchParams.get("path");
  const currentFile = React.useMemo(() => {
    return demoTextFiles.reduce((prev, next) => {
      if (next.path === searchPath) {
        return next;
      }

      return prev;
    });
  }, [searchPath]);
  return currentFile;
}
