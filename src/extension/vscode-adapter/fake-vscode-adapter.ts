import {
  demoWorkspaceFiles,
  DEMO_WORKSPACE_ROOT,
  getDemoWorkspaceFile,
  toDemoWorkspaceFsPath,
  toDemoWorkspaceRelativePath,
} from "@/extension/document-symbol-tracker/demo-workspace";
import { FakeDocumentSymbolTracker } from "@/extension/document-symbol-tracker/fake-document-symbol-tracker";
import { LocationFinder } from "@/location-finder";
import { Public } from "@/extension/types";
import {
  type AppExplorerCommand,
  type VSCodeAdapter,
  CodeLensProvider,
  Command,
  Disposable,
  GlobPattern,
  TextDocument,
  Uri,
} from "@/extension/vscode-adapter/adapter";
import { DemoFile } from "@demo/index";
import * as vscode from "vscode";

class Range {
  public readonly start: vscode.Position;
  public readonly end: vscode.Position;
  constructor(start: vscode.Position, end: vscode.Position) {
    this.start = start;
    this.end = end;
  }

  contains(position: vscode.Position) {
    if (position.line < this.start.line || position.line > this.end.line) {
      return false;
    }

    if (
      position.line === this.start.line &&
      position.character < this.start.character
    ) {
      return false;
    }

    if (
      position.line === this.end.line &&
      position.character > this.end.character
    ) {
      return false;
    }

    return true;
  }
}

class Position {
  public readonly line: number;
  public readonly character: number;
  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }
}

class Selection {
  public readonly anchor: Position;
  public readonly active: Position;
  constructor(anchor: Position, active: Position) {
    this.anchor = anchor;
    this.active = active;
  }

  get start() {
    return this.anchor;
  }

  get end() {
    return this.active;
  }
}

type FakeTextDocument = vscode.TextDocument & {
  __demoFile: DemoFile;
};

function positionFromOffset(text: string, offset: number): vscode.Position {
  const safeOffset = Math.max(0, Math.min(text.length, offset));
  const lines = text.slice(0, safeOffset).split("\n");
  const line = Math.max(0, lines.length - 1);
  const character = lines[line]?.length ?? 0;
  return new Position(line, character) as unknown as vscode.Position;
}

function offsetFromPosition(text: string, position: vscode.Position): number {
  const lines = text.split("\n");
  const line = Math.max(0, Math.min(position.line, lines.length - 1));
  const charsBefore = lines
    .slice(0, line)
    .reduce((acc, next) => acc + next.length + 1, 0);
  const character = Math.max(
    0,
    Math.min(position.character, lines[line]?.length ?? 0),
  );
  return charsBefore + character;
}
export class FakeVSCodeAdapter implements Public<VSCodeAdapter> {
  locationFinder = {
    async findCardDestination() {},
  } as unknown as LocationFinder;

  private commandConfig = new Map<string, unknown>([["follow", false]]);
  private textDocumentListeners = new Set<
    (e: vscode.TextDocumentChangeEvent) => void
  >();
  private textSelectionListeners = new Set<
    (e: vscode.TextEditorSelectionChangeEvent) => void
  >();
  private activeTextEditorListeners = new Set<
    (e: vscode.TextEditor | undefined) => void
  >();
  private openTextDocumentListeners = new Set<
    (e: vscode.TextDocument) => void
  >();
  private workspaceFolderListeners = new Set<(e: unknown) => void>();
  private documents = new Map<string, FakeTextDocument>();
  private _activeTextEditor: vscode.TextEditor | undefined;

  constructor() {
    for (const file of demoWorkspaceFiles) {
      const document = this.createTextDocument(file);
      this.documents.set(file.path, document);
    }

    this.openTextDocument(Uri.parse(demoWorkspaceFiles[0]?.path ?? ""));
  }
  getDocumentSymbolTracker() {
    this.symbolTracker ??= new FakeDocumentSymbolTracker();
    return this.symbolTracker;
  }

  showTextDocument = async (
    documentOrUri: vscode.TextDocument | vscode.Uri,
    _options?: unknown,
  ) => {
    const document =
      "uri" in documentOrUri
        ? (documentOrUri as vscode.TextDocument)
        : await this.openTextDocument(documentOrUri as vscode.Uri);

    const editor = this.makeEditor(document as FakeTextDocument, 0);
    this._activeTextEditor = editor;

    this.emitActiveTextEditor(editor);
    this.emitSelection(editor);

    return editor;
  };

  setActiveDemoFile(path: string, offset = 0) {
    const file = getDemoWorkspaceFile(path);
    const document = this.documents.get(file.path);

    if (!document) {
      throw new Error(`Unknown demo file: ${path}`);
    }

    const editor = this.makeEditor(document, offset);
    this._activeTextEditor = editor;

    this.emitActiveTextEditor(editor);
    this.emitSelection(editor);
  }

