"use client";
import React from "react";

import { randomHex } from "@/utils/to-hex";

const SESSION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useDemoSession() {
  return React.useState(() => {
    const initialValue = {
      sessionId: crypto.randomUUID(),
      sessionHexKey: randomHex(512),
    };
    if (typeof window === "undefined") {
      return initialValue;
    }

    const storedValue = window.localStorage.getItem("demo-session");
    if (!storedValue) {
      window.localStorage.setItem("demo-session", JSON.stringify(initialValue));
      return initialValue;
    }

    try {
      const parsedValue = JSON.parse(storedValue) as typeof initialValue;
      if (!SESSION_ID_REGEX.test(parsedValue.sessionId)) {
        window.localStorage.setItem(
          "demo-session",
          JSON.stringify(initialValue),
        );
        return initialValue;
      }
      return parsedValue;
    } catch {
      window.localStorage.setItem("demo-session", JSON.stringify(initialValue));
      return initialValue;
    }
  });
}
