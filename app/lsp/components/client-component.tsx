import React from "react";

export function ClientComponent({ children }: React.PropsWithChildren<{}>) {
  const [browser, setBrowser] = React.useState(false);
  React.useEffect(() => {
    setBrowser(true);
  }, []);
  return browser ? children : null;
}
