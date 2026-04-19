"use client";

import React from "react";
import { io as socketIO } from "socket.io-client";
import invariant from "tiny-invariant";

import { useDemoBoardStorage } from "@/app/(website)/demo/demo-storage";
import { useDemoSession } from "@/app/(website)/demo/useDemoSession";
import {
  type AppExplorerSession,
  getSocketUrl,
  zAppExplorerSession,
} from "@/app-explorer-session";
import { type CardData } from "@/card-data";
import { EventHandler } from "@/event-handlers/event-handler";
import { SidebarClientEventHandler } from "@/event-handlers/sidebar-client-event-handler";
import {
  type HandlerMethodMap,
  type WorkspaceSocket,
} from "@/event-handlers/types";
import { getIndexFromOrigin } from "@/host-config";
import { connectSidebarHandler } from "@/sidebar/connect-sidebar-socket";
import { createDebug } from "@/utils/create-debug";

const log = createDebug("app-explorer:demo:session");
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const demoBoardId = "demo-board";

type DemoSessionTransport = {
  cardsAroundCursor: CardData[];
  emitCardsAroundCursor: (cards: CardData[]) => void;
  navigateTo: (card: CardData) => void;
};

const DemoSessionTransportContext =
  React.createContext<DemoSessionTransport | null>(null);

class DemoWorkspaceEventHandler extends EventHandler<"workspace", "sidebar"> {
  protected readonly selfName = "workspace" as const;
  readonly #getCardsAroundCursor: () => CardData[];
  readonly #onNavigateTo: (card: CardData) => void;
  readonly #onSessionShutdown: () => void;

  constructor(
    socket: WorkspaceSocket,
    {
      getCardsAroundCursor,
      onNavigateTo,
      onSessionShutdown,
    }: {
      getCardsAroundCursor: () => CardData[];
      onNavigateTo: (card: CardData) => void;
      onSessionShutdown: () => void;
    },
  ) {
    super(socket as never);
    this.#getCardsAroundCursor = getCardsAroundCursor;
    this.#onNavigateTo = onNavigateTo;
    this.#onSessionShutdown = onSessionShutdown;
  }

  protected readonly handlerMethods = {
    onNavigateTo: async (card: CardData) => {
      this.#onNavigateTo(card);
    },
    onRequestCardsAroundCursor: async () => {
      await this.emitEncrypted(
        "cardsAroundCursor",
        this.#getCardsAroundCursor(),
      );
    },
    onSessionShutdown: async () => {
      this.#onSessionShutdown();
      this.socket.disconnect();
    },
  } satisfies HandlerMethodMap<"workspace", "sidebar">;

  emitCardsAroundCursor(cards: CardData[]) {
    return this.emitEncrypted("cardsAroundCursor", cards);
  }
}

async function connectDemoWorkspaceHandler(
  session: AppExplorerSession,
  options: ConstructorParameters<typeof DemoWorkspaceEventHandler>[1],
) {
  const connectionTimeout = 10000;
  const socket = socketIO(getSocketUrl(session), {
    auth: {
      role: "workspace",
    },
    transports: ["websocket"],
    timeout: connectionTimeout,
    reconnection: false,
    forceNew: false,
  }) as WorkspaceSocket;
  const handler = DemoWorkspaceEventHandler.create(socket, options);
  handler.attachSession(session);

  let timedOut = false;
  delay(connectionTimeout).then(() => {
    timedOut = true;
  });

  while (!socket.connected) {
    if (timedOut) {
      throw new Error(
        `Failed to connect to demo workspace socket within ${connectionTimeout}ms`,
      );
    }
    await delay(100);
  }

  return { socket, handler };
}

function installDemoMiroShim() {
  const globalWithMiro = globalThis as typeof globalThis & {
    miro?: {
      board: {
        getInfo: () => Promise<{ id: string }>;
        ui: {
          openModal: () => Promise<{ waitForClose: () => Promise<null> }>;
        };
      };
    };
  };

  if (globalWithMiro.miro) {
    return;
  }

  globalWithMiro.miro = {
    board: {
      getInfo: async () => ({ id: demoBoardId }),
      ui: {
        openModal: async () => ({
          waitForClose: async () => null,
        }),
      },
    },
  } as never;
}

