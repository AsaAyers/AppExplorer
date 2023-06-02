import { useLoaderData, useSearchParams } from "@remix-run/react";
import type { DocumentSymbol } from "vscode-languageserver-protocol";
import React from "react";
import type { AnnotationData, CodeSelection } from "~/lsp/components/code";
import { Code, links as codeLinks } from "~/lsp/components/code";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import * as lspServer from "~/lsp/lsp.server";
import { readCardData } from "AppExplorer/view-file";
import { CardFromSelection } from "~/plugin-utils/card-from-selection";

export const links = codeLinks
export const loader = async ({ params, request }: LoaderArgs) => {
  const [projectName, project] = await lspServer.requireProject(params);
  const url = new URL(request.url)
  const path = url.searchParams.get("path")
  if (typeof path !== "string") {
    throw new Response("Path is required", { status: 400 })
  }

  const fullPath = lspServer.resolvePath(project, path);

  // TODO: Make this more generic, so that I can ask for the connection for a file instead of using
  // a specific language. Right now I'm exploring what I can do with the LSP.
  const connection = await lspServer.getTypescriptConnection();
  const { uri, text: fileContent } = await lspServer.openTextDocument(connection, fullPath);

  // This is a list of top level symbols created in the file. The type is
  // recursive, so this seems to be the module level symbols.
  const symbols = await lspServer.requestDocumentSymbols(connection, uri);

  return json({
    type: 'symbols',
    projectName,
    path,
    fileContent,
    symbols,
    cardData: await readCardData(fullPath, path, project, projectName),
  } as const);
};


export default function ViewFile() {
  const data = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const currentFile = (searchParams.get('path') ?? '')

  const [selection, setSelection] = React.useState<CodeSelection | null>(null)
  const handleNewSelection = (selection: CodeSelection) => {
    setSelection({
      ...selection,
      text: [],
    })
  }

  const lines = React.useMemo(() => {
    const lines = data.fileContent.split('\n')

    return lines
  }, [data.fileContent])

  console.log({ lines })

  const symbolToAnnotation = (symbol: DocumentSymbol): Array<AnnotationData> => {
    const self = ({
      endCharacter: symbol.selectionRange.end.character,
      endLine: symbol.selectionRange.end.line,
      startCharacter: symbol.selectionRange.start.character,
      startLine: symbol.selectionRange.start.line,
      name: symbol.name,
      onClick: () => {
        setSelection({
          endLine: symbol.selectionRange.end.line,
          startLine: symbol.selectionRange.start.line,
          text: [],
          title: symbol.name
        })
      }
    });
    console.log(symbol.name)

    return [self].concat(
      symbol.children?.flatMap(symbolToAnnotation) ?? []
    )
  };
  const annotation = data.symbols.flatMap(symbolToAnnotation)

  return (
    <div className="flex">
      <div>
        <div>{currentFile}</div>
        <hr />
        {!selection && (
          <Code
            onSelection={handleNewSelection}
            lines={lines}
            annotations={annotation}
          />
        )}
        {selection && (
          <CardFromSelection
            selection={selection}
            onDrop={() => setSelection(null)}
            data={data.cardData}
          />
        )}


      </div>
    </div >
  );
}
