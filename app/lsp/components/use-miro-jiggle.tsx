import React from "react";

export function useMiroJiggle() {
  const [key, setKey] = React.useState(() =>
    // It doesn't really matter what the key is, as long as its truthy and
    // changes.
    Math.random().toString(36).substring(2)
  );

  React.useEffect(() => {
    const stableHandler = () => setKey(Math.random().toString(36).substring(2));

    miro.board.ui.on("items:create", stableHandler);
    miro.board.ui.on("items:delete", stableHandler);
    miro.board.ui.on("selection:update", stableHandler);

    return () => {
      // Miro doesn't like it when strict mode causes a handler to be registerd
      // and immediately unregistered. Adding a delay seems to fix it.
      new Promise((r) => setTimeout(r, 1)).then(() => {
        miro.board.ui.off("items:create", stableHandler);
        miro.board.ui.off("items:delete", stableHandler);
        miro.board.ui.off("selection:update", stableHandler);
      });
    };
  }, []);
  return key;
}
