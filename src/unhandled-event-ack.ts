const EVENT_HANDLER_OPT_OUT_CODE = "app-explorer.event-handler-opt-out";

export class EventHandlerOptOutError extends Error {
  readonly code = EVENT_HANDLER_OPT_OUT_CODE;

  constructor(message = "Event handler opted out") {
    super(message);
    this.name = "EventHandlerOptOutError";
  }
}

export const isEventHandlerOptOutError = (value: unknown): boolean =>
  value instanceof EventHandlerOptOutError ||
  (typeof value === "object" &&
    value !== null &&
    "code" in value &&
    value.code === EVENT_HANDLER_OPT_OUT_CODE);

export const serializeEventHandlerError = (value: unknown): unknown => {
  if (isEventHandlerOptOutError(value)) {
    const message =
      value instanceof Error ? value.message : "Event handler opted out";
    return {
      code: EVENT_HANDLER_OPT_OUT_CODE,
      message,
      name: "EventHandlerOptOutError",
    };
  }

  return value instanceof Error ? value.message : value;
};
