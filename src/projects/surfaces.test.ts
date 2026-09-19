import { describe, expect, it } from "vitest";

import {
  normalizeProjectRouteSurface,
  projectRouteDefaultSurface,
} from "./surfaces.js";

describe("project route surfaces", () => {
  it("defaults projects to activity and remaps legacy overview and files", () => {
    expect(projectRouteDefaultSurface("project")).toBe("activity");
    expect(projectRouteDefaultSurface("repository")).toBe("overview");
    expect(normalizeProjectRouteSurface("project", "overview")).toBe("activity");
    expect(normalizeProjectRouteSurface("project", "files")).toBe("activity");
    expect(normalizeProjectRouteSurface("repository", "files")).toBe("files");
  });
});
