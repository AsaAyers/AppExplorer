import invariant from "tiny-invariant";
import * as vscode from "vscode";

import {
  type AppExplorerSession,
  parseSessionUri,
  zAppExplorerSession,
} from "@/app-explorer-session";
import { getHostConfig } from "@/host-config";
import { createDebug } from "@/utils/create-debug";
import { EventEmitter } from "@/utils/event-emitter";
import { WorkspaceCardStorage } from "@/workspace-card-storage";

const log = createDebug("app-explorer:extension-session");

const sessionBroadcastFileName = "session.json";

const serializeSession = (session: AppExplorerSession) =>
  JSON.stringify(session);

export class AppExplorerSessionCoordinator
  implements vscode.Disposable, vscode.UriHandler
{
  readonly #context: vscode.ExtensionContext;
  readonly #cardStorage: WorkspaceCardStorage;
  readonly #onDidStartSessionEmitter = new EventEmitter<AppExplorerSession>();
  readonly onDidStartSession = this.#onDidStartSessionEmitter.event;
  #sessionWatcher?: vscode.FileSystemWatcher;
  #currentSession?: AppExplorerSession;
  #currentSessionKey?: string;
  #startPromise?: Promise<void>;

  constructor(
    context: vscode.ExtensionContext,
    cardStorage: WorkspaceCardStorage,
  ) {
    this.#context = context;
    this.#cardStorage = cardStorage;
  }

  async initialize() {
    await vscode.workspace.fs.createDirectory(this.#context.globalStorageUri);
    this.#sessionWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        this.#context.globalStorageUri,
        sessionBroadcastFileName,
      ),
    );
    this.#sessionWatcher.onDidCreate(() => {
      void this.syncFromBroadcastFile().catch((error) => {
        log("Failed to sync session broadcast on create", { error });
      });
    });
    this.#sessionWatcher.onDidChange(() => {
      void this.syncFromBroadcastFile().catch((error) => {
        log("Failed to sync session broadcast on change", { error });
      });
    });
    this.#sessionWatcher.onDidDelete(() => {
      void this.disconnectSession(false).catch((error) => {
        log("Failed to disconnect session from delete", { error });
      });
    });

    try {
      await this.syncFromBroadcastFile();
    } catch (error) {
      log("Failed to hydrate session from broadcast file", { error });
    }
  }

  hasActiveSession() {
    return !!this.#currentSession;
  }

  getCurrentSession() {
    return this.#currentSession;
  }

  async waitForSessionStart() {
    if (this.#currentSession) {
      return this.#currentSession;
    }

    return new Promise<AppExplorerSession>((resolve) => {
      const subscription = this.onDidStartSession((session) => {
        subscription.dispose();
        resolve(session);
      });
    });
  }

  async handleUri(uri: vscode.Uri) {
    const session = parseSessionUri(
      `${uri.scheme}://${uri.authority}${uri.path}?${uri.query}`,
    );
    await this.writeSessionBroadcast(session);
    await this.startSession(session);
  }

  async disconnectSession(shouldDeleteBroadcast = true) {
    if (this.#currentSession || this.#cardStorage.socket?.connected) {
      await this.#cardStorage.disconnectSession();
    }

    this.#currentSession = undefined;
    this.#currentSessionKey = undefined;
    this.#startPromise = undefined;

    if (shouldDeleteBroadcast) {
      await this.deleteSessionBroadcast();
    }
  }

  async resumeActiveSession() {
    if (!this.#currentSession) {
      return;
    }
    await this.startSession(this.#currentSession);
  }

  dispose() {
    this.#onDidStartSessionEmitter.dispose();
    this.#sessionWatcher?.dispose();
  }

  private getSessionBroadcastUri() {
    return vscode.Uri.joinPath(
      this.#context.globalStorageUri,
      sessionBroadcastFileName,
    );
  }

  private async readSessionBroadcast() {
    try {
      const bytes = await vscode.workspace.fs.readFile(
        this.getSessionBroadcastUri(),
      );
      const value = JSON.parse(Buffer.from(bytes).toString("utf8"));
      const parsed = zAppExplorerSession.safeParse(value);
      if (!parsed.success) {
        log("Ignoring invalid session broadcast payload", { value });
        return undefined;
      }
      return parsed.data;
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : undefined;
      if (code === "FileNotFound") {
        return undefined;
      }
      throw error;
    }
  }

  private async writeSessionBroadcast(session: AppExplorerSession) {
    await vscode.workspace.fs.writeFile(
      this.getSessionBroadcastUri(),
      Buffer.from(JSON.stringify(session), "utf8"),
    );
  }

  private async deleteSessionBroadcast() {
    try {
      await vscode.workspace.fs.delete(this.getSessionBroadcastUri());
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : undefined;
      if (code !== "FileNotFound") {
        throw error;
      }
    }
  }

  private async syncFromBroadcastFile() {
    const broadcastSession = await this.readSessionBroadcast();
    if (!broadcastSession) {
      return;
    }

    const sessionKey = serializeSession(broadcastSession);
    if (sessionKey === this.#currentSessionKey) {
      return;
    }

    await this.startSession(broadcastSession);
  }

  private async startSession(session: AppExplorerSession) {
    const sessionKey = serializeSession(session);
    if (this.#currentSessionKey === sessionKey && this.#startPromise) {
      return this.#startPromise;
    }

    const previousSession = this.#currentSession;
    const previousSessionKey = this.#currentSessionKey;
    this.#currentSession = session;
    this.#currentSessionKey = sessionKey;

    this.#startPromise = (async () => {
      this.#cardStorage.attachSession(session);

      const { origin } = getHostConfig(session.hostIndex);
      log("(session_start)", {
        hostIndex: session.hostIndex,
        hostOrigin: origin,
        sessionToken: session.sessionToken,
      });

      await this.connectWorkspaceSocket();
      this.#onDidStartSessionEmitter.fire(session);
    })();

    try {
      await this.#startPromise;
    } catch (error) {
      this.#currentSession = previousSession;
      this.#currentSessionKey = previousSessionKey;
      throw error;
    } finally {
      this.#startPromise = undefined;
    }
  }

  private async connectWorkspaceSocket() {
    if (this.#cardStorage.socket?.connected) {
      return;
    }

    const socket = this.#cardStorage.socket;
    invariant(socket, "Expected socket to be initialized by this point");

    await new Promise<void>((resolve, reject) => {
      let lastError: unknown;
      const timeout = setTimeout(() => {
        cleanup();
        reject(lastError ?? new Error("Timed out connecting workspace socket"));
      }, 10000);
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: unknown) => {
        lastError = error;
        log("(workspace_socket_error)", { error });
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      };

      socket.on("connect", onConnect);
      socket.on("connect_error", onError);
      socket.connect();
    });
  }
}
