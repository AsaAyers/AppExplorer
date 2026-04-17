import { CardData } from "../card-data";

import { type HandlerMethodMap, SidebarSocket } from "./types";

import { EventHandler } from "@/event-handlers/event-handler";

type CardsAroundCursorListener = (cards: CardData[]) => void;
type SessionShutdownListener = () => void;

export class SidebarClientEventHandler extends EventHandler<
  "sidebar",
  "workspace"
> {
  protected readonly selfName = "sidebar" as const;
  #cardsAroundCursorListeners = new Set<CardsAroundCursorListener>();
  #sessionShutdownListeners = new Set<SessionShutdownListener>();

  onCardsAroundCursor(listener: CardsAroundCursorListener) {
    this.#cardsAroundCursorListeners.add(listener);
    return () => {
      this.#cardsAroundCursorListeners.delete(listener);
    };
  }

  onSessionShutdown(listener: SessionShutdownListener) {
    this.#sessionShutdownListeners.add(listener);
    return () => {
      this.#sessionShutdownListeners.delete(listener);
    };
  }

  protected readonly handlerMethods = {
    onCardsAroundCursor: async (cards: CardData[]) => {
      this.#cardsAroundCursorListeners.forEach((listener) => {
        listener(cards);
      });
    },
    onSessionShutdown: async () => {
      this.#sessionShutdownListeners.forEach((listener) => {
        listener();
      });
    },
  } satisfies HandlerMethodMap<"sidebar", "workspace">;
}

export class SidebarSocketBridge {
  #cardsAroundCursorListeners = new Map<
    CardsAroundCursorListener,
    () => void
  >();
  #sessionShutdownListeners = new Map<SessionShutdownListener, () => void>();
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

    if (eventName === "sessionShutdown") {
      this.#sessionShutdownListeners.set(
        listener as SessionShutdownListener,
        this.eventHandler.onSessionShutdown(
          listener as SessionShutdownListener,
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

    if (eventName === "sessionShutdown") {
      this.#sessionShutdownListeners.get(
        listener as SessionShutdownListener,
      )?.();
      this.#sessionShutdownListeners.delete(
        listener as SessionShutdownListener,
      );
      return this;
    }

    this.socket.off(eventName as any, listener as any);
    return this;
  }
}
