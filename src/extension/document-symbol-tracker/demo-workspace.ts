import { demoTextFiles } from "@/app/(website)/demo/demo-text-files";
import type { CardData } from "@/EventTypes";

export const DEMO_WORKSPACE_ROOT = "/demo-workspace";

export const demoWorkspaceFiles = demoTextFiles;

export const defaultDemoWorkspaceFile = demoWorkspaceFiles[0];

function normalizePath(path: string) {
  let normalized = path;
  if (normalized.startsWith(DEMO_WORKSPACE_ROOT + "/")) {
    normalized = normalized.slice(DEMO_WORKSPACE_ROOT.length + 1);
  }

  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

export function toDemoWorkspaceFsPath(path: string) {
  return `${DEMO_WORKSPACE_ROOT}/${normalizePath(path)}`;
}

export function toDemoWorkspaceRelativePath(pathOrFsPath: string) {
  return normalizePath(pathOrFsPath);
}

export function getDemoWorkspaceFile(pathOrFsPath: string | null | undefined) {
  if (!pathOrFsPath) {
    return defaultDemoWorkspaceFile;
  }

  const normalized = normalizePath(pathOrFsPath);
  return (
    demoWorkspaceFiles.find((file) => file.path === normalized) ??
    defaultDemoWorkspaceFile
  );
}

export function getDemoWorkspaceCardsAroundCursor(
  pathOrFsPath: string,
  offset: number,
): CardData[] {
  const file = getDemoWorkspaceFile(pathOrFsPath);
  const matching = file.symbols
    .filter((symbol) => symbol.start <= offset && symbol.end >= offset)
    .map((symbol) => symbol.card)
    .toReversed();

  if (matching.length > 0) {
    return matching;
  }

  return file.symbols
    .filter((symbol) => !symbol.card.symbol.includes("/"))
    .map((symbol) => symbol.card);
}
