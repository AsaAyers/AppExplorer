import { CardData } from "@/card-data";

export type CurrentBoardInfo = {
  boardId: string;
  name: string;
  cards: Record<NonNullable<CardData["miroLink"]>, CardData>;
};

export type MetaData = {
  path: string;
  symbol: string | null;
  codeLink: string | null;
};
