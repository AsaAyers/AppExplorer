import { CardData } from "@/extension/types";
import { selectRangeInEditor } from "@/extension/utils/select-range-in-editor";
import { getVSCodeAdapter } from "@/extension/vscode-adapter/adapter";

export async function goToCardCode(
  card: Pick<CardData, "symbol" | "path">,
  preview = false,
) {
  const vscode = getVSCodeAdapter();
  const symbol = await vscode.locationFinder.findCardDestination(card);

  if (symbol && "range" in symbol) {
    const editor = await vscode.showTextDocument(symbol.uri, {
      preview,
      preserveFocus: preview,
    });
    selectRangeInEditor(symbol.range, editor);
    return true;
  } else if (symbol) {
    await vscode.showTextDocument(symbol, {
      preview,
      preserveFocus: preview,
    });
    // The card still attaches to a file, but not a symbol, so even though it
    // navigated to a file, it's NOT considered connected.
    return false;
  }
  vscode.showWarningMessage(`Unable to open ${card.path}`);
  return false;
}
