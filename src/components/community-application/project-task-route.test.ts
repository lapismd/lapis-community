import { describe, expect, it } from "vitest";

import { projectRouteFromHash, projectRouteToHash } from "./project-route.js";
import { taskForProjectRoute } from "./project-task-route.js";

const id = "c".repeat(64);
const coordinate = `30617:${"d".repeat(64)}:buzz-world`;

describe("project task routes", () => {
  it("round-trips a tasks hash and selects the matching work item", () => {
    const route = {
      kind: "repository" as const,
      coordinate,
      surface: "tasks" as const,
      commitSha: id,
    };
    expect(projectRouteFromHash(projectRouteToHash(route))).toEqual(route);
    expect(
      taskForProjectRoute([{ root: { id }, title: "Awesome" }], route, "")
        ?.title,
    ).toBe("Awesome");
  });
});
