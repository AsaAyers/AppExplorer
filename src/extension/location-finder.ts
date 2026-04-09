import { SymbolAnchor, CardData } from "@/extension/types";
import {
  DocumentSymbol,
  FileType,
  Position,
  SymbolInformation,
  Uri,
  UriType,
  VSCodeAdapter,
} from "@/extension/vscode-adapter/adapter";
import { debugLog } from "@/utils/debug-log";
const log = debugLog("location-finder");

export class LocationFinder {
  constructor(protected vscode: VSCodeAdapter) {}
  async findSymbolsInDocument(uri: UriType): Promise<Array<SymbolAnchor>> {
    const symbols =
      (await this.vscode.executeCommand<
        Array<SymbolInformation | DocumentSymbol>
      >("vscode.executeDocumentSymbolProvider", uri)) || [];

    return this.flattenSymbols(symbols, uri);
  }

  async findTopLevelSymbols(uri: UriType) {
    const symbols: Array<SymbolInformation | DocumentSymbol> =
      (await this.vscode.executeCommand<
        Array<SymbolInformation | DocumentSymbol>
      >("vscode.executeDocumentSymbolProvider", uri)) || [];

    return symbols.flatMap((symbol): SymbolAnchor[] => {
      const range =
        "location" in symbol ? symbol.location.range : symbol.selectionRange;
      const selectionRange =
        "selectionRange" in symbol
          ? symbol.selectionRange
          : symbol.location.range;

      return [
        {
          type: "symbol",
          label: symbol.name,
          range,
          selectionRange,
          uri,
          target: symbol,
        },
      ];
    });
  }

  async findSymbolsAroundCursor(
    uri: UriType,
    position: Position,
  ): Promise<SymbolAnchor[]> {
    const allSymbols = await this.findSymbolsInDocument(uri);
    return [
      ...allSymbols
        .filter((symbol) => {
          return symbol.range.contains(position);
        })
        .reverse(),
    ];
  }

  async findSymbolInPosition(
    uri: UriType,
    position: Position,
  ): Promise<SymbolAnchor | null> {
    const symbols = await this.findSymbolsInDocument(uri);
    return symbols.reduce(
      (acc, symbol) => {
        if (symbol.range.contains(position)) {
          if (!acc || acc.range.contains(symbol.range)) {
            return symbol;
          }
        }
        return acc;
      },
      null as SymbolAnchor | null,
    );
  }

  async findCardDestination(
    card: Pick<CardData, "symbol" | "path">,
  ): Promise<SymbolAnchor | UriType | null> {
    if (card.path) {
      const path = card.path[0] === "/" ? card.path.slice(1) : card.path;

      return (this.vscode.workspaceFolders ?? []).reduce(
        async (result: Promise<SymbolAnchor | UriType | null>, folder) => {
          const dest = await result;
          if (dest !== null) {
            return dest;
          }

          const rootUri = folder.uri;
          const uri = Uri.joinPath(rootUri, path);

          try {
            const stat = await this.vscode.workspaceFs.stat(uri);
            if (stat.type !== FileType.File) {
              return null;
            }
          } catch (e) {
            log(String(e));
            return null;
          }

          if ("symbol" in card) {
            // Retry symbol finding with delays to handle Language Server timing
            let symbols: SymbolAnchor[] = [];
            let attempts = 0;
            const maxAttempts = 5; // Increased from 1 to 5

            while (symbols.length === 0 && attempts < maxAttempts) {
              attempts++;
              symbols = await this.findSymbolsInDocument(uri);

              if (symbols.length === 0 && attempts < maxAttempts) {
                // Wait a bit for the Language Server to process the file
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased from 500ms to 1000ms
              }
            }

            // Try to find symbol by exact match first, then by suffix match for nested symbols
            let symbol = symbols.find((symbol) => symbol.label === card.symbol);

            // If not found, try to find by suffix (e.g., "testMethod" matches "TestClass/testMethod")
            if (!symbol) {
              symbol = symbols.find((symbol) =>
                symbol.label.endsWith(`/${card.symbol}`),
              );
            }

            if (!symbol) {
              log("❌ Symbol not found, returning URI only");
            }

            return symbol ?? uri;
          }
          return uri;
        },
        Promise.resolve(null),
      );
    }
    return null;
  }

  private flattenSymbols(
    symbols: Array<SymbolInformation | DocumentSymbol>,
    uri: UriType,
  ): SymbolAnchor[] {
    return symbols.flatMap((symbol): SymbolAnchor[] => {
      let children: Array<SymbolAnchor> = [];
      if ("children" in symbol) {
        children = symbol.children.flatMap((s) =>
          this.flattenSymbols(
            [{ ...s, name: `${symbol.name}/${s.name}` }],
            uri,
          ),
        );
      }

      const range = "location" in symbol ? symbol.location.range : symbol.range;
      const selectionRange =
        "selectionRange" in symbol
          ? symbol.selectionRange
          : symbol.location.range;

      return [
        {
          type: "symbol",
          label: symbol.name,
          range,
          selectionRange,
          uri,
          target: symbol,
        },
        ...children,
      ];
    });
  }
}
