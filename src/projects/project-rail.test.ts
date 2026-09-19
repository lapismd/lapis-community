import { describe, expect, it } from "vitest";

import { projectRailSurface, projectSurfaceTitle } from "./project-rail.js";
import { isProjectForgeSurface, PROJECT_REPOSITORY_TABS } from "./surfaces.js";

describe("project rail", () => {
  it("maps Options to the options surface without adding a toolbar tab", () => {
    expect(projectRailSurface("Options", "repository")).toBe("options");
    expect(isProjectForgeSurface("options")).toBe(true);
    expect(PROJECT_REPOSITORY_TABS.map((tab) => tab.value)).not.toContain(
      "options",
    );
    expect(projectSurfaceTitle("options")).toBe("Options");
  });

  it("keeps existing repository detail targets", () => {
    expect(projectRailSurface("Latest", "repository")).toBe("commits");
    expect(projectRailSurface("Files", "repository")).toBe("files");
    expect(projectRailSurface("Tasks", "repository")).toBe("tasks");
    expect(projectRailSurface("Reviews", "repository")).toBe("reviews");
    expect(projectRailSurface("Repositories", "repository")).toBeUndefined();
    expect(projectRailSurface("Repositories", "project")).toBe("repositories");
  });
});
