import type {
  ProjectForgeRepository,
  ProjectForgeSurface,
} from "../../projects/index.js";

export function preferredProjectFilesRepository(
  repositories: readonly ProjectForgeRepository[],
  preference: {
    selectedCoordinate?: string | undefined;
    channelRepositoryCoordinate?: string | undefined;
  },
): ProjectForgeRepository | undefined {
  const selected = repositoryByCoordinate(
    repositories,
    preference.selectedCoordinate,
  );
  if (selected) return selected;
  return (
    repositoryByCoordinate(
      repositories,
      preference.channelRepositoryCoordinate,
    ) ?? repositories[0]
  );
}

function repositoryByCoordinate(
  repositories: readonly ProjectForgeRepository[],
  coordinate: string | undefined,
): ProjectForgeRepository | undefined {
  if (!coordinate) return undefined;
  return repositories.find(
    (repository) => repository.address.coordinate === coordinate,
  );
}

export function projectFilesSurfaceLoadsTree(
  surface: ProjectForgeSurface | undefined,
  options: {
    filesRouteRevision?: string | undefined;
    inlineProjectFilesSheetOpen?: boolean | undefined;
  } = {},
): boolean {
  return (
    surface === undefined ||
    surface === "overview" ||
    (surface === "files" &&
      (Boolean(options.filesRouteRevision) ||
        options.inlineProjectFilesSheetOpen === true))
  );
}
