import type { CardProps } from "@mirohq/websdk-types";
import React from "react";
import type { CodeSelection } from "~/lsp/components/code";
import { MiroCard } from "~/lsp/components/miro-card";

type CardFromSelectionProps = {
  selection: CodeSelection;
  data: {
    readonly path: string;
    readonly gitPath: string;
    readonly remotes: string[];
    readonly commitHash: string;
    readonly projectName: string;
    readonly content: string;
  };
  title?: string;
  onDrop: (card: CardProps | null) => void;
};

export function CardFromSelection({
  selection: originalSelection,
  title: originalTitle = originalSelection.title,
  data,
  onDrop,
}: CardFromSelectionProps) {
  const [selection, setSelection] = React.useState(originalSelection);

  const location = React.useMemo(() => {
    if (selection) {
      return `${data.gitPath}#L${selection.startLine}-L${selection.endLine}`;
    }
    return "";
  }, [data.gitPath, selection]);
  const permalink = React.useMemo((): string | undefined => {
    const GITHUB_ORIGIN = /git@github.com:([^/\s]+)\/([^/\s]+)(.git)/;

    return data.remotes.flatMap((remoteUrl) => {
      const github = remoteUrl.match(GITHUB_ORIGIN);
      if (github) {
        const [, org, repo] = github;
        return `https://github.com/${org}/${repo}/blob/${data.commitHash}/${location}`;
      }
      return [];
    })[0];
  }, [data.commitHash, data.remotes, location]);

  const header = (
    <>
      {permalink && (
        <p>
          {" "}
          <a href={permalink}>{`${data.projectName}:${location}`}</a>{" "}
        </p>
      )}
      {!permalink && (
        <>
          Remote: {data.remotes}
          <br />
          {location}
        </>
      )}
    </>
  );

  const [title, setTitle] = React.useState<string>(originalTitle ?? "");

  return (
    <div>
      <MiroCard
        onDrop={onDrop}
        width={300}
        height={150}
        fields={[
          {
            value: `Project: ${data.projectName}`,
          },
          {
            value: location,
          },
        ]}
        style={{}}
        meta={{
          projectName: data.projectName,
          path: data.path,
          startLine: selection.startLine,
          endLine: selection.endLine,
          remote: data.remotes,
        }}
        title={title}
        editTitle={
          <div className="form-group-small">
            <label htmlFor="title">Title</label>

            <input
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              className="input"
              type="text"
              name="title"
              id="title"
              placeholder="Title"
              value={title}
            />
          </div>
        }
        editDescription={
          <>
            {header}
            <div className="form-group-small">
              <label htmlFor="text">Description</label>
              <textarea
                className="flex-grow textarea"
                placeholder=""
                onChange={(e) => {
                  const lines = e.target.value.split("\n");
                  setSelection({
                    ...selection,
                    text: lines,
                  });
                }}
                style={{
                  height: 10 + "em",
                }}
                name="text"
                id="text"
                value={selection.text.join("\n")}
              />
            </div>
          </>
        }
      >
        {header}
        {selection.text.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </MiroCard>

      <button className="button button-secondary" onClick={() => onDrop(null)}>
        Cancel
      </button>
    </div>
  );
}
