import { CardStorage } from "@/card-storage";
import {
  getVSCodeAdapter,
  LocationLink,
  Uri,
} from "@/extension/vscode-adapter/adapter";
import { WorkspaceHandler } from "@/extension/workspace-handler";
import { debugLog } from "@/utils/debug-log";

const debug = debugLog("navigate");

export const makeNavigationHandler = (
  cardStorage: CardStorage,
  socket: WorkspaceHandler,
) => {
  const vscode = getVSCodeAdapter();
  return async (miroLink: string, locationLink: LocationLink) => {
    const card = cardStorage.getCardByLink(miroLink);
    debug("navigateTo", miroLink, locationLink);
    if (card && cardStorage.getConnectedBoards().length > 0) {
      const success = await socket.emit("selectCard", {
        type: "selectCard",
        miroLink,
      });
      debug("selectCard result", success);

      if (success) {
        await vscode.showInformationMessage(
          `Selected card ${card.title} [${miroLink}]`,
        );
      } else {
        await vscode.showErrorMessage(
          `Failed to select card ${card.title} [${miroLink}]`,
        );
      }
    } else {
      vscode.showInformationMessage(`Opening card ${miroLink} in browser`);
      // Open the URL in the browser
      vscode.openExternal(Uri.parse(miroLink));
    }
  };
};
