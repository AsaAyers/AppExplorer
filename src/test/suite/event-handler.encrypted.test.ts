import * as assert from "node:assert";
import { EventEmitter } from "node:events";

import { EventHandler } from "../../event-handlers/event-handler";
import { SidebarClientEventHandler } from "../../event-handlers/sidebar-client-event-handler";
import { encryptedEventName } from "../../socket-events";
import { isEventHandlerOptOutError } from "../../unhandled-event-ack";

import { zAppExplorerSession } from "@/app-explorer-session";
import type { CardData } from "@/card-data";
import type { HandlerMethodMap } from "@/event-handlers/types";
import { randomHex } from "@/utils/to-hex";

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

const invokeWithAck = (
  receiverSocket: MockSocket,
  eventName: string,
  ...args: unknown[]
) =>
  new Promise<unknown>((resolve, reject) => {
    receiverSocket.emit(
      eventName,
      ...args,
      (error: unknown, result: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );
  });

const relayAckEvent = async (
  receivers: MockSocket[],
  eventName: string,
  ...args: unknown[]
) => {
  for (const receiver of receivers) {
    try {
      return await invokeWithAck(receiver, eventName, ...args);
    } catch (error) {
      if (isEventHandlerOptOutError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`No recipient handled ${eventName}`);
};

class SidebarTestEventHandler extends EventHandler<"sidebar", "workspace"> {
  protected readonly selfName = "sidebar" as const;
  protected readonly handlerMethods = {
    onCardsAroundCursor: async (_cards: CardData[]) => {},
    onSessionShutdown: async () => {},
  } satisfies HandlerMethodMap<"sidebar", "workspace">;
}

class WorkspaceTestEventHandler extends EventHandler<"workspace", "sidebar"> {
  protected readonly selfName = "workspace" as const;
  receivedCard: CardData | null = null;

  protected readonly handlerMethods = {
    onNavigateTo: async (card: CardData) => {
      this.receivedCard = card;
    },
    onRequestCardsAroundCursor: async () => {},
    onSessionShutdown: async () => {},
  } satisfies HandlerMethodMap<"workspace", "sidebar">;
}

class WorkspaceMiroRequestEventHandler extends EventHandler<
  "workspace",
  "miro"
> {
  protected readonly selfName = "workspace" as const;
  protected readonly handlerMethods = {
    onBoardUpdate: async (_board) => {},
    onSelectedCards: async (_cards) => {},
    onNavigateTo: async (_card) => {},
    onCard: async (_event) => {},
  } satisfies HandlerMethodMap<"workspace", "miro">;
}

class MiroWorkspaceResponseEventHandler extends EventHandler<
  "miro",
  "workspace"
> {
  protected readonly selfName = "miro" as const;
  protected readonly handlerMethods = {
    onGetBoardInfo: async (_boardId: string) => ({
      boardId: "board-1",
      name: "Board 1",
      cards: {},
    }),
    onSelectCard: async (_boardId: string, _miroLink: string) => true,
    onCardStatus: async (_boardId: string, _data) => true,
    onCards: async (_boardId: string) => [],
    onSessionShutdown: async () => {},
  } satisfies HandlerMethodMap<"miro", "workspace">;
}

class OptOutMiroWorkspaceResponseEventHandler extends EventHandler<
  "miro",
  "workspace"
> {
  protected readonly selfName = "miro" as const;
  protected readonly handlerMethods = {
    onGetBoardInfo: async (_boardId: string) => this.optOut(),
    onSelectCard: async (_boardId: string, _miroLink: string) => this.optOut(),
    onCardStatus: async (_boardId: string, _data) => this.optOut(),
    onCards: async (_boardId: string) => this.optOut(),
    onSessionShutdown: async () => {},
  } satisfies HandlerMethodMap<"miro", "workspace">;
}

suite("Encrypted EventHandler transport", () => {
  test("emitEncrypted sends hidden envelopes that dispatch to handler methods", async () => {
    const senderSocket = new MockSocket();
    const receiverSocket = new MockSocket();
    const session = zAppExplorerSession.parse({
      sessionId: crypto.randomUUID(),
      hostIndex: 0,
      key: randomHex(512),
      insiders: false,
    });

    const sender = SidebarTestEventHandler.create(senderSocket as never);
    sender.attachSession(session);

    const receiver = WorkspaceTestEventHandler.create(receiverSocket as never);
    receiver.attachSession(session);

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

    const session = zAppExplorerSession.parse({
      sessionId: crypto.randomUUID(),
      hostIndex: 0,
      key: randomHex(512),
      insiders: false,
    });
    MiroWorkspaceResponseEventHandler.create(
      responderSocket as never,
    ).attachSession(session);

    const requester = WorkspaceMiroRequestEventHandler.create(
      requesterSocket as never,
    );
    requester.attachSession(session);

    const result = await requester.emitEncrypted(
      "selectCard",
      "board-1",
      "link",
    );

    assert.strictEqual(result, true);
  });

  test("ack relay can skip sockets that opt out", async () => {
    const firstResponderSocket = new MockSocket();
    const secondResponderSocket = new MockSocket();
    OptOutMiroWorkspaceResponseEventHandler.create(
      firstResponderSocket as never,
    );
    MiroWorkspaceResponseEventHandler.create(secondResponderSocket as never);

    const result = await relayAckEvent(
      [firstResponderSocket, secondResponderSocket],
      "selectCard",
      "board-1",
      "link",
    );

    assert.strictEqual(result, true);
  });

  test("sidebar client handler replays the latest cardsAroundCursor to late listeners", async () => {
    const sidebarSocket = new MockSocket();
    const sidebarEventHandler = SidebarClientEventHandler.create(
      sidebarSocket as never,
    );

    const cards: CardData[] = [
      {
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
      },
    ];

    sidebarSocket.emit("cardsAroundCursor", cards);
    await new Promise((resolve) => setTimeout(resolve, 0));

    let receivedCards: CardData[] | undefined;
    sidebarEventHandler.cardsAroundCursorEvent((value) => {
      receivedCards = value as CardData[];
    });

    assert.deepStrictEqual(receivedCards, cards);
  });
});
