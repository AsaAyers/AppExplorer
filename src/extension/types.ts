import { z } from "zod";

import {
  AppEventDestinations,
  AppEventRoutes,
  AppEventSources,
  zAllEvents,
} from "@/extension/app-events";
import { CardStorage } from "@/card-storage";
import type * as vscode from "vscode";

type Range = vscode.Range;
type SymbolInformation = vscode.SymbolInformation;
type DocumentSymbol = vscode.DocumentSymbol;
type UriType = vscode.Uri;
import { CardData } from "@/EventTypes";

export type SymbolAnchor = {
  type: "symbol";
  label: string;
  range: Range;
  selectionRange: Range;
  target: SymbolInformation | DocumentSymbol;
  uri: UriType;
}; /**
 * Shape of the event payload when the symbol path under the cursor changes.
 * labels are guaranteed unique (LocationFinder flattens & constructs unique names).
 */

export interface SymbolPathChangeEvent {
  type: "symbolsChanged";
  uri: UriType;
  version: number; // TextDocument version at sampling time
  symbols: CardData[]; // Same order as labels
}
interface SymbolRequest {
  type: "symbolRequest";
}
export type SymbolEvents = SymbolPathChangeEvent | SymbolRequest;

export interface WorkspaceRegistrationRequest {
  workspaceId: string;
  workspaceName?: string;
  rootPath?: string;
}

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
}; /**
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

export type EventsTo<Target extends AppEventDestinations> = MergeUnionOfObjects<
  MergeUnionOfObjects<AppEventRoutes[AppEventSources]>[Target]
>;

export type EventsFrom<Source extends keyof AppEventRoutes> =
  MergeUnionOfObjects<AppEventRoutes[Source][keyof AppEventRoutes[Source]]>;

export type RoutedEvents<
  Source extends keyof AppEventRoutes,
  Target extends keyof AppEventRoutes,
> = Target extends keyof AppEventRoutes[Source]
  ? AppEventRoutes[Source][Target]
  : never;

export interface WorkspaceRegistrationResponse {
  success: boolean;
  workspaceId: string;
  error?: string;
  cardsByBoard: ReturnType<CardStorage["getCardsByBoard"]>;
}
export type AppEventUnion = z.infer<typeof zAllEvents>;

export type Public<T> = {
  [K in keyof T]: T[K];
};
