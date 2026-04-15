import { SidebarServerSocket, HandlerMethodMap } from "./types";

import { EventHandler } from "@/event-handlers/event-handler";
import { debug } from "@/server/sidebar-server";

export class ServerSidebarEventHandler extends EventHandler<
  "server",
  "sidebar"
> {
  protected readonly self = "server" as const;
  private readonly instanceId: string;

  constructor(socket: SidebarServerSocket, instanceId: string) {
    super(socket);
    this.instanceId = instanceId;
  }

  protected readonly handlerMethods = {
    onGetInstanceId: async () => {
      debug("getInstanceId", this.instanceId);
      return this.instanceId;
    },
  } satisfies HandlerMethodMap<"server", "sidebar">;
}
