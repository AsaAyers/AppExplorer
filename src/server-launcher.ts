import { createServer } from "node:http";
import path from "node:path";

import compression from "compression";
import express from "express";
import morgan from "morgan";

import { MiroServer } from "./server/server";
import { ServerDiscovery } from "./server-discovery";
import { delay, waitForValue } from "./test/suite/test-utils";
import { createDebug } from "./utils/create-debug";
const debug = createDebug("app-explorer:server-launcher");
export type ServerMode = "server" | "client";

export interface ServerLaunchResult {
  mode: ServerMode;
  server?: boolean;
  serverUrl?: string;
  error?: string;
}

export class ServerLauncher {
  private serverDiscovery: ServerDiscovery;
  subscriptions: { dispose: () => void }[] = [];
  server: MiroServer | undefined;

  constructor(serverDiscovery?: ServerDiscovery) {
    // If no ServerDiscovery provided, create one with configured port
    this.serverDiscovery = serverDiscovery || new ServerDiscovery();
  }

  /**
   * Determine server mode and launch server if needed
   */
  async initializeServer(): Promise<ServerLaunchResult> {
    debug("Initializing server");

    try {
      // Step 1: Check if server already exists
      debug("Checking for existing server...");
      const serverExists = await this.serverDiscovery.checkServerHealth();
      debug("Server health check result", { serverExists });

      if (serverExists) {
        // Step 2a: Server exists, connect as client
        const serverUrl = this.serverDiscovery.getServerUrl();

        debug("Existing server detected, connecting as client", {
          serverUrl,
        });

        return {
          mode: "client",
          serverUrl,
        };
      } else {
        // Step 2b: No server exists, try to launch one
        debug("No existing server found, attempting to launch new server");
        return this.attemptServerLaunch();
      }
    } catch (error) {
      debug("Error during server initialization, falling back to legacy mode", {
        error,
      });

      // Fallback to legacy mode on error
      return this.launchServer();
    }
  }

  /**
   * Attempt to launch server with race condition handling
   */
  private async attemptServerLaunch(): Promise<ServerLaunchResult> {
    debug("Attempting to launch server in this workspace");

    try {
      // Try to launch server - if another workspace wins the race, this will fail
      const server = await this.launchServer();

      if (server.server) {
        debug("Successfully launched server in this workspace");
        return server;
      } else {
        throw new Error("Failed to launch server");
      }
    } catch (launchError) {
      // Server launch failed - likely another workspace won the race
      debug(
        "Server launch failed (likely race condition), attempting to connect as client",
        {
          error:
            launchError instanceof Error
              ? launchError.message
              : String(launchError),
          isPortInUse:
            String(launchError).includes("EADDRINUSE") ||
            String(launchError).includes("already in use"),
        },
      );

      // Wait a moment for the other server to fully start
      debug("Waiting for other server to fully start...");
      await delay(1000);

      // Try to connect as client to the server that won the race
      debug("Checking if other server is now available...");
      const serverExists = await waitForValue(async () => {
        return (await this.serverDiscovery.checkServerHealth())
          ? true
          : undefined;
      });
      debug("Post-race server health check result", {
        serverExists,
      });

      const serverUrl = this.serverDiscovery.getServerUrl();
      debug("Successfully connecting as client after race condition", {
        serverUrl,
      });
      return {
        mode: "client",
        serverUrl,
      };
    }
  }

  /**
   * Launch MiroServer in this workspace
   */
  private async launchServer(): Promise<ServerLaunchResult> {
    const startTime = Date.now();
    const serverUrl = this.serverDiscovery.getServerUrl();

    debug("Starting server launch", { serverUrl });

    try {
      const app = express();
      const httpServer = createServer(app);
      app.use(compression());
      app.use(
        "/",
        express.static(MiroServer.publicPath, {
          index: "index.html",
        }),
      );
      app.get("/sidebar", (_req, res) => {
        res.sendFile(path.join(MiroServer.publicPath, "sidebar.html"));
      });
      app.get("/card/:boardId/:cardId", (_req, res) => {
        res.sendFile(path.join(MiroServer.publicPath, "edit-card.html"));
      });

      app.post("/reset", (_req, res) => {
        debug("Resetting server state");
        httpServer.close();
        return res.status(200).json({ success: true });
      });
      app.use(morgan("tiny"));

      app.get("/health", (_req, res) => {
        res.json({ status: "healthy", timestamp: new Date().toISOString() });
      });

      // Create and start server instance with proper error handling
      // Use the same port as ServerDiscovery for consistency
      const server = new MiroServer(httpServer);
      this.subscriptions.push(server);
      this.server = server;

      /**
       * The server launcher only ever uses this port. Functionality will get
       * migrated off of port 9042 and onto port 3000, which is the codebase
       * that hosts https://appexplorer.dev. During the transition period, the
       * server launcher will continue to use port 9042 and will eventually
       * launch an unused server. Then the server on 9042 will be removed
       * entirely once the transition is complete.
       */
      const port = 9042;
      await new Promise<void>((resolve, reject) => {
        httpServer.on("error", (error) => {
          if ("code" in error && error.code === "EADDRINUSE") {
            debug("Port already in use", {
              port,
              error: error.message,
            });
            reject(
              new Error(
                `Port ${port} is already in use. Another server instance may be running.`,
              ),
            );
          } else {
            debug("Server error", { error });
            reject(error);
          }
        });

        httpServer.listen(port, "127.0.0.1", () => {
          debug("Server started successfully", { port });
          resolve();
        });
      });

      this.subscriptions.push({
        dispose() {
          httpServer.closeAllConnections();
        },
      });

      const duration = Date.now() - startTime;
      debug("Server launched successfully", {
        serverUrl,
        duration: `${duration}ms`,
        mode: "server",
      });

      return {
        mode: "server",
        server: true,
        serverUrl,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Port binding failed - another process is using the port
      debug("Server launch failed", {
        serverUrl,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        isPortInUse:
          String(error).includes("EADDRINUSE") ||
          String(error).includes("already in use"),
      });

      throw error;
    }
  }

  /**
   * Handle server failover when current server goes down
   */
  async handleServerFailover(): Promise<ServerLaunchResult> {
    debug("Handling server failover, attempting to launch new server");

    // Try to launch a new server to replace the failed one
    return this.attemptServerLaunch();
  }

  /**
   * Get current server discovery instance
   */
  getServerDiscovery(): ServerDiscovery {
    return this.serverDiscovery;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    debug("Disposing ServerLauncher resources");
    this.serverDiscovery.dispose();
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    this.server?.dispose();
    this.server = undefined;
    debug("ServerLauncher disposed");
  }
}
