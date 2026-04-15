import {
  HandlerMethodMap,
  SidebarServerSocket,
  WorkspaceNamespace,
} from "./types";

import { EventHandler } from "@/event-handlers/event-handler";

export class WorkspaceSidebarEventManager extends EventHandler<
  "workspace",
  "sidebar"
> {
  protected readonly self = "workspace" as const;
  private readonly workspaceNamespace: WorkspaceNamespace;

  constructor(
    socket: SidebarServerSocket,
    workspaceNamespace: WorkspaceNamespace,
  ) {
    super(socket);
    this.workspaceNamespace = workspaceNamespace;
  }

  protected readonly handlerMethods = {
    onNavigateTo: async (card) => {
      this.workspaceNamespace.emit("navigateTo", card);
    },
  } satisfies HandlerMethodMap<"workspace", "sidebar">;
}
