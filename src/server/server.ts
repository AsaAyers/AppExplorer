import { createServer } from "node:http";

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

  public static publicPath = [__dirname, "public"].join("/");
  constructor(httpServer: ReturnType<typeof createServer>) {
    const io = new Server(httpServer);
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

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }
}
