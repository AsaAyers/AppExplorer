import React from "react";

export function useNewKeyOnItemUpdates() {
  const [key, setKey] = React.useState(() =>
    Math.random().toString(36).substring(2)
  );

  React.useEffect(() => {
    const stableHandler = () => setKey(Math.random().toString(36).substring(2));

    miro.board.ui.on("items:create", stableHandler);
    miro.board.ui.on("items:delete", stableHandler);
    return () => {
      // Miro doesn't like it when strict mode causes a handler to be registerd
      // and immediately unregistered. Adding a delay seems to fix it.
      new Promise((r) => setTimeout(r, 1)).then(() => {
        miro.board.ui.off("items:create", stableHandler);
        miro.board.ui.off("items:delete", stableHandler);
      });
    };
  }, []);
  return key;
}
