import { createServer } from "node:http";
import * as path from "node:path";

import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Namespace, Server } from "socket.io";
import invariant from "tiny-invariant";
import * as vscode from "vscode";

import {
  AppExplorerTag,
  WorkspaceInfo,
  WorkspaceRegistrationRequest,
  WorkspaceRegistrationResponse,
} from "../EventTypes";
import { BoardInfo, CardStorage, MemoryAdapter } from "../card-storage";
import { logger } from "../logger";
import { PortConfig } from "../port-config";
import { EventsFrom, EventsTo, RoutedEvents } from "../socket-events";
import { listenToAllEvents } from "../test/helpers/listen-to-all-events";
import { createDebug } from "../utils/create-debug";

import { SidebarServer } from "./sidebar-server";

import {
  EventHandler,
  HandlerMethodMap,
  MiroServerSocket,
  WorkspaceServerSocket,
} from "@/event-handler";

const debug = createDebug("app-explorer:server");
const debugEvents = debug.extend("events");

export class MiroServer {
  subscriptions = [] as vscode.Disposable[];
  httpServer: ReturnType<typeof createServer>;
  private workspaceNamespace: Namespace<
    EventsFrom<"workspace">,
    EventsTo<"workspace">
  >;
  private connectedWorkspaces = new Map<string, WorkspaceInfo>();

  private cardStorage = new CardStorage(new MemoryAdapter());
  #port: number;
  #workspaceHost: string;

  public static publicPath = path.join(__dirname, "public");
  constructor(
    workspaceHost: string,
    port: number = PortConfig.getServerPort(),
  ) {
    this.#port = port;
    this.#workspaceHost = workspaceHost;
    listenToAllEvents(this.cardStorage, (eventName, ...args) => {
      debug("Server storage event", eventName, ...args);
    });
    const app = express();
    this.httpServer = createServer(app);
    app.use(compression());
    app.use(
      "/",
      express.static(MiroServer.publicPath, {
        index: "index.html",
      }),
    );

    app.post("/reset", (_req, res) => {
      debug("Resetting server state");
      this.httpServer.close();
      return res.status(200).json({ success: true });
    });
    app.use(morgan("tiny"));

    // Add health check endpoint for server discovery
    app.get("/health", (_req, res) => {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    });

    app.get("/storage", (_req, res) => {
      res.json({
        workspaceHost: this.#workspaceHost,
        connectedBoards: this.cardStorage.getConnectedBoards(),
        cardsByBoard: this.cardStorage.getCardsByBoard(),
      });
    });

    const io = new Server<
      RoutedEvents<"miro", "workspace">,
      RoutedEvents<"workspace", "miro">
    >(this.httpServer);
    io.on("connection", this.onMiroConnection.bind(this));
    // Create workspace namespace
    this.workspaceNamespace = io.of("/workspace");
    this.setupWorkspaceNamespace();

    new SidebarServer(
      io.of("/sidebar"),
      this.cardStorage,
      this.connectedWorkspaces,
      this.workspaceNamespace,
    );
  }
  private setupWorkspaceNamespace() {
    // Handle workspace connections
    this.workspaceNamespace.on("connection", (socket) => {
      this.onWorkspaceConnection(socket);
    });

    // Set up global event listeners to broadcast to all workspaces
    this.cardStorage.on("connectedBoards", (event) => {
      this.workspaceNamespace.emit("connectedBoards", event.boardIds);
    });
    this.cardStorage.on("boardUpdate", (event) => {
      this.workspaceNamespace.emit("boardUpdate", event.board);
    });
    this.cardStorage.on("cardUpdate", (event) => {
      this.workspaceNamespace.emit("cardUpdate", event.miroLink, event.card);
    });
    this.cardStorage.on("selectedCards", (event) => {
      this.workspaceNamespace.emit("selectedCards", event.cards);
    });
  }

