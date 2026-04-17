import { ContextConsumer } from "@lit/context";
import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

import { CardData } from "../card-data";
import { createDebug } from "../utils/create-debug";

import { socketContext } from "./socket-context";

import { SidebarSocket } from "@/event-handlers/types";
const debug = createDebug("app-explorer:cards-around-cursor:controller");

export class CardsAroundCursorController implements ReactiveController {
  #host: ReactiveControllerHost;
  value: CardData[] | undefined;
  #socket: SidebarSocket | undefined;
  #subscribedSocket: SidebarSocket | undefined;
  private _socketContext?: ContextConsumer<
    {
      __context__: SidebarSocket;
    },
    LitElement
  >;

  constructor(host: LitElement, socket?: SidebarSocket) {
    (this.#host = host).addController(this);

    this.#socket = socket;
    if (!socket) {
      this._socketContext = new ContextConsumer(host, {
        context: socketContext,
      });
    }
  }

  get socket() {
    return this.#socket || this._socketContext?.value;
  }

  private onValueChange = (newValue: CardData[]): void => {
    debug("symbolsChanged event", newValue.length);
    this.value = newValue;
    this.#host.requestUpdate();
  };

  hostConnected(): void {
    this.subscribe();
  }

  hostUpdated() {
    this.subscribe();
  }

  private subscribe(): void {
    const socket = this.socket;

    // Nothing to do if we are already listening on this socket instance.
    if (socket && this.#subscribedSocket === socket) {
      return;
    }

    // If the socket instance changed, detach from the previous one first.
    if (this.#subscribedSocket) {
      this.#subscribedSocket.off("cardsAroundCursor", this.onValueChange);
      this.#subscribedSocket = undefined;
    }

    if (socket) {
      socket.on("cardsAroundCursor", this.onValueChange);
      this.#subscribedSocket = socket;
      socket.emit("requestCardsAroundCursor");
      debug("listening for cardsAroundCursor");
      return;
    }
  }
  hostDisconnected(): void {
    if (this.#subscribedSocket) {
      this.#subscribedSocket.off("cardsAroundCursor", this.onValueChange);
      this.#subscribedSocket = undefined;
    }
  }
}
