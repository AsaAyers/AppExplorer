import { Debugger } from "debug";
import { Socket as ServerSocket } from "socket.io";
import type { Socket as ClientSocket } from "socket.io-client";
import invariant from "tiny-invariant";
import { Disposable } from "vscode";
import { z } from "zod";

import {
  encryptedEventName,
  SocketEntity,
  socketEntities,
  socketEventMap,
  zEncryptedEvent,
} from "../socket-events";
import {
  EventHandlerOptOutError,
  serializeEventHandlerError,
} from "../unhandled-event-ack";
import { decrypt, encrypt } from "../utils/crypto";

import type {
  InboundSchemaMap,
  OutboundSchemaMap,
  HandlerMethodMap,
  EventHandlerSocket,
  OutgoingHandlerMap,
  EventSignature,
  EventHandlerIncomingEventMap,
  SocketLifecycleEvents,
  SocketListener,
  IncomingSchemaMap,
  EventNameFromHandlerMethodName,
} from "./types";

import { AppExplorerSession } from "@/app-explorer-session";
import { createDebug } from "@/utils/create-debug";
import { fromHex } from "@/utils/to-hex";

const isClientSocket = <T>(
  socket: T,
): socket is Extract<T, InferClientSocket<T>> =>
  typeof socket === "object" && socket !== null && "io" in socket;

type InferClientSocket<T> =
  T extends ClientSocket<infer L, infer E> ? ClientSocket<L, E> : never;

// Extract the concrete listen/emit maps from a value's static type.
//
// Why this helper exists:
// - `infer` only introduces type variables *inside* a conditional type branch.
// - If we write `socket is ServerSocket<L, E>` directly on the function return type,
//   `L`/`E` are out of scope because they were never declared at the function level.
// - By capturing them in `InferServerSocket<T>`, the guard can return a valid
//   predicate while preserving the specific event-map types when available.
type InferServerSocket<T> =
  T extends ServerSocket<infer L, infer E> ? ServerSocket<L, E> : never;

const isServerSocket = <T>(
  socket: T,
): socket is Extract<T, InferServerSocket<T>> =>
  typeof socket === "object" && socket !== null && "server" in socket;

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

const unwrapSocketAckValue = (value: unknown) =>
  Array.isArray(value) && value[0] === null ? value[1] : value;

export abstract class EventHandler<
  SelfName extends SocketEntity,
  EventSources extends SocketEntity = Exclude<SocketEntity, SelfName>,
