import * as child from "child_process";
import * as path from "path";
import { fs } from "~/fs-promises.server";

// git rev-parse --short HEAD

export async function getCommitHash(fullPath: string): Promise<string> {
  const stat = await fs.stat(fullPath);
  const hash = child.spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf-8",
    cwd: stat.isDirectory() ? fullPath : path.dirname(fullPath),
  });

  return hash.stdout.trim();
}

export async function getRemoteURLs(fullPath: string): Promise<string[]> {
  const stat = await fs.stat(fullPath);
  const cwd = stat.isDirectory() ? fullPath : path.dirname(fullPath);

  const gitRemote = child.spawnSync("git", ["remote"], {
    encoding: "utf-8",
    cwd,
  });

  const remotes = String(gitRemote.stdout).trim().split("\n");

  return Promise.all(
    remotes.map(async (remoteName) => {
      const gitRemoteUrl = child.spawnSync(
        "git",
        ["remote", "get-url", remoteName],
        {
          encoding: "utf-8",
          cwd,
        }
      );

      return String(gitRemoteUrl.stdout).trim();
    })
  );
}
