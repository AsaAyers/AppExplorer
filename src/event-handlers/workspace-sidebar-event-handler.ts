import {
  EventHandler,
  SidebarServerSocket,
  HandlerMethodMap,
  WorkspaceNamespace,
} from "@/event-handler";
import { SidebarServer } from "@/server/sidebar-server";

export class WorkspaceSidebarEventManager extends EventHandler<
  "workspace",
  "sidebar"
> {
  protected readonly self = "workspace" as const;
  private readonly workspaceNamespace: WorkspaceNamespace;

  constructor(
    socket: SidebarServerSocket,
    workspaceNamespace: SidebarServer["workspaceNamespace"],
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
