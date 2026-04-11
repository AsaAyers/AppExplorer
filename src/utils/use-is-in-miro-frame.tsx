"use client";
import React from "react";

function isParentSameOrigin() {
  try {
    void window.parent.location.href;
    return true;
  } catch {
    return false;
  }
}

export function useIsInMiroIframe() {
  const [isInMiroIframe, setIsInMiroIframe] = React.useState<boolean | null>(
    null,
  );

  React.useEffect(() => {
    setIsInMiroIframe(!isParentSameOrigin());
  }, []);

  return isInMiroIframe;
}
