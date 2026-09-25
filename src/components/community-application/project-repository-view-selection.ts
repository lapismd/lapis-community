import type {
  ProjectForgeCatalog,
  ProjectForgeRepository,
} from "../../projects/index.js";

export function projectRepositoriesForView(input: {
  catalog: ProjectForgeCatalog;
  projectCoordinate?: string | undefined;
  repositoryCoordinate?: string | undefined;
}): readonly ProjectForgeRepository[] {
  const project = input.catalog.projects.find(
    (candidate) => candidate.address.coordinate === input.projectCoordinate,
  );
  const requestedRepository = input.catalog.repositories.find(
    (repository) =>
      repository.address.coordinate === input.repositoryCoordinate,
  );
  if (requestedRepository) return [requestedRepository];
  if (!project) return input.catalog.repositories;
  const coordinates = new Set(
    project.repositories.map((reference) => reference.coordinate),
  );
  return input.catalog.repositories.filter((repository) =>
    coordinates.has(repository.address.coordinate),
  );
}
