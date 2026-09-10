import type { ProjectForgeTreeEntry } from "../../projects/index.js";

export interface RepositoryBrowserEntry {
  type: "tree" | "blob";
  name: string;
  path: string;
  size?: number;
}

export interface RepositoryBreadcrumbSegment {
  name: string;
  path: string;
}

function normalizeRepositoryPath(path: string): string {
  return path.split("/").filter(Boolean).join("/");
}

function entryPath(entry: ProjectForgeTreeEntry): string {
  return normalizeRepositoryPath(entry.path ?? entry.name);
}

function directChildren(
  files: readonly ProjectForgeTreeEntry[],
  directory: string,
): { directories: string[]; files: ProjectForgeTreeEntry[] } {
  const prefix = directory ? `${directory}/` : "";
  const directories = new Set<string>();
  const immediateFiles: ProjectForgeTreeEntry[] = [];

  for (const file of files) {
    const path = entryPath(file);
    if (!path.startsWith(prefix)) continue;
    const relativePath = path.slice(prefix.length);
    if (!relativePath) continue;
    const [child, ...remaining] = relativePath.split("/");
    if (!child) continue;
    if (remaining.length > 0) directories.add(child);
    else immediateFiles.push(file);
  }

  return {
    directories: [...directories].sort((left, right) =>
      left.localeCompare(right),
    ),
    files: immediateFiles.sort((left, right) =>
      entryPath(left).localeCompare(entryPath(right)),
    ),
  };
}

/**
 * Builds the entries for one repository directory. Directory chains that do
 * not contain a file or branch are collapsed into one GitHub-style path.
 */
export function repositoryBrowserEntries(
  entries: readonly ProjectForgeTreeEntry[],
  currentPath = "",
): RepositoryBrowserEntry[] {
  const directory = normalizeRepositoryPath(currentPath);
  const files = entries.filter((entry) => entry.type === "blob");
  const children = directChildren(files, directory);

  const directories = children.directories.map((name) => {
    const segments = [name];
    let path = [directory, name].filter(Boolean).join("/");

    while (true) {
      const nested = directChildren(files, path);
      if (nested.files.length > 0 || nested.directories.length !== 1) break;
      const [onlyDirectory] = nested.directories;
      if (!onlyDirectory) break;
      segments.push(onlyDirectory);
      path = `${path}/${onlyDirectory}`;
    }

    return {
      type: "tree" as const,
      name: segments.join("/"),
      path,
    };
  });

  const immediateFiles = children.files.map((file) => ({
    type: "blob" as const,
    name: entryPath(file).split("/").at(-1) ?? file.name,
    path: entryPath(file),
    ...(file.size === undefined ? {} : { size: file.size }),
  }));

  return [...directories, ...immediateFiles];
}

export function repositoryBreadcrumbSegments(
  path: string,
): RepositoryBreadcrumbSegment[] {
  const segments = normalizeRepositoryPath(path).split("/").filter(Boolean);
  return segments.map((name, index) => ({
    name,
    path: segments.slice(0, index + 1).join("/"),
  }));
}

export function repositoryParentPath(path: string): string {
  const segments = normalizeRepositoryPath(path).split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

export function isMarkdownRepositoryPath(path: string): boolean {
  return /\.(?:md|markdown|mdown|mkd|mdx)$/iu.test(path);
}