  /**
   * Create and start a MiroServer instance with proper error handling
   */
  static async create(workspaceId: string, port?: number): Promise<MiroServer> {
    // Use provided port, or fall back to configured port
    const serverPort = port ?? PortConfig.getServerPort();
    const server = new MiroServer(workspaceId, serverPort);
    await server.startServer();
    return server;
  }

  /**
   * Start the HTTP server with proper error handling
   */
  private async startServer(): Promise<void> {
    const port = this.#port;

    return new Promise((resolve, reject) => {
      // Set up error handling for port binding failures
      this.httpServer.on("error", (error) => {
        if ("code" in error && error.code === "EADDRINUSE") {
          debug("Port already in use", {
            port,
            error: error.message,
          });
          reject(
            new Error(
              `Port ${port} is already in use. Another server instance may be running.`,
            ),
          );
        } else {
          debug("Server error", { error });
          reject(error);
        }
      });

      // Start listening on the port
      this.httpServer.listen(port, "127.0.0.1", () => {
        debug("Server started successfully", { port });
        resolve();
      });
    });
  }

  /**
   * Handle workspace websocket connection
   */
  private async onWorkspaceConnection(
    socket: WorkspaceServerSocket,
  ): Promise<void> {
    debug("New workspace connection", { socketId: socket.id });
    socket.onAny((event, ...args) => {
      debugEvents("Received workspace event", socket.id, event, args);
    });
    socket.onAnyOutgoing((event, ...args) => {
      debugEvents("Sending workspace event", socket.id, event, args);
    });
    socket.on("disconnect", () => {
      debug("Workspace socket disconnected", { id: socket.id });
    });

    const cardStorage = this.cardStorage;

    WorkspaceServerEventHandler.create(
      socket,
      this.cardStorage,
      this.connectedWorkspaces,
    );
    WorkspaceMiroEventHandler.create(socket, this.cardStorage);

    cardStorage
      .on("connectedBoards", (event) => {
        debug("Card storage connected boards updated", {
          boardIds: event.boardIds,
        });
        socket.emit("connectedBoards", event.boardIds);
      })
      .on("boardUpdate", (event) => {
        if (event.board) {
          socket.emit("boardUpdate", event.board);
        }
      })
      .on("cardUpdate", (event) => {
        socket.emit("cardUpdate", event.miroLink, event.card);
      })
      .on("selectedCards", (event) => {
        socket.emit("selectedCards", event.cards);
      });
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
    this.httpServer.closeAllConnections();
  }

  async onMiroConnection(socket: MiroServerSocket) {
    try {
      // Add a small delay to allow the client to set up its handlers
      await new Promise((resolve) => setTimeout(resolve, 100));
      socket.onAny((event, ...args) => {
        debugEvents("Received miro event", socket.id, event, args);
      });
      socket.onAnyOutgoing((event, ...args) => {
        debugEvents("Sending miro event", socket.id, event, args);
      });

      const info = await socket.emitWithAck("getBoardInfo", "");
      debug("Miro board connected", info);

      let boardInfo = this.cardStorage.getBoard(info.boardId);
      if (!boardInfo) {
        boardInfo = await this.cardStorage.addBoard(info.boardId, info.name);
      } else if (boardInfo.name !== info.name) {
        this.cardStorage.setBoardName(info.boardId, info.name);
      }
      debug("boardInfo retrieved", info);

      const cards = await socket.emitWithAck("cards", info.boardId);
      debug("Cards received from Miro board", {
        boardId: info.boardId,
        cardCount: cards.length,
      });
      this.cardStorage.connectBoard(info.boardId, socket);
      this.cardStorage.setBoardCards(info.boardId, cards);

      debug("boardInfo retrieved", info, {
        cards: this.cardStorage.getCardsByBoard()[info.boardId],
      });

      MiroServerEventHandler.create(
        socket,
        this.cardStorage,
        this.workspaceNamespace,
      );
    } catch (error) {
      debug("Failed to handle Miro connection", {
        error,
        socketId: socket.id,
      });
    }
  }
}