export function DemoSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ sessionId, sessionHexKey }] = useDemoSession();
  const [, dispatch] = useDemoBoardStorage();
  const [cardsAroundCursor, setCardsAroundCursor] = React.useState<CardData[]>(
    [],
  );
  const [sidebarHandler, setSidebarHandler] = React.useState<
    SidebarClientEventHandler | undefined
  >();
  const [workspaceHandler, setWorkspaceHandler] = React.useState<
    DemoWorkspaceEventHandler | undefined
  >();
  const latestCardsAroundCursor = React.useRef<CardData[]>([]);
  const [session, setSession] = React.useState<AppExplorerSession>();

  React.useEffect(() => {
    installDemoMiroShim();
  }, []);

  React.useEffect(() => {
    setSession(
      zAppExplorerSession.parse({
        sessionId,
        key: sessionHexKey,
        insiders: false,
        hostIndex: getIndexFromOrigin(window.location.origin),
      }),
    );
  }, [sessionHexKey, sessionId]);

  React.useEffect(() => {
    if (!session) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const nextSidebarHandler = await connectSidebarHandler(session);
      const nextWorkspaceConnection = await connectDemoWorkspaceHandler(
        session,
        {
          getCardsAroundCursor: () => latestCardsAroundCursor.current,
          onNavigateTo: (card) => {
            dispatch({ type: "selectCard", card });
          },
          onSessionShutdown: () => {
            setCardsAroundCursor([]);
            dispatch({ type: "selectCard", card: undefined });
          },
        },
      );

      if (disposed) {
        nextSidebarHandler.dispose();
        nextSidebarHandler.socketClient.disconnect();
        nextWorkspaceConnection.handler.dispose();
        nextWorkspaceConnection.socket.disconnect();
        return;
      }

      setSidebarHandler(nextSidebarHandler);
      setWorkspaceHandler(nextWorkspaceConnection.handler);
      setCardsAroundCursor(nextSidebarHandler.latestCardsAroundCursor ?? []);

      const cardsSubscription = nextSidebarHandler.cardsAroundCursorEvent(
        (cards) => {
          setCardsAroundCursor(cards);
        },
      );
      const shutdownSubscription = nextSidebarHandler.sessionShutdownEvent(
        () => {
          setCardsAroundCursor([]);
        },
      );

      cleanup = () => {
        cardsSubscription.dispose();
        shutdownSubscription.dispose();
        nextSidebarHandler.dispose();
        nextSidebarHandler.socketClient.disconnect();
        nextWorkspaceConnection.handler.dispose();
        nextWorkspaceConnection.socket.disconnect();
      };

      await nextSidebarHandler.emitEncrypted("requestCardsAroundCursor");
    })().catch((error) => {
      log("Failed to initialize demo session", { error });
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [dispatch, session]);

  const emitCardsAroundCursor = React.useCallback(
    (cards: CardData[]) => {
      latestCardsAroundCursor.current = cards;
      if (workspaceHandler) {
        void workspaceHandler.emitCardsAroundCursor(cards);
      }
    },
    [workspaceHandler],
  );

  const navigateTo = React.useCallback(
    (card: CardData) => {
      if (!sidebarHandler) {
        dispatch({ type: "selectCard", card });
        return;
      }

      void sidebarHandler.emitEncrypted("navigateTo", card);
    },
    [dispatch, sidebarHandler],
  );

  const contextValue = React.useMemo(() => {
    return {
      cardsAroundCursor,
      emitCardsAroundCursor,
      navigateTo,
    } satisfies DemoSessionTransport;
  }, [cardsAroundCursor, emitCardsAroundCursor, navigateTo]);

  return (
    <DemoSessionTransportContext.Provider value={contextValue}>
      {children}
    </DemoSessionTransportContext.Provider>
  );
}

export function useDemoSessionTransport() {
  const value = React.useContext(DemoSessionTransportContext);
  invariant(
    value,
    "useDemoSessionTransport must be used within a DemoSessionProvider",
  );
  return value;
}
