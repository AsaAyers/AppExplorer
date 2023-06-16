import type { AppCardProps } from "@mirohq/websdk-types";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import React from "react";
import { ConnectedBoardItem } from "~/lsp/components/connected-board-item";
import { getProjects } from "~/lsp/projects";

export const loader = async (a: LoaderArgs) => {
  return json({ projects: await getProjects() });
};

export default function () {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="">
      {Object.keys(data.projects).map((projectName) => (
        <ConnectedBoardItem
          key={`/api/${projectName}/card`}
          type="app_card"
          Component={ProjectCard}
          apiEndpoint={`/api/${projectName}/card`}
        />
      ))}
    </div>
  );
}

function ProjectCard({
  title,
  description,
  status,
  fields,
}: AppCardProps): JSX.Element {
  return (
    <div className="app-card">
      <h1 className="app-card--title">{title}</h1>
      <h1 className="app-card--description p-medium">{description}</h1>
      <div className="app-card--body">
        <div className="app-card--tags">
          {fields?.map((field, i) => (
            <span key={i} className="tag">
              {field.value}
            </span>
          ))}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="app-card--app-logo"
        ></svg>
      </div>
    </div>
  );
}
