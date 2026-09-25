import { describe, expect, it } from "vitest";

import {
  locationForProjectDestination,
  locationForProjectRoute,
} from "./project-commit-route.js";
import { projectRouteFromHash, projectRouteToHash } from "./navigation.js";
import { parseStoredProjectRoute, projectRouteKey } from "./project-route.js";

describe("project route hashes", () => {
  it("restores an exact repository commit through direct navigation", () => {
    const route = {
      kind: "repository" as const,
      coordinate: "30617:owner:probe",
      surface: "commits" as const,
      commitSha: "a".repeat(40),
    };
    expect(projectRouteFromHash(projectRouteToHash(route))).toEqual(route);
    expect(
      projectRouteFromHash(
        projectRouteToHash(route).replace("/commits/", "/log/"),
      ),
    ).toEqual({ ...route, surface: "log" });
    const logRoute = { ...route, surface: "log" as const };
    expect(parseStoredProjectRoute(logRoute)).toEqual(logRoute);
    expect(projectRouteKey(logRoute)).not.toBe(
      projectRouteKey({ ...logRoute, commitSha: "b".repeat(40) }),
    );
    expect(
      projectRouteFromHash(
        projectRouteToHash(route).replace("/commits/", "/files/"),
      ),
    ).toBeNull();
  });
  it("omits the project activity surface and preserves project files", () => {
    expect(
      projectRouteToHash({
        kind: "project",
        coordinate: "30621:owner:road map",
        surface: "activity",
      }),
    ).toBe("#/projects/project/30621:owner:road%20map");
    expect(
      projectRouteFromHash(
        "#/projects/project/30621:owner:road%20map/overview",
      ),
    ).toEqual({
      kind: "project",
      coordinate: "30621:owner:road map",
      surface: "activity",
    });
    expect(
      projectRouteFromHash("#/projects/project/30621:owner:road%20map/files"),
    ).toEqual({
      kind: "project",
      coordinate: "30621:owner:road map",
      surface: "files",
    });
    expect(
      projectRouteFromHash(
        projectRouteToHash({
          kind: "project",
          coordinate: "30621:owner:road map",
          surface: "files",
          repositoryCoordinate: "30617:owner:probe",
          revision: "feature/files",
          path: "src/app.ts",
        }),
      ),
    ).toEqual({
      kind: "project",
      coordinate: "30621:owner:road map",
      surface: "files",
      repositoryCoordinate: "30617:owner:probe",
      revision: "feature/files",
      path: "src/app.ts",
    });
    expect(
      projectRouteFromHash(
        projectRouteToHash({
          kind: "project",
          coordinate: "30621:owner:road map",
          surface: "repositories",
        }),
      ),
    ).toEqual({
      kind: "project",
      coordinate: "30621:owner:road map",
      surface: "repositories",
    });
  });

  it("uses a main surface for selected-project Activity", () => {
    expect(
      locationForProjectRoute({
        kind: "project",
        coordinate: "30621:owner:road map",
        surface: "activity",
      }),
    ).toMatchObject({
      destination: "projects/30621%3Aowner%3Aroad%20map",
      mainSurface: "project-activity",
      projectRoute: {
        kind: "project",
        coordinate: "30621:owner:road map",
        surface: "activity",
      },
    });
    expect(
      locationForProjectDestination("projects/30621%3Aowner%3Aroad%20map"),
    ).toEqual(
      locationForProjectRoute({
        kind: "project",
        coordinate: "30621:owner:road map",
        surface: "activity",
      }),
    );
    expect(locationForProjectDestination("registry")).toBeUndefined();
  });
});
