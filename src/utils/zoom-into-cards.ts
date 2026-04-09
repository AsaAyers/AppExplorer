"use client";
import { AppCard } from "@mirohq/websdk-types/stable/features/widgets/appCard";

import { getMiroAdapter } from "@/utils/miro/adapter";

export async function zoomIntoCards(cards: AppCard[]) {
  const miroAdapter = getMiroAdapter();
  await miroAdapter.zoomTo(
    await Promise.all(
      cards.map(async (card) => {
        if (card.parentId) {
          const frame = await miroAdapter.getBoardItemById(card.parentId);
          if (frame?.type === "frame") {
            return frame;
          }
        }
        return card;
      }),
    ),
  );
}
