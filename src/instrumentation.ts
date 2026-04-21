import * as Sentry from "@sentry/nextjs";

import type { socketHandler as socketHandlerType } from "@/app/sockets/main";
import type { MetricsRegistry } from "@/utils/metrics";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const [{ socketHandler }, { metricsRegistry }] = await Promise.all([
      import("@/app/sockets/main"),
      import("@/utils/metrics"),
    ]);
    globalThis.socketHandler = socketHandler;
    globalThis.metricsRegistry = metricsRegistry;
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

declare global {
  var socketHandler: typeof socketHandlerType | undefined;
  var metricsRegistry: MetricsRegistry | undefined;
}
