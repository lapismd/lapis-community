import {
  isProjectForgeSurface,
  normalizeProjectRouteSurface,
  projectRouteDefaultSurface,
  decodeProjectListCursor,
  encodeProjectListCursor,
} from "../../projects/index.js";
import type { ProjectListCursor } from "../../projects/index.js";
import type { CommunityApplicationProjectRoute } from "./navigation.js";
import { validRouteCoordinate } from "./project-route-coordinate.js";
import {
  projectFilesHash,
  projectFilesRouteFromHash,
  repositoryFilesHash,
  repositoryFilesRouteFromHash,
  storedProjectFilesFields,
  storedRepositoryFilesFields,
} from "./project-route-files.js";
import { projectRouteHasTrailingId } from "./project-route-trailing.js";

export { taskForProjectRoute } from "./project-task-route.js";
export { validRouteCoordinate } from "./project-route-coordinate.js";

export function projectRouteToHash(
  route: CommunityApplicationProjectRoute,
): string {
  if (
    route.kind === "repository" &&
    route.surface === "files" &&
    route.revision
  ) {
    return withProjectRouteCursor(
      repositoryFilesHash(route.coordinate, route.revision, route.path),
      route,
    );
  }
  if (route.kind === "project" && route.surface === "files") {
    return withProjectRouteCursor(
      projectFilesHash(
        route.coordinate,
        route.repositoryCoordinate,
        route.revision,
        route.path,
      ),
      route,
    );
  }
  const surface =
    route.surface === projectRouteDefaultSurface(route.kind)
      ? ""
      : `/${route.surface}`;
  const trailing =
    route.kind === "repository" && projectRouteHasTrailingId(route.surface)
      ? route.commitSha ||
        (route.revision && /^[zyxwvutsrqponmlk]{32}$/u.test(route.revision)
          ? route.revision
          : "")
      : "";
  const commit = trailing ? `/${trailing}` : "";
  return withProjectRouteCursor(
    `#/projects/${route.kind}/${encodeURIComponent(route.coordinate).replaceAll("%3A", ":")}${surface}${commit}`,
    route,
  );
}

export function projectRouteFromHash(
  hash: string,
): CommunityApplicationProjectRoute | null {
  const { baseHash, cursor } = splitProjectRouteCursor(hash);
  const files = repositoryFilesRouteFromHash(baseHash);
  if (files) {
    return {
      kind: "repository",
      coordinate: files.coordinate,
      surface: "files",
      revision: files.revision,
      ...(files.path ? { path: files.path } : {}),
      ...(cursor ? { cursor } : {}),
    };
  }
  const projectFiles = projectFilesRouteFromHash(baseHash);
  if (projectFiles) {
    return {
      kind: "project",
      coordinate: projectFiles.coordinate,
      surface: "files",
      ...(projectFiles.repositoryCoordinate
        ? { repositoryCoordinate: projectFiles.repositoryCoordinate }
        : {}),
      ...(projectFiles.revision ? { revision: projectFiles.revision } : {}),
      ...(projectFiles.path ? { path: projectFiles.path } : {}),
      ...(cursor ? { cursor } : {}),
    };
  }
  const match =
    /^#\/projects\/(project|repository)\/([^/]+)(?:\/([^/]+))?(?:\/([a-f0-9]{40}|[a-f0-9]{64}|[zyxwvutsrqponmlk]{32}))?$/u.exec(
      baseHash,
    );
  if (!match) return null;
  try {
    const kind = match[1] as CommunityApplicationProjectRoute["kind"];
    const coordinate = decodeURIComponent(match[2]!);
    const surface = normalizeProjectRouteSurface(
      kind,
      match[3] ?? projectRouteDefaultSurface(kind),
    );
    if (
      typeof coordinate !== "string" ||
      coordinate.length === 0 ||
      coordinate.length > 1024 ||
      coordinate.trim() !== coordinate ||
      /[\u0000-\u001f\u007f]/u.test(coordinate) ||
      !isProjectForgeSurface(surface)
    ) {
      return null;
    }
    if (
      match[4] &&
      (kind !== "repository" || !projectRouteHasTrailingId(surface))
    )
      return null;
    const token = match[4];
    const changeId = token && /^[zyxwvutsrqponmlk]{32}$/u.test(token);
    return {
      kind,
      coordinate,
      surface,
      ...(token && !changeId ? { commitSha: token } : {}),
      ...(changeId ? { revision: token } : {}),
      ...(cursor ? { cursor } : {}),
    };
  } catch {
    return null;
  }
}

export function projectRouteCommit(
  route: CommunityApplicationProjectRoute | undefined,
) {
  return route?.kind === "repository" &&
    route.surface === "commits" &&
    route.commitSha
    ? { sha: route.commitSha, subject: route.commitSha.slice(0, 12) }
    : undefined;
}

export function parseStoredProjectRoute(
  value: unknown,
): CommunityApplicationProjectRoute | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const route = value as Record<string, unknown>;
  return (route.kind === "project" || route.kind === "repository") &&
    validRouteCoordinate(route.coordinate) &&
    isProjectForgeSurface(route.surface)
    ? {
        kind: route.kind,
        coordinate: route.coordinate,
        surface: route.surface,
        ...(route.kind === "repository" &&
        projectRouteHasTrailingId(route.surface) &&
        typeof route.commitSha === "string" &&
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(route.commitSha)
          ? { commitSha: route.commitSha }
          : {}),
        ...(route.kind === "repository"
          ? storedRepositoryFilesFields(route)
          : storedProjectFilesFields(route)),
        ...storedProjectRouteCursor(route.cursor),
      }
    : undefined;
}

export function projectRouteKey(
  route: CommunityApplicationProjectRoute | undefined,
): string {
  return route === undefined
    ? ""
    : `${route.kind}:${route.coordinate}:${route.surface}:${route.kind === "repository" ? `${route.commitSha ?? ""}:${route.revision ?? ""}:${route.path ?? ""}` : `${route.repositoryCoordinate ?? ""}:${route.revision ?? ""}:${route.path ?? ""}`}:${encodeProjectListCursor(route.cursor) ?? ""}`;
}

export function repositoryRouteState(
  route: CommunityApplicationProjectRoute | undefined,
) {
  return route?.kind === "repository"
    ? route
    : { coordinate: "", surface: "overview" as const };
}

function splitProjectRouteCursor(hash: string): {
  baseHash: string;
  cursor?: ProjectListCursor;
} {
  const [baseHash = hash, query = ""] = hash.split("?", 2);
  const cursor = decodeProjectListCursor(
    new URLSearchParams(query).get("at") ?? undefined,
  );
  return { baseHash, ...(cursor ? { cursor } : {}) };
}

function withProjectRouteCursor(
  hash: string,
  route: CommunityApplicationProjectRoute,
): string {
  const encoded = encodeProjectListCursor(route.cursor);
  return encoded ? `${hash}?at=${encodeURIComponent(encoded)}` : hash;
}

function storedProjectRouteCursor(value: unknown): {
  cursor?: ProjectListCursor;
} {
  const cursor =
    typeof value === "string"
      ? decodeProjectListCursor(value)
      : typeof value === "object" && value !== null
        ? decodeProjectListCursor(
            encodeProjectListCursor(value as ProjectListCursor),
          )
        : undefined;
  return cursor ? { cursor } : {};
}
