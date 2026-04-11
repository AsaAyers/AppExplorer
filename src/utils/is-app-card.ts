import { AppCard, Item } from "@mirohq/websdk-types";

export const isAppCard = (item: Item | undefined): item is AppCard =>
  item?.type === "app_card" && (item as AppCard).owned;
