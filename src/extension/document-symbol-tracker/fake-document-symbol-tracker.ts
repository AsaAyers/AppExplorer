import {
  defaultDemoWorkspaceFile,
  getDemoWorkspaceCardsAroundCursor,
  toDemoWorkspaceFsPath,
} from "@/extension/document-symbol-tracker/demo-workspace";
import { SymbolEvents, type CardData } from "@/extension/types";
import { EventEmitter } from "@/extension/utils/event-emitter";
import { Uri } from "@/extension/vscode-adapter/adapter";
import { debugLog } from "@/utils/debug-log";

const log = debugLog("symbol-tracker:fake");

export class FakeDocumentSymbolTracker extends EventEmitter<SymbolEvents> {
  private activePath = defaultDemoWorkspaceFile.path;
  private cursorOffset = 0;

  constructor() {
    super();
    this.event((event) => {
      if (event.type === "symbolRequest") {
        this.emitBuiltInSymbols();
      }
    });
  }

  setCursor(path: string, offset: number) {
    this.activePath = path;
    this.cursorOffset = offset;
    this.emitBuiltInSymbols();
  }

  emitBuiltInSymbols() {
    const cards = getDemoWorkspaceCardsAroundCursor(
      this.activePath,
      this.cursorOffset,
    );
    this.fire({
      type: "symbolsChanged",
      uri: Uri.file(toDemoWorkspaceFsPath(this.activePath)),
      version: 1,
      symbols: cards,
    });
  }

  emitSymbolsChanged(symbols: CardData[], path: string) {
    this.fire({
      type: "symbolsChanged",
      uri: Uri.file(path),
      version: 1,
      symbols,
    });
  }
}
