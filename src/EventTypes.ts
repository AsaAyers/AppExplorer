import type { AppCard, TagColor } from "@mirohq/websdk-types";
import * as vscode from "vscode";

import { BoardInfo, CardStorage } from "./card-storage";
import { WorkspaceServerSocket } from "./server/server";

export type SymbolCardData = {
  id: string;
  x: number;
  y: number;
  boardId: string;
  type: "symbol";
  title: string;
  path: string;
  symbol: string;
  miroLink?: string;
  codeLink: string | null;
  status: AppCard["status"];
  description?: string;
};

export type GroupCardData = Pick<
  SymbolCardData,
  "title" | "path" | "status" | "miroLink" | "boardId"
> & {
  type: "group";
};

export type CardData = SymbolCardData;

export const allColors: `${TagColor}`[] = [
  "red",
  "magenta",
  "violet",
  "light_green",
  "green",
  "dark_green",
  "cyan",
  "blue",
  "dark_blue",
  "yellow",
  "gray",
  "black",
];

export type AppExplorerTag = {
  title: string;
  id: string;
  color: TagColor;
};

export type ServerStatus = {
  allBoards: BoardInfo[];
  connectedBoardIds: string[];
  cardsPerBoard: Record<string, number>;
  connectedWorkspaces: Omit<WorkspaceInfo, "socket">[];
};

export interface WorkspaceInfo {
  id: string; // Unique workspace identifier
  socket: WorkspaceServerSocket;
  workspaceName?: string;
  rootPath?: string;
}

export interface WorkspaceRegistrationRequest {
  workspaceId: string;
  workspaceName?: string;
  rootPath?: string;
}

export interface WorkspaceRegistrationResponse {
  success: boolean;
  workspaceId: string;
  error?: string;
  cardsByBoard: ReturnType<CardStorage["getCardsByBoard"]>;
}

export type SymbolAnchor = {
  type: "symbol";
  label: string;
  range: vscode.Range;
  target: vscode.SymbolInformation | vscode.DocumentSymbol;
  uri: vscode.Uri;
};

export type GroupAnchor = {
  type: "group";
  label: string;
  range: vscode.Range;
  uri: vscode.Uri;
};

export type Anchor = SymbolAnchor | GroupAnchor;
