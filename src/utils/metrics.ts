import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";

type ActiveSessionCountProvider = () => number;
const SESSION_NAMESPACE_REGEX = /^\/session\/([a-f0-9-]{36})$/i;

const getSessionIdFromNamespace = (namespace: string) => {
  return SESSION_NAMESPACE_REGEX.exec(namespace)?.[1] ?? null;
};

type SessionCounters = {
  activeSessionGauge: Gauge;
  sessionsEndedCounter: Counter;
  sessionsStartedCounter: Counter;
};

type EventCounters = {
  encryptedEventsForwardedCounter: Counter;
  encryptedEventsReceivedCounter: Counter;
  encryptedEventsRejectedCounter: Counter;
};

type RouteCounters = {
  routeLoadsCounter: Counter<"route">;
};

type MetricsState = SessionCounters &
  EventCounters &
  RouteCounters & {
    activeSessionCountProvider?: ActiveSessionCountProvider;
    register: Registry;
    trackedSessions: Map<string, number>;
  };

declare global {
  var appExplorerMetrics: MetricsState | undefined;
}

const METRICS_PREFIX = "app_explorer_";

const createMetricsState = (): MetricsState => {
  const register = new Registry();
  collectDefaultMetrics({ prefix: METRICS_PREFIX, register });

  const sessionsStartedCounter = new Counter({
    name: `${METRICS_PREFIX}sessions_started_total`,
    help: "Total number of unique sessions that became active.",
    registers: [register],
  });

  const sessionsEndedCounter = new Counter({
    name: `${METRICS_PREFIX}sessions_ended_total`,
    help: "Total number of unique sessions that became inactive.",
    registers: [register],
  });

  const activeSessionGauge = new Gauge({
    name: `${METRICS_PREFIX}active_sessions`,
    help: "Current number of active unique sessions with at least one connected client.",
    registers: [register],
  });

  const encryptedEventsReceivedCounter = new Counter({
    name: `${METRICS_PREFIX}encrypted_events_received_total`,
    help: "Total encrypted events received by socket server.",
    registers: [register],
  });

  const encryptedEventsForwardedCounter = new Counter({
    name: `${METRICS_PREFIX}encrypted_events_forwarded_total`,
    help: "Total encrypted events successfully forwarded to destination role.",
    registers: [register],
  });

  const encryptedEventsRejectedCounter = new Counter({
    name: `${METRICS_PREFIX}encrypted_events_rejected_total`,
    help: "Total encrypted events rejected due to invalid payload.",
    registers: [register],
  });

  const routeLoadsCounter = new Counter({
    name: `${METRICS_PREFIX}route_loads_total`,
    help: "Total tracked route loads by route path.",
    labelNames: ["route"] as const,
    registers: [register],
  });

  return {
    activeSessionGauge,
    encryptedEventsForwardedCounter,
    encryptedEventsReceivedCounter,
    encryptedEventsRejectedCounter,
    register,
    routeLoadsCounter,
    sessionsEndedCounter,
    sessionsStartedCounter,
    trackedSessions: new Map<string, number>(),
  };
};

const getMetricsState = (): MetricsState => {
  globalThis.appExplorerMetrics ??= createMetricsState();
  return globalThis.appExplorerMetrics;
};

export const sessionMetrics = {
  onSocketConnected(namespace: string) {
    const metrics = getMetricsState();
    const sessionId = getSessionIdFromNamespace(namespace);
    if (!sessionId) {
      return;
    }

    const currentConnections = metrics.trackedSessions.get(sessionId) ?? 0;
    const newConnections = currentConnections + 1;
    metrics.trackedSessions.set(sessionId, newConnections);

    if (currentConnections === 0) {
      metrics.sessionsStartedCounter.inc();
    }
  },
  onSocketDisconnected(namespace: string) {
    const metrics = getMetricsState();
    const sessionId = getSessionIdFromNamespace(namespace);
    if (!sessionId) {
      return;
    }

    const currentConnections = metrics.trackedSessions.get(sessionId) ?? 0;

    if (currentConnections <= 1) {
      metrics.trackedSessions.delete(sessionId);

      if (currentConnections === 1) {
        metrics.sessionsEndedCounter.inc();
      }
      return;
    }

    metrics.trackedSessions.set(sessionId, currentConnections - 1);
  },
  setActiveSessionCountProvider(provider: ActiveSessionCountProvider) {
    getMetricsState().activeSessionCountProvider = provider;
  },
  refreshActiveSessions() {
    const metrics = getMetricsState();
    const activeSessionCount =
      metrics.activeSessionCountProvider?.() ?? metrics.trackedSessions.size;
    metrics.activeSessionGauge.set(activeSessionCount);
  },
};

export const eventMetrics = {
  onEncryptedEventForwarded() {
    getMetricsState().encryptedEventsForwardedCounter.inc();
  },
  onEncryptedEventReceived() {
    getMetricsState().encryptedEventsReceivedCounter.inc();
  },
  onEncryptedEventRejected() {
    getMetricsState().encryptedEventsRejectedCounter.inc();
  },
};

export const routeMetrics = {
  onRouteLoaded(route: string) {
    getMetricsState().routeLoadsCounter.inc({ route });
  },
};

export const metricsRegistry = {
  async asPrometheusText() {
    sessionMetrics.refreshActiveSessions();
    return getMetricsState().register.metrics();
  },
  get contentType() {
    return getMetricsState().register.contentType;
  },
};

export type MetricsRegistry = typeof metricsRegistry;
