"use client";

import Script from "next/script";
import React from "react";

export default function CardPage() {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      <Script src="/lit.js" strategy="afterInteractive" type="module" />
      <div suppressHydrationWarning>
        {isMounted ? React.createElement("app-explorer-edit-card") : null}
      </div>
    </>
  );
}
