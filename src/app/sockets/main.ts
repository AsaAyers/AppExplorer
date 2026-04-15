"use server";
import { Server as httpServer } from "node:http";

import { MiroServer } from "@/server/server";
import { createDebug } from "@/utils/create-debug";

const log = createDebug("app-explorer:sockets:main");

export function socketHandler(httpServer: httpServer) {
  return new MiroServer(httpServer);
}

declare global {
  var socketHandler: undefined | ((server: httpServer) => MiroServer);
}
globalThis.socketHandler = socketHandler;
