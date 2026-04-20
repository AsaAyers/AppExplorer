"use client";

import React from "react";
import invariant from "tiny-invariant";

import { type CardData } from "@/card-data";

type DemoState = [
  {
    cards: CardData[];
    connectSelectedCards: boolean;
    selectionStart: number;
    selected?: CardData;
  },
  React.ActionDispatch<[Action]>,
];
export type Action =
  | {
      type: "selectionStart";
      value: number;
    }
  | { type: "selectCard"; card: CardData | undefined }
  | {
      type: "connectSelectedCards";
      value: boolean;
    }
  | {
      type: "cardDrop";
      cardData: CardData;
    }
  | {
      type: "removeCard";
      cardId: string;
    };

const context = React.createContext(null as null | DemoState);

export const DemoBoardStorageProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const contextValue = React.useReducer(
    (state, action: Action) => {
      switch (action.type) {
        case "selectCard": {
          return {
            ...state,
            selected: action.card,
          };
        }
        case "selectionStart": {
          return {
            ...state,
            selectionStart: action.value,
          };
        }
        case "cardDrop": {
          const cardData = { ...action.cardData };

          const idx = state.cards.findIndex((c) => c.id === cardData.id);
          if (idx >= 0) {
            const nextCards = state.cards.slice();
            nextCards[idx] = cardData;
            return { ...state, cards: nextCards };
          }

          if (cardData.id.length < 2) {
            cardData.id = Math.random().toString(16).substring(2);
          }

          return {
            ...state,
            cards: state.cards.concat(cardData),
          };
        }
        case "removeCard": {
          return {
            ...state,
            cards: state.cards.filter((c) => c.id !== action.cardId),
          };
        }
        case "connectSelectedCards": {
          return {
            ...state,
            connectSelectedCards: action.value,
          };
        }
      }
      throw new Error(
        `Unhandled demo storage action: ${JSON.stringify(action)}`,
      );
    },
    { cards: [] as CardData[], connectSelectedCards: false, selectionStart: 0 },
  );
  return <context.Provider value={contextValue}>{children}</context.Provider>;
};

export function useDemoBoardStorage() {
  const ctx = React.useContext(context);
  invariant(
    ctx,
    "useDemoBoardStorage must be used within a DemoBoardStorageProvider",
  );
  return ctx;
}
