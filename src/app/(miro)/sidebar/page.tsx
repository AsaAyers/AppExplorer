"use client";

import Script from "next/script";
import React from "react";

export default function SidebarPage() {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      <Script src="/lit.js" strategy="afterInteractive" type="module" />
      <div className="container full sidebar" suppressHydrationWarning>
        {isMounted ? React.createElement("app-explorer-sidebar") : null}
      </div>
    </>
  );
}
