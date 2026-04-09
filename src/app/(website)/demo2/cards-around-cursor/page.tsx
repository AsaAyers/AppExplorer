"use client";
import React from "react";

import { useDemoSession } from "@/app/(website)/demo/useDemoSession";
import { CardsAroundCursor } from "@/components/cards-around-cursor";
import { useForegroundMiro } from "@/lib/foreground-miro-handler";

export default function CardsAroundCursorPage() {
  const [{ sessionId, sessionHexKey }] = useDemoSession();

  const foreground = useForegroundMiro();
  React.useEffect(() => {
    foreground.startSession(sessionId, sessionHexKey);
  }, [foreground, sessionHexKey, sessionId]);

  return <CardsAroundCursor draggable />;
}
