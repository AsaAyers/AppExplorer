"use client";

import { DefaultEventsMap } from "socket.io";
import * as client from "socket.io-client";

import { identity } from "@/utils/identity";

export const socketIO = identity(client.io);

// export const Socket = client.Socket;
export type ClientSocket<
  L extends DefaultEventsMap = DefaultEventsMap,
  R extends DefaultEventsMap = DefaultEventsMap,
> = client.Socket<L, R>;
