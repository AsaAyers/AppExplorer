import { CardData } from "../EventTypes";

import { type HandlerMethodMap, SidebarSocket } from "./types";

import { EventHandler } from "@/event-handlers/event-handler";

type CardsAroundCursorListener = (cards: CardData[]) => void;

export class SidebarClientEventHandler extends EventHandler<
  "sidebar",
  "workspace"
> {
  protected readonly selfName = "sidebar" as const;
  #cardsAroundCursorListeners = new Set<CardsAroundCursorListener>();

  onCardsAroundCursor(listener: CardsAroundCursorListener) {
    this.#cardsAroundCursorListeners.add(listener);
    return () => {
      this.#cardsAroundCursorListeners.delete(listener);
    };
  }

  protected readonly handlerMethods = {
    onCardsAroundCursor: async (cards: CardData[]) => {
      this.#cardsAroundCursorListeners.forEach((listener) => {
        listener(cards);
      });
    },
  } satisfies HandlerMethodMap<"sidebar", "workspace">;
}

export class SidebarSocketBridge {
  #cardsAroundCursorListeners = new Map<
    CardsAroundCursorListener,
    () => void
  >();
  private readonly socket: SidebarSocket;
  private readonly eventHandler: SidebarClientEventHandler;

  constructor(socket: SidebarSocket, eventHandler: SidebarClientEventHandler) {
    this.socket = socket;
    this.eventHandler = eventHandler;
  }

  get connected() {
    return this.socket.connected;
  }

  get disconnected() {
    return this.socket.disconnected;
  }

  get recovered() {
    return this.socket.recovered;
  }

  connect() {
    return this.socket.connect();
  }

  emit(...args: Parameters<typeof this.socket.emit>) {
    return (this.socket.emit as (...socketArgs: unknown[]) => unknown)(...args);
  }

  emitWithAck(...args: Parameters<typeof this.socket.emitWithAck>) {
    return this.socket.emitWithAck(...args);
  }

  on(eventName: string, listener: (...args: unknown[]) => unknown) {
    if (eventName === "cardsAroundCursor") {
      this.#cardsAroundCursorListeners.set(
        listener as CardsAroundCursorListener,
        this.eventHandler.onCardsAroundCursor(
          listener as CardsAroundCursorListener,
        ),
      );
      return this;
    }

    this.socket.on(eventName as any, listener as any);
    return this;
  }

  off(eventName: string, listener: (...args: unknown[]) => unknown) {
    if (eventName === "cardsAroundCursor") {
      this.#cardsAroundCursorListeners.get(
        listener as CardsAroundCursorListener,
      )?.();
      this.#cardsAroundCursorListeners.delete(
        listener as CardsAroundCursorListener,
      );
      return this;
    }

    this.socket.off(eventName as any, listener as any);
    return this;
  }
}
