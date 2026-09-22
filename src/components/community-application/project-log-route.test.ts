import { describe, expect, it } from "vitest";

import { noCommunityApplicationPanel } from "./navigation.js";
import {
  locationWithLogSurface,
  projectViewForSurface,
  repositoryLogRoute,
} from "./project-log-route.js";

const location = {
  destination: "projects",
  panel: noCommunityApplicationPanel(),
  projectRoute: {
    kind: "repository" as const,
    coordinate: "30617:aa:notes",
    surface: "log" as const,
    commitSha: "a".repeat(40),
  },
};

describe("repository log route", () => {
  it("maps op-log to the log renderer and keeps commit on the hash route", () => {
    expect(projectViewForSurface("oplog")).toBe("log");
    expect(repositoryLogRoute(location)?.surface).toBe("log");
    expect(
      locationWithLogSurface(location, "oplog")?.projectRoute,
    ).toMatchObject({ surface: "oplog" });
    expect(
      locationWithLogSurface(location, "log", "b".repeat(40))?.projectRoute
        ?.commitSha,
    ).toBe("b".repeat(40));
  });
});
