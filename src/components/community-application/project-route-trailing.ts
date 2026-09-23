export function projectRouteHasTrailingId(surface: string): boolean {
  return (
    surface === "commits" ||
    surface === "log" ||
    surface === "oplog" ||
    surface === "tasks" ||
    surface === "reviews"
  );
}
