import type { CardProps } from "@mirohq/websdk-types";
import React from "react";
import type { CodeSelection } from "~/lsp/components/code";
import { MiroCard } from "~/lsp/components/miro-card";

type CardFromSelectionProps = {
  selection: CodeSelection,
  data: {
    readonly path: string;
    readonly gitPath: string;
    readonly remote: string;
    readonly commitHash: string;
    readonly projectName: string;
    readonly content: string;
  };
  title?: string,
  onDrop: (card: CardProps | null) => void,
};

export function CardFromSelection({
  selection: originalSelection,
  title: originalTitle = originalSelection.title,
  data,
  onDrop }: CardFromSelectionProps) {
  const [selection, setSelection] = React.useState(originalSelection)

  const location = React.useMemo(() => {
    if (selection) {
      return `${data.gitPath}#L${selection.startLine}-L${selection.endLine}`;
    }
    return ""
  }, [data.gitPath, selection])
  const permalink = React.useMemo(() => {
    const GITHUB_ORIGIN = /git@github.com:([^/\s]+)\/([^/\s]+)(.git)/;

    const github = data.remote.match(GITHUB_ORIGIN);
    if (github) {
      const [, org, repo] = github;
      return `https://github.com/${org}/${repo}/blob/${data.commitHash}/${location}`;
    }

    return null
  }, [data.commitHash, data.remote, location])

  const [title, setTitle] = React.useState<string>(originalTitle ?? "")


  return (
    <div className="p-2 v-full">

      <div className="flex flex-col gap-1 p-1 mt-3 v-full bg-coconut text-c-navy">
        <label htmlFor="title">Title</label>

        <input
          onChange={(e) => { setTitle(e.target.value) }}
          type="text"
          name="title"
          placeholder="Title"
          value={title} />

        <label htmlFor="text">Text</label>
        <textarea
          className='flex-grow'
          onChange={(e) => {
            const lines = e.target.value.split('\n');
            setSelection({
              ...selection,
              text: lines,
            });
          }}
          style={{
            height: 10 + "em",
          }}
          name="text"
          value={selection.text.join('\n')} />

        <div className='mb-4'>
          Drag the card onto the board when ready
        </div>
      </div>

      <MiroCard
        onDrop={onDrop}
        width={300}
        height={150}

        fields={[
          {
            value: `Project: ${data.projectName}`,
          },
          {
            value: location
          }
        ]}
        style={{}}
        meta={{
          projectName: data.projectName,
          path: data.path,
          startLine: selection.startLine,
          endLine: selection.endLine,
          remote: data.remote,
        }}
        title={title}
      >
        {permalink && (
          <a href={permalink}>{`${data.projectName}:${location}`}</a>
        )}
        {!permalink && (
          <>
            Remote: {data.remote}<br />
            {location}
          </>
        )}
        <br /> <br />
        {selection.text.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </MiroCard>

      <button
        className='bg-coconut text-c-crimson p-2 rounded'
        onClick={() => onDrop(null)}>
        Cancel
      </button>
    </div >
  );
}