"use client";
import type { Item } from "@mirohq/websdk-types/stable/api/client";

import { CardData } from "@/EventTypes";
import { decode } from "@/utils/decode";
import { isAppCard } from "@/utils/is-app-card";
import { getMiroAdapter, MiroAdapter } from "@/utils/miro/adapter";
import { MetaData } from "@/types";

export async function extractCardData(card: Item): Promise<CardData | null> {
  return extractCardDataWithAdapter(card, getMiroAdapter());
}

export async function extractCardDataWithAdapter(
  card: Item,
  miroAdapter: MiroAdapter,
): Promise<CardData | null> {
  if (!isAppCard(card)) {
    return null;
  }
  const metadata: MetaData = await card.getMetadata("app-explorer");
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const { codeLink, path, symbol } = metadata as Record<string, string>;

    const boardId = await miroAdapter.getBoardId();
    if (card.linkedTo !== codeLink && codeLink) {
      card.linkedTo = codeLink as string;
      await card.sync();
    }

    return {
      id: card.id,
      type: "symbol",
      boardId,
      title: decode(card.title),
      description: decode(card.description),
      miroLink: `https://miro.com/app/board/${boardId}/?moveToWidget=${card.id}`,
      path: path,
      symbol: symbol,
      codeLink: codeLink,
      status: isAppCard(card) ? card.status : "disconnected",
      x: card.x,
      y: card.y,
    };
  }
  return null;
}
