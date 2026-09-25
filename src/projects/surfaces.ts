// prettier-ignore
export const PROJECT_FORGE_SURFACES = ["activity", "log", "oplog", "overview", "tasks", "reviews", "commits", "files", "repositories", "channels", "contributors", "people", "options"] as const;

export type ProjectForgeSurface = (typeof PROJECT_FORGE_SURFACES)[number];

export const PROJECT_DIRECTORY_TABS = [
  { value: "activity", label: "Activity" },
  { value: "projects", label: "Projects" },
  { value: "repositories", label: "Repositories" },
  { value: "tasks", label: "Tasks" },
  { value: "reviews", label: "Reviews" },
  { value: "channels", label: "Channels" },
] as const;

export const PROJECT_WORKSPACE_TABS = [
  { value: "activity", label: "Activity" },
  { value: "repositories", label: "Repositories" },
  { value: "commits", label: "Commits" },
  { value: "files", label: "Files" },
  { value: "tasks", label: "Tasks" },
  { value: "reviews", label: "Review" },
  { value: "channels", label: "Channels" },
  { value: "contributors", label: "Contributors" },
] as const;

export const PROJECT_REPOSITORY_TABS = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
  { value: "log", label: "Log" },
  { value: "files", label: "Files" },
  { value: "commits", label: "Commits" },
  { value: "tasks", label: "Tasks" },
  { value: "reviews", label: "Review" },
] as const;

export function projectRouteDefaultSurface(
  kind: "project" | "repository",
): ProjectForgeSurface {
  return kind === "project" ? "activity" : "overview";
}

export function normalizeProjectRouteSurface(
  kind: "project" | "repository",
  surface: string,
): string {
  if (kind === "project" && surface === "overview") {
    return "activity";
  }
  return surface;
}

export function isProjectForgeSurface(
  value: unknown,
): value is ProjectForgeSurface {
  return (
    typeof value === "string" &&
    (PROJECT_FORGE_SURFACES as readonly string[]).includes(value)
  );
}
