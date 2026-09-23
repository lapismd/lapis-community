export function repositorySurfaceLoadsRefs(
  surface: string | undefined,
): boolean {
  return (
    surface === undefined ||
    surface === "overview" ||
    surface === "files" ||
    surface === "commits" ||
    surface === "log"
  );
}
