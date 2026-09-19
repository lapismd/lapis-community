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
  return `#/projects/${route.kind}/${encodeURIComponent(route.coordinate).replaceAll("%3A", ":")}${surface}`;
}

export function projectRouteFromHash(
  hash: string,
): CommunityApplicationProjectRoute | null {
  const match =
    /^#\/projects\/(project|repository)\/([^/]+)(?:\/([^/]+))?$/u.exec(hash);
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
    return { kind, coordinate, surface };
  } catch {
    return null;
  }
}
