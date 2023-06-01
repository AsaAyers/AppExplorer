import { useLoaderData, useSearchParams } from "@remix-run/react";
import type { CodeSelection } from "~/lsp/components/code";
import { Code, links as codeLinks } from "~/lsp/components/code";
import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Project } from "~/lsp/Project";
import { requireProject } from "~/lsp/lsp.server";
import { fs } from "~/fs-promises.server";
import * as fsPath from "path";
import React from "react";
import { getCommitHash, getRemoteURL } from "~/models/git.server";
import { CardFromSelection } from "~/plugin-utils/card-from-selection";

export const links = codeLinks

export const loader = async ({ params, request }: LoaderArgs) => {
  const [projectName, project] = await requireProject(params);
  const url = new URL(request.url)
  const path = url.searchParams.get("path") ?? ''
  if (typeof path !== "string") {
    throw new Response("Path is required", { status: 400 })
  }

  const fullPath = fsPath.join(project.root, path)
  if (!fullPath.startsWith(project.root)) {
    throw new Response("Path is invalid", { status: 400 })
  }

  const stat = await fs.stat(fullPath)

  if (stat.isDirectory()) {
    throw redirect(`/lsp/${projectName}/?path=${path}`)
  } else if (stat.isFile()) {
    return json(await readCardData(fullPath, path, project, projectName));
  } else {
    throw new Response("Path is invalid", { status: 400 })
  }
}

export async function readCardData(fullPath: string, path: string, project: Project, projectName: string) {
  const [remote, content, commitHash] = await Promise.all([
    getRemoteURL(fullPath),
    fs.readFile(fullPath, 'utf-8'),
    getCommitHash(fullPath)
  ]);


  return ({
    path,
    gitPath: fsPath.relative(project.projectRoot, fullPath),
    remote,
    commitHash,
    projectName,
    content,
  } as const);
}

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

  return (
    <div className="flex">
      <div>
        <div>{currentFile}</div>
        <hr />
        {!selection && (
          <Code onSelection={handleNewSelection} >{data.content}</Code>
        )}
        {selection && (
          <CardFromSelection
            selection={selection}
            onDrop={() => setSelection(null)}
            data={data}
          />
        )}


      </div>
    </div >
  );
}
