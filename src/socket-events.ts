import { z } from "zod";

import { CardData } from "@/card-data";
import { BoardInfo } from "@/card-storage";
import { PrettyPrint } from "@/utils/pretty-print";

export const socketEntities = [
  "server",
  "miro",
  "sidebar",
  "workspace",
] as const;

export type SocketEntity = (typeof socketEntities)[number];

const cardDataSchema = z.custom<CardData>();
const boardInfoSchema = z.custom<BoardInfo>();

const cardArraySchema = z.array(cardDataSchema);
const cardEventDataSchema = z.object({
  url: z.string(),
  card: cardDataSchema.nullable(),
});
const cardStatusDataSchema = z.object({
  miroLink: z.string(),
  status: z.enum(["connected", "disconnected"]),
  codeLink: z.string().nullable(),
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
export const zSessionShutdown = z.function({
  input: [],
  output: z.promise(z.void()),
});
export const zRequestCardsAroundCursor = z.function({
  input: [],
  output: z.promise(z.void()),
});
export const zEncryptedEvent = z.object({
  eventName: z.string().min(1),
  args: z.array(z.unknown()),
});

export const encryptedEventName = "encryptedEvent" as const;

export const zGetBoardInfo = z.function({
  input: [z.string()],
  output: z.promise(boardInfoSchema),
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
  server: {},
  miro: {
    workspace: {
      boardUpdate: zBoardUpdate,
      selectedCards: zSelectedCards,
      navigateTo: zNavigateTo,
      card: zCard,
    },
  },
  sidebar: {
    workspace: {
      sessionShutdown: zSessionShutdown,
      navigateTo: zNavigateTo,
      requestCardsAroundCursor: zRequestCardsAroundCursor,
    },
  },
  workspace: {
    sidebar: {
      cardsAroundCursor: zCardsAroundCursor,
      sessionShutdown: zSessionShutdown,
    },
    miro: {
      sessionShutdown: zSessionShutdown,
      getBoardInfo: zGetBoardInfo,
      selectCard: zSelectCard,
      cardStatus: zCardStatus,
      cards: zCards,
    },
  },
} as const satisfies SocketEventSchemaShape;

export type SocketEventSchemaMap = typeof socketEventMap;

export type SocketEventMap = InferSocketEventMap<SocketEventSchemaMap>;
