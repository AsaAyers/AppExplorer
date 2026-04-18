"use client";

import { useEffect } from "react";

import { backgroundInit } from "@/miro";

export function BackgroundBoot() {
  useEffect(() => {
    const background = backgroundInit();

    return () => {
      background.dispose();
    };
  }, []);

  return null;
}
