import type {
  CommunityApplicationLocation,
  CommunityApplicationProjectRoute,
} from "./navigation.js";

export function repositoryLogRoute(
  location: CommunityApplicationLocation,
):
  | Extract<CommunityApplicationProjectRoute, { kind: "repository" }>
  | undefined {
  const route = location.projectRoute;
  return route?.kind === "repository" &&
    (route.surface === "log" || route.surface === "oplog")
    ? route
    : undefined;
}

export function projectViewForSurface(surface: string): string {
  return surface === "oplog" ? "log" : surface;
}

export function logPaneNavigation(
  location: () => CommunityApplicationLocation,
  navigate: (location: CommunityApplicationLocation) => void,
) {
  return {
    requestedCommitId() {
      const route = repositoryLogRoute(location());
      return route && (route.commitSha ?? null);
    },
    onSelectCommit(commitId: string | null) {
      const current = location();
      const route = repositoryLogRoute(current);
      if (!route || (route.commitSha ?? null) === commitId) return;
      const next = locationWithLogSurface(current, route.surface, commitId);
      if (next) navigate(next);
    },
    onSelectPane(surface: "log" | "oplog") {
      const current = location();
      if (current.projectRoute?.surface === surface) return;
      const next = locationWithLogSurface(current, surface);
      if (next) navigate(next);
    },
  };
}

export function locationWithLogSurface(
  location: CommunityApplicationLocation,
  surface: "log" | "oplog",
  commitId?: string | null,
): CommunityApplicationLocation | undefined {
  const route = location.projectRoute;
  if (route?.kind !== "repository") return undefined;
  const { commitSha: _previous, ...base } = route;
  return {
    ...location,
    projectRoute: {
      ...base,
      surface,
      ...(commitId ? { commitSha: commitId } : {}),
    },
  };
}
