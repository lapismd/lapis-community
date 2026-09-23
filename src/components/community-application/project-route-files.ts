import { validRouteCoordinate } from "./project-route-coordinate.js";

export interface RepositoryFilesRoute {
  coordinate: string;
  revision: string;
  path?: string;
}

const FILES_HASH =
  /^#\/projects\/repository\/([^/]+)\/([^/]+)\/files(?:\/(.*))?$/u;

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
  if (!validRouteCoordinate(coordinate) || !validRevision(revision)) return null;
  if (match[3] === undefined) return { coordinate, revision };
  const path = decodeFilePath(match[3]);
  return path === undefined ? null : { coordinate, revision, ...(path ? { path } : {}) };
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

export function repositoryViewRevision(input: {
  surface: string;
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

function decodeFilePath(path: string): string | undefined {
  if (path === "") return "";
  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === ".."))
    return undefined;
  try {
    return segments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return undefined;
  }
}
