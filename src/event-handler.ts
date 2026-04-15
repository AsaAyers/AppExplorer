import type { Socket } from "socket.io-client";
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

export type InboundSchemaMap<Target extends SocketEntity> = MergeUnionOfObjects<
  {
    [Source in keyof SocketEventSchemaMap]: Target extends keyof SocketEventSchemaMap[Source]
      ? SocketEventSchemaMap[Source][Target]
      : never;
  }[keyof SocketEventSchemaMap]
>;

export type InboundHandlerMap<Target extends SocketEntity> =
  MergeUnionOfObjects<
    {
      [Source in keyof SocketEventMap]: Target extends keyof SocketEventMap[Source]
        ? SocketEventMap[Source][Target]
        : never;
    }[keyof SocketEventMap]
  >;

type Last<T extends unknown[]> = T extends [...infer _, infer L] ? L : never;
type AllButLast<T extends unknown[]> = T extends [...infer H, infer _]
  ? H
  : never;
type FirstArg<T> = T extends (arg: infer Param, ...rest: unknown[]) => unknown
  ? Param
  : never;

const isZodFunction = <Schema>(
  schema: Schema,
): schema is Extract<Schema, z.ZodFunction> => schema instanceof z.ZodFunction;

const isImplementableHandler = <Schema extends z.ZodFunction>(
  handler: unknown,
  _schema: Schema,
): handler is z.input<Schema> => typeof handler === "function";

const implementAsync = <Schema extends z.ZodFunction>(
  schema: Schema,
  handler: z.input<Schema>,
): z.output<Schema> =>
  schema.implementAsync(handler as never) as z.output<Schema>;

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

export abstract class EventHandler<Self extends keyof SocketEventMap> {
  protected readonly self: Self;

  protected readonly socket: Socket<EventsTo<Self>, EventsFrom<Self>>;

  protected handlers: Partial<InboundHandlerMap<Self>>;

  protected constructor(
    self: Self,
    socket: Socket<EventsTo<Self>, EventsFrom<Self>>,
    handlers: Partial<InboundHandlerMap<Self>>,
  ) {
    this.self = self;
    this.socket = socket;
    this.handlers = this.wrapHandlers(handlers);

    for (const e in this.handlers) {
      const eventName = e as keyof EventsTo<Self> & keyof typeof this.handlers;

      const handler = this.handlers[eventName] as any;
      if (typeof handler !== "function") {
        continue;
      }
      const callbackHandler = async (...args: any[]) => {
        const callback = args.pop();
        try {
          const result = await handler(...args);
          callback(null, result);
        } catch (error) {
          callback(error instanceof Error ? error.message : error);
        }
      };
      // Its not worth the effort to make sure that callbackHandler's types are
      // correct.  So the callbackHandler is generic and then typed as an "any".
      this.socket.on(eventName, callbackHandler as any);
    }
  }

  protected emit<EventName extends keyof EventsFrom<Self> & (string | symbol)>(
    eventName: EventName,
    ...args: AllButLast<Parameters<EventsFrom<Self>[EventName]>>
  ): Promise<FirstArg<Last<Parameters<EventsFrom<Self>[EventName]>>>> {
    return this.socket.emitWithAck(eventName, ...args) as Promise<
      FirstArg<Last<Parameters<EventsFrom<Self>[EventName]>>>
    >;
  }

  private wrapHandlers<Handlers extends Partial<InboundHandlerMap<Self>>>(
    handlers: Handlers,
  ): Handlers {
    const inboundSchemas = getInboundSchemas(this.self);
    const wrappedHandlers = { ...handlers } as Handlers;

    for (const eventName in handlers) {
      const eventKey = eventName as unknown as keyof Handlers &
        keyof InboundSchemaMap<Self>;
      const handler = handlers[eventKey];
      const schema = inboundSchemas[eventKey];

      if (isZodFunction(schema) && isImplementableHandler(handler, schema)) {
        wrappedHandlers[eventKey] = implementAsync(
          schema,
          handler,
        ) as Handlers[typeof eventKey];
      }
    }

    return wrappedHandlers;
  }
}
export type MiroSocket = Socket<EventsTo<"miro">, EventsFrom<"miro">>;
