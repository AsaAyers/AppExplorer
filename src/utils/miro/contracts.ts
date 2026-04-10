import type { Item } from "@mirohq/websdk-types";

import { zCardSelected } from "@/extension/app-events";
import type { CardData } from "@/EventTypes";
import { extractCardDataWithAdapter } from "@/utils/extract-card-data";
import type { MiroAdapter } from "@/utils/miro/adapter";

export async function mapSelectionToCardData(
  items: Item[],
  miroAdapter: MiroAdapter,
): Promise<CardData[]> {
  const result = await Promise.all(
    items.map((item) => extractCardDataWithAdapter(item, miroAdapter)),
  );
  return result.filter((card): card is CardData => card != null);
}

export function toCardSelectedSocketEvent(cardData: CardData) {
  return zCardSelected.parse({
    type: "cardSelected" as const,
    cardData,
  });
}
