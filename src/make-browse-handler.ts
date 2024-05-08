import * as vscode from "vscode";
import { HandlerContext, selectRangeInEditor } from "./extension";
import { CardData } from "./EventTypes";
import { getRelativePath } from "./get-relative-path";
import { readSymbols } from "./make-new-card-handler";
import { notEmpty } from "./make-tag-card-handler";

export const makeBrowseHandler = ({ allCards, emit }: HandlerContext) =>
  async function () {
    type CardQuickPickItem = vscode.QuickPickItem & {
      miroLink: string;
    };

    const activeEditor = vscode.window.activeTextEditor;
    const curentPath = activeEditor
      ? getRelativePath(activeEditor.document.uri)
      : null;

    const items: CardQuickPickItem[] = [...allCards.values()]
      .filter(notEmpty)
      .sort((a, b) => {
        if (a.path !== b.path) {
          if (a.path === curentPath) return -1;
          if (b.path === curentPath) return 1;
        }
        return a.path.localeCompare(b.path) || a.title.localeCompare(b.title);
      })
      .map((card) => {
        let description: string
        if (card.type === "group") {
          description = "Group"
        } else {
          description = card.symbol +
            (card.status === "disconnected" ? "$(debug-disconnect)" : "")
        }
        return {
          label: card.title.trim(),
          detail: card.path,
          description,
          miroLink: card.miroLink!,
        };
      });

    const selected = await vscode.window.showQuickPick(items, {
      title: "Browse Cards",
      // placeHolder: `Choose a symbol to anchor the card to`,
      onDidSelectItem: (item: CardQuickPickItem) => {
        const card = allCards.get(item.miroLink);
        if (card && card.miroLink) {
          emit("hoverCard", card.miroLink);
        }
      },
    });

    if (selected) {
      const card = allCards.get(selected.miroLink);
      if (card) {
        emit("selectCard", card.miroLink!);
        const status = (await goToCardCode(card))
          ? "connected"
          : "disconnected";
        if (card.miroLink) {
          emit("cardStatus", {
            miroLink: card.miroLink,
            status,
          });
        }
      }
    }
  };

export async function findSymbolFromCard(card: CardData) {
  if (card.path && "symbol" in card) {
    const { path } = card;
    // Get the root directory's URI
    const rootUri = vscode.workspace.workspaceFolders?.[0].uri;
    if (rootUri) {
      // Append the relative path to the root directory's URI
      const uri = rootUri.with({ path: rootUri.path + "/" + path });
      // Check if this URI exists
      try {
        if (
          (await vscode.workspace.fs.stat(uri)).type !== vscode.FileType.File
        ) {
          return null
        }
      } catch (e) {
        // stat throws if the file doesn't exist.
        return null
      }

      let symbols = await readSymbols(uri);
      // It seems like when opening a new file, the symbols are not
      // immediately available.
      if (symbols.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        symbols = await readSymbols(uri);
      }
      const symbol = symbols.find((symbol) => symbol.label === card.symbol);
      return symbol;
    }
  }
  return null
}

export async function goToCardCode(card: CardData) {
  const symbol = await findSymbolFromCard(card);
  if (symbol && symbol.range) {
    const editor = await vscode.window.showTextDocument(symbol.uri);
    selectRangeInEditor(symbol.range, editor);
    return true;
  }
  return false
}
