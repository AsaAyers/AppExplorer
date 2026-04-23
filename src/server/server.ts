import { createServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server, type Socket } from "socket.io";
import * as vscode from "vscode";
import { z } from "zod";

import { allowedSocketOrigin } from "@/allowed-socket-origin";
import {
  APP_EXPLORER_SESSION_NAMESPACE,
  appExplorerSessionRoles,
  getSessionTokenFromNamespace,
  type AppExplorerSessionRole,
} from "@/session-transport";
import {
  encryptedEventName,
  socketEventMap,
  type SocketEntity,
} from "@/socket-events";
import { isEventHandlerOptOutError } from "@/unhandled-event-ack";
import { createDebug } from "@/utils/create-debug";
import { getSessionSecretString } from "@/utils/keys";
import { eventMetrics, sessionMetrics } from "@/utils/metrics";
import { decryptUuidToken } from "@/utils/uuid-token";

const debug = createDebug("app-explorer:server");
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
  readonly #io: Server;
  #redisClients: Array<{ destroy(): void }> = [];

  public static publicPath = [__dirname, "public"].join("/");
  constructor(httpServer: ReturnType<typeof createServer>) {
    const io = new Server(httpServer, {
      cors: {
        origin: allowedSocketOrigin,
        credentials: true,
      },
    });
    this.#io = io;
    const sessionNamespace = io.of(APP_EXPLORER_SESSION_NAMESPACE);
    const roleSchema = z.enum(appExplorerSessionRoles);

    sessionNamespace.use((socket, next) => {
      void (async () => {
        const sessionToken = getSessionTokenFromNamespace(socket.nsp.name);
        if (!sessionToken) {
          next(new Error("Invalid AppExplorer session namespace"));
          return;
        }

        try {
          await decryptUuidToken(sessionToken, getSessionSecretString());
        } catch {
          next(new Error("Invalid AppExplorer session token"));
          socket.disconnect(true);
          return;
        }

        const role = roleSchema.safeParse(socket.handshake.auth?.role);
        if (!role.success) {
          next(new Error("Invalid AppExplorer session role"));
          return;
        }

        socket.data.sessionToken = sessionToken;
        socket.data.role = role.data;
        next();
      })().catch(next);
    });

    const allowedEvents = new Set([encryptedEventName, "sessionShutdown"]);
    sessionNamespace.on("connection", (socket) => {
      const role = roleSchema.parse(socket.data.role);
      const namespace = socket.nsp.name;
      sessionMetrics.onSocketConnected(namespace);

      socket.once("disconnect", () => {
        sessionMetrics.onSocketDisconnected(namespace);
      });
      socket.onAny(async (eventName, ...args) => {
        if (!allowedEvents.has(eventName)) {
          debugEvents("(bad_event)", "Blocked disallowed event", {
            socketId: socket.id,
            role,
            eventName,
          });
          socket.disconnect(true);
          return;
        }

        eventMetrics.onEventForwarded();
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

        if (eventName === "sessionShutdown") {
          for (const recipient of recipients) {
            recipient.disconnect(true);
          }
        }

        callback(`No recipient handled ${eventName}`);
      });
    });
  }

  async initialize() {
    await this.#configureAdapter();
    return this;
  }

  async #configureAdapter() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      debug("Socket.IO Redis adapter disabled because REDIS_URL is not set");
      return;
    }

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
    } catch (error) {
      pubClient.destroy();
      subClient.destroy();
      throw error;
    }

    this.#io.adapter(createAdapter(pubClient, subClient));
    this.#redisClients = [pubClient, subClient];
    debug("Socket.IO Redis adapter enabled");
  }

  dispose() {
    this.#io.close();
    this.#redisClients.forEach((client) => client.destroy());
    this.subscriptions.forEach((s) => s.dispose());
  }
}
