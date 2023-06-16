import React from "react";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { NavLink, Outlet, useLoaderData, useLocation } from "@remix-run/react";

// Files that end in .server are excluded from the browser bundle.
import { requireProject } from "~/lsp/lsp.server";
import classNames from "classnames";
import { fs } from "~/fs-promises.server";
import * as fsPath from "path";
import invariant from "tiny-invariant";

export const loader = async ({ params, request }: LoaderArgs) => {
  const [projectName] = await requireProject(params);
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";

  const plugins = await getPlugins(projectName);

  return json({
    projectName,
    path,
    dir: fsPath.dirname(path),
    tabs: plugins,
  });
};

export async function getPlugins(projectName: string) {
  const routeFiles = await fs.readdir(fsPath.join(__dirname, "../app/routes"));
  const plugins = routeFiles
    .filter(
      (file) =>
        file !== "lsp.$project.tsx" &&
        (file.startsWith(`lsp.plugin.${projectName}.`) ||
          file.startsWith(`lsp.$project.`))
    )
    .flatMap((pluginFilename) => {
      const parts = pluginFilename.split(".");
      console.log(parts);
      invariant(parts.shift() === "lsp", "Expected to start with lsp");
      invariant(parts.shift() === "$project", "Missing $project");
      invariant(parts.pop() === "tsx", "Expected to end with tsx");
      if (parts[0] === "plugin" && parts.length > 1 && parts[1] !== "_index") {
        parts.shift();

        return {
          name: parts.join("."),
          path: parts.join("/"),
        };
      }
      return [];
    });
  return plugins;
}

export default function () {
  const { path, tabs, projectName } = useLoaderData<typeof loader>();
  const [expand, setExpand] = React.useState(false);
  const { key } = useLocation();

  React.useEffect(() => {
    // There will always be a key, so this is just a way to make it a dependency
    // of the effect.
    if (key) {
      setExpand(false);
    }
  }, [key]);

  return (
    <div style={{ overflow: "auto", maxHeight: "100vh" }}>
      <nav
        className={classNames("tabs", {
          "flex-row": !expand,
          "flex-col": expand,
        })}
      >
        <div className="tabs-header-list">
          <Tab expand={expand} to={`/lsp/${projectName}/?path=${path}`}>
            Browse
          </Tab>
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              expand={expand}
              to={`/lsp/${projectName}/plugin/${tab.path}?path=${path}`}
            >
              {tab.name}
            </Tab>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

function Tab({
  to,
  children,
  expand,
}: React.PropsWithChildren<{ to: string; expand: boolean }>) {
  return (
    <NavLink
      className={({ isActive }) =>
        classNames("tab", {
          "tab-active": isActive,
          hidden: !isActive,
        })
      }
      style={{
        padding: "var(--space-xxsmall)",
        margin: "var(--space-xxsmall)",
      }}
      to={to}
    >
      {children}
    </NavLink>
  );
}
