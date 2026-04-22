"use client";
import React from "react";

import { useClientOnly } from "@/utils/use-client-only";

function isParentSameOrigin() {
  try {
    void window.parent.location.href;
    return true;
  } catch {
    return false;
  }
}

export function useIsInMiroIframe() {
  const isClient = useClientOnly();

  return React.useMemo(() => {
    return isClient ? !isParentSameOrigin() : null;
  }, [isClient]);
}
