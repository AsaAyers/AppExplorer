import * as assert from "node:assert";
import { createServer } from "node:http";

import { io as socketIO } from "socket.io-client";

import { MiroServer } from "@/server/server";

suite("Session namespace validation", () => {
  test("disconnects clients that connect with an invalid session token", async () => {
    const httpServer = createServer();
    const miroServer = new MiroServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();
    assert.ok(address && typeof address === "object");

    const socket = socketIO(
      `http://127.0.0.1:${address.port}/session/invalid-token`,
      {
        auth: {
          role: "sidebar",
        },
        reconnection: false,
        timeout: 3000,
        transports: ["websocket"],
      },
    );

    try {
      const error = await new Promise<Error>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Expected invalid session token connection to fail"),
          );
        }, 3000);

        socket.once("connect", () => {
          clearTimeout(timeout);
          reject(new Error("Invalid session token should not connect"));
        });
        socket.once("connect_error", (error) => {
          clearTimeout(timeout);
          resolve(error);
        });
      });

      assert.match(error.message, /Invalid AppExplorer session token/);
      assert.strictEqual(socket.connected, false);
      assert.strictEqual(socket.disconnected, true);
    } finally {
      socket.close();
      miroServer.dispose();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
