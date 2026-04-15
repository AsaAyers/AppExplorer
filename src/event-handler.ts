import type { Socket } from "socket.io-client";
import invariant from "tiny-invariant";
import { z } from "zod";

import {
  EventsFrom,
  EventsTo,
  MergeUnionOfObjects,
  SocketEntity,
  SocketEventMap,
  SocketEventSchemaMap,
  socketEntities,
  socketEventMap,
} from "./socket-events";

type InboundSchemaMap<Target extends SocketEntity> = MergeUnionOfObjects<
  {
    [Source in keyof SocketEventSchemaMap]: Target extends keyof SocketEventSchemaMap[Source]
      ? SocketEventSchemaMap[Source][Target]
      : never;
  }[keyof SocketEventSchemaMap]
>;

type InboundHandlerMap<Target extends SocketEntity> = MergeUnionOfObjects<
  {
    [Source in keyof SocketEventMap]: Target extends keyof SocketEventMap[Source]
      ? SocketEventMap[Source][Target]
      : never;
  }[keyof SocketEventMap]
>;

type OutboundSchemaMap<Source extends SocketEntity> = MergeUnionOfObjects<
  SocketEventSchemaMap[Source][keyof SocketEventSchemaMap[Source]]
>;

type OutboundHandlerMap<Source extends SocketEntity> = MergeUnionOfObjects<
  SocketEventMap[Source][keyof SocketEventMap[Source]]
>;

type HandlerMethodName<EventName extends string> = `on${Capitalize<EventName>}`;

export type HandlerMethodMap<Target extends SocketEntity> = {
  [EventName in keyof InboundHandlerMap<Target> &
    string as HandlerMethodName<EventName>]: InboundHandlerMap<Target>[EventName];
};

type EventSignature<
  Events,
  EventName extends keyof Events,
> = Events[EventName] extends (...args: infer Args) => infer Result
  ? { args: Args; return: Result }
  : never;

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

const toHandlerMethodName = <EventName extends string>(
  eventName: EventName,
): HandlerMethodName<EventName> =>
  `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}` as HandlerMethodName<EventName>;

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

export abstract class EventHandler<Self extends SocketEntity> {
  protected abstract readonly self: Self;
  protected abstract readonly handlerMethods: HandlerMethodMap<Self>;
  protected readonly socket: Socket<EventsTo<Self>, EventsFrom<Self>>;

  constructor(socket: Socket<EventsTo<Self>, EventsFrom<Self>>) {
    this.socket = socket;
  }

  static create<Self extends SocketEntity, Handler extends EventHandler<Self>>(
    this: new (socket: Socket<EventsTo<Self>, EventsFrom<Self>>) => Handler,
    socket: Socket<EventsTo<Self>, EventsFrom<Self>>,
  ) {
    const instance = new this(socket);
    instance.registerHandlers();
    return instance;
  }

  public emit<
    EventName extends keyof OutboundHandlerMap<Self> &
      keyof EventsFrom<Self> &
      string,
  >(
    eventName: EventName,
    ...args: EventSignature<OutboundHandlerMap<Self>, EventName>["args"]
  ): EventSignature<OutboundHandlerMap<Self>, EventName>["return"] {
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
    }) as EventSignature<OutboundHandlerMap<Self>, EventName>["return"];
  }

  private registerHandlers(): void {
    const wrappedHandlers = this.wrapHandlers(this.handlerMethods);
    const inboundSchemas = getInboundSchemas(this.self);
    const eventNames = Object.keys(inboundSchemas) as Array<
      keyof InboundSchemaMap<Self> &
        keyof InboundHandlerMap<Self> &
        string &
        keyof EventsTo<Self>
    >;

    for (const eventName of eventNames) {
      const handlerMethodName = toHandlerMethodName(eventName);
      const handler = wrappedHandlers[handlerMethodName];
      if (typeof handler !== "function") {
        throw new Error(
          `Missing handler method ${String(handlerMethodName)} for event ${String(eventName)}`,
        );
      }
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

      this.socket.on(eventName, callbackHandler as any);
    }
  }

  private wrapHandlers<Handlers extends HandlerMethodMap<Self>>(
    handlers: Handlers,
  ): Handlers {
    const inboundSchemas = getInboundSchemas(this.self);
    const wrappedHandlers = { ...handlers } as Handlers;
    const eventNames = Object.keys(inboundSchemas) as Array<
      keyof InboundSchemaMap<Self> & keyof InboundHandlerMap<Self> & string
    >;

    for (const eventName of eventNames) {
      const handlerMethodName = toHandlerMethodName(
        eventName,
      ) as keyof Handlers;
      const handler = handlers[handlerMethodName];
      const schema = inboundSchemas[eventName];

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

export type MiroSocket = Socket<EventsTo<"miro">, EventsFrom<"miro">>;
