import { debugLog } from "@/utils/debug-log";
import type * as vscode from "vscode";

const log = debugLog("event-emitter");

export class EventEmitter<T> implements vscode.EventEmitter<T> {
  listeners = new Set<(event: T) => void>();

  dispose() {
    this.listeners.clear();
  }

  event(listener: (e: T) => void) {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  fire(event: T) {
    log(
      `Sending ${(event as { type?: string })?.type ?? "(unknown)"} to ${this.listeners.size} listeners`,
    );
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
