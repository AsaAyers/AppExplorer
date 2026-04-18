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
  #cardsAroundCursorListenerDisposers = new Map<
    CardsAroundCursorListener,
    () => void
  >();
  #sessionShutdownListenerDisposers = new Map<
    SessionShutdownListener,
    () => void
  >();
  #latestCardsAroundCursor?: CardData[];
  readonly #socket: SidebarSocket;

  constructor(socket: SidebarSocket) {
    super(socket as never);
    this.#socket = socket;
  }

  onCardsAroundCursor(listener: CardsAroundCursorListener) {
    this.#cardsAroundCursorListeners.add(listener);
    if (this.#latestCardsAroundCursor) {
      listener(this.#latestCardsAroundCursor);
    }
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

  onSocketEvent(eventName: string, listener: (...args: unknown[]) => unknown) {
    if (eventName === "cardsAroundCursor") {
      this.#cardsAroundCursorListenerDisposers.set(
        listener as CardsAroundCursorListener,
        this.onCardsAroundCursor(listener as CardsAroundCursorListener),
      );
      return this;
    }

    if (eventName === "sessionShutdown") {
      this.#sessionShutdownListenerDisposers.set(
        listener as SessionShutdownListener,
        this.onSessionShutdown(listener as SessionShutdownListener),
      );
      return this;
    }

    this.#socket.on(eventName as never, listener as never);
    return this;
  }

  offSocketEvent(eventName: string, listener: (...args: unknown[]) => unknown) {
    if (eventName === "cardsAroundCursor") {
      this.#cardsAroundCursorListenerDisposers.get(
        listener as CardsAroundCursorListener,
      )?.();
      this.#cardsAroundCursorListenerDisposers.delete(
        listener as CardsAroundCursorListener,
      );
      return this;
    }

    if (eventName === "sessionShutdown") {
      this.#sessionShutdownListenerDisposers.get(
        listener as SessionShutdownListener,
      )?.();
      this.#sessionShutdownListenerDisposers.delete(
        listener as SessionShutdownListener,
      );
      return this;
    }

    this.#socket.off(eventName as never, listener as never);
    return this;
  }

  toSidebarSocket(): SidebarSocket {
    const socket = this.#socket;

    return {
      connect: () => socket.connect(),
      disconnect: () => socket.disconnect(),
      emit: (...args: Parameters<typeof socket.emit>) =>
        (socket.emit as (...socketArgs: unknown[]) => unknown)(...args),
      emitWithAck: (...args: Parameters<typeof socket.emitWithAck>) =>
        socket.emitWithAck(args[0], ...args.slice(1)),
      get connected() {
        return socket.connected;
      },
      get disconnected() {
        return socket.disconnected;
      },
      get recovered() {
        return socket.recovered;
      },
      on: (eventName: string, listener: (...args: unknown[]) => unknown) =>
        this.onSocketEvent(eventName, listener) as unknown as SidebarSocket,
      off: (eventName: string, listener: (...args: unknown[]) => unknown) =>
        this.offSocketEvent(eventName, listener) as unknown as SidebarSocket,
    } as SidebarSocket;
  }

  protected readonly handlerMethods = {
    onCardsAroundCursor: async (cards: CardData[]) => {
      this.#latestCardsAroundCursor = cards;
      this.#cardsAroundCursorListeners.forEach((listener) => {
        listener(cards);
      });
    },
    onSessionShutdown: async () => {
      this.#latestCardsAroundCursor = undefined;
      this.#sessionShutdownListeners.forEach((listener) => {
        listener();
      });
    },
  } satisfies HandlerMethodMap<"sidebar", "workspace">;
}
