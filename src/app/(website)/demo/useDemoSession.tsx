"use client";
import React from "react";
import { z } from "zod";

import { requestSessionToken, zSessionToken } from "@/app-explorer-session";
import { randomHex } from "@/utils/to-hex";

const zDemoSessionState = z.object({
  sessionToken: zSessionToken,
  sessionHexKey: z.string().min(1),
});

export function useDemoSession() {
  const [demoSession, setDemoSession] = React.useState<
    z.infer<typeof zDemoSessionState> | undefined
  >();

  React.useEffect(() => {
    const abortController = new AbortController();

    void (async () => {
      const storedValue = window.localStorage.getItem("demo-session");
      if (storedValue) {
        try {
          const parsedValue = zDemoSessionState.safeParse(
            JSON.parse(storedValue),
          );
          if (parsedValue.success) {
            setDemoSession(parsedValue.data);
            return;
          }
        } catch {
          // Fall through and replace the invalid cached value.
        }
      }

      const nextDemoSession = zDemoSessionState.parse({
        sessionToken: await requestSessionToken(abortController.signal),
        sessionHexKey: randomHex(512),
      });

      window.localStorage.setItem(
        "demo-session",
        JSON.stringify(nextDemoSession),
      );
      if (!abortController.signal.aborted) {
        setDemoSession(nextDemoSession);
      }
    })();

    return () => {
      abortController.abort("useEffect cleanup");
    };
  }, []);

  return demoSession;
}
