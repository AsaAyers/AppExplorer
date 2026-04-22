import * as vscode from "vscode";

import { OnboardingState } from "@/onboarding-state";
import { createDebug } from "@/utils/create-debug";
import { WorkspaceCardStorage } from "@/workspace-card-storage";
const debug = createDebug("app-explorer:status-bar-manager");

export class StatusBarManager {
  public statusBar: vscode.StatusBarItem;
  readonly #disposables: vscode.Disposable[] = [];
  private eventListeners: {
    boardUpdate: () => void;
    cardUpdate: () => void;
    connectedBoards: () => void;
    workspaceBoards: () => void;
  };

  #cardStorage: WorkspaceCardStorage;
  #onboardingState: OnboardingState;
  constructor(
    cardStorage: WorkspaceCardStorage,
    onboardingState: OnboardingState,
  ) {
    this.#cardStorage = cardStorage;
    this.#onboardingState = onboardingState;
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    debug("Setup status bar");

    // Create event listener functions that can be removed later
    this.eventListeners = {
      boardUpdate: () => this.renderStatusBar(),
      cardUpdate: () => this.renderStatusBar(),
      connectedBoards: () => this.renderStatusBar(),
      workspaceBoards: () => this.renderStatusBar(),
    };

    // Add event listeners
    this.#cardStorage.on("boardUpdate", this.eventListeners.boardUpdate);
    this.#cardStorage.on("cardUpdate", this.eventListeners.cardUpdate);
    this.#cardStorage.on(
      "connectedBoards",
      this.eventListeners.connectedBoards,
    );
    this.#cardStorage.on(
      "workspaceBoards",
      this.eventListeners.workspaceBoards,
    );
    this.#disposables.push(
      this.#onboardingState.onDidChange(() => {
        this.renderStatusBar();
      }),
      vscode.window.onDidChangeWindowState(() => {
        this.renderStatusBar();
      }),
    );
    this.renderStatusBar();
  }

  dispose() {
    // Remove event listeners to prevent memory leaks
    this.#cardStorage.off("boardUpdate", this.eventListeners.boardUpdate);
    this.#cardStorage.off("cardUpdate", this.eventListeners.cardUpdate);
    this.#cardStorage.off(
      "connectedBoards",
      this.eventListeners.connectedBoards,
    );
    this.#cardStorage.off(
      "workspaceBoards",
      this.eventListeners.workspaceBoards,
    );
    this.#disposables.forEach((disposable) => {
      disposable.dispose();
    });

    // Dispose of status bar
    this.statusBar.dispose();
  }

  renderStatusBar() {
    if (!this.#onboardingState.hasCompletedFirstSession()) {
      this.statusBar.text = "$(app-explorer) Set up AppExplorer";
      this.statusBar.tooltip =
        "Open the AppExplorer welcome walkthrough and install the Miro app";
      this.statusBar.command = "app-explorer.openWelcome";
      debug(this.statusBar.text);
      this.statusBar.show();
      return;
    }

    const connectedBoards = this.#cardStorage.getConnectedBoards();
    if (connectedBoards.length >= 0) {
      // this.statusBar.text = "$(app-explorer) (No Miro connections)";
      // } else {
      const boardIds = this.#cardStorage.listBoardIds();
      const allCards = this.#cardStorage.listAllCards();
      const totalCards = allCards.length;

      const disconnected = allCards.filter(
        (card) => card.status === "disconnected",
      ).length;

      this.statusBar.text = `$(app-explorer) (${totalCards} $(preview) ${boardIds.length} $(window)${
        disconnected > 0 ? `, ${disconnected} $(debug-disconnect)` : ""
      })`;
    }

    this.statusBar.command = undefined;
    this.statusBar.tooltip = "AppExplorer board and card status";
    debug(this.statusBar.text);
    this.statusBar.show();
  }
}
