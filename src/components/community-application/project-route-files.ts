import { validRouteCoordinate } from "./project-route-coordinate.js";

export interface RepositoryFilesRoute {
  coordinate: string;
  revision: string;
  path?: string;
}

export interface ProjectFilesRoute {
  coordinate: string;
  repositoryCoordinate?: string;
  revision?: string;
  path?: string;
}

const FILES_HASH =
  /^#\/projects\/repository\/([^/]+)\/([^/]+)\/files(?:\/(.*))?$/u;
const PROJECT_FILES_HASH =
  /^#\/projects\/project\/([^/]+)\/files(?:\/([^/]+)(?:\/([^/]+)(?:\/(.*))?)?)?$/u;

export function repositoryFilesHash(
  coordinate: string,
  revision: string,
  path?: string,
): string {
  const encodedCoordinate = encodeURIComponent(coordinate).replaceAll(
    "%3A",
    ":",
  );
  const suffix = path ? `/${encodeFilePath(path)}` : "";
  return `#/projects/repository/${encodedCoordinate}/${encodeURIComponent(revision)}/files${suffix}`;
}

export function projectFilesHash(
  coordinate: string,
  repositoryCoordinate?: string,
  revision?: string,
  path?: string,
): string {
  const encodedCoordinate = encodeCoordinate(coordinate);
  if (!repositoryCoordinate)
    return `#/projects/project/${encodedCoordinate}/files`;
  const encodedRepository = encodeCoordinate(repositoryCoordinate);
  if (!revision)
    return `#/projects/project/${encodedCoordinate}/files/${encodedRepository}`;
  const suffix = path ? `/${encodeFilePath(path)}` : "";
  return `#/projects/project/${encodedCoordinate}/files/${encodedRepository}/${encodeURIComponent(revision)}${suffix}`;
}

export function repositoryFilesRouteFromHash(
  hash: string,
): RepositoryFilesRoute | null {
  const match = FILES_HASH.exec(hash);
  if (!match) return null;
  let coordinate = "";
  let revision = "";
  try {
    coordinate = decodeURIComponent(match[1] ?? "");
    revision = decodeURIComponent(match[2] ?? "");
  } catch {
    return null;
  }
  if (!validRouteCoordinate(coordinate) || !validRevision(revision))
    return null;
  if (match[3] === undefined) return { coordinate, revision };
  const path = decodeFilePath(match[3]);
  return path === undefined
    ? null
    : { coordinate, revision, ...(path ? { path } : {}) };
}

export function projectFilesRouteFromHash(
  hash: string,
): ProjectFilesRoute | null {
  const match = PROJECT_FILES_HASH.exec(hash);
  if (!match) return null;
  let coordinate = "";
  let repositoryCoordinate = "";
  let revision = "";
  try {
    coordinate = decodeURIComponent(match[1] ?? "");
    repositoryCoordinate = decodeURIComponent(match[2] ?? "");
    revision = decodeURIComponent(match[3] ?? "");
  } catch {
    return null;
  }
  if (!validRouteCoordinate(coordinate)) return null;
  if (!repositoryCoordinate) return { coordinate };
  if (!validRouteCoordinate(repositoryCoordinate)) return null;
  if (!revision) return { coordinate, repositoryCoordinate };
  if (!validRevision(revision)) return null;
  if (match[4] === undefined)
    return { coordinate, repositoryCoordinate, revision };
  const path = decodeFilePath(match[4]);
  return path === undefined
    ? null
    : {
        coordinate,
        repositoryCoordinate,
        revision,
        ...(path ? { path } : {}),
      };
}

export function storedRepositoryFilesFields(route: Record<string, unknown>): {
  revision?: string;
  path?: string;
} {
  if (route.surface !== "files" || !validRevision(route.revision)) return {};
  const path = typeof route.path === "string" ? route.path : "";
  return {
    revision: route.revision,
    ...(path && decodeFilePath(encodeFilePath(path)) === path ? { path } : {}),
  };
}

export function storedProjectFilesFields(route: Record<string, unknown>): {
  repositoryCoordinate?: string;
  revision?: string;
  path?: string;
} {
  if (route.surface !== "files") return {};
  const repositoryCoordinate =
    typeof route.repositoryCoordinate === "string" &&
    validRouteCoordinate(route.repositoryCoordinate)
      ? route.repositoryCoordinate
      : "";
  if (!repositoryCoordinate) return {};
  return {
    repositoryCoordinate,
    ...storedRepositoryFilesFields(route),
  };
}

export function repositoryViewRevision(input: {
  surface: string | undefined;
  routeRevision: string | undefined;
  requestedBranch: string;
  requestedOwnerMatches: boolean;
  branches: readonly { name: string; sha: string }[];
  headName?: string;
  headSha?: string;
}): { branch: string; revision: string } {
  const requested =
    input.surface === "files" && input.routeRevision
      ? input.routeRevision
      : input.requestedOwnerMatches
        ? input.requestedBranch
        : "";
  const match = input.branches.find(
    (branch) => branch.name === requested || branch.sha === requested,
  );
  const fallback = input.branches[0];
  const branch =
    requested && requested === match?.sha
      ? requested
      : (match?.name ?? (requested || fallback?.name || input.headName || ""));
  const revision = branch || fallback?.sha || input.headSha || "";
  return { branch, revision };
}

const COMMIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/iu;

export function repositoryFilePermalink(
  revision: string | undefined,
  branches: readonly { name: string; sha: string }[],
  commitSha?: string,
): string | undefined {
  if (!revision) return undefined;
  if (COMMIT_SHA.test(revision)) return revision;
  return (
    commitSha ||
    branches.find((branch) => branch.name === revision)?.sha ||
    revision
  );
}

export function repositoryFilesLoadKey(
  route: { kind?: string; surface?: string; revision?: string } | undefined,
  loadedRevision: string,
  loadedCommitSha?: string,
): string {
  // Other surfaces discover and reset their revision inside the loader.
  // Feeding that result back into its dependencies cancels and restarts it.
  if (
    (route?.kind !== "repository" && route?.kind !== "project") ||
    route.surface !== "files"
  )
    return "";
  const revision = route.revision ?? "";
  if (loadedCommitSha && revision === loadedCommitSha)
    return loadedRevision || revision;
  return revision || loadedRevision;
}

function validRevision(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function encodeFilePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function encodeCoordinate(coordinate: string): string {
  return encodeURIComponent(coordinate).replaceAll("%3A", ":");
}

function decodeFilePath(path: string): string | undefined {
  if (path === "") return "";
  const segments = path.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  )
    return undefined;
  try {
    return segments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return undefined;
  }
}
