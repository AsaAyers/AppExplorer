import * as vscode from "vscode";
import { HandlerContext } from "./extension";
import { CardData } from "./EventTypes";
import { getRelativePath } from "./get-relative-path";

export const makeBrowseHandler = ({ allCards, emit }: HandlerContext) =>
  async function () {
    type CardQuickPickItem = vscode.QuickPickItem & {
      miroLink: string;
    };

    const activeEditor = vscode.window.activeTextEditor;
    const curentPath = activeEditor
      ? getRelativePath(activeEditor.document.uri)
      : null;
    console.log("curentPath", curentPath);

    const items: CardQuickPickItem[] = [...allCards.values()]
      .sort((a, b) => {
        console.log("a", a.path);
        if (a.path !== b.path) {
          if (a.path === curentPath) return -1;
          if (b.path === curentPath) return 1;
        }
        return a.path.localeCompare(b.path) || a.title.localeCompare(b.title);
      })
      .map((card: CardData) => {
        return {
          label: card.title.trim(),
          detail: card.path,
          description: card.symbol ? card.symbol : "$(debug-disconnect)",
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

      if (card && card.path) {
        const { path } = card;
        // Get the root directory's URI
        const rootUri = vscode.workspace.workspaceFolders?.[0].uri;
        if (rootUri) {
          // Append the relative path to the root directory's URI
          const uri = rootUri.with({ path: rootUri.path + "/" + path });
          await vscode.window.showTextDocument(uri);
        }
      }
    }

    console.log("selected", selected);
  };
