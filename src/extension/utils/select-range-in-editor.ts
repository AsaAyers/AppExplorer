import {
  Range,
  TextEditor,
  getVSCodeAdapter,
} from "@/extension/vscode-adapter/adapter";

export function selectRangeInEditor(range: Range, editor: TextEditor) {
  const vscode = getVSCodeAdapter();
  const newSelection = vscode.newSelection(range.start, range.end);
  editor.selection = newSelection;
  editor.revealRange(newSelection);
}
