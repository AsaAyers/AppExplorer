import { Socket as ServerSocket } from "socket.io";
import type { Socket } from "socket.io-client";

interface Disposable {
  dispose(): void;
}
import { debugLog } from "@/utils/debug-log";

interface EventsMap {
  [event: string]: any;
}

type SocketListeners<T extends ServerSocket | Socket> =
  T extends ServerSocket<infer L, EventsMap> ? L : never;
const log = debugLog("socket");

function toSocketEventName(eventName: string) {
  if (eventName.startsWith("on") && eventName.length > 2) {
    return eventName[2].toLowerCase() + eventName.slice(3);
  }

  return eventName;
}

export function attachSocketHandlers<
  T extends EventsMap,
  S extends Socket | ServerSocket,
>(
  socket: S,
  socketHandlers: SocketListeners<S> extends T ? T : SocketListeners<S>,
): Disposable {
  Object.entries(socketHandlers).forEach(([eventName, handler]) => {
    const socketEventName = toSocketEventName(eventName);
    try {
      socket.on(socketEventName, handler);
    } catch (e) {
      log("ERROR setting up event", e);
    }
  });
  function dispose() {
    if ("off" in socket) {
      Object.entries(socketHandlers).forEach(([eventName, handler]) => {
        const socketEventName = toSocketEventName(eventName);
        try {
          // Each of these are correct, but TS thinks they aren't if socket is
          // still a union
          (socket as ServerSocket).off(socketEventName, handler);
          // (socket as Socket).off(eventName, handler);
        } catch (e) {
          log("ERROR setting up event", e);
        }
      });
    }
  }
  socket.on("disconnect", dispose);
  return { dispose };
}
