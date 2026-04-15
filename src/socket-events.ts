import { TagColor } from "@mirohq/websdk-types";
import { z } from "zod";

import {
  AppExplorerTag,
  CardData,
  ServerStatus,
  WorkspaceRegistrationRequest,
  WorkspaceRegistrationResponse,
} from "./EventTypes";
import { BoardInfo } from "./card-storage";
import { SymbolPathChangeEvent } from "./document-symbol-tracker";
import { PrettyPrint } from "./utils/pretty-print";

export const socketEntities = [
  "server",
  "miro",
  "sidebar",
  "workspace",
] as const;

export type SocketEntity = (typeof socketEntities)[number];

const cardDataSchema = z.custom<CardData>();
const boardInfoSchema = z.custom<BoardInfo>();
const serverStatusSchema = z.custom<ServerStatus>();
const workspaceRegistrationRequestSchema =
  z.custom<WorkspaceRegistrationRequest>();
const workspaceRegistrationResponseSchema =
  z.custom<WorkspaceRegistrationResponse>();
const symbolPathChangeEventSchema = z.custom<SymbolPathChangeEvent>();

const appExplorerTagsCallbackSchema = z.array(z.custom<AppExplorerTag>());

const cardArraySchema = z.array(cardDataSchema);
const cardEventDataSchema = z.object({
  url: z.string(),
  card: cardDataSchema.nullable(),
});
const tagCardsDataSchema = z.object({
  miroLink: z.array(z.string()),
  tag: z.union([
    z.string(),
    z.object({
      color: z.custom<TagColor>(),
      title: z.string(),
    }),
  ]),
});
const cardStatusDataSchema = z.object({
  miroLink: z.string(),
  status: z.enum(["connected", "disconnected"]),
  codeLink: z.string().nullable(),
});
const newCardsOptionsSchema = z.object({
  connect: z.array(z.string()).optional(),
});

export const zServerStatus = z.function({
  input: [serverStatusSchema],
  output: z.promise(z.void()),
});
export const zCardsAroundCursor = z.function({
  input: [cardArraySchema],
  output: z.promise(z.void()),
});
export const zConnectedBoards = z.function({
  input: [z.array(z.string())],
  output: z.promise(z.void()),
});
export const zBoardUpdate = z.function({
  input: [boardInfoSchema.nullable()],
  output: z.promise(z.void()),
});
export const zCardUpdate = z.function({
  input: [z.string(), cardDataSchema.nullable()],
  output: z.promise(z.void()),
});
export const zSelectedCards = z.function({
  input: [cardArraySchema],
  output: z.promise(z.void()),
});
export const zNavigateTo = z.function({
  input: [cardDataSchema],
  output: z.promise(z.void()),
});
export const zCard = z.function({
  input: [cardEventDataSchema],
  output: z.promise(z.void()),
});
export const zLog = z.function({
  input: [z.array(z.unknown())],
  output: z.promise(z.void()),
});
export const zGetInstanceId = z.function({
  input: [],
  output: z.promise(z.string()),
});
export const zSymbolsChanged = z.function({
  input: [symbolPathChangeEventSchema],
  output: z.promise(z.void()),
});
export const zWorkspaceRegistration = z.function({
  input: [workspaceRegistrationRequestSchema],
  output: z.promise(workspaceRegistrationResponseSchema),
});

export const zGetIdToken = z.function({
  input: [z.string()],
  output: z.promise(z.string()),
});
export const zSetBoardName = z.function({
  input: [z.string(), z.string()],
  output: z.promise(z.boolean()),
});
export const zGetBoardInfo = z.function({
  input: [z.string()],
  output: z.promise(boardInfoSchema),
});
export const zTags = z.function({
  input: [z.string()],
  output: z.promise(appExplorerTagsCallbackSchema),
});
export const zAttachCard = z.function({
  input: [z.string(), cardDataSchema],
  output: z.promise(z.boolean()),
});
export const zTagCards = z.function({
  input: [z.string(), tagCardsDataSchema],
  output: z.promise(z.boolean()),
});
export const zSelectCard = z.function({
  input: [z.string(), z.string()],
  output: z.promise(z.boolean()),
});
export const zCardStatus = z.function({
  input: [z.string(), cardStatusDataSchema],
  output: z.promise(z.boolean()),
});
export const zCards = z.function({
  input: [z.string()],
  output: z.promise(z.array(cardDataSchema)),
});
export const zSelected = z.function({
  input: [z.string()],
  output: z.promise(z.array(cardDataSchema)),
});
export const zNewCards = z.function({
  input: [z.string(), cardArraySchema, newCardsOptionsSchema],
  output: z.promise(z.boolean()),
});
export const zHoverCard = z.function({
  input: [z.string(), z.string()],
  output: z.promise(z.boolean()),
});

// Roles participating in the socket mesh (exported for consumers that need to
// reason about directionality elsewhere).
export type Role = PrettyPrint<keyof SocketEventMap>;

