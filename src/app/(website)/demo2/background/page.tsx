"use client";
import React from "react";

import { BackgroundMiroHandler } from "@/app/(miro)/background/background-miro-handler";
import { getMiroAdapter } from "@/utils/miro/adapter";

const miro = getMiroAdapter({ forceFake: true });
const boardIdPromise = miro.getBoardId();
const disabled = process.env.DISABLE_BACKGROUND === "true";

export default function Demo2BackgroundPage() {
  const boardId = React.use(boardIdPromise);

  React.useEffect(() => {
    if (disabled) {
      return;
    }

    const background = new BackgroundMiroHandler(true, boardId, {
      miroAdapter: miro,
    });
    return () => {
      background.dispose();
    };
  }, [boardId]);

  return <div>Demo2 background iframe</div>;
}
