import type { ProjectRepositoryViewInput } from "./project-repository-view-query.js";

export function projectRepositoryViewQueryTarget(
  input: ProjectRepositoryViewInput,
) {
  return {
    repository: input.repositoryCoordinate ?? "project-overview",
    surface: input.surface ?? input.overviewSurface,
    revision: input.filesRouteRevision || input.requestedRepositoryBranch,
    path: input.selectedPath,
    commitSha: input.selectedCommitSha,
    pullRequestId: input.pullRequestId,
  };
}
