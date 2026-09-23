import { projectRouteHasCommit } from "./project-route-commit.js";
import type {
  ProjectForgeCatalog,
  ProjectForgeSurface,
} from "../../projects/model.js";
import type {
  CommunityApplicationLocation,
  CommunityApplicationPanel,
  CommunityApplicationDestination,
  CommunityApplicationProjectRoute,
} from "./navigation.js";
import {
  noCommunityApplicationPanel,
  projectCoordinateFromDestination,
  projectDestinationFromCoordinate,
} from "./navigation.js";

export function locationForProjectDestination(
  destination: CommunityApplicationDestination,
): CommunityApplicationLocation | undefined {
  const coordinate = projectCoordinateFromDestination(destination);
  return coordinate === undefined
    ? undefined
    : locationForProjectRoute({
        kind: "project",
        coordinate,
        surface: "activity",
      });
}

export function repositorySurfaceLocation(
  coordinate: string,
  surface: ProjectForgeSurface,
  panel: CommunityApplicationPanel,
  projectCoordinate?: string,
  commitSha?: string,
): CommunityApplicationLocation {
  return {
    destination: projectCoordinate
      ? projectDestinationFromCoordinate(projectCoordinate)
      : "projects",
    panel,
    projectRoute: {
      kind: "repository",
      coordinate,
      surface,
      ...(surface === "files" && commitSha ? { revision: commitSha } : {}),
      ...(projectRouteHasCommit(surface) && commitSha ? { commitSha } : {}),
    },
  };
}

export function repositoryFilesPathLocation(
  location: CommunityApplicationLocation,
  path: string,
  revision?: string,
): CommunityApplicationLocation | undefined {
  const route = location.projectRoute;
  if (route?.kind !== "repository" || route.surface !== "files" || !route.revision) return undefined;
  const nextRevision = revision || route.revision;
  const { path: _ignored, ...rest } = route;
  const base = nextRevision === route.revision ? rest : { ...rest, revision: nextRevision };
  return { ...location, projectRoute: path ? { ...base, path } : base };
}

export function reviewCommitLocation(
  catalog: ProjectForgeCatalog,
  repositoryCoordinate: string | undefined,
  commitSha: string,
) {
  const repository = catalog.repositories.find(
    (repository) => repository.address.coordinate === repositoryCoordinate,
  );
  if (!repository) return;
  const project = catalog.projects.find((project) =>
    project.repositories.some(
      (reference) => reference.coordinate === repositoryCoordinate,
    ),
  );
  return {
    coordinate: repository.address.coordinate,
    location: repositorySurfaceLocation(
      repository.address.coordinate,
      "commits",
      { kind: "none" },
      project?.address.coordinate,
      commitSha,
    ),
  };
}

export function locationForProjectRoute(
  route: CommunityApplicationProjectRoute,
): CommunityApplicationLocation {
  return {
    destination:
      route.kind === "project"
        ? projectDestinationFromCoordinate(route.coordinate)
        : "projects",
    panel: noCommunityApplicationPanel(),
    ...(route.kind === "project"
      ? { mainSurface: `project-${route.surface}` as const }
      : {}),
    projectRoute: route,
  };
}