/**
 * MergeUnionOfObjects
 * --------------------
 * Problem:
 *   Given a UNION of object types (e.g. A | B | C) we normally cannot access a property safely
 *   unless it exists on *every* member. Also `keyof (A | B | C)` yields only the keys common
 *   to all members. We want instead a "merged" map with the union of keys and, for each key,
 *   the union of its value types across members.
 *
 * Example:
 *   type U = { a: number; shared: string } | { b: boolean; shared: number };
 *   type M = MergeUnionOfObjects<U>;
 *   // M is: { a: number; b: boolean; shared: string | number }
 *
 * Technique:
 *   We leverage distributive conditional types twice.
 *   1. `[K in U extends unknown ? keyof U : never]` distributes over each member of U to collect
 *      all of its keys; the resulting union of keys becomes the index set for the resulting object.
 *   2. For each candidate key K, we again distribute over U; if the current member contains K we
 *      extract its value type U[K], otherwise `never`. Uniting all those gives us the union of
 *      value types for key K across all members (with `never` disappearing).
 *
 * Notes:
 *   - We use `unknown` instead of `any` to satisfy lint rules while still triggering distribution.
 *   - This helper is intentionally *widening*: overlapping function signatures will become a
 *     union of call signatures (which is often acceptable for events).
 */
export type MergeUnionOfObjects<U> = {
  [K in U extends unknown ? keyof U : never]: U extends unknown
    ? K extends keyof U
      ? U[K]
      : never
    : never;
};

type SocketIoCallback<Result> = (result: Result) => void;

type HandlerToSocketIoEvent<Handler> = Handler extends (
  ...args: infer Args
) => Promise<infer Result>
  ? Awaited<Result> extends void
    ? (...args: Args) => void
    : (...args: [...Args, SocketIoCallback<Awaited<Result>>]) => void
  : never;

export type SocketIoEventMap<Events> = {
  [EventName in keyof Events]: HandlerToSocketIoEvent<Events[EventName]>;
};

/**
 * EventsTo<Map, Target>
 * ---------------------
 * Goal:
 *   From a role→(destination-role→events) adjacency mapping (our `SocketEventMap`), build a merged
 *   object containing *all* event handlers whose destination is `Target` (e.g. "server").
 *
 * Steps:
 *   1. Mapped type iterates each source role `S in keyof Map`.
 *   2. If the source role object contains a property named `Target`, we keep that nested event map;
 *      else we yield `never` (ignored later).
 *   3. Indexing the mapped type with `[keyof Map]` converts the mapped object into a UNION of just
 *      those collected nested event maps (dropping `never`).
 *   4. Pass that union of event maps through `MergeUnionOfObjects` to flatten into a single object
 *      whose keys are the union of all inbound event names and whose values are the union of the
 *      respective handler types.
 *
 * Result:
 *   `EventsTo<SocketEventMap, "server">` ⇒ one object type describing every event that can be
 *   sent TO the server from any other role.
 */
export type EventsTo<Target extends PropertyKey> = MergeUnionOfObjects<
  {
    [S in keyof SocketEventMap]: Target extends keyof SocketEventMap[S]
      ? SocketIoEventMap<SocketEventMap[S][Target]>
      : never;
  }[keyof SocketEventMap]
>;

export type EventsFrom<Source extends keyof SocketEventMap> =
  MergeUnionOfObjects<
    SocketIoEventMap<SocketEventMap[Source][keyof SocketEventMap[Source]]>
  >;

export type RoutedEvents<
  Source extends keyof SocketEventMap,
  Target extends keyof SocketEventMap[Source],
> = Target extends keyof SocketEventMap[Source]
  ? SocketIoEventMap<SocketEventMap[Source][Target]>
  : never;

type SocketEventSchema = z.ZodFunction;

type SocketEventSchemaShape = Record<
  SocketEntity,
  Partial<Record<SocketEntity, Record<string, SocketEventSchema>>>
>;

type InferSocketEventMap<
  Map extends Record<
    PropertyKey,
    Record<PropertyKey, Record<PropertyKey, SocketEventSchema>>
  >,
> = {
  [Source in keyof Map]: {
    [Target in keyof Map[Source]]: {
      [EventName in keyof Map[Source][Target]]: z.infer<
        Map[Source][Target][EventName]
      >;
    };
  };
};

export const socketEventMap = {
  server: {
    sidebar: {
      serverStatus: zServerStatus,
      cardsAroundCursor: zCardsAroundCursor,
    },
    workspace: {
      connectedBoards: zConnectedBoards,
      boardUpdate: zBoardUpdate,
      cardUpdate: zCardUpdate,
    },
  },
  miro: {
    workspace: {
      selectedCards: zSelectedCards,
      navigateTo: zNavigateTo,
      card: zCard,
      log: zLog,
    },
  },
  sidebar: {
    server: {
      getInstanceId: zGetInstanceId,
    },
    workspace: {
      navigateTo: zNavigateTo,
    },
  },
  workspace: {
    sidebar: {
      symbolsChanged: zSymbolsChanged,
    },
    server: {
      workspaceRegistration: zWorkspaceRegistration,
    },
    miro: {
      getIdToken: zGetIdToken,
      setBoardName: zSetBoardName,
      getBoardInfo: zGetBoardInfo,
      tags: zTags,
      attachCard: zAttachCard,
      tagCards: zTagCards,
      selectCard: zSelectCard,
      cardStatus: zCardStatus,
      cards: zCards,
      selected: zSelected,
      newCards: zNewCards,
      hoverCard: zHoverCard,
    },
  },
} as const satisfies SocketEventSchemaShape;

export type SocketEventSchemaMap = typeof socketEventMap;

export type SocketEventMap = PrettyPrint<
  InferSocketEventMap<SocketEventSchemaMap>
>;
