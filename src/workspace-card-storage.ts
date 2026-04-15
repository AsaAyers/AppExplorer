import { io as socketIO } from "socket.io-client";
import * as vscode from "vscode";

import { CardData } from "./EventTypes";
import { BoardInfo, CardStorage, StorageAdapter } from "./card-storage";
import { getDocumentSymbolTracker } from "./document-symbol-tracker";
import { WorkspaceSocket } from "./event-handlers/types";
import { WorkspaceEventHandler } from "./event-handlers/workspace-event-handler";
import { HandlerContext, selectRangeInEditor } from "./extension";
import { getGitHubUrl } from "./get-github-url";
import { APP_EXPLORER_SESSION_NAMESPACE } from "./session-transport";

export class WorkspaceCardStorage
  extends CardStorage
  implements vscode.Disposable
{
  public readonly socket: WorkspaceSocket;
  readonly #eventHandler: WorkspaceEventHandler;
  readonly #symbolTracker;
  readonly #symbolTrackerSubscription: vscode.Disposable;

  #handlerContext: Pick<HandlerContext, "locationFinder">;
  constructor(
    storageAdapter: StorageAdapter,
    serverUrl: string,
    handlerContext: Pick<HandlerContext, "locationFinder">,
  ) {
    super(storageAdapter);
    this.#handlerContext = handlerContext;
    this.debug = this.debug.extend("workspace");
    this.#symbolTracker = getDocumentSymbolTracker(
      this.#handlerContext.locationFinder,
    );

    const wsUrl = `${serverUrl}${APP_EXPLORER_SESSION_NAMESPACE}`;
    const connectionTimeout = 10000;

    const socket = socketIO(wsUrl, {
      auth: {
        role: "workspace",
      },
      transports: ["websocket"],
      timeout: connectionTimeout,
      reconnection: true,
      forceNew: false,
    }) as WorkspaceSocket;
    this.socket = socket;
    this.#eventHandler = WorkspaceEventHandler.create(socket, this);

    this.#symbolTrackerSubscription = this.#symbolTracker.event((event) => {
      if (event.type === "symbolsChanged") {
        void this.#eventHandler
          .emitEncrypted("cardsAroundCursor", event.symbols)
          .catch((error) => {
            this.debug("Failed to emit cardsAroundCursor", {
              error: String(error),
            });
          });
      }
    });

    socket.on("disconnect", (reason) => {
      try {
        this.emit("disconnect", { type: "disconnect" });
      } catch (e) {
        this.debug("Error handling disconnect event", { error: String(e) });
      }

      if (reason === "transport close") {
        this.debug("retry");
        const i = setInterval(() => {
          this.debug(
            "Reconnecting socket...",
            socket.connected,
            socket.disconnected,
            socket.recovered,
          );
          if (socket.connected) {
            clearInterval(i);
            void this.onConnect();
            return;
          }
          socket.connect();
          socket.io.connect();
        }, 1000);
      } else {
        this.debug("Socket disconnected");
      }
    });
    // @ts-expect-error Reconnect event is missing from types
    socket.on("reconnect", (arg: unknown) => {
      this.debug("on reconnect", { arg });
    });

    socket.on("connect", this.onConnect);
  }
  onConnect = async () => {
    try {
      const info = await this.#eventHandler.emit("getBoardInfo", "");
      this.connectedBoardSet.add(info.boardId);
      this.boardUpdate(info);
      this.#symbolTracker.fire({ type: "symbolRequest" });
    } catch (error) {
      this.debug("No board info available on connect", { error });
    }
  };

  override dispose(): void {
    this.#symbolTrackerSubscription.dispose();
    this.socket.disconnect();
    super.dispose();
  }

  async disconnectBoard(boardId: string) {
    return super.disconnectBoard(boardId, false);
  }

  /**
   * TODO: Remove this function and associated event
   */
  log() {
    //  Events already log through the transport debug path.
  }
  selectedCards(cards: CardData[]): void {
    this.debug("selectedCards()", { cards });
    return super.selectedCards(cards);
  }
  connectedBoards(boardIds: string[]) {
    this.debug("connectedBoards())", { boardIds });
    this.connectedBoardSet = new Set(boardIds);
    this.emit("connectedBoards", {
      type: "connectedBoards",
      boardIds: boardIds,
    });
  }
  boardUpdate(board: BoardInfo | null) {
    this.debug(`Received boardUpdate: `, board);
    if (board) {
      this.connectedBoardSet.add(board.boardId);
      this.setBoardName(board.boardId, board.name);
      this.setBoardCards(board.boardId, Object.values(board.cards));
    }
  }
  async cardUpdate(url: string, card: CardData | null) {
    this.debug("Received card update", { url, card });
    try {
      if (card) {
        await this.setCard(card.boardId, card);
      } else {
        this.deleteCardByLink(url);
      }
    } catch (error) {
      this.debug("Error handling cardUpdate event", {
        error: String(error),
        url,
        card,
      });
    }
  }

  async card({ url, card }: { url: string; card: CardData | null }) {
    this.debug("Received card event", { url, card });
    try {
      if (card) {
        const board = this.getBoard(card.boardId);
        if (!board) {
          await this.addBoard(card.boardId, `Board ${card.boardId}`);
        }
        await this.setCard(card.boardId, card);
      } else {
        this.deleteCardByLink(url);
      }
    } catch (error) {
      this.debug("Error handling card event", {
        error: String(error),
        url,
        card,
      });
    }
  }

  public navigateTo = async (card: CardData, preview = false) => {
    this.debug("Navigating to card", { card, preview });
    const dest =
      await this.#handlerContext.locationFinder.findCardDestination(card);

    const success = await goToCardCode(this.#handlerContext, card, preview);
    const status = success ? "connected" : "disconnected";

    if (card.miroLink) {
      let codeLink: string | null = null;
      if (dest) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          const uri = activeEditor.document.uri;
          const selection =
            status === "connected"
              ? new vscode.Range(
                  activeEditor.selection.start,
                  activeEditor.selection.end,
                )
              : new vscode.Range(
                  new vscode.Position(0, 0),
                  new vscode.Position(0, 0),
                );

          const def: vscode.LocationLink = {
            targetUri: uri,
            targetRange: selection,
          };
          codeLink = await getGitHubUrl(def);
        }
      }
      if (status !== card.status) {
        let updatedCard: CardData;

        if (card.type === "symbol") {
          updatedCard = {
            ...card,
            status,
            codeLink: codeLink ?? null,
          };
        } else {
          updatedCard = {
            ...card,
            status,
          };
        }

        try {
          await this.setCard(card.boardId, updatedCard);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("Board not found")
          ) {
            this.debug("Board not found in workspace, creating it", {
              boardId: card.boardId,
            });
            await this.addBoard(card.boardId, `Board ${card.boardId}`);
            await this.setCard(card.boardId, updatedCard);
          } else {
            throw error;
          }
        }
      }

      await this.#eventHandler.emit("cardStatus", card.boardId, {
        miroLink: card.miroLink,
        status,
        codeLink,
      });
    }
    this.debug("Returning from navigateTo", {
      connected: status === "connected",
    });
    return status === "connected";
  };
}

async function goToCardCode(
  context: Pick<HandlerContext, "locationFinder">,
  card: CardData,
  preview = false,
) {
  const symbol = await context.locationFinder.findCardDestination(card);

  if (symbol && "range" in symbol) {
    const editor = await vscode.window.showTextDocument(symbol.uri, {
      preview,
      preserveFocus: preview,
    });
    selectRangeInEditor(symbol.range, editor);
    return true;
  } else if (symbol) {
    await vscode.window.showTextDocument(symbol, {
      preview,
      preserveFocus: preview,
    });
    return false;
  }
  vscode.window.showWarningMessage(`Unable to open ${card.path}`);
  return false;
}
