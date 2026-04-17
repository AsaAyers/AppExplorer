"use client";

import React from "react";

import { AppExplorerCard } from "./app-explorer-card";

import type { CardData } from "@/card-data";

type SymbolOption = Pick<CardData, "path" | "symbol">;

function getSymbolOptions(
  cardData: CardData,
  cardsAroundCursor: readonly CardData[],
): SymbolOption[] {
  const seen = new Set<string>();

  return [cardData, ...cardsAroundCursor].flatMap(({ path, symbol }) => {
    const key = `${path}\n${symbol}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ path, symbol }];
  });
}

export function AppExplorerEditCard({
  cardData,
  cardsAroundCursor = [],
}: {
  cardData: CardData;
  cardsAroundCursor?: readonly CardData[];
}) {
  const [cardEdits, setCardEdits] = React.useState<Partial<CardData>>({});
  const [expandDescription, setExpandDescription] = React.useState(false);

  const currentCardData = React.useMemo(
    () => ({ ...cardData, ...cardEdits }),
    [cardData, cardEdits],
  );
  const symbolOptions = React.useMemo(
    () => getSymbolOptions(cardData, cardsAroundCursor),
    [cardData, cardsAroundCursor],
  );

  const updateCardEdits = React.useCallback((update: Partial<CardData>) => {
    setCardEdits((previous) => ({ ...previous, ...update }));
  }, []);

  const jumpToCode = React.useCallback(() => {
    if (!currentCardData.codeLink) {
      return;
    }
    window.open(currentCardData.codeLink, "_blank", "noopener,noreferrer");
  }, [currentCardData.codeLink]);

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void miro.board.ui.closeModal(currentCardData);
    },
    [currentCardData],
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <AppExplorerCard
        cardData={currentCardData}
        className="m-0"
        miroDraggable={false}
        showStatusButton={false}
      />

      <label className="flex flex-col gap-2">
        <span>Title</span>
        <input
          autoFocus
          className="rounded border border-gray-300 px-3 py-2"
          onChange={(event) => {
            updateCardEdits({ title: event.target.value });
          }}
          type="text"
          value={currentCardData.title}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex items-center justify-between gap-4">
          <span>Description</span>
          <button
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            onClick={() => {
              setExpandDescription((value) => !value);
            }}
            type="button"
          >
            {expandDescription ? "Collapse" : "Expand"}
          </button>
        </span>
        <textarea
          className="rounded border border-gray-300 px-3 py-2"
          onChange={(event) => {
            updateCardEdits({ description: event.target.value });
          }}
          rows={expandDescription ? 12 : 3}
          value={currentCardData.description ?? ""}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span>Symbol Path</span>
        <select
          className="rounded border border-gray-300 px-3 py-2"
          onChange={(event) => {
            const [path, symbol] = event.target.value.split("\n");
            updateCardEdits({ path, symbol });
          }}
          value={`${currentCardData.path}\n${currentCardData.symbol}`}
        >
          {symbolOptions.map(({ path, symbol }) => (
            <option key={`${path}\n${symbol}`} value={`${path}\n${symbol}`}>
              {symbol}
            </option>
          ))}
        </select>
      </label>

      <div className="flex justify-between gap-4">
        <button
          className="rounded border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!currentCardData.codeLink}
          type="button"
          onClick={jumpToCode}
        >
          Jump to Code
        </button>
        <button
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
          type="submit"
        >
          Save
        </button>
      </div>
    </form>
  );
}
