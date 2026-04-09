"use client";
import React from "react";

import { BackgroundMiroHandler } from "@/app/(miro)/background/background-miro-handler";
import { useClientSession } from "@/components/client-session";
import { getMiroAdapter } from "@/utils/miro/adapter";

const miro = getMiroAdapter();

const boardIdPromise = miro.getBoardId();

const disabled = process.env.DISABLE_BACKGROUND === "true";

export default function BackgroundClient() {
  const { isPaid } = useClientSession();
  const boardId = React.use(boardIdPromise);

  React.useEffect(() => {
    if (disabled) {
      return;
    }

    const handler = new BackgroundMiroHandler(isPaid, boardId);

    return () => {
      handler.dispose();
    };
  }, [boardId, isPaid]);

  return <div>Miro opens this page in an invisible iframe</div>;
}
