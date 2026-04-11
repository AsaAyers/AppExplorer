"use server";
import { Server as httpServer } from "node:http";

import { parse } from "cookie";
import { Server, Socket } from "socket.io";
import invariant from "tiny-invariant";
import { z } from "zod";

import { createDebug } from "@/utils/create-debug";
import { decrypt } from "@/utils/crypto";
import { EncryptableMiroState, MIRO_COOKIE } from "@/utils/init-miro-api";
import { sessionMetrics } from "@/utils/metrics";

const log = createDebug("app-explorer:sockets:main");
const SESSION_NAMESPACE_REGEX = /^\/session\/[a-f0-9]{32}$/i;

const readSessionFromSocket = async (socket: Socket) => {
  const cookie = socket.request.headers.cookie;
  invariant(cookie, "Expected socket to have a cookie");
  const { session, [MIRO_COOKIE]: miroCookie } = parse(cookie);
  invariant(session, "expected cookie to contain a session");
  const isPaid = (await decrypt(session))?.isPaid;
  invariant(miroCookie, "expected cookie to contain miro cookie");
  const userId = (await decrypt<EncryptableMiroState>(miroCookie))?.userId;
  invariant(userId, "Missing userId");

  return { isPaid, userId };
};

export class SocketServer {
  io: Server;

  constructor(httpServer: httpServer) {
    this.io = new Server(httpServer).use(async (socket, next) => {
      const userId = (await readSessionFromSocket(socket).catch(() => null))
        ?.userId;

      if (!userId) {
        return next(new Error("Unauthorized"));
      }
      const isSession = SESSION_NAMESPACE_REGEX.test(socket.nsp.name);

      if (!isSession) {
        return next(new Error("Invalid workspace name"));
      }

      next();
    });

    const dynamicNamespaces = this.io.of(SESSION_NAMESPACE_REGEX);

    dynamicNamespaces.on("connection", async (socket) => {
      const namespace = socket.nsp.name;
      sessionMetrics.onSocketConnected(namespace);

      socket.once("disconnect", () => {
        sessionMetrics.onSocketDisconnected(namespace);
      });

      const role = z
        .enum(["workspace", "miro"])
        .safeParse(socket.handshake.auth?.role);

      if (!role.success) {
        socket.disconnect(true);
        return;
      }
      socket.join(role.data);

      socket.onAny((eventName) => {
        log("onAny", eventName);
        if (eventName !== "encryptedEvent") {
          log(`Disconnecting socket for unexpected event: ${eventName}`);
          socket.disconnect(true);
          return;
        }
      });

      socket.on("encryptedEvent", () => {});
    });
  }
}

export function socketHandler(httpServer: httpServer) {
  return new SocketServer(httpServer);
}

declare global {
  var socketHandler: undefined | ((server: httpServer) => SocketServer);
}
globalThis.socketHandler = socketHandler;
