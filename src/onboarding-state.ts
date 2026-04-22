import * as vscode from "vscode";
import { z } from "zod";

import { createDebug } from "@/utils/create-debug";
import { EventEmitter } from "@/utils/event-emitter";

const onboardingBroadcastFileName = "onboarding.json";
const log = createDebug("app-explorer:onboarding-state");

export const appExplorerWalkthroughId = "appExplorerGettingStarted";
export const miroAppInstallUrl =
  "https://miro.com/app-install/?response_type=code&client_id=3458764531189693223&redirect_uri=http%3A%2F%2Flocalhost%3A9042%2F";

export type OnboardingSnapshot = {
  hasCompletedFirstSession: boolean;
  lastSeenWelcomeVersion?: string;
};

const zOnboardingSnapshot = z.object({
  hasCompletedFirstSession: z.boolean().default(false),
  lastSeenWelcomeVersion: z.string().optional(),
});

type OnboardingPersistence = {
  initialize(): Promise<void>;
  read(): Promise<OnboardingSnapshot>;
  write(snapshot: OnboardingSnapshot): Promise<void>;
  watch(listener: () => void): vscode.Disposable;
};

export class OnboardingState implements vscode.Disposable {
  readonly #persistence: OnboardingPersistence;
  readonly #currentVersion: string;
  readonly #onDidChangeEmitter = new EventEmitter<OnboardingSnapshot>();
  readonly onDidChange = this.#onDidChangeEmitter.event;
  #snapshot: OnboardingSnapshot = {
    hasCompletedFirstSession: false,
  };
  #watcher?: vscode.Disposable;

  constructor(persistence: OnboardingPersistence, currentVersion: string) {
    this.#persistence = persistence;
    this.#currentVersion = currentVersion;
  }

  async initialize() {
    await this.#persistence.initialize();
    this.#watcher = this.#persistence.watch(() => {
      void this.syncFromPersistence().catch((error) => {
        log("Failed to sync onboarding state from broadcast", { error });
      });
    });
    await this.syncFromPersistence();
  }

  hasCompletedFirstSession() {
    return this.#snapshot.hasCompletedFirstSession;
  }

  shouldShowWelcomeOnActivate() {
    return (
      !this.hasCompletedFirstSession() &&
      this.#snapshot.lastSeenWelcomeVersion !== this.#currentVersion
    );
  }

  async markWelcomeShown() {
    if (this.#snapshot.lastSeenWelcomeVersion === this.#currentVersion) {
      return;
    }

    await this.updateSnapshot({
      ...this.#snapshot,
      lastSeenWelcomeVersion: this.#currentVersion,
    });
  }

  async completeFirstSession() {
    if (this.hasCompletedFirstSession()) {
      return;
    }

    await this.updateSnapshot({
      ...this.#snapshot,
      hasCompletedFirstSession: true,
    });
  }

  getSnapshot(): OnboardingSnapshot {
    return { ...this.#snapshot };
  }

  dispose() {
    this.#watcher?.dispose();
    this.#onDidChangeEmitter.dispose();
  }

  private async syncFromPersistence() {
    const nextSnapshot = await this.#persistence.read();
    if (serializeSnapshot(nextSnapshot) === serializeSnapshot(this.#snapshot)) {
      return;
    }

    this.#snapshot = nextSnapshot;
    this.#onDidChangeEmitter.fire(this.getSnapshot());
  }

  private async updateSnapshot(nextSnapshot: OnboardingSnapshot) {
    if (serializeSnapshot(nextSnapshot) === serializeSnapshot(this.#snapshot)) {
      return;
    }

    this.#snapshot = nextSnapshot;
    await this.#persistence.write(this.#snapshot);
    this.#onDidChangeEmitter.fire(this.getSnapshot());
  }
}

export const getWalkthroughSelector = (extensionId: string) =>
  `${extensionId}#${appExplorerWalkthroughId}`;

export async function openAppExplorerWalkthrough(extensionId: string) {
  await vscode.commands.executeCommand(
    "workbench.action.openWalkthrough",
    getWalkthroughSelector(extensionId),
    false,
  );
}

export async function openMiroAppInstallPage() {
  await vscode.env.openExternal(vscode.Uri.parse(miroAppInstallUrl));
}

export class GlobalOnboardingPersistence implements OnboardingPersistence {
  readonly #context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.#context = context;
  }

  async initialize() {
    await vscode.workspace.fs.createDirectory(this.#context.globalStorageUri);
  }

  async read(): Promise<OnboardingSnapshot> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.getBroadcastUri());
      const value = JSON.parse(Buffer.from(bytes).toString("utf8"));
      const parsed = zOnboardingSnapshot.safeParse(value);
      if (!parsed.success) {
        log("Ignoring invalid onboarding broadcast payload", { value });
        return defaultSnapshot();
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
        return defaultSnapshot();
      }
      throw error;
    }
  }

  async write(snapshot: OnboardingSnapshot) {
    await vscode.workspace.fs.writeFile(
      this.getBroadcastUri(),
      Buffer.from(JSON.stringify(snapshot), "utf8"),
    );
  }

  watch(listener: () => void): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        this.#context.globalStorageUri,
        onboardingBroadcastFileName,
      ),
    );
    watcher.onDidCreate(listener);
    watcher.onDidChange(listener);
    watcher.onDidDelete(listener);
    return watcher;
  }

  private getBroadcastUri() {
    return vscode.Uri.joinPath(
      this.#context.globalStorageUri,
      onboardingBroadcastFileName,
    );
  }
}

export class MemoryOnboardingPersistence implements OnboardingPersistence {
  #snapshot = defaultSnapshot();
  readonly #listeners = new Set<() => void>();

  async initialize() {}

  async read() {
    return { ...this.#snapshot };
  }

  async write(snapshot: OnboardingSnapshot) {
    this.#snapshot = { ...snapshot };
    for (const listener of this.#listeners) {
      listener();
    }
  }

  watch(listener: () => void): vscode.Disposable {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }
}

function defaultSnapshot(): OnboardingSnapshot {
  return {
    hasCompletedFirstSession: false,
  };
}

function serializeSnapshot(snapshot: OnboardingSnapshot) {
  return JSON.stringify(snapshot);
}