  setCursor(path: string, offset: number) {
    const relative = toDemoWorkspaceRelativePath(path);
    this.setActiveDemoFile(relative, offset);
  }

  emitDidChangeTextDocument(path: string) {
    const file = getDemoWorkspaceFile(path);
    const document = this.documents.get(file.path);
    if (!document) {
      return;
    }

    for (const listener of this.textDocumentListeners) {
      listener({ document } as unknown as vscode.TextDocumentChangeEvent);
    }
  }

  newCodeLens(_range: Range, _command?: Command): vscode.CodeLens {
    throw new Error("Method not implemented.");
  }

  createTextEditorDecorationType(
    _options: vscode.DecorationRenderOptions,
  ): vscode.TextEditorDecorationType {
    throw new Error("Method not implemented.");
  }

  createDecoration(): vscode.TextEditorDecorationType {
    throw new Error("Method not implemented.");
  }

  createSelectedDecoration(): vscode.TextEditorDecorationType {
    throw new Error("Method not implemented.");
  }

  newThemeColor(_str: string): vscode.ThemeColor {
    throw new Error("Method not implemented.");
  }

  registerUriHandler(_handler: vscode.UriHandler): vscode.Disposable {
    throw new Error("Method not implemented.");
  }

  registerCodeLensProvider(
    _selector: vscode.DocumentSelector,
    _provider: CodeLensProvider,
  ): vscode.Disposable {
    throw new Error("Method not implemented.");
  }

  onDidChangeWorkspaceFolders(
    listener: (e: unknown) => any,
    _thisArgs?: any,
    _disposables?: Disposable[],
  ): vscode.Disposable {
    this.workspaceFolderListeners.add(listener);
    return {
      dispose: () => {
        this.workspaceFolderListeners.delete(listener);
      },
    };
  }

  async showInformationMessage(_message: string) {
    return undefined;
  }

  async showWarningMessage(_message: string) {
    return undefined;
  }

  async openExternal(_uri: vscode.Uri) {
    return true;
  }

  get workspaceFs() {
    return {
      stat: async (uri: vscode.Uri) => {
        const relative = toDemoWorkspaceRelativePath(String(uri));
        if (!this.documents.has(relative)) {
          throw new Error(`ENOENT: ${String(uri)}`);
        }

        return { type: vscode.FileType.File };
      },
      readFile: async (uri: vscode.Uri) => {
        const relative = toDemoWorkspaceRelativePath(String(uri));
        const doc = this.documents.get(relative);
        if (!doc) {
          throw new Error(`ENOENT: ${String(uri)}`);
        }

        return new TextEncoder().encode(doc.__demoFile.code);
      },
      writeFile: async () => {
        // no-op for fake workspace
      },
    } as unknown as vscode.FileSystem;
  }

  onDidChangeTextDocument(
    listener: (e: vscode.TextDocumentChangeEvent) => any,
  ): Disposable {
    this.textDocumentListeners.add(listener);
    return {
      dispose: () => {
        this.textDocumentListeners.delete(listener);
      },
    };
  }

  onDidChangeTextEditorSelection(
    listener: (e: vscode.TextEditorSelectionChangeEvent) => void,
  ): Disposable {
    this.textSelectionListeners.add(listener);
    return {
      dispose: () => {
        this.textSelectionListeners.delete(listener);
      },
    };
  }

  onDidChangeActiveTextEditor(
    listener: (e: vscode.TextEditor | undefined) => void,
  ): Disposable {
    this.activeTextEditorListeners.add(listener);
    return {
      dispose: () => {
        this.activeTextEditorListeners.delete(listener);
      },
    };
  }

  onDidOpenTextDocument(listener: (e: TextDocument) => void): Disposable {
    this.openTextDocumentListeners.add(listener);
    return {
      dispose: () => {
        this.openTextDocumentListeners.delete(listener);
      },
    };
  }

  symbolTracker?: FakeDocumentSymbolTracker;
  async openTextDocument(uri: vscode.Uri) {
    const relative = toDemoWorkspaceRelativePath(String(uri));
    const existing = this.documents.get(relative);

    if (!existing) {
      throw new Error(`Unknown fake document: ${String(uri)}`);
    }

    for (const listener of this.openTextDocumentListeners) {
      listener(existing);
    }

    this.getDocumentSymbolTracker().setCursor(relative, 0);
    return existing as TextDocument;
  }

  async showErrorMessage(_message: string) {
    return undefined;
  }

  async findFiles(_glob: GlobPattern) {
    return demoWorkspaceFiles.map((file) =>
      Uri.file(toDemoWorkspaceFsPath(file.path)),
    );
  }

  executeCommand<T = unknown>(command: string, ...rest: any[]) {
    const callback = this.commands.get(command as AppExplorerCommand);
    if (callback) {
      return callback(...rest) as T;
    }

    if (command === "vscode.executeDocumentSymbolProvider") {
      return [] as T;
    }

    if (command === "vscode.executeHoverProvider") {
      return [] as T;
    }

    return undefined as T;
  }

