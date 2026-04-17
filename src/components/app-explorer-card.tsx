"use client";
import classNames from "classnames";
import Image from "next/image";
import React from "react";

import appExplorerLogo from "@/assets/app-explorer.svg";
import appcardStatusDisabled from "@/assets/appcard-status-disabled.svg";
import appcardStatusDisconnected from "@/assets/appcard-status-disconnected.svg";
import expandIcon from "@/assets/expand-icon.svg";
import { CardData } from "@/card-data";
import { createDebug } from "@/utils/create-debug";
import { useIsInMiroIframe } from "@/utils/use-is-in-miro-frame";

const log = createDebug("app-explorer:app-card");
export const iconMap = {
  connected: expandIcon,
  disconnected: appcardStatusDisconnected,
  disabled: appcardStatusDisabled,
} as const;

export function AppExplorerCard({
  className,
  cardData,
  hideTags = false,
  miroDraggable = false,
  connectSelectedCards = false,
}: {
  className?: string;
  cardData: CardData;
  hideTags?: boolean;
  miroDraggable?: boolean;
  connectSelectedCards?: boolean;
}) {
  const codeLogo = React.useMemo(() => {
    if (cardData.codeLink) {
      const url = new URL(cardData.codeLink, "https://localhost");
      return new URL(`/favicon/${url.host}`, "https://localhost").pathname;
    }
    return null;
  }, [cardData.codeLink]);
  const inFrame = useIsInMiroIframe();

  const [dragging, setDragging] = React.useState(false);
  const dragImageRef = React.useRef<HTMLElement | null>(null);
  const onDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
    if (inFrame) {
      return;
    }
    setDragging(true);
    // Attach cardData to the drag event
    try {
      log("dragStart");
      const rect = event.currentTarget.getBoundingClientRect();
      event.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          cardData,
          connectSelectedCards,
          width: event.clientX - rect.x,
          height: event.clientY - rect.y,
        }),
      );
    } catch (error) {
      console.error("Failed to set drag data:", error);
    }
  };
  const onDragEnd = (event: React.DragEvent<HTMLDivElement>): void => {
    setDragging(false);
    try {
      const el = event.currentTarget as HTMLElement;
      el.style.visibility = "";
    } catch {
      /* ignore */
    }
    if (dragImageRef.current) {
      try {
        document.body.removeChild(dragImageRef.current);
      } catch {
        /* ignore */
      }
      dragImageRef.current = null;
    }
  };
  return (
    <div
      id={`card-${cardData.id}`}
      draggable={miroDraggable}
      className={classNames("relative app-card m-2", className, {
        hideTags: hideTags,
        "miro-draggable": miroDraggable,
        "cursor-grab": miroDraggable,
        "opacity-60": dragging,
      })}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      data-attach-selected={connectSelectedCards}
      data-card={JSON.stringify(cardData)}
    >
      <div className="absolute app-card-arrow">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18"
          />
        </svg>
      </div>

      <h1 className="app-card--title">
        <span>{cardData.title}</span>
      </h1>
      <h1 className="app-card--description p-medium"></h1>
      <div className="app-card--body">
        <div className="app-card--tags flex flex-row gap-1">
          <span className="tag">{cardData.path}</span>
          <span className="tag symbol-tag">{cardData.symbol}</span>
        </div>

        <div className="absolute right-0 top-0">
          <button
            disabled={!cardData.miroLink}
            onClick={async () => {
              await miro.board.ui.openModal({
                url: "/edit-card",
                data: cardData,
                width: 400,
              });
            }}
            className="text-white bg-gray-500 hover:bg-black rounded-xl p-1 m-1"
          >
            <Image
              className="invert"
              src={iconMap[cardData.status]}
              alt=""
              width="16"
              height="16"
            />
          </button>

          {cardData.codeLink && codeLogo ? (
            <a
              href={cardData.codeLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element*/}
              <img src={codeLogo} alt="" width="20" height="20" />
              <span className="sr-only"> Open code </span>
            </a>
          ) : null}
        </div>

        <Image
          alt="AppExplorer logo"
          className="app-card--app-logo"
          width="16"
          height="16"
          src={appExplorerLogo}
        />
      </div>
    </div>
  );
}
