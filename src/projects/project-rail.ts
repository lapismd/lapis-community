import type { ProjectForgeOverviewSurface } from "./model.js";
import type { ProjectForgeSurface } from "./surfaces.js";

export type ProjectRailScope = "repository" | "project" | "directory";

export function projectSurfaceTitle(surface: string, name = ""): string {
  if (surface === "overview") return name || "Overview";
  if (surface === "reviews") return "Reviews";
  // prettier-ignore
  if (surface === "people" || surface === "oplog") return surface === "oplog" ? "Op Log" : "Contributors";
  return surface[0]!.toUpperCase() + surface.slice(1);
}

export function projectRailSurface(
  label: string,
  scope: ProjectRailScope,
): ProjectForgeSurface | ProjectForgeOverviewSurface | undefined {
  if (label === "Options") return "options";
  if (label === "Latest" || label === "Commits") return "commits";
  if (label === "Files") return "files";
  if (
    label === "Tasks" ||
    label === "Active" ||
    label === "Completed" ||
    label === "Active tasks"
  )
    return "tasks";
  if (
    label === "Reviews" ||
    label === "Open" ||
    label === "Merged" ||
    label === "Open reviews"
  )
    return "reviews";
  if (label === "Channels") return "channels";
  if (scope === "project") {
    if (label === "Contributors") return "contributors";
    if (label === "Repositories") return "repositories";
    return undefined;
  }
  if (scope === "directory") {
    if (label === "Projects") return "projects";
    if (label === "Repositories") return "repositories";
  }
  return undefined;
}
