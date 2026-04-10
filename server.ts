const { createServer } = await import("node:http");
const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

declare let hostname: string;
const hostName = typeof hostname === "string" ? hostname : "AppExplorer.dev";

const next = await import("next");
const app = next.default({
  dev,
  hostname: hostName,
  port,
  conf: process.env.__NEXT_PRIVATE_STANDALONE_CONFIG
    ? JSON.parse(process.env.__NEXT_PRIVATE_STANDALONE_CONFIG)
    : undefined,
});
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const nextUpgradeHandler = app.getUpgradeHandler();

  globalThis.socketHandler?.(httpServer);

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", `https://${hostName}`);
    const { pathname } = url;

    // Pass HMR requests to Next.js's internal handler
    if (pathname === "/_next/webpack-hmr") {
      nextUpgradeHandler(req, socket, head);
    } else {
      // I think socket.io is handling this for me
    }
  });

  httpServer.once("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> Ready on https://${hostName}`);
  });
});

const metricsPort = Number(port + 1);

const metricsServer = createServer(async (req, res) => {
  if (req.url !== "/api/metrics" || !metricsRegistry) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  const body = await metricsRegistry?.asPrometheusText();

  res.statusCode = 200;
  res.setHeader("Content-Type", metricsRegistry?.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
});

metricsServer.listen(metricsPort, () => {
  // eslint-disable-next-line no-console
  console.log(`> Ready on http://localhost:${metricsPort}`);
});

export {};
