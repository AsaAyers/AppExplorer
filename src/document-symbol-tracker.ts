import * as vscode from "vscode";

import { SymbolAnchor, CardData } from "@/card-data";
import { getGitHubUrl } from "@/get-github-url";
import { getRelativePath } from "@/get-relative-path";
import { LocationFinder } from "@/location-finder";
import { createDebug } from "@/utils/create-debug";
import { sha256 } from "@/utils/crypto";
const log = createDebug("app-explorer:document-symbol-tracker");

/**
 * Shape of the event payload when the symbol path under the cursor changes.
 * labels are guaranteed unique (LocationFinder flattens & constructs unique names).
 */
export interface SymbolPathChangeEvent {
  type: "symbolsChanged";
  uri: vscode.Uri;
  version: number; // TextDocument version at sampling time
  symbols: CardData[]; // Same order as labels
  force: boolean;
}

interface SymbolRequest {
  type: "symbolRequest";
}

type SymbolEvents = SymbolPathChangeEvent | SymbolRequest;

/**
 * Tracks the chain of symbols enclosing the active editor's primary cursor.
 * Emits a SymbolPathChangeEvent when that chain changes (by content edits or cursor moves).
 * Uses LocationFinder.findSymbolsAroundCursor which already returns flattened, unique labels.
 */
export class DocumentSymbolTracker
  extends vscode.EventEmitter<SymbolEvents>
  implements vscode.Disposable
{
  private finder: LocationFinder;
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  /**
   * Only track the symbols in editor files (scheme "file") to avoid noise
   * from outputs, settings, etc.
   */
  private activeTextEditor: vscode.TextEditor | null = null;
  constructor(finder: LocationFinder, debounceMs = 400) {
    super();
    this.debounceMs = debounceMs;
    this.finder = finder;

    this.event((e) => {
      if (e.type === "symbolRequest") {
        this.refresh(true); // force refresh on request
      }
    });

    // Text changes (could alter symbol structure / ranges)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (
          ["file"].includes(e.document.uri.scheme) &&
          e.document === this.activeTextEditor?.document
        ) {
          log("(scheme)", e.document.uri.scheme, e.document.uri.path);
          this.schedule();
        }
      }),
    );
    // Cursor / selection movements (symbol path can change without edits)
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor === this.activeTextEditor) {
          this.schedule(true); // something
        }
      }),
    );
    // Active editor changed
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        if (vscode.window.activeTextEditor?.document.uri.scheme === "file") {
          this.activeTextEditor = vscode.window.activeTextEditor;
          this.schedule();
        }
      }),
    );
    // Opened doc (useful if LS warm-up completes only after open)
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc === this.activeTextEditor?.document) {
          this.schedule();
        }
      }),
    );
  }

  /** Force immediate refresh (ignores debounce). */
  public async forceRefresh() {
    await this.refresh();
  }

  private schedule(fast = false) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const delay = fast ? Math.min(120, this.debounceMs / 3) : this.debounceMs;
    this.debounceTimer = setTimeout(() => this.refresh(), delay);
  }

  private async refresh(force = false) {
    this.debounceTimer = null;
    const editor = this.activeTextEditor;
    if (!editor) {
      return;
    }
    const doc = editor.document;
    const position = editor.selection.active;
    try {
      const symbols = await this.finder.findSymbolsAroundCursor(
        doc.uri,
        position,
      );
      this.emitSymbols(symbols, doc.uri, doc.version, force);
    } catch (err) {
      log("symbol refresh error", err);
    }
  }

  private async emitSymbols(
    symbols: SymbolAnchor[],
    uri: vscode.Uri | null,
    version: number | null,
    force: boolean,
  ) {
    const labels = symbols.map((s) => s.label).reverse(); // ensure outer->inner order
    const pathKey = labels.join("→");

    const boardId = "";
    const cards = await Promise.all(
      symbols.map(async (anchor): Promise<CardData> => {
        const def: vscode.LocationLink = {
          targetUri: anchor.uri,
          targetRange: anchor.range,
        };
        const path = getRelativePath(def.targetUri)!;

        return {
          id: await sha256(anchor.label),
          x: 0,
          y: 0,
          type: "symbol",
          boardId,
          title: anchor.label,
          path,
          symbol: anchor.label,
          codeLink: await getGitHubUrl(def),
          status: "connected",
        };
      }),
    );

    if (uri) {
      log("symbol path change", { pathKey, uri: String(uri) });
      this.fire({
        type: "symbolsChanged",
        uri,
        version: version ?? -1,
        symbols: cards,
        force,
      });
    }
  }

  dispose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

// Convenience: singleton instance
let singleton: DocumentSymbolTracker | null = null;
export function getDocumentSymbolTracker(
  locationFinder: LocationFinder,
): DocumentSymbolTracker {
  if (!singleton) {
    singleton = new DocumentSymbolTracker(locationFinder);
  }
  return singleton;
}
