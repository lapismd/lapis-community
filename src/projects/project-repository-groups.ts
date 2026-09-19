import type { ProjectForgeProject, ProjectForgeRepository } from "./model.js";

export function preferredProjectForRepository(
  projects: readonly ProjectForgeProject[],
  repositoryCoordinate: string,
  preferredCoordinate = "",
): ProjectForgeProject | undefined {
  return (
    projects.find(
      (project) =>
        project.address.coordinate === preferredCoordinate &&
        project.repositories.some(
          (reference) => reference.coordinate === repositoryCoordinate,
        ),
    ) ??
    projects.find((project) =>
      project.repositories.some(
        (reference) => reference.coordinate === repositoryCoordinate,
      ),
    )
  );
}

export function projectMemberRepositories(
  repositories: readonly ProjectForgeRepository[],
  references: readonly { coordinate: string }[] = repositories.map(
    (repository) => repository.address,
  ),
): ProjectForgeRepository[] {
  return references
    .map((reference) =>
      repositories.find(
        (repository) => repository.address.coordinate === reference.coordinate,
      ),
    )
    .filter(
      (repository): repository is ProjectForgeRepository =>
        repository !== undefined && repository.repositoryClass !== "task-anchor",
    );
}

export function groupItemsByProjectRepository<T>(
  items: readonly T[],
  repositories: readonly ProjectForgeRepository[],
  coordinateOf: (item: T) => string,
): { repository: ProjectForgeRepository; items: T[] }[] {
  const members = projectMemberRepositories(repositories);
  return members
    .map((repository) => ({
      repository,
      items: items.filter(
        (item) => coordinateOf(item) === repository.address.coordinate,
      ),
    }))
    .filter((group) => group.items.length > 0);
}
