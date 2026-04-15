import { Socket as ServerSocket } from "socket.io";
import type { Socket as ClientSocket } from "socket.io-client";
import invariant from "tiny-invariant";
import { z } from "zod";

import {
  EventsFrom,
  EventsTo,
  MergeUnionOfObjects,
  RoutedEvents,
  SocketEntity,
  SocketEventMap,
  SocketEventSchemaMap,
  socketEntities,
  socketEventMap,
} from "./socket-events";
import { EventMapType } from "./utils/bindHandlers";

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

type EventHandlerSocket<
  Self extends SocketEntity,
  Sources extends SocketEntity = Exclude<SocketEntity, Self>,
> =
  IsRoutedMode<Sources> extends true
    ? ServerSocket<
        SourceSocketEventMap<Sources>,
        SourceSocketResponseMap<Sources>
      >
    : ClientSocket<EventsTo<Self>, EventsFrom<Self>>;

type InboundSchemaMap<
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

type OutboundSchemaMap<Source extends SocketEntity> = MergeUnionOfObjects<
  SocketEventSchemaMap[Source][keyof SocketEventSchemaMap[Source]]
>;

type OutboundHandlerMap<Source extends SocketEntity> = MergeUnionOfObjects<
  SocketEventMap[Source][keyof SocketEventMap[Source]]
>;

type IncomingSchemaMap<
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

type OutgoingHandlerMap<
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

type EventSignature<
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

type SocketLifecycleEvents = ClientSocketLifecycleEvents &
  ServerSocketLifecycleEvents;

type RoutedEventMap<
  Source extends SocketEntity,
  Target extends SocketEntity,
> = Source extends keyof SocketEventMap
  ? Target extends keyof SocketEventMap[Source]
    ? RoutedEvents<Source, Target>
    : never
  : never;

type EventHandlerIncomingEventMap<
  Self extends SocketEntity,
  Sources extends SocketEntity,
> =
  IsRoutedMode<Sources> extends true
    ? RoutedEventMap<Sources, Self>
    : EventsTo<Self>;

type SocketListener<
  Self extends SocketEntity,
  Sources extends SocketEntity,
  EventName extends string,
> = EventName extends keyof EventHandlerIncomingEventMap<Self, Sources>
  ? EventHandlerIncomingEventMap<Self, Sources>[EventName]
  : EventName extends keyof SocketLifecycleEvents
    ? SocketLifecycleEvents[EventName]
    : (...args: unknown[]) => void;

type ClientSocketOnEventName<Self extends SocketEntity> =
  | (keyof EventsTo<Self> & string)
  | (keyof ClientSocketLifecycleEvents & string);

type ServerSocketOnEventName<Sources extends SocketEntity> =
  | (keyof SourceSocketEventMap<Sources> & string)
  | (keyof ServerSocketLifecycleEvents & string);

const isClientSocket = (
  socket: object,
): socket is ClientSocket<EventMapType, EventMapType> => "io" in socket;

const isServerSocket = (
  socket: object,
): socket is ServerSocket<EventMapType, EventMapType> => "server" in socket;

const getInboundSchemas = <Target extends SocketEntity>(
  target: Target,
): InboundSchemaMap<Target> => {
  const schemas: Partial<InboundSchemaMap<Target>> = {};

  for (const source of socketEntities) {
    const sourceSchemas = socketEventMap[source] as Partial<
      Record<SocketEntity, InboundSchemaMap<Target>>
    >;
    const targetSchemas = sourceSchemas[target];
    if (targetSchemas) {
      Object.assign(schemas, targetSchemas);
    }
  }

  return schemas as InboundSchemaMap<Target>;
};

const getOutboundSchemas = <Source extends SocketEntity>(
  source: Source,
): OutboundSchemaMap<Source> => {
  const schemas: Partial<OutboundSchemaMap<Source>> = {};

  for (const targetSchemas of Object.values(socketEventMap[source])) {
    Object.assign(schemas, targetSchemas);
  }

  return schemas as OutboundSchemaMap<Source>;
};

type EventNameFromHandlerMethodName<MethodName extends string> =
  MethodName extends `on${infer EventName}` ? Uncapitalize<EventName> : never;

const toEventName = <MethodName extends `on${string}`>(
  handlerMethodName: MethodName,
): EventNameFromHandlerMethodName<MethodName> =>
  `${handlerMethodName.charAt(2).toLowerCase()}${handlerMethodName.slice(3)}` as EventNameFromHandlerMethodName<MethodName>;

