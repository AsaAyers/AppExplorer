import type { LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireProject } from "~/lsp/lsp.server";
import type { AppCardProps } from "@mirohq/websdk-types";

type ProjectResponse = {
  type: "app_card";
  props: AppCardProps;
};

export const loader = async ({
  params,
  request,
}: LoaderArgs): Promise<TypedResponse<ProjectResponse>> => {
  const [, project] = await requireProject(params);
  return json({
    type: "app_card",
    props: {
      title: `Project: ${project.name}`,
      status: "connected",
      fields: [
        ...project.remotes.map((value) => ({
          value,
          tooltip: "git remotes are used to identify projects",
        })),
      ],
      description: `Custom Plugins: \n${project.plugins.join("\n")}`,
    },
  });
};
