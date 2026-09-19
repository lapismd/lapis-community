import type { ProjectForgeSession } from "./data-source.js";
import type {
  ProjectForgeCommit,
  ProjectForgeCommitActivity,
  ProjectForgeCommitResponse,
  ProjectForgeProject,
  ProjectForgeRepository,
} from "./model.js";

export async function readRepositoryPathCommit(
  session: ProjectForgeSession | undefined,
  repository: string | undefined,
  revision: string | undefined,
  path: string,
  signal?: AbortSignal,
): Promise<ProjectForgeCommit | undefined> {
  if (!session || !repository || !revision) return undefined;
  const response = await session.loadCommits(repository, revision, signal, {
    path,
    limit: 1,
  });
  return response.commits[0];
}

export async function readRepositoryCommit(
  session: ProjectForgeSession | undefined,
  repository: string | undefined,
  sha: string,
  signal?: AbortSignal,
): Promise<ProjectForgeCommitResponse> {
  if (!session || !repository) {
    throw new Error("Repository source is not ready");
  }
  return await session.loadCommit(repository, sha, signal);
}

export async function loadProjectCommitActivity(
  session: Pick<ProjectForgeSession, "loadCommits"> | undefined,
  repositories: readonly ProjectForgeRepository[],
  projects: readonly Pick<ProjectForgeProject, "address" | "repositories">[],
  signal?: AbortSignal,
): Promise<ProjectForgeCommitActivity[]> {
  if (!session) return [];
  const activity = await Promise.all(
    repositories.map(async (repository) => {
      const owner = projects.find((project) =>
        project.repositories.some(
          (reference) =>
            reference.coordinate === repository.address.coordinate,
        ),
      );
      if (!owner) return [];
      try {
        const response = await session.loadCommits(
          repository.address.coordinate,
          undefined,
          signal,
        );
        return response.commits.map((commit) => ({
          projectCoordinate: owner.address.coordinate,
          repositoryCoordinate: repository.address.coordinate,
          commit,
        }));
      } catch {
        return [];
      }
    }),
  );
  return activity.flat();
}