  createOutputChannel(name: string): OutputChannel {
    return new OutputChannel(name);
  }

  newMarkdownString(
    value: string,
    supportThemeIcons?: boolean,
  ): MarkdownString {
    return new MarkdownString(value, supportThemeIcons);
  }

  createStatusBarItem(): vscode.StatusBarItem {
    return {
      text: "",
      tooltip: "",
      command: undefined,
      show() {},
      hide() {},
      dispose() {},
    } as vscode.StatusBarItem;
  }

  getConfiguration(_section: string): vscode.WorkspaceConfiguration {
    return {
      get: <T>(key: string) => this.commandConfig.get(key) as T,
      update: async (key: string, value: unknown) => {
        this.commandConfig.set(key, value);
      },
    } as unknown as vscode.WorkspaceConfiguration;
  }

  get workspaceFolders(): Array<{ uri: vscode.Uri }> | undefined {
    return [{ uri: Uri.file(DEMO_WORKSPACE_ROOT) }];
  }

  newSelection(
    anchor: vscode.Position,
    active: vscode.Position,
  ): vscode.Selection {
    return new Selection(
      anchor as Position,
      active as Position,
    ) as vscode.Selection;
  }

  get activeTextEditor(): vscode.TextEditor | undefined {
    return this._activeTextEditor;
  }

  newRange(start: vscode.Position, end: vscode.Position): vscode.Range {
    return new Range(start, end) as vscode.Range;
  }

  newPosition(line: number, character: number): vscode.Position {
    return new Position(line, character) as vscode.Position;
  }

  commands = new Map<AppExplorerCommand, (...args: any[]) => unknown>();

  getApi() {
    return vscode;
  }

  registerCommand(
    cmd: AppExplorerCommand,
    callback: (...args: any[]) => unknown,
  ): Disposable {
    this.commands.set(cmd, callback);

    return {
      dispose: () => {
        this.commands.delete(cmd);
      },
    };
  }

  private emitSelection(editor: vscode.TextEditor) {
    for (const listener of this.textSelectionListeners) {
      listener({ textEditor: editor } as vscode.TextEditorSelectionChangeEvent);
    }
  }

  private emitActiveTextEditor(editor: vscode.TextEditor | undefined) {
    for (const listener of this.activeTextEditorListeners) {
      listener(editor);
    }
  }

  private makeEditor(document: FakeTextDocument, offset: number) {
    const position = positionFromOffset(document.__demoFile.code, offset);
    const selection = this.newSelection(position, position);

    return {
      document,
      selection,
      selections: [selection],
    } as unknown as vscode.TextEditor;
  }

  private createTextDocument(demoFile: DemoFile) {
    const { path, code: text } = demoFile;
    const uri = Uri.file(toDemoWorkspaceFsPath(path));

    const document = {
      uri,
      fileName: toDemoWorkspaceFsPath(path),
      languageId: path.split(".").pop() ?? "text",
      version: 1,
      isDirty: false,
      isUntitled: false,
      isClosed: false,
      eol: 1,
      lineCount: text.split("\n").length,
      __demoFile: demoFile,
      getText: () => text,
      offsetAt: (position: vscode.Position) =>
        offsetFromPosition(text, position),
      positionAt: (offset: number) => positionFromOffset(text, offset),
    } as FakeTextDocument;

    return document;
  }
}

class OutputChannel implements vscode.OutputChannel {
  #text = "";
  public readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  append(value: string): void {
    this.#text += `${value}`;
  }
  appendLine(value: string): void {
    this.#text += `${value}\n`;
  }
  replace(_value: string): void {
    throw new Error("Method not implemented.");
  }
  clear(): void {
    this.#text = "";
  }
  show(_column?: unknown, _preserveFocus?: unknown): void {}
  hide(): void {}
  dispose(): void {
    this.#text = "";
  }
  read() {
    return this.#text;
  }
}

class MarkdownString implements vscode.MarkdownString {
  value: string;
  isTrusted?:
    | boolean
    | { readonly enabledCommands: readonly string[] }
    | undefined;
  supportThemeIcons?: boolean | undefined;
  supportHtml?: boolean | undefined;
  baseUri?: vscode.Uri | undefined;
  constructor(value: string, supportThemeIcons?: boolean) {
    this.value = value;
    this.supportThemeIcons = supportThemeIcons;
  }
  appendText(value: string): vscode.MarkdownString {
    this.value += value;
    return this;
  }
  appendMarkdown(value: string): vscode.MarkdownString {
    this.value += value;
    return this;
  }
  appendCodeblock(
    value: string,
    language: string = "code",
  ): vscode.MarkdownString {
    this.value += "```" + language + "\n" + value + "```\n";
    return this;
  }
}
