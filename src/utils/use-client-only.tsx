"use client";
import React from "react";

export function useClientOnly() {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    const t = requestAnimationFrame(() => {
      setIsClient(true);
    });
    return () => cancelAnimationFrame(t);
  }, []);

  return isClient;
}
