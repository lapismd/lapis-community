import {
  isProjectForgeSurface,
  normalizeProjectRouteSurface,
  projectRouteDefaultSurface,
} from "../../projects/index.js";
import type { CommunityApplicationProjectRoute } from "./navigation.js";

export function projectRouteToHash(
  route: CommunityApplicationProjectRoute,
): string {
  const surface =
    route.surface === projectRouteDefaultSurface(route.kind)
      ? ""
      : `/${route.surface}`;
  const commit =
    route.kind === "repository" &&
    (route.surface === "commits" || route.surface === "log") &&
    route.commitSha
      ? `/${route.commitSha}`
      : "";
  return `#/projects/${route.kind}/${encodeURIComponent(route.coordinate).replaceAll("%3A", ":")}${surface}${commit}`;
}

export function projectRouteFromHash(
  hash: string,
): CommunityApplicationProjectRoute | null {
  const match =
    /^#\/projects\/(project|repository)\/([^/]+)(?:\/([^/]+))?(?:\/([a-f0-9]{40}|[a-f0-9]{64}))?$/u.exec(
      hash,
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
      (kind !== "repository" || !["commits", "log"].includes(surface))
    )
      return null;
    return {
      kind,
      coordinate,
      surface,
      ...(match[4] ? { commitSha: match[4] } : {}),
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
        (route.surface === "commits" || route.surface === "log") &&
        typeof route.commitSha === "string" &&
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(route.commitSha)
          ? { commitSha: route.commitSha }
          : {}),
      }
    : undefined;
}

export function validRouteCoordinate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function projectRouteKey(
  route: CommunityApplicationProjectRoute | undefined,
): string {
  return route === undefined
    ? ""
    : `${route.kind}:${route.coordinate}:${route.surface}:${route.kind === "repository" ? (route.commitSha ?? "") : ""}`;
}

export function repositoryRouteState(
  route: CommunityApplicationProjectRoute | undefined,
) {
  return route?.kind === "repository"
    ? route
    : { coordinate: "", surface: "overview" as const };
}
