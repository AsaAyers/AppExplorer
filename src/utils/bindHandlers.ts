import { Socket } from "socket.io-client";

export type EventMapType = {
  // This does need to use any, it doesn't work with unknown

  [K: string]: (...args: any[]) => any;
};

export function bindHandlers<T extends EventMapType>(
  socket: Socket<T>,
  handlers: T,
) {
  Object.keys(handlers).forEach((k) => {
    const event = k as keyof typeof handlers;
    const handler = handlers[event];
    if (typeof event === "string") {
      socket.on(event, handler);
    }
  });
}
