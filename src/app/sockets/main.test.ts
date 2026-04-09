import { createServer, type Server as HttpServer } from "node:http";

import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SocketServer } from "@/app/sockets/main";
import { MIRO_COOKIE } from "@/lib/init-miro-api";

const { decryptMock } = vi.hoisted(() => ({
  decryptMock: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: decryptMock,
}));

type TestContext = {
  httpServer: HttpServer;
  socketServer: SocketServer;
  port: number;
  sockets: Socket[];
};

const SESSION_TOKEN = "session-token";
const MIRO_TOKEN = "miro-token";

const cookieHeader = (session = SESSION_TOKEN, miro = MIRO_TOKEN) =>
  `session=${session}; ${MIRO_COOKIE}=${miro}`;

const waitForConnectError = (socket: Socket) =>
  new Promise<Error>((resolve) => {
    socket.once("connect_error", (error) => resolve(error));
  });

const waitForEvent = <T>(register: (done: (value: T) => void) => void) =>
  new Promise<T>((resolve) => register(resolve));

describe("SocketServer", () => {
  let context: TestContext;

  beforeEach(async () => {
    decryptMock.mockImplementation(async (token: string) => {
      if (token === SESSION_TOKEN) {
        return { isPaid: true };
      }

      if (token === MIRO_TOKEN) {
        return { userId: "user-1" };
      }

      return undefined;
    });

    const httpServer = createServer();
    const socketServer = new SocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected HTTP server to bind on a TCP port");
    }

    context = {
      httpServer,
      socketServer,
      port: address.port,
      sockets: [],
    };
  });

  afterEach(async () => {
    for (const socket of context.sockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    await new Promise<void>((resolve) => {
      context.socketServer.io.close(() => {
        context.httpServer.close(() => resolve());
      });
    });

    decryptMock.mockReset();
  });

  const connectClient = (
    namespace: string,
    role: string,
    cookie = cookieHeader(),
  ) => {
    const socket = io(`http://127.0.0.1:${context.port}${namespace}`, {
      auth: { role },
      autoConnect: false,
      extraHeaders: {
        cookie,
      },
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });

    context.sockets.push(socket);
    return socket;
  };

  it("rejects connection for invalid namespace", async () => {
    const socket = connectClient("/invalid", "workspace");
    const errorPromise = waitForConnectError(socket);
    socket.connect();
    const error = await errorPromise;

    expect(error.message).toBe("Invalid namespace");
  });

  it("rejects connection when role is not workspace|miro", async () => {
    const socket = connectClient(
      "/session/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "admin",
    );

    const connectPromise = waitForEvent<void>((done) => {
      socket.once("connect", () => done());
    });
    const disconnectPromise = waitForEvent<string>((done) => {
      socket.once("disconnect", (disconnectReason) => done(disconnectReason));
    });
    socket.connect();

    await connectPromise;

    const reason = await disconnectPromise;

    expect(reason).toBe("io server disconnect");
  });

  it("ignores invalid encryptedEvent payload without crashing", async () => {
    const sender = connectClient(
      "/session/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "workspace",
    );

    const connected = waitForEvent<void>((done) => {
      sender.once("connect", () => done());
    });
    sender.connect();
    await connected;

    sender.emit("encryptedEvent", {
      type: "encryptedEvent",
      enc: 42,
      dest: "workspace",
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sender.connected).toBe(true);
  });

  it("throws through invariant path for unexpected event names", async () => {
    const sender = connectClient(
      "/session/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "workspace",
    );

    const connected = waitForEvent<void>((done) => {
      sender.once("connect", () => done());
    });
    sender.connect();
    await connected;

    const uncaught = await waitForEvent<Error>((done) => {
      const listener = (error: Error) => {
        process.off("uncaughtException", listener);
        done(error);
      };
      process.on("uncaughtException", listener);
      sender.emit("unexpectedEvent", { value: true });
    });

    expect(uncaught.message).toContain(
      "Recieved unexpected event: unexpectedEvent",
    );
  });
});
