import {
  reviewMatchesListFilter,
  type ProjectReviewListFilter,
  type ProjectTaskListFilter,
} from "../../projects/collection-filters.js";

export type CommunityProjectsFilterProps = {
  taskListFilter?: ProjectTaskListFilter;
  reviewListFilter?: ProjectReviewListFilter;
};

export function taskIsMine(
  task: { root: { pubkey: string }; assignees: readonly string[] },
  memberId: string,
): boolean {
  return task.root.pubkey === memberId || task.assignees.includes(memberId);
}

export function projectPullRequestsFor<
  T extends { repository: { coordinate: string } },
>(
  project: { repositories: readonly { coordinate: string }[] },
  pullRequests: readonly T[],
): T[] {
  const coordinates = new Set(
    project.repositories.map((repository) => repository.coordinate),
  );
  return pullRequests.filter((pullRequest) =>
    coordinates.has(pullRequest.repository.coordinate),
  );
}

export function pullRequestBelongsToProjectScope<
  T extends { root: { id: string }; lifecycle: string },
>(
  pullRequest: T,
  selectedProject: { repositories: readonly { coordinate: string }[] } | undefined,
  projectPullRequests: readonly { root: { id: string } }[],
  filter?: ProjectReviewListFilter,
): boolean {
  if (filter && !reviewMatchesListFilter(pullRequest, filter)) return false;
  if (!selectedProject) return true;
  return projectPullRequests.some(
    (candidate) => candidate.root.id === pullRequest.root.id,
  );
}
