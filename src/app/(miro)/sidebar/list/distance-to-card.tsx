"use client";
import classNames from "classnames";
import React from "react";

import { CardData } from "@/extension/types";
import { distance } from "@/utils/distance";

export function DistanceToCard({
  className,
  center,
  cardData,
  action,
}: {
  className?: string;
  center: { x: number; y: number };
  cardData: CardData;
  action?: () => void;
}) {
  const d = Math.round(distance(center, cardData) / 120);
  const rotate = React.useMemo(() => {
    const n = Math.atan2(cardData.y - center.y, cardData.x - center.x);
    return `${n}rad`;
  }, [cardData.x, cardData.y, center.x, center.y]);

  return (
    <button
      type="button"
      className={classNames(
        "bg-sun hover:bg-sun-hover white rounded-xl p-0.5",
        className,
      )}
      onClick={action}
    >
      <span
        className="inline-block align-bottom "
        style={{
          rotate,
        }}
      >
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
            d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </span>
      {d}
    </button>
  );
}
