import path from "path";
import type { Project } from "./Project";
import invariant from "tiny-invariant";
import { fs } from "~/fs-promises.server";
import { getRemoteURLs } from "~/models/git.server";

const LSPProjects: Record<Project["name"], Project> = {};

export async function getProjects() {
  const projects = LSPProjects;

  const root = path.join(__dirname, "../");
  const project = await prepareProject(root);
  if (project) {
    LSPProjects[project.name] = project;
  }

  const r = await Object.keys(process.env)
    .filter((key) => key.startsWith("REPO"))
    .map((key) => process.env[key])
    .reduce(async (acc, repo) => {
      const tmp = await acc;

      if (typeof repo === "string") {
        const project = await prepareProject(path.join(root, repo));
        if (project) {
          tmp[project.name] = project;
        }
      }
      return acc;
    }, Promise.resolve(projects));

  return r;
}
async function prepareProject(gitRoot: string): Promise<Project | undefined> {
  let stat;
  try {
    stat = await fs.stat(gitRoot);
    if (!stat.isDirectory()) {
      return;
    }
  } catch (e) {
    return;
  }
  const projectConfig = {
    root: gitRoot,
    name: path.basename(gitRoot),
  };

  const pluginFolder = path.resolve(gitRoot, "AppExplorer");

  let plugins: Project["plugins"] = [];
  try {
    if ((await fs.stat(pluginFolder)).isDirectory()) {
      plugins = await readPlugins(projectConfig.name, pluginFolder);
    }
  } catch (e) {
    // ignore
  }
  return {
    name: projectConfig.name,
    root: gitRoot,
    remotes: await getRemoteURLs(gitRoot),
    plugins,
  };
}

async function readPlugins(projectName: string, pluginFolder: string) {
  const files = await fs.readdir(pluginFolder);

  const plugins = files.map((filename) => {
    if (filename.match(/\.tsx$/)) {
      return filename;
    }
    return [];
  });

  // I can't import the plugins from where they sit, so I'm going to copy them
  // into the lsp folder
  return Promise.all(
    plugins.flat().map(async (plugin): Promise<string> => {
      const source = path.join(pluginFolder, plugin);
      const destination = path.join(
        __dirname,
        "../app/routes",
        `lsp.$project.plugin.${projectName}.${plugin}`
      );

      await fs.mkdir(path.dirname(destination), { recursive: true });

      try {
        const destinationStats = await fs.stat(destination);
        const sourceStats = await fs.stat(source);
        // Only copy the file if the source is older, because this updates the
        // app directory and triggers a reload. Without this timestamp check, it
        // gets stuck in an infinite loop
        if (
          destinationStats.isFile() &&
          sourceStats.mtimeMs < destinationStats.mtimeMs
        ) {
          if (destinationStats.mtimeMs > sourceStats.mtimeMs + 60000) {
            console.log("Saving updates to", source);
            await fs.copyFile(destination, source);
          } else {
            console.log("Plugin already installed, skipping");
          }
          return `${projectName}.${plugin}`;
        }
      } catch (e) {
        // ignore
      }

      console.log("copying file");
      await fs.copyFile(source, destination);
      return `${projectName}.${plugin}`;
    })
  );
}

export async function readInstalledPlugins(projectName: string) {
  const files = await fs.readdir(path.join(__dirname, "../app/routes/"));

  const plugins = files
    .filter((filename) => filename.startsWith(`lsp.plugin.${projectName}.`))
    .map((filename) => {
      const [, , , pluginName] = filename.split(".");
      return {
        projectName,
        pluginName,
        filename,
      };
    });

  return plugins;
}
