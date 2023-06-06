import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getProjects } from "~/lsp/projects";

export const loader = async (a: LoaderArgs) => {
  return json({ projects: await getProjects() })
}

export default function () {
  const data = useLoaderData<typeof loader>()

  return (
    <div className="">
      <table className="table">
        <thead>
          <tr>
            <th>Projects</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data.projects).map((projectName) => (
            <tr key={projectName}>
              <td>
                <Link
                  className="link"
                  to={"./" + projectName}>
                  {projectName}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}