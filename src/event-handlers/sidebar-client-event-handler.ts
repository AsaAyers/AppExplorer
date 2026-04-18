import { CardData } from "../card-data";

import { type HandlerMethodMap, SidebarSocket } from "./types";

import { EventHandler } from "@/event-handlers/event-handler";

class ListenerCollection<T> {
  #listeners = new Set<(value: T) => void>();

  subscribe(listener: (value: T) => void) {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }

  fire(value: T) {
    for (const listener of this.#listeners) {
      listener(value);
    }
  }

  clear() {
    this.#listeners.clear();
  }
}

export class SidebarClientEventHandler extends EventHandler<
  "sidebar",
  "workspace"
> {
  protected readonly selfName = "sidebar" as const;
  readonly #socket: SidebarSocket;
  readonly #cardsAroundCursorEmitter = new ListenerCollection<CardData[]>();
  readonly #sessionShutdownEmitter = new ListenerCollection<void>();
  #latestCardsAroundCursor?: CardData[];

  constructor(socket: SidebarSocket) {
    super(socket as never);
    this.#socket = socket;
  }

  get latestCardsAroundCursor() {
    return this.#latestCardsAroundCursor;
  }

  get socketClient() {
    return this.#socket;
  }

  get cardsAroundCursorEvent() {
    return (listener: (cards: CardData[]) => void) => {
      if (this.#latestCardsAroundCursor) {
        listener(this.#latestCardsAroundCursor);
      }
      return this.#cardsAroundCursorEmitter.subscribe(listener);
    };
  }

  get sessionShutdownEvent() {
    return this.#sessionShutdownEmitter.subscribe.bind(
      this.#sessionShutdownEmitter,
    );
  }

  protected readonly handlerMethods = {
    onCardsAroundCursor: async (cards: CardData[]) => {
      this.#latestCardsAroundCursor = cards;
      this.#cardsAroundCursorEmitter.fire(cards);
    },
    onSessionShutdown: async () => {
      this.#latestCardsAroundCursor = undefined;
      this.#sessionShutdownEmitter.fire();
    },
    onDisconnect: async () => {
      this.#latestCardsAroundCursor = undefined;
    },
  } satisfies HandlerMethodMap<"sidebar", "workspace"> & {
    onConnect?: () => void | Promise<void>;
    onDisconnect?: (...args: unknown[]) => void | Promise<void>;
  };

  override dispose() {
    this.#cardsAroundCursorEmitter.clear();
    this.#sessionShutdownEmitter.clear();
    super.dispose();
  }
}
