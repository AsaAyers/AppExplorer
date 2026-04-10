/* eslint-disable @typescript-eslint/no-explicit-any */
import { LocationFinder } from "@/location-finder";
import type { Public, SymbolEvents } from "@/extension/types";
import type { EventEmitter } from "@/extension/utils/event-emitter";
import { FakeUri } from "@/extension/vscode-adapter/FakeUri";
import { FakeVSCodeAdapter } from "@/extension/vscode-adapter/fake-vscode-adapter";
import * as vscode from "vscode";

export type UriType = vscode.Uri;
export const Uri = vscode.Uri ?? (FakeUri as unknown as vscode.Uri);

export type AppExplorerCommand =
  | "app-explorer.updateExtension"
  | "app-explorer.navigate"
  | "app-explorer.toggleFollow"
  | "app-explorer.update";

type DocumentSymbolTracker = EventEmitter<SymbolEvents>;
type DocumentSymbolTrackerFactory = (
  adapter: VSCodeAdapter,
) => DocumentSymbolTracker;

let documentSymbolTrackerFactory: DocumentSymbolTrackerFactory | null = null;

function configureVSCodeAdapter(options: {
  documentSymbolTrackerFactory?: DocumentSymbolTrackerFactory;
}) {
  if (options.documentSymbolTrackerFactory) {
    documentSymbolTrackerFactory = options.documentSymbolTrackerFactory;
  }
}

export class VSCodeAdapter {
  public locationFinder = new LocationFinder(this);
  symbolTracker?: DocumentSymbolTracker;
  getDocumentSymbolTracker() {
    if (!documentSymbolTrackerFactory) {
      throw new Error("Missing document symbol tracker factory");
    }
    this.symbolTracker ??= documentSymbolTrackerFactory(this);
    return this.symbolTracker;
  }

  newSelection(anchor: vscode.Position, active: vscode.Position) {
    return new vscode.Selection(anchor, active);
  }
  registerCommand(
    cmd: AppExplorerCommand,
    callback: (...args: any[]) => unknown,
  ) {
    return vscode.commands.registerCommand(cmd, callback);
  }

  openTextDocument(uri: UriType) {
    return vscode.workspace.openTextDocument(uri as UriType);
  }
  showInformationMessage(message: string) {
    return vscode.window.showErrorMessage(message);
  }

  showWarningMessage(message: string) {
    return vscode.window.showWarningMessage(message);
  }
  showErrorMessage(message: string) {
    return vscode.window.showErrorMessage(message);
  }

  findFiles(glob: vscode.GlobPattern) {
    return vscode.workspace.findFiles(glob);
  }

  openExternal(uri: UriType) {
    return vscode.env.openExternal(uri);
  }

  executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T> {
    return vscode.commands.executeCommand(command, ...rest);
  }

  createOutputChannel(name: string, languageId?: string | undefined) {
    return vscode.window.createOutputChannel(name, languageId);
  }

  newMarkdownString(value?: string, supportThemeIcons?: boolean) {
    return new vscode.MarkdownString(value, supportThemeIcons);
  }

  createStatusBarItem() {
    return vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
  }
  getConfiguration(section: string) {
    return vscode.workspace.getConfiguration(section);
  }

  get activeTextEditor() {
    return vscode.window.activeTextEditor;
  }

  get workspaceFolders(): readonly { uri: UriType }[] | undefined {
    return vscode.workspace.workspaceFolders;
  }

  get workspaceFs() {
    return vscode.workspace.fs;
  }

  newRange(start: vscode.Position, end: vscode.Position) {
    return new vscode.Range(start, end);
  }

  newPosition(line: number, character: number): vscode.Position {
    return new vscode.Position(line, character);
  }

  onDidChangeTextEditorSelection(
    listener: (e: vscode.TextEditorSelectionChangeEvent) => void,
  ) {
    return vscode.window.onDidChangeTextEditorSelection(listener);
  }

  onDidChangeActiveTextEditor(
    listener: (e: vscode.TextEditor | undefined) => void,
  ) {
    return vscode.window.onDidChangeActiveTextEditor(listener);
  }

  onDidOpenTextDocument(listener: (e: vscode.TextDocument) => void) {
    return vscode.workspace.onDidOpenTextDocument(listener);
  }

  newCodeLens(range: Range, command?: Command) {
    return new vscode.CodeLens(range, command);
  }

  createTextEditorDecorationType(options: vscode.DecorationRenderOptions) {
    return vscode.window.createTextEditorDecorationType(options);
  }

  createDecoration() {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("appExplorer.background"),
      overviewRulerColor: new vscode.ThemeColor("appExplorer.rulerColor"),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  createSelectedDecoration() {
    return vscode.window.createTextEditorDecorationType({
      border: "1px solid",
      backgroundColor: new vscode.ThemeColor("appExplorer.selectedBackground"),
      borderColor: new vscode.ThemeColor("appExplorer.selectedBorder"),
      overviewRulerColor: new vscode.ThemeColor("appExplorer.rulerColor"),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  newThemeColor(str: string) {
    return new vscode.ThemeColor(str);
  }

  onDidChangeTextDocument(
    listener: (e: vscode.TextDocumentChangeEvent) => any,
    thisArgs?: any,
    disposables?: Disposable[],
  ) {
    return vscode.workspace.onDidChangeTextDocument(
      listener,
      thisArgs,
      disposables,
    );
  }

  registerUriHandler(handler: vscode.UriHandler) {
    return vscode.window.registerUriHandler(handler);
  }

  registerCodeLensProvider(
    selector: vscode.DocumentSelector,
    provider: CodeLensProvider,
  ) {
    return vscode.languages.registerCodeLensProvider(selector, provider);
  }
  onDidChangeWorkspaceFolders(
    listener: (e: unknown) => any,
    thisArgs?: any,
    disposables?: Disposable[],
  ) {
    return vscode.workspace.onDidChangeWorkspaceFolders(
      listener,
      thisArgs,
      disposables,
    );
  }

  showTextDocument = vscode.window.showTextDocument;
}

export const hasRealVscode = !("isFake" in vscode);

let singleton: Public<VSCodeAdapter> | null = null;

export function getVSCodeAdapter(): VSCodeAdapter {
  if (!singleton) {
    singleton = hasRealVscode ? new VSCodeAdapter() : new FakeVSCodeAdapter();
  }

  return singleton;
}

function resetVSCodeAdapterSingleton() {
  singleton = null;
}

export type LocationLink = vscode.LocationLink;
export type Disposable = vscode.Disposable;
export type Range = vscode.Range;
export type TextEditor = vscode.TextEditor;

export type SymbolInformation = vscode.SymbolInformation;
export type DocumentSymbol = vscode.DocumentSymbol;
export type StatusBarItem = vscode.StatusBarItem;
export type MarkdownString = vscode.MarkdownString;

export type ExtensionContext = vscode.ExtensionContext;

export type OutputChannel = vscode.OutputChannel;

export type Hover = vscode.Hover;

export type CodeLensProvider = vscode.CodeLensProvider;
export type CodeLens = vscode.CodeLens;
export type TextDocument = vscode.TextDocument;
export type Command = vscode.Command;

export type DecorationOptions = vscode.DecorationOptions;

export type TextEditorDecorationType = vscode.TextEditorDecorationType;
export type GlobPattern = vscode.GlobPattern;
export type Position = vscode.Position;
export const FileType = vscode.FileType;
