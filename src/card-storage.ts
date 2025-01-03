import * as vscode from "vscode";
import { CardData } from "./EventTypes";

export type BoardInfo = {
  id: string;
  name: string;
  cards: Record<NonNullable<CardData["miroLink"]>, CardData>;
};

export class CardStorage {
  private boards = new Map<BoardInfo["id"], BoardInfo>();
  subscribers: Array<() => void> = [];

  constructor(private context: vscode.ExtensionContext) {
    const boardIds = this.context.workspaceState.get<string[]>("boardIds");

    boardIds?.forEach((id) => {
      const board = this.context.workspaceState.get<BoardInfo>(`board-${id}`);
      if (board) {
        this.boards.set(board.id, board);
      }
    });
    this.context.subscriptions.push(this);
  }

  dispose() {
    this.subscribers = [];
  }

  subscribe(callback: () => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((c) => c !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((s) => s());
  }

  async addBoard(boardId: string, name: string) {
    const board: BoardInfo = { id: boardId, name, cards: {} };
    this.boards.set(boardId, board);
    const boardIds = this.context.workspaceState.get<string[]>("boardIds");
    boardIds?.push(boardId);
    await this.context.workspaceState.update("boardIds", boardIds);
    await this.context.workspaceState.update(`board-${boardId}`, board);
    this.notifySubscribers();
    return board;
  }

  async setCard(boardId: string, card: CardData) {
    const board = this.boards.get(boardId);
    if (board) {
      board.cards[card.miroLink!] = card;
      await this.context.workspaceState.update(`board-${boardId}`, board);
    }
    this.notifySubscribers();
  }

  getBoard(boardId: string) {
    return this.boards.get(boardId);
  }

  setBoardName(boardId: string, name: string) {
    const board = this.boards.get(boardId);
    if (board) {
      board.name = name;
      this.context.workspaceState.update(`board-${boardId}`, board);
    }
    this.notifySubscribers();
    return board;
  }

  setBoardCards(boardId: string, cards: CardData[]) {
    const board = this.boards.get(boardId);
    if (board) {
      board.cards = cards.reduce(
        (acc, c) => {
          acc[c.miroLink!] = c;
          return acc;
        },
        {} as Record<string, CardData>,
      );
      this.context.workspaceState.update(`board-${boardId}`, board);
    }
    this.notifySubscribers();
  }

  totalCards() {
    return [...this.boards.values()].reduce(
      (acc, b) => acc + Object.keys(b.cards).length,
      0,
    );
  }

  getCardByLink(link: string): CardData | undefined {
    return [...this.boards.values()]
      .flatMap((b) => Object.values(b.cards))
      .find((c) => c.miroLink === link);
  }

  deleteCardByLink(link: string) {
    [...this.boards.values()].forEach((b) => {
      if (b.cards[link]) {
        delete b.cards[link];
        this.context.workspaceState.update(`board-${b.id}`, b);
      }
    });
    this.notifySubscribers();
  }

  clear() {
    this.listBoardIds().forEach((id) => {
      this.context.workspaceState.update(`board-${id}`, undefined);
    });
    this.boards.clear();
    this.context.workspaceState.update("boardIds", []);
    this.notifySubscribers();
  }

  set(miroLink: string, card: CardData) {
    const url = new URL(miroLink);
    const match = url.pathname.match(/\/app\/board\/([^/]+)\//);
    if (match) {
      const boardId = match[1];
      const board = this.boards.get(boardId);
      if (board) {
        board.cards[miroLink] = card;
        this.context.workspaceState.update(`board-${boardId}`, board);
      }
    }
    this.notifySubscribers();
  }

  setWorkspaceBoards(boardIds: string[]) {
    if (this.listBoardIds().length === boardIds.length) {
      this.context.workspaceState.update(`board-filter`, undefined);
    } else {
      this.context.workspaceState.update(`board-filter`, boardIds);
    }
    this.notifySubscribers();
  }
  listWorkspaceBoards() {
    return (
      this.context.workspaceState.get<string[]>(`board-filter`) ??
      this.listBoardIds()
    );
  }

  listBoardIds() {
    return [...this.boards.keys()];
  }
  listAllCards() {
    return [...this.boards.values()].flatMap((b) => Object.values(b.cards));
  }
}
