import { Namespace, Socket as ServerSocket } from "socket.io";

import {
  SocketEntity,
  MergeUnionOfObjects,
  SocketEventSchemaMap,
  SocketEventMap,
  RoutedEvents,
  SocketIoEventMap,
} from "@/socket-events";
import type { ClientSocket } from "@/socketio";

type SourceSocketEventMap<Sources extends SocketEntity> = MergeUnionOfObjects<
  {
    [Source in Sources]: EventsFrom<Source>;
  }[Sources]
>;
type SourceSocketResponseMap<Sources extends SocketEntity> =
  MergeUnionOfObjects<
    {
      [Source in Sources]: EventsTo<Source>;
    }[Sources]
  >;
type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;
type IsRoutedMode<Sources extends SocketEntity> =
  IsUnion<Sources> extends true ? false : true;
export type EventHandlerSocket<
  Self extends SocketEntity,
  Sources extends SocketEntity = Exclude<SocketEntity, Self>,
> =
  IsRoutedMode<Sources> extends true
    ? ServerSocket<
        SourceSocketEventMap<Sources>,
        SourceSocketResponseMap<Sources>
      >
    : ClientSocket<EventsTo<Self>, EventsFrom<Self>>;
export type InboundSchemaMap<
  Target extends SocketEntity,
  Sources extends SocketEntity = Exclude<SocketEntity, Target>,
> = MergeUnionOfObjects<
  {
    [Source in Sources]: Source extends keyof SocketEventSchemaMap
      ? Target extends keyof SocketEventSchemaMap[Source]
        ? SocketEventSchemaMap[Source][Target]
        : never
      : never;
  }[Sources]
>;
type InboundHandlerMap<
  Target extends SocketEntity,
  Sources extends SocketEntity = Exclude<SocketEntity, Target>,
> = MergeUnionOfObjects<
  {
    [Source in Sources]: Source extends keyof SocketEventMap
      ? Target extends keyof SocketEventMap[Source]
        ? SocketEventMap[Source][Target]
        : never
      : never;
  }[Sources]
>;
type RoutedSchemaMap<
  Source extends SocketEntity,
  Target extends SocketEntity,
> = Source extends keyof SocketEventSchemaMap
  ? Target extends keyof SocketEventSchemaMap[Source]
    ? SocketEventSchemaMap[Source][Target]
    : never
  : never;
type RoutedHandlerMap<
  Source extends SocketEntity,
  Target extends SocketEntity,
> = Source extends keyof SocketEventMap
  ? Target extends keyof SocketEventMap[Source]
    ? SocketEventMap[Source][Target]
    : never
  : never;
export type OutboundSchemaMap<Source extends SocketEntity> =
  MergeUnionOfObjects<
    SocketEventSchemaMap[Source][keyof SocketEventSchemaMap[Source]]
  >;
type OutboundHandlerMap<Source extends SocketEntity> = MergeUnionOfObjects<
  SocketEventMap[Source][keyof SocketEventMap[Source]]
>;
export type IncomingSchemaMap<
  Self extends SocketEntity,
  Sources extends SocketEntity,
> =
  IsRoutedMode<Sources> extends true
    ? RoutedSchemaMap<Sources, Self>
    : InboundSchemaMap<Self, Sources>;
type IncomingHandlerMap<
  Self extends SocketEntity,
  Sources extends SocketEntity,
> =
  IsRoutedMode<Sources> extends true
    ? RoutedHandlerMap<Sources, Self>
    : InboundHandlerMap<Self, Sources>;
export type OutgoingHandlerMap<
  Self extends SocketEntity,
  Sources extends SocketEntity,
> =
  IsRoutedMode<Sources> extends true
    ? RoutedHandlerMap<Self, Sources>
    : OutboundHandlerMap<Self>;
type HandlerMethodName<EventName extends string> = `on${Capitalize<EventName>}`;

export type HandlerMethodMap<
  Self extends SocketEntity,
  Sources extends SocketEntity = Exclude<SocketEntity, Self>,
> = {
  [EventName in keyof IncomingHandlerMap<Self, Sources> &
    string as HandlerMethodName<EventName>]: IncomingHandlerMap<
    Self,
    Sources
  >[EventName];
};

export type OutboundHandlerMethodMap<Source extends SocketEntity> = {
  [EventName in keyof OutboundHandlerMap<Source> &
    string as HandlerMethodName<EventName>]: OutboundHandlerMap<Source>[EventName];
};
export type EventSignature<
  Events,
  EventName extends keyof Events,
> = Events[EventName] extends (...args: infer Args) => infer Result
  ? { args: Args; return: Result }
  : never;
type ClientSocketLifecycleEvents = {
  connect: () => void;
  connect_error: (error: unknown) => void;
  disconnect: (...args: unknown[]) => void;
};
type ServerSocketLifecycleEvents = {
  disconnect: (...args: unknown[]) => void;
  disconnecting: (...args: unknown[]) => void;
  error: (error: unknown) => void;
};
export type SocketLifecycleEvents = ClientSocketLifecycleEvents &
  ServerSocketLifecycleEvents;
type RoutedEventMap<
  Source extends SocketEntity,
  Target extends SocketEntity,
> = Source extends keyof SocketEventMap
  ? Target extends keyof SocketEventMap[Source]
    ? RoutedEvents<Source, Target>
    : never
  : never;
export type EventHandlerIncomingEventMap<
  Self extends SocketEntity,
  Sources extends SocketEntity,
> =
  IsRoutedMode<Sources> extends true
    ? RoutedEventMap<Sources, Self>
    : EventsTo<Self>;
export type SocketListener<
  Self extends SocketEntity,
  Sources extends SocketEntity,
  EventName extends string,
> = EventName extends keyof EventHandlerIncomingEventMap<Self, Sources>
  ? EventHandlerIncomingEventMap<Self, Sources>[EventName]
  : EventName extends keyof SocketLifecycleEvents
    ? SocketLifecycleEvents[EventName]
    : (...args: unknown[]) => void;
export type ClientSocketOnEventName<Self extends SocketEntity> =
  | (keyof EventsTo<Self> & string)
  | (keyof ClientSocketLifecycleEvents & string);
export type ServerSocketOnEventName<Sources extends SocketEntity> =
  | (keyof SourceSocketEventMap<Sources> & string)
  | (keyof ServerSocketLifecycleEvents & string);
export type EventNameFromHandlerMethodName<MethodName extends string> =
  MethodName extends `on${infer EventName}` ? Uncapitalize<EventName> : never;
export type MiroSocket = ClientSocket<EventsTo<"miro">, EventsFrom<"miro">>;
export type WorkspaceSocket = ClientSocket<
  EventsTo<"workspace">,
  EventsFrom<"workspace">
>;
export type SidebarSocket = ClientSocket<
  EventsTo<"sidebar">,
  EventsFrom<"sidebar">
>;
export type MiroServerSocket = ServerSocket<
  EventsFrom<"miro">,
  EventsTo<"miro">
>;
export type WorkspaceServerSocket = ServerSocket<
  EventsFrom<"workspace">,
  EventsTo<"workspace">
>;
export type SidebarServerSocket = ServerSocket<
  EventsFrom<"sidebar">,
  EventsTo<"sidebar">
>;
export type WorkspaceNamespace = Namespace<
  EventsFrom<"workspace">,
  EventsTo<"workspace">
>;
export type SidebarNamespace = Namespace<
  EventsFrom<"sidebar">,
  EventsTo<"sidebar">
>; /**
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
