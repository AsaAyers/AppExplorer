import { z } from "zod";

import { BoardInfo } from "@/card-storage";
import {
  WorkspaceRegistrationResponse,
  CardData,
  EventsTo,
  EventsFrom,
} from "@/extension/types";

export const zCardData = z.custom<CardData>();
export const zBoardInfo = z.custom<BoardInfo>();
export const zWorkspaceRegistrationRequest = z.object({
  workspaceId: z.string(),
  workspaceName: z.string().optional(),
  rootPath: z.string().optional(),
});

export const zWorkspaceRegistrationResponse: z.ZodType<WorkspaceRegistrationResponse> =
  z.object({
    success: z.boolean(),
    workspaceId: z.string(),
    error: z.string().optional(),
    cardsByBoard: z.record(z.string(), z.array(zCardData)),
  });

export const zConnectedBoards = z.object({
  type: z.literal("connectedBoards"),
  boards: z.array(z.string()),
});

export const zCardUpdate = z.object({
  type: z.literal("cardUpdate"),
  url: z.string(),
  cardData: zCardData.nullable(),
});

export const zSelectCard = z.object({
  type: z.literal("selectCard"),
  miroLink: z.string(),
  result: z.object({ success: z.boolean() }).optional(),
});

export const zCardSelected = z.object({
  type: z.literal("cardSelected"),
  cardData: zCardData,
});

export const zNavigateToCode = z.object({
  type: z.literal("navigateToCode"),
  transport: z.union([z.literal("channel"), z.literal("socket")]).optional(),
  cardData: zCardData,
  source: z.literal("foreground"),
  result: z
    .object({ success: z.boolean(), link: z.string().nullable() })
    .optional(),
});

export const zSetCardData = z.object({
  type: z.literal("setCardData"),
  id: z.string(),
  cardData: zCardData.nullable(),
});

export const zWorkspaceRegistration = z.object({
  ...zWorkspaceRegistrationRequest.shape,
  type: z.literal("workspaceRegistration"),
  result: zWorkspaceRegistrationResponse.optional(),
});

export const zCardsAroundCursor = z.object({
  type: z.literal("cardsAroundCursor"),
  transport: z.union([z.literal("channel"), z.literal("socket")]).optional(),
  source: z.literal("background"),
  cards: z.array(zCardData).nullable(),
  path: z.string(),
});

export type EventCardsAroundCursor = z.infer<typeof zCardsAroundCursor>;

export const zSetBoardName = z.object({
  type: z.literal("setBoardName"),
  boardId: z.string(),
  name: z.string(),
  result: z.object({ success: z.boolean() }).optional(),
});

export const zGetBoardInfo = z.object({
  type: z.literal("getBoardInfo"),
  boardId: z.string(),
  result: zBoardInfo.optional(),
});

export const zSetBoardInfo = z.object({
  type: z.literal("setBoardInfo"),
  boardInfo: zBoardInfo,
});

export const zMiroReady = z.object({
  type: z.literal("miroReady"),
  result: z.boolean().optional(),
});

export const zGetCardsOnBoard = z.object({
  type: z.literal("getCardsOnBoard"),
  boardId: z.string(),
  result: z.object({ cards: z.array(zCardData) }).optional(),
});

export const zGetSelectedCards = z.object({
  type: z.literal("getSelectedCard"),
  boardId: z.string(),
  result: z.array(zCardData).optional(),
});

export const zOpenAuthModal = z.object({
  type: z.literal("openAuthModal"),
  transport: z.literal("channel").optional(),
  source: z.literal("foreground"),
  redirectUrl: z.string(),
  returnPath: z.string(),
  modalData: z.unknown(),
  panelData: z.unknown(),
});

export const zRequestSocketStatus = z.object({
  type: z.literal("requestSocketStatus"),
  transport: z.literal("channel").optional(),
});

export const zStartSession = z.object({
  type: z.literal("startSession"),
  transport: z.literal("channel").optional(),
  key: z.string(),
  id: z.string(),
});

export const zSocketStatus = z.object({
  transport: z.literal("channel").optional(),
  type: z.literal("socketStatus"),
  sessionId: z.string().nullable(),
});

export const zEncryptedEvent = z.object({
  type: z.literal("encryptedEvent"),
  enc: z.string(),
  dest: z.union([z.literal("miro"), z.literal("workspace")]),
  result: z.string().nullable().optional(),
});

export const zAttachDescription = z.object({
  type: z.literal("attachDescription"),
  source: z.literal("foreground"),
  cardId: z.string(),
  description: z.string(),
  transport: z.literal("channel").optional(),
});

export const zRequestCardsAroundCursor = z.object({
  type: z.literal("requestCardsAroundCursor"),
  transport: z.literal("channel").optional(),
  source: z.literal("foreground"),
});

export const zZoomIntoCards = z.object({
  type: z.literal("zoomIntoCards"),
  cards: z.array(zCardData),
  transport: z.literal("channel").optional(),
});

export const zNewCard = z.object({
  type: z.literal("newCard"),
  transport: z.literal("channel").optional(),
  x: z.number(),
  y: z.number(),
  attachSelected: z.boolean(),
  cardData: zCardData,
});

