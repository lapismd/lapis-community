import { describe, expect, it } from "vitest";

import {
  PROJECT_REVIEW_LIST_FILTER_DEFAULT,
  PROJECT_TASK_LIST_FILTER_DEFAULT,
  projectRailCollectionFilter,
  projectRailLabelIsCurrentPage,
  projectReviewListFilterFromLabel,
  projectTaskListFilterFromLabel,
  reviewMatchesListFilter,
  scopeProjectTasks,
  taskMatchesListFilter,
} from "./collection-filters.js";

describe("collection filters", () => {
  it("defaults Tasks to active and Reviews to open", () => {
    expect(PROJECT_TASK_LIST_FILTER_DEFAULT).toBe("active");
    expect(PROJECT_REVIEW_LIST_FILTER_DEFAULT).toBe("open");
  });

  it("treats applied and closed tasks as completed", () => {
    expect(taskMatchesListFilter({ lifecycle: "open" }, "active")).toBe(true);
    expect(taskMatchesListFilter({ lifecycle: "applied" }, "active")).toBe(
      false,
    );
    expect(taskMatchesListFilter({ lifecycle: "closed" }, "completed")).toBe(
      true,
    );
    expect(taskMatchesListFilter({ lifecycle: "applied" }, "completed")).toBe(
      true,
    );
  });

  it("treats draft reviews as open and hides closed from merged", () => {
    expect(reviewMatchesListFilter({ lifecycle: "draft" }, "open")).toBe(true);
    expect(reviewMatchesListFilter({ lifecycle: "merged" }, "open")).toBe(false);
    expect(reviewMatchesListFilter({ lifecycle: "merged" }, "merged")).toBe(
      true,
    );
    expect(reviewMatchesListFilter({ lifecycle: "closed" }, "merged")).toBe(
      false,
    );
  });

  it("maps rail labels onto exclusive collection filters", () => {
    expect(projectTaskListFilterFromLabel("Active")).toBe("active");
    expect(projectTaskListFilterFromLabel("Completed")).toBe("completed");
    expect(projectTaskListFilterFromLabel("Tasks")).toBeUndefined();
    expect(projectReviewListFilterFromLabel("Open reviews")).toBe("open");
    expect(projectReviewListFilterFromLabel("Merged")).toBe("merged");
    expect(projectReviewListFilterFromLabel("Reviews")).toBeUndefined();
    expect(projectRailCollectionFilter("Active")).toEqual({
      kind: "tasks",
      value: "active",
    });
    expect(projectRailCollectionFilter("Merged")).toEqual({
      kind: "reviews",
      value: "merged",
    });
    expect(projectRailLabelIsCurrentPage("Active")).toBe(false);
    expect(projectRailLabelIsCurrentPage("Latest")).toBe(false);
    expect(projectRailLabelIsCurrentPage("Tasks")).toBe(true);
  });

  it("scopes tasks to the selected repository before the lifecycle filter", () => {
    const tasks = [
      { repository: { coordinate: "repo-a" }, lifecycle: "open" },
      { repository: { coordinate: "repo-a" }, lifecycle: "closed" },
      { repository: { coordinate: "repo-b" }, lifecycle: "open" },
    ];
    expect(
      scopeProjectTasks(tasks, {
        repositoryCoordinate: "repo-a",
        projectRepositoryCoordinates: ["repo-a", "repo-b"],
        filter: "active",
      }),
    ).toEqual([{ repository: { coordinate: "repo-a" }, lifecycle: "open" }]);
  });
});
