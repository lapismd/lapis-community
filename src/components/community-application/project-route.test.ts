import { describe, expect, it } from "vitest";

import { projectRouteFromHash, projectRouteToHash } from "./navigation.js";

describe("project route hashes", () => {
  it("omits the project activity surface and remaps legacy hashes", () => {
    expect(
      projectRouteToHash({
        kind: "project",
        coordinate: "30621:owner:road map",
        surface: "activity",
      }),
    ).toBe("#/projects/project/30621:owner:road%20map");
    expect(
      projectRouteFromHash("#/projects/project/30621:owner:road%20map/overview"),
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
      surface: "activity",
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
});
