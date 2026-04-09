"use client";

import React from "react";

import Loading from "@/app/(miro)/loading";
import { debugLog } from "@/utils/debug-log";
import { useForegroundMiro } from "@/utils/foreground-miro-handler";

let singletonPromise: Promise<void> | null = null;

const log = debugLog("auth:start");

export default function AuthIntercept() {
  const foreground = useForegroundMiro();

  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    async function run() {
      foreground.openAuthModal();
    }

    if (singletonPromise === null) {
      startTransition(() => {
        singletonPromise ??= run();
      });
    }
  }, [foreground]);

  return <Loading path="auth.tsx" symbol="start" />;
}
