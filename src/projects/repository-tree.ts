import type { ProjectForgeSession } from "./data-source.js";
import type { ProjectForgeTreeResponse } from "./model.js";

const DIRECTORY_READ_CONCURRENCY = 6;

function repositoryEntryPath(parent: string, name: string): string {
  const normalizedParent = parent.replace(/^\/+|\/+$/gu, "");
  const normalizedName = name.replace(/^\/+|\/+$/gu, "");
  return [normalizedParent, normalizedName].filter(Boolean).join("/");
}

export async function loadProjectRepositoryFileTree(
  session: ProjectForgeSession,
  repository: string,
  revision: string,
  signal: AbortSignal,
): Promise<ProjectForgeTreeResponse> {
  const root = await session.loadTree(repository, revision, "", signal);
  const files: Array<ProjectForgeTreeResponse["entries"][number]> = [];
  const pendingDirectories: string[] = [];
  const visitedDirectories = new Set<string>([""]);

  function collectEntries(tree: ProjectForgeTreeResponse, parent: string) {
    for (const entry of tree.entries) {
      const path = repositoryEntryPath(parent, entry.name);
      if (entry.type === "tree") {
        if (!visitedDirectories.has(path)) pendingDirectories.push(path);
        continue;
      }
      files.push({ ...entry, path });
    }
  }

  collectEntries(root, "");
  while (pendingDirectories.length > 0) {
    const batch = pendingDirectories.splice(0, DIRECTORY_READ_CONCURRENCY);
    for (const path of batch) visitedDirectories.add(path);
    const directories = await Promise.all(
      batch.map(async (path) => ({
        path,
        tree: await session.loadTree(repository, revision, path, signal),
      })),
    );
    for (const directory of directories)
      collectEntries(directory.tree, directory.path);
  }

  return { ...root, path: "", entries: files };
}