const serializeForError = (value: unknown): string => {
  try {
    return (
      JSON.stringify(
        value,
        (_key, currentValue) =>
          currentValue === undefined ? "__undefined__" : currentValue,
        2,
      ) ?? String(value)
    );
  } catch {
    return String(value);
  }
};

const contextualizeValidationError = (
  direction: "emit" | "handler",
  self: SocketEntity,
  eventName: string,
  args: unknown[],
  error: unknown,
): Error | unknown => {
  if (error instanceof z.ZodError) {
    return new Error(
      `Socket ${direction} validation failed for ${self}.${eventName}\nArgs: ${serializeForError(args)}\nIssues: ${JSON.stringify(error.issues, null, 2)}`,
    );
  }

  return error;
};

const returnsVoid = (schema: z.ZodFunction): boolean =>
  schema.def.output instanceof z.ZodPromise &&
  schema.def.output.def.innerType instanceof z.ZodVoid;

export abstract class EventHandler<
  Self extends SocketEntity,
  EventSources extends SocketEntity = Exclude<SocketEntity, Self>,
> {
  protected abstract readonly self: Self;
  protected abstract readonly handlerMethods: HandlerMethodMap<
    Self,
    EventSources
  >;
  protected readonly socket: EventHandlerSocket<Self, EventSources>;

  constructor(socket: EventHandlerSocket<Self, EventSources>) {
    this.socket = socket;
  }

  static create<Args extends unknown[], Instance>(
    this: new (...args: Args) => Instance,
    ...args: Args
  ): Instance {
    const instance = new this(...args);
    (instance as EventHandler<SocketEntity, SocketEntity>).registerHandlers();
    return instance;
  }

  public emit<
    EventName extends keyof OutgoingHandlerMap<Self, EventSources> & string,
  >(
    eventName: EventName,
    ...args: EventSignature<
      OutgoingHandlerMap<Self, EventSources>,
      EventName
    >["args"]
  ): EventSignature<
    OutgoingHandlerMap<Self, EventSources>,
    EventName
  >["return"] {
    const schema = (
      getOutboundSchemas(this.self) as Record<string, z.ZodFunction>
    )[eventName];
    invariant(
      schema instanceof z.ZodFunction,
      `No schema found for event ${String(eventName)}`,
    );

    const callSocket = schema.implementAsync(
      async (...validatedArgs: unknown[]) => {
        if (returnsVoid(schema)) {
          (this.socket.emit as unknown as (...socketArgs: unknown[]) => void)(
            eventName,
            ...validatedArgs,
          );
          return;
        }

        return (
          this.socket.emitWithAck as (
            ...socketArgs: unknown[]
          ) => Promise<unknown>
        )(eventName, ...validatedArgs);
      },
    );
    return callSocket(...args).catch((error) => {
      throw contextualizeValidationError(
        "emit",
        this.self,
        eventName,
        args,
        error,
      );
    }) as EventSignature<
      OutgoingHandlerMap<Self, EventSources>,
      EventName
    >["return"];
  }

  public on<
    EventName extends keyof EventHandlerIncomingEventMap<Self, EventSources> &
      string,
  >(
    eventName: EventName,
    listener: EventHandlerIncomingEventMap<Self, EventSources>[EventName],
  ): this;
  public on<EventName extends keyof SocketLifecycleEvents & string>(
    eventName: EventName,
    listener: SocketLifecycleEvents[EventName],
  ): this;
  public on<EventName extends string>(
    eventName: EventName,
    listener: SocketListener<Self, EventSources, EventName>,
  ): this {
    const socket = this.socket;

    if (isClientSocket(socket)) {
      (<Self extends SocketEntity>(
        socket: ClientSocket<EventMapType, EventMapType>,
        eventName: ClientSocketOnEventName<Self>,
        listener: (...args: unknown[]) => void,
      ) => {
        (
          socket.on as (
            eventName: ClientSocketOnEventName<Self>,
            listener: (...args: unknown[]) => void,
          ) => void
        )(eventName, listener);
      })(
        socket,
        eventName as ClientSocketOnEventName<Self>,
        listener as (...args: unknown[]) => void,
      );
      return this;
    }

    if (isServerSocket(socket)) {
      (<Sources extends SocketEntity>(
        socket: ServerSocket<EventMapType, EventMapType>,
        eventName: ServerSocketOnEventName<Sources>,
        listener: (...args: unknown[]) => void,
      ) => {
        (
          socket.on as (
            eventName: ServerSocketOnEventName<Sources>,
            listener: (...args: unknown[]) => void,
          ) => void
        )(eventName, listener);
      })(
        socket,
        eventName as ServerSocketOnEventName<EventSources>,
        listener as (...args: unknown[]) => void,
      );
    }

    return this;
  }

  public once<
    EventName extends keyof EventHandlerIncomingEventMap<Self, EventSources> &
      string,
  >(
    eventName: EventName,
    listener: EventHandlerIncomingEventMap<Self, EventSources>[EventName],
  ): this;
  public once<EventName extends keyof SocketLifecycleEvents & string>(
    eventName: EventName,
    listener: SocketLifecycleEvents[EventName],
  ): this;
  public once<EventName extends string>(
    eventName: EventName,
    listener: SocketListener<Self, EventSources, EventName>,
  ): this {
    const socket = this.socket;

    if (isClientSocket(socket)) {
      (<Self extends SocketEntity>(
        socket: ClientSocket<EventMapType, EventMapType>,
        eventName: ClientSocketOnEventName<Self>,
        listener: (...args: unknown[]) => void,
      ) => {
        (
          socket.once as (
            eventName: ClientSocketOnEventName<Self>,
            listener: (...args: unknown[]) => void,
          ) => void
        )(eventName, listener);
      })(
        socket,
        eventName as ClientSocketOnEventName<Self>,
        listener as (...args: unknown[]) => void,
      );
      return this;
    }

    if (isServerSocket(socket)) {
      (<Sources extends SocketEntity>(
        socket: ServerSocket<EventMapType, EventMapType>,
        eventName: ServerSocketOnEventName<Sources>,
        listener: (...args: unknown[]) => void,
      ) => {
        (
          socket.once as (
            eventName: ServerSocketOnEventName<Sources>,
            listener: (...args: unknown[]) => void,
          ) => void
        )(eventName, listener);
      })(
        socket,
        eventName as ServerSocketOnEventName<EventSources>,
        listener as (...args: unknown[]) => void,
      );
    }

    return this;
  }

  private registerHandlers(): void {
    const wrappedHandlers = this.wrapHandlers(this.handlerMethods);
    const incomingSchemas = getInboundSchemas(this.self);
    const handlerMethodNames = Object.keys(wrappedHandlers) as Array<
      keyof HandlerMethodMap<Self, EventSources> & string
    >;

    for (const handlerMethodName of handlerMethodNames) {
      const eventName = toEventName(
        handlerMethodName,
      ) as unknown as keyof EventHandlerIncomingEventMap<Self, EventSources> &
        keyof IncomingSchemaMap<Self, EventSources> &
        string;
      const handler = wrappedHandlers[handlerMethodName];
      const schema = (incomingSchemas as Record<string, z.ZodFunction>)[
        eventName as unknown as string
      ];
      invariant(
        schema instanceof z.ZodFunction,
        `No schema found for event ${String(eventName)}`,
      );
      const asyncHandler = handler as unknown as (
        ...args: any[]
      ) => Promise<unknown>;

      const callbackHandler = async (...args: any[]) => {
        const callback = args.pop();
        try {
          const result = await asyncHandler(...args);
          callback(null, result);
        } catch (error) {
          callback(error instanceof Error ? error.message : error);
        }
      };

      this.on(eventName, callbackHandler as any);
    }
  }

  private wrapHandlers<Handlers extends HandlerMethodMap<Self, EventSources>>(
    handlers: Handlers,
  ): Handlers {
    const incomingSchemas = getInboundSchemas(this.self);
    const wrappedHandlers = { ...handlers } as Handlers;
    const handlerMethodNames = Object.keys(handlers) as Array<
      keyof Handlers & `on${string}`
    >;

    for (const handlerMethodName of handlerMethodNames) {
      const eventName = toEventName(
        handlerMethodName,
      ) as unknown as keyof IncomingSchemaMap<Self, EventSources> & string;
      const handler = handlers[handlerMethodName];
      const schema = (incomingSchemas as Record<string, z.ZodFunction>)[
        eventName as unknown as string
      ];

      if (schema instanceof z.ZodFunction && typeof handler === "function") {
        const functionSchema: z.ZodFunction = schema;
        const validatedHandler = functionSchema.implementAsync(
          handler as never,
        ) as (...args: unknown[]) => Promise<unknown>;
        wrappedHandlers[handlerMethodName] = (async (...args: unknown[]) => {
          try {
            return await validatedHandler(...args);
          } catch (error) {
            throw contextualizeValidationError(
              "handler",
              this.self,
              eventName,
              args,
              error,
            );
          }
        }) as Handlers[typeof handlerMethodName];
      }
    }

    return wrappedHandlers;
  }
}

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
