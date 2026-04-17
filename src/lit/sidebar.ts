import "@webcomponents/webcomponentsjs";
import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import invariant from "tiny-invariant";

import { createDebug } from "../utils/create-debug";

import "./app-card";
import { AppElement } from "./app-element";
import "./cards-around-cursor";
import { mirotoneStyles, rawMirotoneStyles } from "./mirotone";
import "./onboarding";
import { SocketProvider } from "./socket-context";

import {
  AppExplorerSession,
  makeSessionUrl,
  parseSessionUri,
} from "@/app-explorer-session";
import { randomHex } from "@/utils/to-hex";
// Mirotone must be loaded on the host page to set all the CSS variables.
document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${rawMirotoneStyles}</style>`,
);

const log = createDebug("app-explorer:miro:sidebar");

@customElement("app-explorer-sidebar")
export class SidebarElement extends AppElement {
  static styles = [
    mirotoneStyles,
    css`
      .card-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-medium);
        overflow-y: auto;
      }

      app-explorer-sidebar {
        display: flex;
        flex-direction: column;
        max-height: 100%;
      }

      .session-setup {
        display: flex;
        flex-direction: column;
        gap: var(--space-medium);
        padding: var(--space-large);
      }

      .commands {
        padding: 0 var(--space-medium);
      }
    `,
  ];

  #disposeSessionShutdownListener?: () => void;
  private _socketProvider = new SocketProvider(this, (socket) => {
    this.#disposeSessionShutdownListener?.();
    socket.on("sessionShutdown", this.handleSessionShutdown);
    this.#disposeSessionShutdownListener = () => {
      socket.off("sessionShutdown", this.handleSessionShutdown);
    };
  });

  private makeFreshSession(base: AppExplorerSession = this.session) {
    return {
      sessionId: crypto.randomUUID(),
      key: randomHex(512),
      insiders: base.insiders,
      hostIndex: base.hostIndex,
    };
  }

  private handleSessionShutdown = () => {
    log("Received session shutdown");
    this.#disposeSessionShutdownListener?.();
    this.#disposeSessionShutdownListener = undefined;
    this._socketProvider.setHostIndex(undefined);
    this._socketProvider.disconnect();
    this.session = this.makeFreshSession();
  };

  startSession = (event: PointerEvent) => {
    const link = event.currentTarget;
    invariant(
      link instanceof HTMLAnchorElement,
      "Session link must be an anchor",
    );
    const href = link.href;
    const session = parseSessionUri(href);
    this.session = session;
    for (let i = 0; i < (window.top?.length ?? 0); i++) {
      window.top?.[i].postMessage(
        {
          type: "attachSession",
          session,
        },
        window.origin,
      );
    }
    this._socketProvider.setHostIndex(session);
    if (globalThis.captureSessionLink) {
      globalThis.captureSessionLink(makeSessionUrl(session));
      event.preventDefault();
    }
  };

  @property({
    type: Object,
  })
  session: AppExplorerSession = this.makeFreshSession({
    sessionId: crypto.randomUUID(),
    key: randomHex(512),
    insiders: false,
    hostIndex: 0,
  });

  setInsiders(value: boolean) {
    this.session = {
      ...this.session,
      insiders: value,
    };
  }

  override disconnectedCallback(): void {
    this.#disposeSessionShutdownListener?.();
    this.#disposeSessionShutdownListener = undefined;
    super.disconnectedCallback();
  }

  render() {
    if (!this._socketProvider.value) {
      return html`<div class="session-setup">
        <a
          href="${makeSessionUrl(this.session)}"
          @click=${(e: PointerEvent) => this.startSession(e)}
        >
          Start VSCode session
        </a>
        <label>
          <input
            type="checkbox"
            ?checked=${this.session.insiders}
            @change=${(e: Event) =>
              this.setInsiders((e.target as HTMLInputElement).checked)}
          />
          Use VSCode Insiders
        </label>
        <app-explorer-cards-around-cursor></app-explorer-cards-around-cursor>
      </div> `;
    }

    return html`
      <app-explorer-cards-around-cursor></app-explorer-cards-around-cursor>
    `;
  }
}
