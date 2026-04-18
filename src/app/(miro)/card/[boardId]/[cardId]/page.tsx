"use client";

import React from "react";
import invariant from "tiny-invariant";

import type { CardData } from "@/card-data";
import { AppExplorerEditCard } from "@/components/app-explorer-edit-card";

export default function CardPage() {
  const [cardData, setCardData] = React.useState<CardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const abortController = new AbortController();

    void miro.board.ui
      .getModalData<CardData>()
      .then((data) => {
        invariant(data, "Missing modal data");
        if (!abortController.signal.aborted) {
          setCardData(data);
        }
      })
      .catch((reason: unknown) => {
        if (!abortController.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      abortController.abort();
    };
  }, []);

  if (error) {
    return <p>Error loading card data {error}</p>;
  }

  if (!cardData) {
    return <p>Loading...</p>;
  }

  return <AppExplorerEditCard cardData={cardData} />;
}
