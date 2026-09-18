export const PROJECT_FORGE_SURFACES = [
  "activity",
  "log",
  "overview",
  "tasks",
  "reviews",
  "commits",
  "files",
  "channels",
  "contributors",
  "people",
  "options",
] as const;

export type ProjectForgeSurface = (typeof PROJECT_FORGE_SURFACES)[number];

export const PROJECT_REPOSITORY_TABS = [
  { value: "activity", label: "Activity" },
  { value: "log", label: "Log" },
  { value: "overview", label: "Overview" },
  { value: "files", label: "Files" },
  { value: "commits", label: "Commits" },
  { value: "tasks", label: "Tasks" },
  { value: "reviews", label: "Review" },
] as const;

export function isProjectForgeSurface(
  value: unknown,
): value is ProjectForgeSurface {
  return (
    typeof value === "string" &&
    (PROJECT_FORGE_SURFACES as readonly string[]).includes(value)
  );
}
