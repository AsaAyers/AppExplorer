import * as Sentry from "@sentry/nextjs";

import { socketHandler } from "@/app/sockets/main";
import { MetricsRegistry, metricsRegistry as registry } from "@/utils/metrics";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

globalThis.socketHandler = socketHandler;
globalThis.metricsRegistry = registry;

declare global {
  var metricsRegistry: MetricsRegistry | undefined;
}
