export type ProjectTaskListFilter = "active" | "completed";
export type ProjectReviewListFilter = "open" | "merged";

export const PROJECT_TASK_LIST_FILTER_DEFAULT: ProjectTaskListFilter =
  "active";
export const PROJECT_REVIEW_LIST_FILTER_DEFAULT: ProjectReviewListFilter =
  "open";

export function isActiveProjectTask(lifecycle: string): boolean {
  return lifecycle !== "closed" && lifecycle !== "applied";
}

export function isCompletedProjectTask(lifecycle: string): boolean {
  return lifecycle === "closed" || lifecycle === "applied";
}

export function isOpenProjectReview(lifecycle: string): boolean {
  return lifecycle === "open" || lifecycle === "draft";
}

export function isMergedProjectReview(lifecycle: string): boolean {
  return lifecycle === "merged";
}

export function taskMatchesListFilter(
  task: { lifecycle: string },
  filter: ProjectTaskListFilter,
): boolean {
  return filter === "active"
    ? isActiveProjectTask(task.lifecycle)
    : isCompletedProjectTask(task.lifecycle);
}

export function reviewMatchesListFilter(
  review: { lifecycle: string },
  filter: ProjectReviewListFilter,
): boolean {
  return filter === "open"
    ? isOpenProjectReview(review.lifecycle)
    : isMergedProjectReview(review.lifecycle);
}

export function projectTaskListFilterFromLabel(
  label: string,
): ProjectTaskListFilter | undefined {
  if (label === "Active" || label === "Active tasks") return "active";
  if (label === "Completed") return "completed";
  return undefined;
}

export function projectReviewListFilterFromLabel(
  label: string,
): ProjectReviewListFilter | undefined {
  if (label === "Open" || label === "Open reviews") return "open";
  if (label === "Merged") return "merged";
  return undefined;
}

export type ProjectRailCollectionFilter =
  | { kind: "tasks"; value: ProjectTaskListFilter }
  | { kind: "reviews"; value: ProjectReviewListFilter };

export function projectRailCollectionFilter(
  label: string,
): ProjectRailCollectionFilter | undefined {
  const task = projectTaskListFilterFromLabel(label);
  if (task) return { kind: "tasks", value: task };
  const review = projectReviewListFilterFromLabel(label);
  if (review) return { kind: "reviews", value: review };
  return undefined;
}

export function projectRailLabelIsCurrentPage(label: string): boolean {
  return !projectRailCollectionFilter(label) && label !== "Latest";
}

export function scopeProjectTasks<
  T extends { repository: { coordinate: string }; lifecycle: string },
>(
  tasks: readonly T[],
  options: {
    repositoryCoordinate?: string | undefined;
    projectRepositoryCoordinates?: readonly string[] | undefined;
    filter?: ProjectTaskListFilter | undefined;
  },
): T[] {
  return tasks.filter((task) => {
    if (options.repositoryCoordinate) {
      if (task.repository.coordinate !== options.repositoryCoordinate) {
        return false;
      }
    } else if (
      options.projectRepositoryCoordinates &&
      !options.projectRepositoryCoordinates.includes(task.repository.coordinate)
    ) {
      return false;
    }
    return options.filter
      ? taskMatchesListFilter(task, options.filter)
      : true;
  });
}
