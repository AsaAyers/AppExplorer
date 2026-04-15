import * as assert from "node:assert";
import { EventEmitter } from "node:events";

import { EventHandler } from "../../event-handlers/event-handler";
import { encryptedEventName } from "../../socket-events";

import type { CardData } from "@/EventTypes";
import type { HandlerMethodMap } from "@/event-handlers/types";

class MockSocket extends EventEmitter {
  id = "mock-socket";
  io = {};
  peer?: MockSocket;
  emitted: Array<{ eventName: string; args: unknown[] }> = [];

  override emit(eventName: string, ...args: unknown[]) {
    this.emitted.push({ eventName, args });
    return super.emit(eventName, ...args);
  }

  emitWithAck(eventName: string, ...args: unknown[]) {
    this.emitted.push({ eventName, args });
    if (!this.peer) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
      this.peer?.emit(eventName, ...args, (error: unknown, result: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  onAny() {}

  onAnyOutgoing() {}
}

const relayEncryptedEvent = async (
  receiverSocket: MockSocket,
  payload: unknown,
) => {
  receiverSocket.emit(encryptedEventName, payload);
  await new Promise((resolve) => setTimeout(resolve, 50));
};

class SidebarTestEventHandler extends EventHandler<"sidebar", "workspace"> {
  protected readonly selfName = "sidebar" as const;
  protected readonly handlerMethods = {} satisfies HandlerMethodMap<
    "sidebar",
    "workspace"
  >;
}

class WorkspaceTestEventHandler extends EventHandler<"workspace", "sidebar"> {
  protected readonly selfName = "workspace" as const;
  receivedCard: CardData | null = null;

  protected readonly handlerMethods = {
    onNavigateTo: async (card: CardData) => {
      this.receivedCard = card;
    },
  } satisfies HandlerMethodMap<"workspace", "sidebar">;
}

class SidebarServerRequestEventHandler extends EventHandler<
  "sidebar",
  "server"
> {
  protected readonly selfName = "sidebar" as const;
  protected readonly handlerMethods = {
    onCardsAroundCursor: async (_cards: CardData[]) => {},
    onServerStatus: async (_status: unknown) => {},
  } satisfies HandlerMethodMap<"sidebar", "server">;
}

class ServerSidebarResponseEventHandler extends EventHandler<
  "server",
  "sidebar"
> {
  protected readonly selfName = "server" as const;
  protected readonly handlerMethods = {
    onGetInstanceId: async () => "instance-123",
  } satisfies HandlerMethodMap<"server", "sidebar">;
}

suite("Encrypted EventHandler transport", () => {
  test("emitEncrypted sends hidden envelopes that dispatch to handler methods", async () => {
    const senderSocket = new MockSocket();
    const receiverSocket = new MockSocket();
    const sender = SidebarTestEventHandler.create(senderSocket as never);
    const receiver = WorkspaceTestEventHandler.create(receiverSocket as never);

    const card: CardData = {
      id: "card-1",
      x: 0,
      y: 0,
      type: "symbol",
      boardId: "board-1",
      title: "Example",
      description: "",
      miroLink: "https://miro.com/app/board/board-1/?moveToWidget=1",
      path: "src/example.ts",
      symbol: "example",
      codeLink: "https://github.com/example/repo/blob/main/src/example.ts",
      status: "connected",
    };

    await sender.emitEncrypted("navigateTo", card);

    assert.strictEqual(senderSocket.emitted.length, 1);
    assert.strictEqual(senderSocket.emitted[0]?.eventName, encryptedEventName);

    const [payload] = senderSocket.emitted[0]?.args ?? [];
    assert.strictEqual(typeof payload, "string");

    await relayEncryptedEvent(receiverSocket, payload);

    assert.deepStrictEqual(receiver.receivedCard, card);
  });

  test("emitEncrypted decrypts encrypted ack results", async () => {
    const requesterSocket = new MockSocket();
    const responderSocket = new MockSocket();
    requesterSocket.peer = responderSocket;
    responderSocket.peer = requesterSocket;

    const requester = SidebarServerRequestEventHandler.create(
      requesterSocket as never,
    );
    ServerSidebarResponseEventHandler.create(responderSocket as never);

    const result = await requester.emitEncrypted("getInstanceId");

    assert.strictEqual(result, "instance-123");
  });
});
