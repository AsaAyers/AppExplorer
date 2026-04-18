import fs from "node:fs";
import path from "node:path";

import * as vscode from "vscode";

import { AppExplorerLens } from "./app-explorer-lens";
import { MemoryAdapter } from "./card-storage";
import { makeNavigationHandler } from "./commands/navigate";
import { registerUpdateCommand } from "./commands/update-extension";
import { EditorDecorator } from "./editor-decorator";
import { AppExplorerSessionCoordinator } from "./extension-session";
import { LocationFinder } from "./location-finder";
import { logger as baseLogger, logger } from "./logger";
import { MiroServer } from "./server/server";
import { StatusBarManager } from "./status-bar-manager";
import { listenToAllEvents } from "./test/helpers/listen-to-all-events";
import { createDebug } from "./utils/create-debug";
import { WorkspaceCardStorage } from "./workspace-card-storage";
const debug = createDebug("app-explorer:extension");
export type HandlerContext = {
  cardStorage: WorkspaceCardStorage;
  locationFinder: LocationFinder;
  waitForConnections: () => Promise<void>;
};

export type ExtensionApi = {
  __watchOutput: (debugValue: string, callback: (line: string) => void) => void;
};

declare global {
  var extensionContext: vscode.ExtensionContext;
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<ExtensionApi> {
  globalThis.extensionContext = context;
  setUpdateCommandContext(context);
  vscode.commands.executeCommand("setContext", "appExplorer.enabled", true);

  baseLogger.initialize();

  const locationFinder = new LocationFinder();
  const cardStorage = new WorkspaceCardStorage(new MemoryAdapter(), {
    locationFinder,
  });
  listenToAllEvents(cardStorage, (eventName, ...args) => {
    debug("storage event", eventName, args);
  });
  // Log port configuration for debugging

  const sessionCoordinator = new AppExplorerSessionCoordinator(
    context,
    cardStorage,
  );
  context.subscriptions.push(sessionCoordinator);
  context.subscriptions.push(
    vscode.window.registerUriHandler(sessionCoordinator),
  );
  await sessionCoordinator.initialize();

  cardStorage.on("disconnect", () => {
    if (!sessionCoordinator.hasActiveSession()) {
      return;
    }
    debug("Server disconnected");
    return sessionCoordinator.resumeActiveSession();
  });

  debug("AppExplorer extension activating");

  context.subscriptions.push(new StatusBarManager(cardStorage));

  // Create handler context with the proxy as the only CardStorage
  const handlerContext: HandlerContext = {
    cardStorage,
    locationFinder,
    async waitForConnections() {
      await sessionCoordinator.waitForSessionStart();
      debug("Waiting for connections...");
      if (handlerContext.cardStorage.getConnectedBoards().length > 0) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "AppExplorer: Waiting for connections...",
          cancellable: true,
        },
        async (_progress, token) => {
          token.onCancellationRequested(() => {
            debug("User canceled the long running operation");
          });

          while (handlerContext.cardStorage.getConnectedBoards().length === 0) {
            debug(
              "Waiting for connections...",
              cardStorage.getConnectedBoards(),
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        },
      );
      debug("Finished waiting for connections");
    },
  };

  context.subscriptions.push(
    new EditorDecorator(handlerContext),
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      new AppExplorerLens(handlerContext),
    ),
    vscode.commands.registerCommand("app-explorer.disconnectSession", () =>
      sessionCoordinator.disconnectSession(),
    ),
    vscode.commands.registerCommand(
      "app-explorer.navigate",
      makeNavigationHandler(handlerContext),
    ),
  );

  registerUpdateCommand(context);
  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    setUpdateCommandContext(context);
  });

  return {
    __watchOutput(debugValue: string, callback: (line: string) => void) {
      createDebug.enable(debugValue);

      context.subscriptions.push(logger.monitor(callback));
      debug(`Watching output ${debugValue}`);
    },
  };
}

function setUpdateCommandContext(context: vscode.ExtensionContext) {
  let updateWorkspacePath: string | undefined = undefined;
  let myPackagedJson: Awaited<typeof import("../package.json")> | undefined =
    undefined;
  try {
    myPackagedJson = JSON.parse(
      fs.readFileSync(path.join(context.extensionPath, "package.json"), {
        encoding: "utf8",
      }),
    );
    if (!myPackagedJson) {
      return;
    }
  } catch {
    return;
  }
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const packageJsonPath = path.join(folder.uri.fsPath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8"),
          );
          if (
            packageJson.name === myPackagedJson.name &&
            packageJson.version === myPackagedJson.version &&
            packageJson.publisher === myPackagedJson.publisher
          ) {
            updateWorkspacePath = folder.uri.fsPath;
            MiroServer.publicPath = path.join(
              path.dirname(packageJsonPath),
              "public",
            );
            break;
          }
          debug("public path", MiroServer.publicPath);
        } catch (error) {
          debug("Error parsing package.json:", error);
        }
      }
    }
  }
  vscode.commands.executeCommand(
    "setContext",
    "app-explorer.enableUpdate",
    !!updateWorkspacePath,
  );
  context.workspaceState.update("updateWorkspacePath", updateWorkspacePath);
}

export function deactivate() {
  vscode.commands.executeCommand("setContext", "appExplorer.enabled", false);
  vscode.commands.executeCommand(
    "setContext",
    "app-explorer.enableUpdate",
    false,
  );
}

export function selectRangeInEditor(
  range: vscode.Range,
  editor: vscode.TextEditor,
) {
  const newSelection = new vscode.Selection(range.start, range.end);
  editor.selection = newSelection;
  editor.revealRange(newSelection);
}