export type BaseEvent = { type: string };

export type AsSocketEvents<T extends Record<string, BaseEvent>> = {
  [Key in keyof T]: SocketEvent<T[Key]>;
};

export type SocketEvent<E extends BaseEvent> = E extends {
  result?: infer Result;
}
  ? (e: E, callback: (result: Result) => void) => void
  : (e: E) => void;

export type UnwrapSocketEvent<T extends SocketEvent<any>> =
  T extends SocketEvent<infer E> ? E : never;

/**
 * I'm using types to guide and verify development. This type specifies every
 * event that can be sent to and from another socket. "workspace" is each
 * individual VSCode window. No matter how many you have open, they all need to
 * connect to a central "server" running on localhost:9043 and hosted by one of
 * those windows. The server will then have a connection to any number of Miro
 * boards that you have open in a browser.
 *
 * I have generics that help ensure that all possible events are being handled
 * in each location. Now when I want to add a new event, the first step is to
 * add it here, and then run tsc to see where it needs to be handled.
 *
 * @AppExplorer
 */
export const appEventRoutes = {
  miroBackground: {
    workspace: {
      encryptedEvent: zEncryptedEvent,
      cardSelected: zCardSelected,
      navigateToCode: zNavigateToCode,
    },
    miro: {
      navigateToCode: zNavigateToCode,
      socketStatus: zSocketStatus,
      cardsAroundCursor: zCardsAroundCursor,
    },
  },
  workspace: {
    miroBackground: {
      encryptedEvent: zEncryptedEvent,
      cardsAroundCursor: zCardsAroundCursor,
      selectCard: zSelectCard,
      zoomIntoCards: zZoomIntoCards,
    },
  },
  // server: {
  //   workspace: {
  //     connectedBoards: zConnectedBoards,
  //     setBoardInfo: zSetBoardInfo,
  //     setCardData: zSetCardData,
  //   },
  //   miroBackground: {
  //     getBoardInfo: zGetBoardInfo,
  //   },
  // },
  miro: {
    miroBackground: {
      openAuthModal: zOpenAuthModal,
      startSession: zStartSession,
      requestSocketStatus: zRequestSocketStatus,
      attachDescription: zAttachDescription,
      requestCardsAroundCursor: zRequestCardsAroundCursor,
      zoomIntoCards: zZoomIntoCards,
      newCard: zNewCard,
      navigateToCode: zNavigateToCode,
    },
    // server: {
    //   miroReady: zMiroReady,
    //   setCardData: zSetCardData,
    // },
    workspace: {
      cardSelected: zCardSelected,
    },
  },
} as const;
export type AppEventRoutes = AppEventHelper<typeof appEventRoutes>;
export type AppEventSources = keyof AppEventRoutes;
export type AppEventDestinations = {
  [Key in AppEventSources]: keyof AppEventRoutes[Key];
}[AppEventSources];

type AppEventHelper<
  T extends Record<string, Record<string, Record<string, z.ZodTypeAny>>>,
> = {
  [S in keyof T]: {
    [Target in keyof T[S]]: {
      [EventName in keyof T[S][Target]]: z.infer<T[S][Target][EventName]>;
    };
  };
};

export type EventMapFrom<Source extends keyof AppEventRoutes> = {
  [Key in keyof EventsFrom<Source>]: [EventsFrom<Source>[Key]];
};

type Transport = "socket" | "channel";

// Given an event type E, does it allow Transport T?
type AllowsTransport<E, T extends Transport> = E extends {
  transport?: infer ET;
}
  ? T extends Extract<ET, Transport> // T ∈ ET (works for unions)
    ? true
    : false
  : false;

// Compute the handler type for a particular event key (or never if excluded)
type HandlerFor<
  Target extends AppEventDestinations,
  T extends Transport,
  K extends keyof EventsTo<Target>,
> = T extends "socket"
  ? SocketEvent<EventsTo<Target>[K]> // sockets get everything in your model
  : AllowsTransport<EventsTo<Target>[K], T> extends true
    ? SocketEvent<EventsTo<Target>[K]>
    : never;

export type HandlersFor<
  Target extends AppEventDestinations,
  T extends Transport = Transport,
> = {
  [K in keyof EventsTo<Target> as HandlerFor<Target, T, K> extends never
    ? never
    : `on${Capitalize<K & string>}`]: HandlerFor<Target, T, K>;
};

export const zAllEvents = z.union([
  zCardUpdate,
  zCardsAroundCursor,
  zConnectedBoards,
  zGetBoardInfo,
  zSetBoardInfo,
  zGetCardsOnBoard,
  zStartSession,
  zRequestSocketStatus,
  zAttachDescription,
  zNewCard,
  zZoomIntoCards,
  zRequestCardsAroundCursor,
  zEncryptedEvent,
  zSocketStatus,
  zGetSelectedCards,
  zCardSelected,
  zSelectCard,
  zSetBoardName,
  zSetCardData,
  zOpenAuthModal,
  zWorkspaceRegistration,
]);
