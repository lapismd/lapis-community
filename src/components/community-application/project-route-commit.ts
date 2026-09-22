export function projectRouteHasCommit(surface: string): boolean {
  return surface === "commits" || surface === "log" || surface === "oplog";
}
