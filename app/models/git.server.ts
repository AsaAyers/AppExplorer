import * as child from "child_process";
import * as path from "path";

// git rev-parse --short HEAD

export function getCommitHash(fullPath: string): string {
  const hash = child.spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf-8",
    // TODO: Figure out why I had to add this .git folder here.  Before I added
    // it, it claimed it couldn't find a git repo.
    cwd: path.dirname(fullPath) + "/.git",
  });

  return hash.stdout.trim();
}

export function getRemoteURL(fullPath: string): string {
  const hash = child.spawnSync("git", ["remote", "-v"], {
    encoding: "utf-8",
    // TODO: Figure out why I had to add this .git folder here.  Before I added
    // it, it claimed it couldn't find a git repo.
    cwd: path.dirname(fullPath) + "/.git",
  });

  const github = String(hash.stdout).match(
    /git@github.com:([^/\s]+)\/([^/\s]+)(.git)/
  );

  if (github) {
    return github[0];
  }

  if (hash.stderr) {
    console.warn(`Unable to read remote URL for ${fullPath}\n`, hash.stderr);
  }

  return "https://example.com/unknown_remote";
}
