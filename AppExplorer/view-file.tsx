import { useLoaderData } from "@remix-run/react";
import type { DocumentSymbol } from "vscode-languageserver-protocol";
import React from "react";
import type { AnnotationData, CodeSelection } from "~/lsp/components/code";
import { Code, links as codeLinks } from "~/lsp/components/code";
import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { json } from "@remix-run/node";
import * as lspServer from "~/lsp/lsp.server";
import { CardFromSelection } from "~/plugin-utils/card-from-selection";
import type { Project } from "~/lsp/Project";
import * as fsPath from "path";
import { fs } from "~/fs-promises.server";
import { getRemoteURLs, getCommitHash } from "~/models/git.server";
import { getPathFromQuery } from "~/plugin-utils/require-file-from-query";

export async function readCardData(
  fullPath: string,
  path: string,
  project: Project,
  projectName: string
) {
  const [remotes, content, commitHash] = await Promise.all([
    getRemoteURLs(fullPath),
    fs.readFile(fullPath, "utf-8"),
    getCommitHash(fullPath),
  ]);

  return {
    path,
    gitPath: fsPath.relative(project.root, fullPath),
    remotes,
    commitHash,
    projectName,
    content,
  } as const;
}

export const links = codeLinks;
export const loader = async ({ params, request }: LoaderArgs) => {
  const [projectName, project] = await lspServer.requireProject(params);
  const { fullPath, path, stat } = await getPathFromQuery(request, project);
  if (stat.isDirectory()) {
    return redirect(`/lsp/${projectName}/?path=${path}`);
  }

  // TODO: Make this more generic, so that I can ask for the connection for a file instead of using
  // a specific language. Right now I'm exploring what I can do with the LSP.
  const connection = await lspServer.getTypescriptConnection();
  const { uri, text: fileContent } = await lspServer.openTextDocument(
    connection,
    fullPath
  );

  // This is a list of top level symbols created in the file. The type is
  // recursive, so this seems to be the module level symbols.
  const symbols = await lspServer.requestDocumentSymbols(connection, uri);

  return json({
    type: "symbols",
    projectName,
    path,
    fileContent,
    symbols,
    cardData: await readCardData(fullPath, path, project, projectName),
  } as const);
};

export default function ViewFile() {
  const data = useLoaderData<typeof loader>();

  const [selection, setSelection] = React.useState<CodeSelection | null>(null);
  const handleNewSelection = (selection: CodeSelection) => {
    setSelection({
      ...selection,
    });
  };

  const lines = React.useMemo(() => {
    const lines = data.fileContent.split("\n");

    return lines;
  }, [data.fileContent]);

  const symbolToAnnotation = (
    prefix = "",
    symbol: DocumentSymbol
  ): Array<AnnotationData> => {
    const self: AnnotationData = {
      endCharacter: symbol.selectionRange.end.character,
      endLine: symbol.selectionRange.end.line,
      startCharacter: symbol.selectionRange.start.character,
      startLine: symbol.selectionRange.start.line,
      name: symbol.name,
      dragId: `${prefix}${symbol.name}`,
      onClick: () => {
        setSelection({
          endLine: symbol.selectionRange.end.line,
          startLine: symbol.selectionRange.start.line,
          text: [],
          title: `${prefix}${symbol.name} (${data.path})`,
        });
      },
    };

    if (prefix != "") {
      prefix += ".";
    }
    // console.group(`${prefix}${symbol.name}`)
    const children =
      symbol.children?.flatMap(
        symbolToAnnotation.bind(null, `${prefix}${symbol.name}`)
      ) ?? [];
    // console.groupEnd()
    return [self].concat(children);
  };
  const annotation = data.symbols.flatMap(symbolToAnnotation.bind(null, ""));

  return (
    <div className="flex">
      <div>
        <form method="get" action="./view-file">
          <div className="form-group">
            <div className="input-group">
              <label className="h2">Filename:</label>
              <input
                className="input"
                name="path"
                type="text"
                defaultValue={data.path}
              />
              <button className="button button-primary" type="submit">
                Go
              </button>
            </div>
          </div>
        </form>
        <Code
          onSelection={handleNewSelection}
          lines={lines}
          annotations={annotation}
          peek={selection?.startLine}
        >
          {selection && (
            <CardFromSelection
              selection={selection}
              onDrop={() => setSelection(null)}
              data={data.cardData}
            />
          )}
        </Code>
      </div>
    </div>
  );
}
