"use client";
import { AppCard } from "@mirohq/websdk-types/stable/features/widgets/appCard";

import { CardData } from "@/card-data";

export const distance = (
  center: { x: number; y: number },
  card: AppCard | CardData,
) => Math.sqrt(Math.pow(card.x - center.x, 2) + Math.pow(card.y - center.y, 2));
