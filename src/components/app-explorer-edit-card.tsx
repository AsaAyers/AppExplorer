"use client";

import React from "react";

import type { CardData } from "@/card-data";

import { AppExplorerCard } from "./app-explorer-card";

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
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1rem",
      }}
    >
      <AppExplorerCard
        cardData={currentCardData}
        className="m-0"
        miroDraggable={false}
        showStatusButton={false}
      />

      <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span>Title</span>
        <input
          autoFocus
          onChange={(event) => {
            updateCardEdits({ title: event.target.value });
          }}
          type="text"
          value={currentCardData.title}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Description</span>
          <button
            onClick={() => {
              setExpandDescription((value) => !value);
            }}
            type="button"
          >
            {expandDescription ? "Collapse" : "Expand"}
          </button>
        </span>
        <textarea
          onChange={(event) => {
            updateCardEdits({ description: event.target.value });
          }}
          rows={expandDescription ? 12 : 3}
          value={currentCardData.description ?? ""}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span>Symbol Path</span>
        <select
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

      <div
        style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}
      >
        <button disabled={!currentCardData.codeLink} type="button" onClick={jumpToCode}>
          Jump to Code
        </button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
