import type { ProjectForgeActivityItem } from "./model.js";

type ActivityItem = Pick<
  ProjectForgeActivityItem,
  "id" | "kind" | "title" | "projectCoordinate" | "repositoryCoordinate"
>;

export type ActivityNavigationTarget<
  TTask extends { repository: { coordinate: string }; title: string },
  TReview extends {
    root: { id: string };
    updates: readonly { event: { id: string } }[];
    comments: readonly { event: { id: string } }[];
  },
  TProject extends { address: { coordinate: string } },
> =
  | { kind: "task"; task: TTask }
  | { kind: "review"; pullRequest: TReview }
  | { kind: "project"; project: TProject };

export function activityNavigationTarget<
  TTask extends { repository: { coordinate: string }; title: string },
  TReview extends {
    root: { id: string };
    updates: readonly { event: { id: string } }[];
    comments: readonly { event: { id: string } }[];
  },
  TProject extends { address: { coordinate: string } },
>(
  item: ActivityItem,
  sources: {
    tasks: readonly TTask[];
    pullRequests: readonly TReview[];
    projects: readonly TProject[];
  },
): ActivityNavigationTarget<TTask, TReview, TProject> | undefined {
  const pullRequest = pullRequestForActivity(item.id, sources.pullRequests);
  if (pullRequest) return { kind: "review", pullRequest };
  if (
    item.kind === "task" ||
    item.kind === "comment" ||
    item.kind === "assignment"
  ) {
    const task = sources.tasks.find(
      (candidate) =>
        candidate.repository.coordinate === item.repositoryCoordinate &&
        candidate.title === item.title,
    );
    if (task) return { kind: "task", task };
  }
  const project = sources.projects.find(
    (candidate) => candidate.address.coordinate === item.projectCoordinate,
  );
  return project ? { kind: "project", project } : undefined;
}

function pullRequestForActivity<
  TReview extends {
    root: { id: string };
    updates: readonly { event: { id: string } }[];
    comments: readonly { event: { id: string } }[];
  },
>(id: string, pullRequests: readonly TReview[]): TReview | undefined {
  const review = id.startsWith("review:") ? id.slice("review:".length) : "";
  if (review) return pullRequests.find((item) => item.root.id === review);
  const update = id.startsWith("review-update:")
    ? id.slice("review-update:".length)
    : "";
  if (update) {
    return pullRequests.find((item) =>
      item.updates.some((entry) => entry.event.id === update),
    );
  }
  const comment = id.startsWith("review-comment:")
    ? id.slice("review-comment:".length)
    : "";
  if (!comment) return undefined;
  return pullRequests.find((item) =>
    item.comments.some((entry) => entry.event.id === comment),
  );
}
