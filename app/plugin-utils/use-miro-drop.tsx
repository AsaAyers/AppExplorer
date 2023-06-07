import type { DropEvent } from "@mirohq/websdk-types";
import React from "react";
import { useLatestRef } from "~/lsp/components/useLatestRef";

export function useMiroDrop(handleDrop: ({ x, y, target }: DropEvent) => Promise<void>) {
  const handlerRef = useLatestRef(handleDrop);

  React.useEffect(() => {
    const stableHandler: typeof handlerRef.current = (...args) => handlerRef.current(...args);

    miro.board.ui.on("drop", stableHandler);
    return () => {
      // Miro doesn't like it when strict mode causes a handler to be registerd
      // and immediately unregistered. Adding a delay seems to fix it.
      new Promise(r => setTimeout(r, 1)).then(() => {
        miro.board.ui.off("drop", stableHandler);
      });
    };
  }, [handlerRef]);
}