class WorkspaceServerEventHandler extends EventHandler<"server", "workspace"> {
  protected readonly self = "server" as const;
  private readonly cardStorage: CardStorage;
  private readonly connectedWorkspaces: Map<string, WorkspaceInfo>;

  constructor(
    socket: WorkspaceServerSocket,
    cardStorage: CardStorage,
    connectedWorkspaces: Map<string, WorkspaceInfo>,
  ) {
    super(socket);
    this.cardStorage = cardStorage;
    this.connectedWorkspaces = connectedWorkspaces;
  }

  protected readonly handlerMethods = {
    onWorkspaceRegistration: async (request: WorkspaceRegistrationRequest) => {
      debug("Workspace registration request", request);

      try {
        const workspaceInfo: WorkspaceInfo = {
          id: request.workspaceId,
          rootPath: request.rootPath,
          workspaceName: request.workspaceName,
        };

        this.connectedWorkspaces.set(request.workspaceId, workspaceInfo);
        this.once("disconnect", () => {
          this.connectedWorkspaces.delete(request.workspaceId);
          this.cardStorage.emit("connectedBoards", {
            type: "connectedBoards",
            boardIds: Array.from(this.connectedWorkspaces.keys()),
          });
        });

        debug("Workspace client", {
          workspaceId: request.workspaceId,
          socketId: this.socket.id,
        });

        const response: WorkspaceRegistrationResponse = {
          success: true,
          workspaceId: request.workspaceId,
          cardsByBoard: this.cardStorage.getCardsByBoard(),
        };

        debug("Workspace registered successfully", {
          workspaceId: request.workspaceId,
        });

        this.cardStorage.emit("connectedBoards", {
          type: "connectedBoards",
          boardIds: Array.from(this.connectedWorkspaces.keys()),
        });
        return response;
      } catch (error) {
        debug("Workspace registration failed", {
          workspaceId: request.workspaceId,
          error,
        });
        const response: WorkspaceRegistrationResponse = {
          success: false,
          workspaceId: request.workspaceId,
          error: String(error),
          cardsByBoard: this.cardStorage.getCardsByBoard(),
        };
        return response;
      }
    },
  } satisfies HandlerMethodMap<"server", "workspace">;
}

class WorkspaceMiroEventHandler extends EventHandler<"miro", "workspace"> {
  protected readonly self = "miro" as const;
  private readonly cardStorage: CardStorage;

  constructor(socket: WorkspaceServerSocket, cardStorage: CardStorage) {
    super(socket);
    this.cardStorage = cardStorage;
  }

