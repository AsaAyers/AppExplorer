"use client";

import { useEffect } from "react";

export function BackgroundBoot() {
  useEffect(() => {
    let isActive = true;

    void import("@/miro").then(({ backgroundInit }) => {
      if (isActive) {
        void backgroundInit();
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  return null;
}