> {
  protected abstract readonly selfName: SelfName;
  protected abstract readonly handlerMethods: HandlerMethodMap<
    SelfName,
    EventSources
  >;
  protected readonly socket: EventHandlerSocket<SelfName, EventSources>;
  log: Debugger;

  #subscriptions: Array<Disposable> = [];
  #session?: AppExplorerSession;

  constructor(socket: EventHandlerSocket<SelfName, EventSources>) {
    this.socket = socket;
    this.log = createDebug(`app-explorer:event-handler`);
  }

  attachSession(session: AppExplorerSession) {
    this.#session = session;
  }

  protected optOut(): never {
    throw new EventHandlerOptOutError();
  }

  static create<
    Args extends unknown[],
    Instance = EventHandler<SocketEntity, SocketEntity>,
  >(this: new (...args: Args) => Instance, ...args: Args): Instance {
    const instance = new this(...args);
    (instance as EventHandler<SocketEntity, SocketEntity>).registerHandlers();
    return instance;
  }

  public emit<
    EventName extends keyof OutgoingHandlerMap<SelfName, EventSources> & string,
  >(
    eventName: EventName,
    ...args: EventSignature<
      OutgoingHandlerMap<SelfName, EventSources>,
      EventName
    >["args"]
  ): EventSignature<
    OutgoingHandlerMap<SelfName, EventSources>,
    EventName
  >["return"] {
    const schema = (
      getOutboundSchemas(this.selfName) as Record<string, z.ZodFunction>
    )[eventName];
    invariant(
      schema instanceof z.ZodFunction,
      `No schema found for event ${String(eventName)}`,
    );

    const callSocket = schema.implementAsync(
      async (...validatedArgs: unknown[]) => {
        if (returnsVoid(schema)) {
          this.log(`Emitting event ${this.selfName}.${eventName}`);
          (this.socket.emit as unknown as (...socketArgs: unknown[]) => void)(
            eventName,
            ...validatedArgs,
          );
          return;
        }

        this.log(`Calling event ${this.selfName}.${eventName}`);
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
        this.selfName,
        eventName,
        args,
        error,
      );
    }) as EventSignature<
      OutgoingHandlerMap<SelfName, EventSources>,
      EventName
    >["return"];
  }

  public emitEncrypted<
    EventName extends keyof OutgoingHandlerMap<SelfName, EventSources> & string,
  >(
    eventName: EventName,
    ...args: EventSignature<
      OutgoingHandlerMap<SelfName, EventSources>,
      EventName
    >["args"]
  ): EventSignature<
    OutgoingHandlerMap<SelfName, EventSources>,
    EventName
  >["return"] {
    const schema = (
      getOutboundSchemas(this.selfName) as Record<string, z.ZodFunction>
    )[eventName];
    invariant(
      schema instanceof z.ZodFunction,
      `No schema found for event ${String(eventName)}`,
    );

    invariant(
      this.#session,
      "Session must be attached to encrypt encrypted events",
    );
    const callSocket = schema.implementAsync(
      async (...validatedArgs: unknown[]) => {
        const encryptedPayload = await this.encryptEncryptedEnvelope(
          eventName,
          validatedArgs,
        );

        if (returnsVoid(schema)) {
          this.log(`Emitting encrypted event ${this.selfName}.${eventName}`);
          (this.socket.emit as unknown as (...socketArgs: unknown[]) => void)(
            encryptedEventName,
            encryptedPayload,
          );
          return;
        }

        this.log(`Calling encrypted event ${this.selfName}.${eventName}`);
        const encryptedResult = await (
          this.socket.emitWithAck as (
            ...socketArgs: unknown[]
          ) => Promise<unknown>
        )(encryptedEventName, encryptedPayload);

        return this.decryptEncryptedResult(eventName, schema, encryptedResult);
      },
    );

    return callSocket(...args).catch((error) => {
      throw contextualizeValidationError(
        "emit",
        this.selfName,
        eventName,
        args,
        error,
      );
    }) as EventSignature<
      OutgoingHandlerMap<SelfName, EventSources>,
      EventName
    >["return"];
  }

  public on<EventName extends keyof SocketLifecycleEvents & string>(
    eventName: EventName,
    listener: SocketLifecycleEvents[EventName],
  ): this;
  public on<
    EventName extends keyof EventHandlerIncomingEventMap<
      SelfName,
      EventSources
    > &
      string,
  >(
    eventName: EventName,
    listener: EventHandlerIncomingEventMap<SelfName, EventSources>[EventName],
  ): this;
  public on<EventName extends string>(
    eventName: EventName,
    listener: SocketListener<SelfName, EventSources, EventName>,
  ): this {
    const socket = this.socket;

    if (isClientSocket(socket)) {
      const s: ClientSocket = socket;
      s.on(eventName as any, listener as any);
      this.#subscriptions.push({
        dispose: () => s.off(eventName as any, listener as any),
      });
    } else if (isServerSocket(socket)) {
      const s: ServerSocket = socket;
      s.on(eventName as any, listener as any);
      this.#subscriptions.push({
        dispose: () => s.off(eventName as any, listener as any),
      });
    }

    return this;
  }

  public once<EventName extends keyof SocketLifecycleEvents & string>(
    eventName: EventName,
    listener: SocketLifecycleEvents[EventName],
  ): this;
  public once<
    EventName extends keyof EventHandlerIncomingEventMap<
      SelfName,
      EventSources
    > &
      string,
  >(
    eventName: EventName,
    listener: EventHandlerIncomingEventMap<SelfName, EventSources>[EventName],
  ): this {
    const socket = this.socket;

    /**
     * TypeScript says that the .once implementations don't share a signature,
     * so they have to be split up to know which function signature to use. But
     * then I don't have a way to ensure that server-only eventNames are sent to
     * the server and client-only event names are sent to the client. Its also
     * difficult to assure TypeScript that this listener is the specific
     * listener for this event, so it needs an any too.
     */
    if (isClientSocket(socket)) {
      socket.once(eventName as any, listener as any);
      this.#subscriptions.push({
        dispose: () => socket.off(eventName as any, listener as any),
      });
    }
    if (isServerSocket(socket)) {
      socket.once(eventName as any, listener as any);
      this.#subscriptions.push({
        dispose: () => socket.off(eventName as any, listener as any),
      });
    }

    return this;
  }

  public off<EventName extends keyof SocketLifecycleEvents & string>(
    eventName: EventName,
    listener: SocketLifecycleEvents[EventName],
  ): this;
  public off<
    EventName extends keyof EventHandlerIncomingEventMap<
      SelfName,
      EventSources
    > &
      string,
  >(
    eventName: EventName,
    listener: EventHandlerIncomingEventMap<SelfName, EventSources>[EventName],
  ): this;
  public off<EventName extends string>(
    eventName: EventName,
    listener: SocketListener<SelfName, EventSources, EventName>,
  ): this {
    const socket = this.socket;

    if (isClientSocket(socket)) {
      socket.off(eventName as any, listener as any);
    } else if (isServerSocket(socket)) {
      socket.off(eventName as any, listener as any);
    }

    return this;
  }

  private registerHandlers(): void {
    this.log = this.log.extend(this.selfName);
    const wrappedHandlers = this.wrapHandlers(this.handlerMethods);
    const incomingSchemas = getInboundSchemas(this.selfName);
    const handlerMethodNames = Object.keys(wrappedHandlers) as Array<
      keyof HandlerMethodMap<SelfName, EventSources> & string
    >;

    for (const handlerMethodName of handlerMethodNames) {
      const eventName = toEventName(
        handlerMethodName,
      ) as unknown as keyof EventHandlerIncomingEventMap<
        SelfName,
        EventSources
      > &
        keyof IncomingSchemaMap<SelfName, EventSources> &
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
        let callback = null;
        if (!returnsVoid(schema)) {
          callback = args.pop();
        }

        try {
          const result = await asyncHandler(...args);
          callback?.(null, result);
        } catch (error) {
          callback?.(serializeEventHandlerError(error));
        }
      };

      const encryptedHandler = async (...args: unknown[]) => {
        let callback: ((...callbackArgs: unknown[]) => void) | undefined;
        const maybeCallback = args.at(-1);
        if (typeof maybeCallback === "function") {
          callback = args.pop() as (...callbackArgs: unknown[]) => void;
        }

        try {
          const decryptedArgs = await this.decryptEncryptedArgs(
            eventName,
            schema,
            args[0],
          );
          if (!decryptedArgs) {
            return;
          }

          const result = await asyncHandler(...decryptedArgs);
          if (returnsVoid(schema)) {
            return;
          }

          const encryptedResult = await this.encryptEncryptedResult(
            eventName,
            schema,
            result,
          );
          callback?.(null, encryptedResult);
        } catch (error) {
          callback?.(serializeEventHandlerError(error));
        }
      };

      this.on(eventName, callbackHandler as any);
      this.on(encryptedEventName as any, encryptedHandler as any);
    }
  }

  private wrapHandlers<
    Handlers extends HandlerMethodMap<SelfName, EventSources>,
  >(handlers: Handlers): Handlers {
    const incomingSchemas = getInboundSchemas(this.selfName);
    const wrappedHandlers = { ...handlers } as Handlers;
    const handlerMethodNames = Object.keys(handlers) as Array<
      keyof Handlers & `on${string}`
    >;

    for (const handlerMethodName of handlerMethodNames) {
      const eventName = toEventName(
        handlerMethodName,
      ) as unknown as keyof IncomingSchemaMap<SelfName, EventSources> & string;
      const handler = handlers[handlerMethodName];
      const schema = (incomingSchemas as Record<string, z.ZodFunction>)[
        eventName as unknown as string
      ];

      if (schema instanceof z.ZodFunction && typeof handler === "function") {
        wrappedHandlers[handlerMethodName] = (async (...args: unknown[]) => {
          try {
            const validatedArgs = await (
              schema.def.input as unknown as z.ZodType<unknown[]>
            ).parseAsync(args);
            const result = await (
              handler as (...args: unknown[]) => Promise<unknown>
            )(...validatedArgs);
            return await this.getOutputSchema(schema).parseAsync(result);
          } catch (error) {
            throw contextualizeValidationError(
              "handler",
              this.selfName,
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

  private getOutputSchema(schema: z.ZodFunction) {
    return (
      schema.def.output instanceof z.ZodPromise
        ? schema.def.output.def.innerType
        : schema.def.output
    ) as z.ZodType<unknown>;
  }

  private async encryptEncryptedEnvelope(eventName: string, args: unknown[]) {
    invariant(
      this.#session,
      "Session must be attached to encrypt encrypted events",
    );
    return encrypt(
      {
        sessionId: this.#session.sessionId,
        eventName,
        args,
      },
      fromHex(this.#session.key),
    );
  }

  private async parseEncryptedEnvelope(payload: unknown) {
    invariant(
      this.#session,
      "Session must be attached to decrypt encrypted events",
    );
    const encryptedPayload = z.string().parse(unwrapSocketAckValue(payload));
    const decryptedPayload = await decrypt(
      encryptedPayload,
      fromHex(this.#session.key),
    );

    invariant(decryptedPayload, "Failed to decrypt encrypted event payload");

    const parsedPayload = zEncryptedEvent.safeParse(decryptedPayload);
    invariant(
      parsedPayload.success,
      `Invalid encrypted event payload: ${serializeForError(decryptedPayload)}`,
    );

    return parsedPayload.data;
  }

  private async decryptEncryptedArgs(
    expectedEventName: string,
    schema: z.ZodFunction,
    payload: unknown,
  ) {
    const parsedPayload = await this.parseEncryptedEnvelope(payload);
    if (
      parsedPayload.sessionId !== this.#session?.sessionId ||
      parsedPayload.eventName !== expectedEventName
    ) {
      return null;
    }

    return (schema.def.input as unknown as z.ZodType<unknown[]>).parseAsync(
      parsedPayload.args,
    );
  }

  private async encryptEncryptedResult(
    eventName: string,
    schema: z.ZodFunction,
    result: unknown,
  ) {
    const validatedResult =
      await this.getOutputSchema(schema).parseAsync(result);
    return this.encryptEncryptedEnvelope(eventName, [validatedResult]);
  }

  private async decryptEncryptedResult(
    eventName: string,
    schema: z.ZodFunction,
    payload: unknown,
  ) {
    const parsedPayload = await this.parseEncryptedEnvelope(payload);
    invariant(
      parsedPayload.sessionId === this.#session?.sessionId &&
        parsedPayload.eventName === eventName,
      `Encrypted result mismatch for ${eventName}`,
    );
    invariant(
      parsedPayload.args.length === 1,
      `Encrypted result for ${eventName} must contain exactly one value`,
    );

    return this.getOutputSchema(schema).parseAsync(parsedPayload.args[0]);
  }

  hasSession = () => !!this.#session;

  dispose() {
    for (const subscription of this.#subscriptions) {
      subscription.dispose();
    }
    this.#subscriptions = [];
  }
}
