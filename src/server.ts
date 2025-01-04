/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServer } from "http";
import * as path from "path";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import invariant from "tiny-invariant";
import * as vscode from "vscode";
import { CardData, Queries, RequestEvents, ResponseEvents } from "./EventTypes";
import { HandlerContext } from "./extension";
import compression = require("compression");
import express = require("express");
import morgan = require("morgan");

type MiroEvents =
  | {
      type: "connect";
      boardInfo: { id: string; name: string };
    }
  | { type: "disconnect" }
  | { type: "navigateToCard"; card: CardData }
  | {
      type: "updateCard";
      miroLink: CardData["miroLink"];
      card: CardData | null;
    };

export class MiroServer extends vscode.EventEmitter<MiroEvents> {
  subscriptions = [] as vscode.Disposable[];

  constructor(
    private context: HandlerContext,

    private sockets: Map<string, Socket<ResponseEvents, RequestEvents>>,
  ) {
    super();
    this.event(() => this.context.renderStatusBar());

    const app = express();
    const httpServer = createServer(app);
    const io = new Server<ResponseEvents, RequestEvents>(httpServer);
    io.on("connection", this.onConnection.bind(this));

    app.use(compression());
    app.use(
      "/",
      express.static(path.join(__dirname, "../dist"), { index: "index.html" }),
    );

    app.use(morgan("tiny"));

    const port = 50505;

    httpServer.on("error", (e) => {
      vscode.window.showErrorMessage(`AppExplorer - ${String(e)}`);
    });
    httpServer.listen(port, () => {
      vscode.window.showInformationMessage(
        `AppExplorer - Server started. Open a Miro board to connect.`,
      );
    });
  }

  async onConnection(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket: Socket<ResponseEvents, RequestEvents, DefaultEventsMap, any>,
  ) {
    const { sockets, context } = this;
    const info = await querySocket(socket, "getBoardInfo");
    const boardId = info.boardId;
    sockets.set(boardId, socket);
    socket.on("disconnect", () => {
      if (boardId) {
        context.connectedBoards.delete(boardId);
        sockets.delete(boardId);
      }
      this.fire({ type: "disconnect" });
    });
    socket.on("navigateTo", async (card) =>
      this.fire({ type: "navigateToCard", card }),
    );
    socket.on("card", async ({ url, card }) => {
      this.fire({ type: "updateCard", miroLink: url, card });
    });

    let boardInfo = context.cardStorage.getBoard(boardId);
    if (!boardInfo) {
      boardInfo = await context.cardStorage.addBoard(boardId, info.name);
    } else if (boardInfo.name !== info.name) {
      context.cardStorage.setBoardName(boardId, info.name);
      boardInfo = { ...boardInfo, name: info.name };
    }
    const cards = await querySocket(socket, "cards");
    context.cardStorage.setBoardCards(boardId, cards);
    context.connectedBoards.add(boardId);
    this.fire({ type: "connect", boardInfo });
  }
  async query<Req extends keyof Queries, Res extends ReturnType<Queries[Req]>>(
    boardId: string,
    name: Req,
    ...data: Parameters<Queries[Req]>
  ): Promise<Res> {
    const socket = this.sockets.get(boardId);
    invariant(socket, `No connection to board ${boardId}`);
    return querySocket<Req, Res>(socket, name, ...data);
  }
}

async function querySocket<
  Req extends keyof Queries,
  Res extends ReturnType<Queries[Req]>,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: Socket<ResponseEvents, RequestEvents, DefaultEventsMap, any>,
  name: Req,
  ...data: Parameters<Queries[Req]>
): Promise<Res> {
  const requestId = Math.random().toString(36);
  return new Promise<Res>((resolve) => {
    socket.emit("query", {
      name,
      requestId,
      data,
    });
    socket.once("queryResult", (response) => {
      resolve(response.response as any);
    });
  });
}
