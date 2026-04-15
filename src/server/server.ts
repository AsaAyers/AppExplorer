import { createServer } from "node:http";
import * as path from "node:path";

import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Namespace, Server } from "socket.io";
import * as vscode from "vscode";

import { WorkspaceInfo } from "../EventTypes";
import { CardStorage, MemoryAdapter } from "../card-storage";
import { PortConfig } from "../port-config";
import { EventsFrom, EventsTo, RoutedEvents } from "../socket-events";
import { listenToAllEvents } from "../test/helpers/listen-to-all-events";
import { createDebug } from "../utils/create-debug";

import { SidebarServer } from "./sidebar-server";

import { MiroServerSocket, WorkspaceServerSocket } from "@/event-handler";
import { MiroWorkspaceEventHandler } from "@/event-handlers/miro-workspace-event-handler";
import { ServerWorkspaceEventHandler } from "@/event-handlers/server-workspace-event-handler";
import { WorkspaceMiroEventHandler } from "@/event-handlers/workspace-miro-event-handler";

export const debug = createDebug("app-explorer:server");
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

    ServerWorkspaceEventHandler.create(
      socket,
      this.cardStorage,
      this.connectedWorkspaces,
    );
    MiroWorkspaceEventHandler.create(socket, this.cardStorage);

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

      WorkspaceMiroEventHandler.create(
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
