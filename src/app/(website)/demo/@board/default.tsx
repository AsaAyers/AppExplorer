"use client";
import classNames from "classnames";
import React, { DragEventHandler } from "react";

import { useDemoSessionTransport } from "@/app/(website)/demo/demo-session";
import { useDemoBoardStorage } from "@/app/(website)/demo/demo-storage";
import { TaskList, useTasks } from "@/app/(website)/demo/tasks";
import { type CardData } from "@/card-data";
import { AppExplorerCard } from "@/components/app-explorer-card";
import { createDebug } from "@/utils/create-debug";

const log = createDebug("app-explorer:demo:board");
export default function DemoBoard() {
  const [{ connectSelectedCards, cards, selected }, dispatch] =
    useDemoBoardStorage();
  const { navigateTo } = useDemoSessionTransport();
  const [events, markEvent] = useTasks();

  const [connections, setConnections] = React.useState<
    Array<{
      from: string;
      to: string;
      type?: "ghost";
    }>
  >([]);

  React.useEffect(() => {
    if (selected) {
      markEvent("clicked");
    }
  }, [markEvent, selected]);

  const connectionLines: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }> = React.useMemo(() => {
    return connections.flatMap(({ from, to }) => {
      const fromCard = cards.find((c) => c.id === from);
      const toCard = cards.find((c) => c.id === to);
      log({ fromCard, toCard });
      if (toCard && fromCard) {
        const offsetX = 150;
        const offsetY = 70;
        return [
          {
            fromX: fromCard.x + offsetX,
            fromY: fromCard.y + offsetY,
            toX: toCard.x + offsetX,
            toY: toCard.y + offsetY,
          },
        ];
      }
      return [];
    });
  }, [cards, connections]);

  const handleDrop: DragEventHandler<HTMLDivElement> = (e) => {
    const { cardData, width, height, connectSelectedCards } = JSON.parse(
      e.dataTransfer.getData("application/json"),
    ) as {
      cardData: CardData;
      connectSelectedCards: boolean;
      width: number;
      height: number;
    };

    if (cardData.title) {
      const rect = e.currentTarget.getBoundingClientRect();

      let id = cardData.id;
      if (id.startsWith("ex")) {
        id = Math.random().toString(16).substring(2);
      }

      dispatch({
        type: "cardDrop",
        cardData: {
          ...cardData,
          id,
          x: e.clientX - rect.left - width,
          y: e.clientY - rect.top - height,
          status: "connected",
        },
      });
      // record that a card was added
      if (selected?.id === cardData.id) {
        markEvent("moved");
      } else {
        if (cardData.title === "saveDoc") {
          markEvent("saveDoc");
        }
        markEvent("added");

        log({ connectSelectedCards, selected });
        // If enabled and a card is currently selected, connect selected -> new
        if (connectSelectedCards && selected) {
          setConnections((prev) => prev.concat({ from: selected.id, to: id }));
          markEvent("connected");
        }
      }
    }
  };

  const handleDragOver: DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onBoardClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.target === e.currentTarget) {
      dispatch({ type: "selectCard", card: undefined });
    }
  };

  return (
    <div
      id="MockBoard"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={onBoardClick}
      className={classNames(
        "hidden lg:grid lg:col-span-4 xl:col-span-6 h-full bg-gray-100 relative",
        // "hidden xl:visible",
      )}
      style={{
        backgroundImage: `
            linear-gradient(0deg, transparent 24%, rgba(128, 128, 128, 0.1) 25%, rgba(128, 128, 128, 0.1) 26%, transparent 27%, transparent 74%, rgba(128, 128, 128, 0.1) 75%, rgba(128, 128, 128, 0.1) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(128, 128, 128, 0.1) 25%, rgba(128, 128, 128, 0.1) 26%, transparent 27%, transparent 74%, rgba(128, 128, 128, 0.1) 75%, rgba(128, 128, 128, 0.1) 76%, transparent 77%, transparent)
          `,
        backgroundSize: "50px 50px",
      }}
    >
      <div className="pointer-events-none absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-xs">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Tutorial</h3>
        <TaskList events={events} />
      </div>
      {/* SVG overlay for connection lines */}
      <svg className="absolute w-full h-full pointer-events-none">
        {connectionLines.map((l, i) => (
          <line
            key={i}
            x1={l.fromX}
            y1={l.fromY}
            x2={l.toX}
            y2={l.toY}
            strokeWidth={2}
            stroke="#4F46E5"
            strokeLinecap="round"
          />
        ))}
      </svg>
      {cards.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-5xl mt-32">📍</div>
            <h2 className="text-2xl font-bold text-gray-700">
              Drop cards here
            </h2>
            <p className="text-gray-600 max-w-sm">
              Drag code symbol cards from the sidebar on the left onto this
              board to visualize your architecture.
            </p>
          </div>
        </div>
      ) : null}
      {cards.map((cardData) => (
        <div
          key={cardData.id}
          className={classNames("absolute rounded-2xl w-min")}
          tabIndex={0}
          onFocus={() => {
            navigateTo(cardData);
          }}
          onKeyDown={(e) => {
            if (e.key === "Delete") {
              dispatch({
                type: "removeCard",
                cardId: cardData.id,
              });
            }
          }}
          style={{
            left: cardData.x,
            top: cardData.y,
          }}
        >
          <AppExplorerCard
            connectSelectedCards={connectSelectedCards}
            className={classNames({
              "ring-4 ring-blue-600 ring-offset-2 is-selected":
                selected?.id === cardData.id,
            })}
            cardData={cardData}
            miroDraggable
          />
          {cardData.description ? <div>{cardData.description}</div> : null}
        </div>
      ))}
    </div>
  );
}
