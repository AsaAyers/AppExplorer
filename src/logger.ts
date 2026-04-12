import { formatWithOptions } from "node:util";

import baseDebug from "debug";
import * as vscode from "vscode";

import { createDebug } from "./utils/create-debug";

baseDebug.inspectOpts ??= {};
baseDebug.inspectOpts.hideDate = true;
const log = createDebug("app-explorer:logger");

createDebug.enable("app-explorer:*");

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface PrefixedLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export class Logger {
  private outputChannel: vscode.OutputChannel;
  private static instance?: Logger;
  logUri: vscode.Uri | undefined;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      "AppExplorer",
      "log",
    );

    this.outputChannel.appendLine("Logger initialized");

    baseDebug.log = this.log;
  }

  logMonitor: undefined | ((line: string) => void);

  /**
   * This is used for capturing test logs, so it only needs to keep track of 1 callback at a time.
   */
  monitor(callback: (line: string) => void): { dispose(): unknown } {
    this.logMonitor = callback;
    return {
      dispose: () => {
        this.logMonitor = undefined;
      },
    };
  }

  appendLine(line: string) {
    this.outputChannel.appendLine(line);
    this.logMonitor?.(line);
  }

  log = (message: unknown, ...args: unknown[]) => {
    const formatedMessage = formatWithOptions(
      { colors: false, compact: true, maxArrayLength: 10, sorted: true },
      message,
      ...args.map(cleanCardEvents),
    );
    this.outputChannel.appendLine(formatedMessage);
    this.logMonitor?.(formatedMessage);
  };

  /**
   * Get the singleton logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Initialize the logger with feature flag manager
   */
  initialize(): void {
    // Show the output channel if debug mode is enabled
    const config = vscode.workspace.getConfiguration("appExplorer");
    const debug = config.get<string>("debug");

    if (debug) {
      // createDebug.enable(debug);
      this.outputChannel.show(true); // true = preserve focus
      this.outputChannel.appendLine(
        "[logger] Debug mode enabled - AppExplorer output channel shown",
      );
    }
  }

  /**
   * Dispose of the output channel
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export singleton instance for easy importing
export const logger = Logger.getInstance();

const cleanMap = new WeakMap<object, boolean>();
function cleanCardEvents<T>(eventFragment: T): T {
  if (Array.isArray(eventFragment)) {
    return eventFragment.map(cleanCardEvents) as T;
  }
  if (typeof eventFragment === "object" && eventFragment !== null) {
    if (cleanMap.get(eventFragment)) {
      return eventFragment;
    }
    cleanMap.set(eventFragment, true);

    if (
      "miroLink" in eventFragment &&
      "boardId" in eventFragment &&
      "title" in eventFragment
    ) {
      return `(card: ${eventFragment.title})` as T;
    }

    const cleaned = Object.fromEntries(
      Object.entries(eventFragment).map(([key, value]) => {
        if (typeof value === "function") {
          return [key, value.toString()];
        }
        if (value && key === "cards") {
          if (Array.isArray(value)) {
            return [key, `(${value.length} cards)`];
          }

          return [key, `(${Object.keys(value).length} cards)`];
        }
        if (value && key === "card") {
          return [key, `(${value.miroLink})`];
        }

        return [key, cleanCardEvents(value)];
      }),
    );
    cleanMap.delete(eventFragment);
    return cleaned as T;
  }

  return eventFragment;
}
