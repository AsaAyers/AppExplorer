import { io as socketIO } from "socket.io-client";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import { AppExplorerSession, getSocketUrl } from "./app-explorer-session";
import { CardData } from "./card-data";
import { BoardInfo, CardStorage, StorageAdapter } from "./card-storage";
import { getDocumentSymbolTracker } from "./document-symbol-tracker";
import { WorkspaceSocket } from "./event-handlers/types";
import { WorkspaceEventHandler } from "./event-handlers/workspace-event-handler";
import { HandlerContext, selectRangeInEditor } from "./extension";
import { getGitHubUrl } from "./get-github-url";
import { getSocketClientOptions } from "./socket-client-options";

export class WorkspaceCardStorage
  extends CardStorage
  implements vscode.Disposable
{
  public socket: WorkspaceSocket | null = null;
  #eventHandler?: WorkspaceEventHandler;
  readonly #symbolTracker;
  readonly #symbolTrackerSubscription: vscode.Disposable;
  #session: undefined | AppExplorerSession;
  #lastCardsAroundCursorKey?: string;
  #pendingInitialCardsAroundCursor = false;
  #initialCardsAroundCursorRetry?: NodeJS.Timeout;

  #handlerContext: Pick<HandlerContext, "locationFinder">;
  constructor(
    storageAdapter: StorageAdapter,
    handlerContext: Pick<HandlerContext, "locationFinder">,
  ) {
    super(storageAdapter);
    this.#handlerContext = handlerContext;
    this.log = this.log.extend("workspace");
    this.#symbolTracker = getDocumentSymbolTracker(
      this.#handlerContext.locationFinder,
    );

    this.#symbolTrackerSubscription = this.#symbolTracker.event((event) => {
      if (event.type === "symbolsChanged" && this.#eventHandler?.hasSession()) {
        this.emitCardsAroundCursor(event.symbols, event.force);
      }
    });
  }

  attachSession(session: AppExplorerSession) {
    if (session === this.#session) {
      return;
    }

    this.socket?.disconnect();
    this.socket?.removeAllListeners();
    this.#session = session;
    this.#lastCardsAroundCursorKey = undefined;
    this.#pendingInitialCardsAroundCursor = true;
    if (this.#initialCardsAroundCursorRetry) {
      clearTimeout(this.#initialCardsAroundCursorRetry);
      this.#initialCardsAroundCursorRetry = undefined;
    }
    const socket = this.createSocket(session);
    this.socket = socket;
    this.attachSocketListeners(socket);
  }

  private serializeCardsAroundCursor(cards: CardData[]) {
    return JSON.stringify(
      cards.map(({ path, symbol, title, codeLink }) => [
        path,
        symbol,
        title,
        codeLink,
      ]),
    );
  }

  private emitCardsAroundCursor(cards: CardData[], force = false) {
    if (!this.#eventHandler?.hasSession()) {
      return;
    }

    const payloadKey = this.serializeCardsAroundCursor(cards);
    if (!force && payloadKey === this.#lastCardsAroundCursorKey) {
      return;
    }

    this.#lastCardsAroundCursorKey = payloadKey;
    this.log("(cards_around_cursor_send)", "cards:", cards.length);
    void this.#eventHandler
      .emitEncrypted("cardsAroundCursor", cards)
      .catch((error) => {
        this.log("Failed to emit cardsAroundCursor", {
          error: String(error),
        });
      });
  }

  requestCurrentCardsAroundCursor() {
    this.#symbolTracker.fire({ type: "symbolRequest" });
  }

  private createSocket(session: AppExplorerSession, connectionTimeout = 10000) {
    this.#session = session;
    const socket = socketIO(getSocketUrl(this.#session), {
      auth: {
        role: "workspace",
      },
      autoConnect: false,
      transports: ["websocket"],
      timeout: connectionTimeout,
      reconnection: true,
      forceNew: false,
      ...getSocketClientOptions(this.#session),
    }) as WorkspaceSocket;

    this.#eventHandler?.dispose();
    this.#eventHandler = WorkspaceEventHandler.create(socket, this);
    this.#eventHandler.attachSession(session);
    return socket;
  }

  private attachSocketListeners(socket: WorkspaceSocket) {
    socket.on("disconnect", (reason) => {
      try {
        this.emit("disconnect", { type: "disconnect" });
      } catch (e) {
        this.log("Error handling disconnect event", { error: String(e) });
      }

      if (reason === "transport close") {
        this.log("(workspace_socket_retry)");
        const i = setInterval(() => {
          this.log(
            "(workspace_socket_reconnecting)",
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
        this.log("(workspace_socket_disconnect)");
      }
    });
    // @ts-expect-error Reconnect event is missing from types
    socket.on("reconnect", (arg: unknown) => {
      this.log("(workspace_socket_reconnect)", { arg });
    });

    socket.once("connect", this.onConnect);
  }
  onConnect = async () => {
    try {
      invariant(
        this.#eventHandler,
        "Event handler should be initialized on connect",
      );
      const info = await this.#eventHandler.emit("getBoardInfo", "");
      this.connectedBoardSet.add(info.boardId);
      this.log("(workspace_socket_connect)", "boardId:", info.boardId);
      this.boardUpdate(info);
    } catch (error) {
      this.log("No board info available on connect", { error });
    }
  };

  override dispose(): void {
    this.#symbolTrackerSubscription.dispose();
    if (this.#initialCardsAroundCursorRetry) {
      clearTimeout(this.#initialCardsAroundCursorRetry);
      this.#initialCardsAroundCursorRetry = undefined;
    }
    this.socket?.disconnect();
    super.dispose();
  }

  async disconnectSession() {
    if (this.socket?.connected && this.#eventHandler) {
      await this.#eventHandler.emit("sessionShutdown");
    }
    this.socket?.disconnect();
    this.#lastCardsAroundCursorKey = undefined;
    this.#pendingInitialCardsAroundCursor = false;
    if (this.#initialCardsAroundCursorRetry) {
      clearTimeout(this.#initialCardsAroundCursorRetry);
      this.#initialCardsAroundCursorRetry = undefined;
    }
    this.connectedBoardSet.clear();
    this.clear();
    this.selectedCards([]);
    this.emit("connectedBoards", {
      type: "connectedBoards",
      boardIds: [],
    });
  }

  async disconnectBoard(boardId: string) {
    return super.disconnectBoard(boardId, false);
  }

  selectedCards(cards: CardData[]): void {
    this.log("selectedCards()", { cards });
    return super.selectedCards(cards);
  }
  connectedBoards(boardIds: string[]) {
    this.log("connectedBoards())", { boardIds });
    this.connectedBoardSet = new Set(boardIds);
    this.emit("connectedBoards", {
      type: "connectedBoards",
      boardIds: boardIds,
    });
  }
  boardUpdate(board: BoardInfo | null) {
    this.log("(board_update)", board);
    if (board) {
      this.connectedBoardSet.add(board.boardId);
      this.setBoardName(board.boardId, board.name);
      this.setBoardCards(board.boardId, Object.values(board.cards));
      if (this.#pendingInitialCardsAroundCursor) {
        this.#pendingInitialCardsAroundCursor = false;
        this.requestCurrentCardsAroundCursor();
        this.#initialCardsAroundCursorRetry = setTimeout(() => {
          this.requestCurrentCardsAroundCursor();
          this.#initialCardsAroundCursorRetry = undefined;
        }, 250);
      }
    }
  }
  async cardUpdate(url: string, card: CardData | null) {
    this.log("Received card update", { url, card });
    try {
      if (card) {
        await this.setCard(card.boardId, card);
      } else {
        this.deleteCardByLink(url);
      }
    } catch (error) {
      this.log("Error handling cardUpdate event", {
        error: String(error),
        url,
        card,
      });
    }
  }

  async card({ url, card }: { url: string; card: CardData | null }) {
    this.log("Received card event", { url, card });
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
      this.log("Error handling card event", {
        error: String(error),
        url,
        card,
      });
    }
  }

  public navigateTo = async (card: CardData, preview = false) => {
    this.log("Navigating to card", { card, preview });
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
            this.log("Board not found in workspace, creating it", {
              boardId: card.boardId,
            });
            await this.addBoard(card.boardId, `Board ${card.boardId}`);
            await this.setCard(card.boardId, updatedCard);
          } else {
            throw error;
          }
        }
      }

      await this.#eventHandler?.emit("cardStatus", card.boardId, {
        miroLink: card.miroLink,
        status,
        codeLink,
      });
    }
    this.log("Returning from navigateTo", {
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
