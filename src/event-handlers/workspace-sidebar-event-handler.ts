import { Namespace } from "socket.io";

import {
  EventHandler,
  SidebarServerSocket,
  HandlerMethodMap,
} from "@/event-handler";
import { SidebarServer } from "@/server/sidebar-server";
import { RoutedEvents, EventsTo } from "@/socket-events";

export class WorkspaceSidebarEventManager extends EventHandler<
  "workspace",
  "sidebar"
> {
  protected readonly self = "workspace" as const;
  private readonly workspaceNamespace: Namespace<
    RoutedEvents<"workspace", "miro">,
    EventsTo<"workspace">
  >;

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
