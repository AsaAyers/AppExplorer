import {
  io as socketIO,
  type ManagerOptions,
  type SocketOptions,
} from "socket.io-client";

import { AppEventHandler, NamedSocket } from "@/extension/app-event-handler";
import { makeNavigationHandler } from "@/extension/commands/navigate";
import { goToCardCode } from "@/extension/go-to-card-code";
import { LocationFinder } from "@/extension/location-finder";
import { SymbolEvents, CardData } from "@/extension/types";
import { EventEmitter } from "@/extension/utils/event-emitter";
import { hexToKey } from "@/extension/utils/hex-to-key";
import {
  getVSCodeAdapter,
  LocationLink,
  UriType,
  type VSCodeAdapter,
} from "@/extension/vscode-adapter/adapter";
import { WorkspaceCardStorage } from "@/workspace-card-storage";
import { debugLog } from "@/utils/debug-log";

const log = debugLog("handler:workspce");

const defaultSocketOptions: Partial<ManagerOptions & SocketOptions> = {
  retries: 3,
  withCredentials: true,
  auth: { role: "workspace" },
  timeout: 1000,
  ackTimeout: 5000,
  reconnectionAttempts: 5,
};

export type WorkspaceSocketFactory = (
  sessionId: string,
  options?: Partial<ManagerOptions & SocketOptions>,
) => NamedSocket<"workspace">;

export type ResolveRelativePath = (uri: UriType) => string | undefined;

export type ResolveGitHubUrl = (
  locationLink: LocationLink,
) => Promise<string | null>;

export type WorkspaceSessionSocketOptions = {
  host?: string;
  socketFactory?: WorkspaceSocketFactory;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
  vscodeAdapter?: VSCodeAdapter;
  resolveRelativePath?: ResolveRelativePath;
  resolveGitHubUrl?: ResolveGitHubUrl;
};

export class WorkspaceHandler extends AppEventHandler<"workspace"> {
  public baseUrl = "appexplorer.dev";
  cardStorage: WorkspaceCardStorage;
  locationFinder: Pick<LocationFinder, "findCardDestination">;
  public readonly symbolTracker: EventEmitter<SymbolEvents>;
  vscodeAdapter: VSCodeAdapter;
  private readonly resolveRelativePath: ResolveRelativePath;
  private readonly resolveGitHubUrl: ResolveGitHubUrl;
  private hexKey: string;

  constructor(
    sessionId: string,
    hexKey: string,
    isDev: boolean,
    cardStorage: WorkspaceCardStorage,
    locationFinder: Pick<LocationFinder, "findCardDestination">,
    options: WorkspaceSessionSocketOptions = {},
  ) {
    super("workspace", "socket");
    this.hexKey = hexKey;
    this.baseUrl = isDev
      ? "https://dev.appexplorer.dev"
      : "https://appexplorer.dev";
    this.baseUrl = options.host ?? this.baseUrl;
    this.key = hexToKey(this.hexKey);
    this.cardStorage = cardStorage;
    this.locationFinder = locationFinder;

    const socketFactory = options.socketFactory ?? this.socketFactory;

    this.socket = this.attachSocket(
      socketFactory(sessionId, {
        ...defaultSocketOptions,
        ...options.socketOptions,
      }),
    );

    this.vscodeAdapter = options.vscodeAdapter ?? getVSCodeAdapter();

    this.symbolTracker = this.vscodeAdapter.getDocumentSymbolTracker();

    this.resolveRelativePath =
      options.resolveRelativePath ?? ((uri) => String(uri));
    this.resolveGitHubUrl = options.resolveGitHubUrl ?? (async () => null);

    this.trackSymbols();
    this.subscriptions.push(
      this.vscodeAdapter.registerCommand(
        "app-explorer.navigate",
        makeNavigationHandler(cardStorage, this),
      ),
    );

    log("Connecting socket");
    this.socket.connect();
  }

  socketFactory = (
    sessionId: string,
    options: Partial<ManagerOptions & SocketOptions> | undefined,
  ) =>
    socketIO(`${this.baseUrl}/session/${sessionId}`, {
      ...defaultSocketOptions,
      ...options,
    });

  dispose() {
    super.dispose();
  }

  emitCardsAroundCursor(path: string, cards: CardData[] | null) {
    this.emit("cardsAroundCursor", {
      type: "cardsAroundCursor",
      source: "background",
      path,
      cards,
    });
  }

  handlers = this.makeHandlers({
    onCardSelected: async () => {
      // TODO: remove OnCardSelected and only trigger navigateToCode from
      // MiroBackground.
    },
    onNavigateToCode: async (
      event: {
        cardData: Pick<CardData, "symbol" | "path">;
      },
      callback,
    ) => {
      const cardData = event.cardData;
      log("Navigating to card", { cardData });
      const dest = await this.locationFinder.findCardDestination(cardData);

      const success = await goToCardCode(cardData);
      const status = success ? "connected" : "disconnected";

      let link = null;
      if (success) {
        if (dest) {
          const activeEditor = this.vscodeAdapter.activeTextEditor;
          if (activeEditor) {
            const uri = activeEditor.document.uri;
            const selection =
              status === "connected"
                ? this.vscodeAdapter.newRange(
                    activeEditor.selection.start,
                    activeEditor.selection.end,
                  )
                : this.vscodeAdapter.newRange(
                    this.vscodeAdapter.newPosition(0, 0),
                    this.vscodeAdapter.newPosition(0, 0),
                  );

            const def: LocationLink = {
              targetUri: uri,
              targetRange: selection,
            };
            link = await this.resolveGitHubUrl(def);
          }
        }
      }

      callback({ success, link });
    },
    onEncryptedEvent: (e, done) =>
      this.handleEncryptedEvent(this.key!, e, done),
  });

  trackSymbols() {
    this.subscriptions.push(this.symbolTracker);
    this.subscriptions.push(
      this.symbolTracker.event((event) => {
        log("[Event]", event.type);
        if (event.type === "symbolsChanged") {
          this.emit("cardsAroundCursor", {
            type: "cardsAroundCursor",
            path: this.resolveRelativePath(event.uri) ?? String(event.uri),
            cards: event.symbols,
            source: "background",
          });
        }
      }),
    );

    setTimeout(() => {
      this.symbolTracker.fire({ type: "symbolRequest" });
    }, 250);
  }
}
