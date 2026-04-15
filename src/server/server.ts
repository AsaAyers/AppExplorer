import { createServer } from "node:http";
import * as path from "node:path";

import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Server, type Socket } from "socket.io";
import * as vscode from "vscode";
import { z } from "zod";

import {
  APP_EXPLORER_SESSION_NAMESPACE,
  appExplorerSessionRoles,
  type AppExplorerSessionRole,
} from "../session-transport";
import {
  encryptedEventName,
  socketEventMap,
  type SocketEntity,
} from "../socket-events";
import { isEventHandlerOptOutError } from "../unhandled-event-ack";
import { createDebug } from "../utils/create-debug";

export const debug = createDebug("app-explorer:server");
const debugEvents = debug.extend("events");

const getTargetRoles = (
  sourceRole: AppExplorerSessionRole,
  eventName: string,
): AppExplorerSessionRole[] => {
  if (eventName === encryptedEventName) {
    return appExplorerSessionRoles.filter((role) => role !== sourceRole);
  }

  const roleMap = socketEventMap[sourceRole as SocketEntity];
  return Object.entries(roleMap)
    .filter(([, events]) => eventName in events)
    .map(([role]) => role as AppExplorerSessionRole);
};

const getRecipients = (
  socket: Socket,
  sourceRole: AppExplorerSessionRole,
  eventName: string,
) => {
  const targetRoles = new Set(getTargetRoles(sourceRole, eventName));
  return [...socket.nsp.sockets.values()].filter(
    (candidate) =>
      candidate.id !== socket.id &&
      targetRoles.has(candidate.data.role as AppExplorerSessionRole),
  );
};

export class MiroServer {
  subscriptions = [] as vscode.Disposable[];
  httpServer: ReturnType<typeof createServer>;
  #port: number;

  public static publicPath = path.join(__dirname, "public");
  constructor() {
    this.#port = 9042;
    const app = express();
    this.httpServer = createServer(app);
    app.use(compression());
    app.use(
      "/",
      express.static(MiroServer.publicPath, {
        index: "index.html",
      }),
    );

    app.post("/reset", (_req, res) => {
      debug("Resetting server state");
      this.httpServer.close();
      return res.status(200).json({ success: true });
    });
    app.use(morgan("tiny"));

    app.get("/health", (_req, res) => {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    });

    const io = new Server(this.httpServer);
    this.setupSessionNamespace(io);
  }

  private setupSessionNamespace(io: Server) {
    const sessionNamespace = io.of(APP_EXPLORER_SESSION_NAMESPACE);
    const roleSchema = z.enum(appExplorerSessionRoles);

    sessionNamespace.use((socket, next) => {
      const role = roleSchema.safeParse(socket.handshake.auth?.role);
      if (!role.success) {
        next(new Error("Invalid AppExplorer session role"));
        return;
      }

      socket.data.role = role.data;
      next();
    });

    sessionNamespace.on("connection", (socket) => {
      const role = roleSchema.parse(socket.data.role);

      socket.onAny(async (eventName, ...args) => {
        debugEvents("Relaying session event", {
          socketId: socket.id,
          role,
          eventName,
        });

        const callback =
          typeof args.at(-1) === "function"
            ? (args.pop() as (error: unknown, result?: unknown) => void)
            : undefined;
        const recipients = getRecipients(socket, role, eventName);

        if (!callback) {
          recipients.forEach((recipient) => {
            recipient.emit(eventName, ...args);
          });
          return;
        }

        for (const recipient of recipients) {
          try {
            const result = await recipient.emitWithAck(eventName, ...args);
            callback(null, result);
            return;
          } catch (error) {
            if (isEventHandlerOptOutError(error)) {
              continue;
            }
            debugEvents("Relay ack failed", {
              socketId: recipient.id,
              eventName,
              error,
            });
          }
        }

        callback(`No recipient handled ${eventName}`);
      });
    });
  }

  static async create(): Promise<MiroServer> {
    const server = new MiroServer();
    await server.startServer();
    return server;
  }

  private async startServer(): Promise<void> {
    const port = this.#port;

    return new Promise((resolve, reject) => {
      this.httpServer.on("error", (error) => {
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

      this.httpServer.listen(port, "127.0.0.1", () => {
        debug("Server started successfully", { port });
        resolve();
      });
    });
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
    this.httpServer.closeAllConnections();
  }
}
