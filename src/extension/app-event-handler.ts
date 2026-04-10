/* eslint-disable @typescript-eslint/no-explicit-any */
import { addMinutes } from "date-fns";
import { Socket } from "socket.io-client";
import invariant from "tiny-invariant";
import { z } from "zod";

import {
  AppEventDestinations,
  AsSocketEvents,
  HandlersFor,
  zEncryptedEvent,
} from "@/extension/app-events";
import {
  AppEventUnion,
  EventsFrom,
  EventsTo,
  MergeUnionOfObjects,
} from "@/extension/types";
import { attachSocketHandlers } from "@/extension/utils/attach-socket-handlers";
interface Disposable {
  dispose(): void;
}
import { AppExplorerChannel } from "@/utils/broadcast-channel";
import { decrypt, encrypt } from "@/utils/crypto";
import { debugLog } from "@/utils/debug-log";
import { EncryptablePayload } from "@/utils/session";

type EncryptedEvent = z.infer<typeof zEncryptedEvent>;
export type NamedSocket<T extends AppEventDestinations> = Socket<
  AsSocketEvents<MergeUnionOfObjects<EventsTo<T>>>,
  AsSocketEvents<{ encryptedEvent: z.infer<typeof zEncryptedEvent> }>
>;
type EventFrom<
  Target extends AppEventDestinations,
  EventName extends keyof EventsFrom<Target>,
> = EventsFrom<Target>[EventName];
type EventResult<T> = T extends { result?: infer R } ? R : undefined;

export abstract class AppEventHandler<
  Target extends AppEventDestinations,
  Transport extends "socket" | "channel" = "socket",
> implements Disposable {
  abstract handlers: HandlersFor<Target, Transport>; // = this.makeHandlers({});

  protected key?: Uint8Array<ArrayBuffer>;

  async emit<EventName extends keyof EventsFrom<Target>>(
    type: EventName,
    e: EventFrom<Target, EventName>,
  ): Promise<EventResult<EventFrom<Target, EventName>>> {
    this.log("emit", type, { channel: !!this.channel, socket: !!this.socket });

    if (this.channel) {
      this.channel.postMessage(e as AppEventUnion);
    }
    if (this.socket) {
      invariant(
        this.key,
        this.log.namespace + " Missing key for encrypted socket events",
      );
      const event = await this.encryptEvent(e as AppEventUnion);
      const encryptedResult = await this.socket.emitWithAck(
        "encryptedEvent",
        event,
      );
      if (typeof encryptedResult !== "string") {
        return undefined as EventResult<EventFrom<Target, EventName>>;
      }

      const result = (await this.decryptResult(encryptedResult)) as EventResult<
        EventFrom<Target, EventName>
      >;

      return result;
    }
    return undefined as EventResult<EventFrom<Target, EventName>>;
  }

  protected target: Target;
  protected channel?: AppExplorerChannel;
  protected socket?: NamedSocket<Target>;
  protected log: ReturnType<typeof debugLog>;

  constructor(target: Target, transport: Transport) {
    this.target = target;
    this.log = debugLog(`handler:${target}:${transport}`);
  }

  onHandlerCalled(_str: string, event: any) {
    this.log("onHandlerCalled", event.type);
  }
  makeHandlers(
    h: HandlersFor<Target, Transport>,
  ): HandlersFor<Target, Transport> {
    return wrapFunctions(h, (key, ...args) => {
      this.onHandlerCalled(key as string, args[0]);
    });
  }

  protected handleEncryptedEvent = async (
    key: Uint8Array<ArrayBuffer>,
    e: EncryptedEvent,
    done: (r: NonNullable<z.infer<typeof zEncryptedEvent>["result"]>) => void,
  ) => {
    invariant(key, "Missing key for encrypted event handling");
    const decryptedEvent = await decrypt<
      Exclude<AppEventUnion, { type: "encryptedEvent" }>
    >(e.enc, key);

    invariant(decryptedEvent, "Failed to decrypt event");
    const type = decryptedEvent.type;
    const handlerName = `on${captialize(type)}`;
    // @ts-expect-error without knowing the subclass, TS can't verify that the
    // handler exists.
    const handler = this.handlers[handlerName];

    this.log("handling ecryptedEvent", handlerName);
    let acknowledged = false;
    const ack = async (result: unknown) => {
      acknowledged = true;
      done(await encrypt({ result }, key));
    };

    await handler(decryptedEvent as any, ack);
    if (!acknowledged) {
      await ack(null);
    }
  };

  protected attachSocket(socket: NamedSocket<Target>) {
    this.socket?.disconnect();
    this.socket = socket;
    this.subscriptions.push(attachSocketHandlers(socket, this.handlers));
    this.subscriptions.push({
      dispose() {
        socket.disconnect();
      },
    });
    return this.socket;
  }

  protected attachChannel(channel: AppExplorerChannel) {
    this.channel?.dispose();

    this.channel = channel;
    const handler = ({ data }: MessageEvent<AppEventUnion>) => {
      const handlerName =
        `on${captialize(data.type)}` as keyof typeof this.handlers;
      const handler = this.handlers[handlerName];
      this.log("channel", handlerName);
      if (typeof handler === "function") {
        handler(data);
      }
    };
    channel.addEventListener("message", handler);
    this.subscriptions.push(channel);
  }

  protected async decryptResult(
    encryptedResult: string,
  ): Promise<NonNullable<Extract<AppEventUnion, { result?: any }>["result"]>> {
    invariant(this.key, "Missing key for decryption");
    const data = await decrypt<{ result: any } & EncryptablePayload>(
      encryptedResult,
      this.key,
    );
    this.log("decryptResult", encryptedResult);
    invariant(data !== undefined, "Failed to decrypt result");

    return data.result;
  }

  protected getEncryptedDestination(): EncryptedEvent["dest"] {
    if (this.target === "workspace") {
      return "miro";
    }
    if (this.target === "miroBackground") {
      return "workspace";
    }

    invariant(false, `${this.target} unsupported encrypted destination`);
  }

  protected async encryptEvent(event: AppEventUnion) {
    const expiresAt = addMinutes(new Date(), 1);
    invariant(this.key, "Missing key for encryption");
    const enc = await encrypt(
      {
        ...event,
        expiresAt,
      },
      this.key,
    );

    const encryptedEvent = {
      type: "encryptedEvent",
      dest: this.getEncryptedDestination(),
      enc,
    } as const;
    return encryptedEvent;
  }

  protected subscriptions: Disposable[] = [];
  public dispose(): void {
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.subscriptions.length = 0;
    this.socket?.disconnect();
  }
}

function captialize<T extends string>(type: T) {
  return (type[0].toUpperCase() + type.substring(1)) as Capitalize<T>;
}

function typedEntries<T extends object>(
  obj: T,
): { [K in keyof T]: [K, T[K]] }[keyof T][] {
  return Object.entries(obj) as any;
}

function wrapFunctions<T extends Record<string, (...args: any[]) => any>>(
  obj: T,
  fn: <K extends keyof T>(key: K, ...args: any[]) => void,
): T {
  const result = {} as T;

  for (const [key, value] of typedEntries(obj)) {
    // @ts-expect-error This has a subtype issue
    result[key] = function (
      ...args: Parameters<T[typeof key]>
    ): ReturnType<T[typeof key]> {
      fn(key, ...args);
      return value(...args);
    };
  }

  return result;
}