  protected readonly handlerMethods = {
    onCardStatus: async (boardId, data) => {
      debug("Workspace cardStatus request", { data });
      const boardSocket = this.cardStorage.getBoardSocket(boardId);

      if (!boardSocket) {
        debug("Board not connected", { boardId });
        return false;
      }

      try {
        const card = this.cardStorage.getCardByLink(data.miroLink);
        invariant(card, "Card not found in storage");
        this.cardStorage.setCard(card.boardId, {
          ...card,
          status: data.status,
          codeLink: data.codeLink,
        });

        const success = await boardSocket.emitWithAck(
          "cardStatus",
          boardId,
          data,
        );
        debug("cardStatus routed to board successfully", { boardId, success });
        return success;
      } catch (error) {
        debug("Failed to route cardStatus to board", { boardId, error });
        return false;
      }
    },
    onGetIdToken: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("getIdToken", boardId)
        .then((id) => id as string)
        .catch(() => "" as string);
    },
    onSetBoardName: async (boardId, name) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      this.cardStorage.setBoardName(boardId, name);
      return boardSocket
        .emitWithAck("setBoardName", boardId, name)
        .then((success) => success as boolean)
        .catch(() => false);
    },
    onGetBoardInfo: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        const info = await boardSocket.emitWithAck("getBoardInfo", boardId);
        let boardInfo = this.cardStorage.getBoard(info.boardId);

        if (!boardInfo) {
          boardInfo = await this.cardStorage.addBoard(info.boardId, info.name);
        } else if (boardInfo.name !== info.name) {
          this.cardStorage.setBoardName(info.boardId, info.name);
        }

        debug("boardInfo retrieved", { boardId, info });
        return info;
      } catch (_error) {
        return undefined as unknown as BoardInfo;
      }
    },
    onTags: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("tags", boardId)
        .then((tags) => tags as AppExplorerTag[])
        .catch(() => []);
    },
    onAttachCard: async (boardId, data) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("attachCard", boardId, data)
        .then((success) => success as boolean)
        .catch(() => false);
    },
    onTagCards: async (boardId, data) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("tagCards", boardId, data)
        .then((success) => success as boolean)
        .catch(() => false);
    },
    onSelectCard: async (boardId, miroLink) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      this.cardStorage.selectedCards([
        this.cardStorage.getCardByLink(miroLink)!,
      ]);
      return boardSocket
        .emitWithAck("selectCard", boardId, miroLink)
        .then((success) => success as boolean)
        .catch(() => false);
    },
    onCards: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        const cards = await boardSocket.emitWithAck("cards", boardId);
        this.cardStorage.setBoardCards(boardId, cards);
        return cards;
      } catch (_error) {
        return [];
      }
    },
    onSelected: async (boardId) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        const selected = await boardSocket.emitWithAck("selected", boardId);
        this.cardStorage.selectedCards(selected);
        return selected;
      } catch (_error) {
        return [];
      }
    },
    onNewCards: async (boardId, data, options) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");

      try {
        return await boardSocket.emitWithAck(
          "newCards",
          boardId,
          data,
          options,
        );
      } catch (_error) {
        return false;
      }
    },
    onHoverCard: async (boardId, miroLink) => {
      const boardSocket = this.cardStorage.getBoardSocket(boardId);
      invariant(boardSocket, "Board not connected");
      return boardSocket
        .emitWithAck("hoverCard", boardId, miroLink)
        .then((success) => success as boolean)
        .catch(() => false);
    },
  } satisfies HandlerMethodMap<"miro", "workspace">;
}

class MiroServerEventHandler extends EventHandler<"workspace", "miro"> {
  protected readonly self = "workspace" as const;
  private readonly cardStorage: CardStorage;
  private readonly workspaceNamespace: Namespace<
    EventsFrom<"workspace">,
    EventsTo<"workspace">
  >;

  constructor(
    socket: MiroServerSocket,
    cardStorage: CardStorage,
    workspaceNamespace: MiroServer["workspaceNamespace"],
  ) {
    super(socket);
    this.cardStorage = cardStorage;
    this.workspaceNamespace = workspaceNamespace;
  }

  protected readonly handlerMethods = {
    onLog: async ([message, ...args]) => {
      logger.log(message, ...args);
    },
    onNavigateTo: async (card) => {
      debug("🎯 MIRO EVENT: Navigate to card", {
        timestamp: new Date().toISOString(),
        boardId: card.boardId,
        cardTitle: card.title,
        cardPath: card.path,
        cardSymbol: card.type === "symbol" ? card.symbol : undefined,
        cardMiroLink: card.miroLink,
        cardStatus: card.status,
        eventSource: "miro-board",
        willBroadcastTo: "assigned-workspaces",
      });

      debug("🔄 BROADCASTING TO BOARD WORKSPACES", { boardId: card.boardId });
      this.workspaceNamespace.emit("navigateTo", card);
    },
    onSelectedCards: async (data) => {
      this.workspaceNamespace.emit("selectedCards", data);
    },
    onCard: async ({ url, card }) => {
      debug("Received card update", { url, card });
      this.workspaceNamespace.emit("card", { url, card });

      if (card) {
        this.cardStorage.setCard(card.boardId, card);
      } else {
        this.cardStorage.deleteCardByLink(url);
      }
    },
  } satisfies HandlerMethodMap<"workspace", "miro">;
}
