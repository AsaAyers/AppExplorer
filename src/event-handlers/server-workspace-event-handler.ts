import { WorkspaceServerSocket, HandlerMethodMap } from "./types";

import {
  WorkspaceInfo,
  WorkspaceRegistrationRequest,
  WorkspaceRegistrationResponse,
} from "@/EventTypes";
import { CardStorage } from "@/card-storage";
import { EventHandler } from "@/event-handlers/event-handler";
import { debug } from "@/server/server";

export class ServerWorkspaceEventHandler extends EventHandler<
  "server",
  "workspace"
> {
  protected readonly selfName = "server" as const;
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
