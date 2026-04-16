import "@webcomponents/webcomponentsjs";
import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { createDebug } from "../utils/create-debug";

import "./app-card";
import { AppElement } from "./app-element";
import "./cards-around-cursor";
import { mirotoneStyles, rawMirotoneStyles } from "./mirotone";
import "./onboarding";
import { SocketProvider } from "./socket-context";

import { AppExplorerSession, makeSessionUrl } from "@/app-explorer-session";
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

  private _socketProvider = new SocketProvider(this);

  startSession = (event: PointerEvent, session: AppExplorerSession) => {
    this.session = session;
    this._socketProvider.setHostIndex(session);
    if (globalThis.captureSessionLink) {
      globalThis.captureSessionLink(makeSessionUrl(session));
      event.preventDefault();
    }
  };

  @property({
    type: Object,
  })
  session: AppExplorerSession = {
    sessionId: crypto.randomUUID(),
    key: crypto.randomUUID(),
    insiders: false,
    hostIndex: 1,
  };

  setInsiders(value: boolean) {
    this.session = {
      ...this.session,
      insiders: value,
    };
  }

  render() {
    if (!this._socketProvider.value) {
      return html`<div class="session-setup">
        <a
          href="${makeSessionUrl(this.session)}"
          @click=${(e: PointerEvent) => this.startSession(e, this.session)}
        >
          Start VSCode session
        </a>
        <a
          href="${makeSessionUrl({ ...this.session, hostIndex: 2 })}"
          @click=${(e: PointerEvent) =>
            this.startSession(e, { ...this.session, hostIndex: 2 })}
        >
          Start VSCode session (host 2 dev)
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
