import * as vscode from "vscode";

export class EventEmitter<T> implements vscode.Disposable {
  #listeners = new Set<(event: T) => void>();

  readonly event = (listener: (event: T) => void): vscode.Disposable => {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  };

  fire(event: T) {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  dispose() {
    this.#listeners.clear();
  }
}
