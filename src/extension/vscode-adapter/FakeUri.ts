import * as vscode from "vscode";

export class FakeUri {
  constructor(public fsPath: string) {}
  public static parse(location: string) {
    return new FakeUri(location) as unknown as vscode.Uri;
  }
  public static joinPath(...args: Array<vscode.Uri | string>) {
    return FakeUri.parse(args.map(String).join("/"));
  }
  public static file(updateWorkspacePath: string) {
    return FakeUri.parse(updateWorkspacePath);
  }
  toString() {
    return this.fsPath;
  }
}
