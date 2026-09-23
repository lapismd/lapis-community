import { describe, expect, it } from "vitest";

import { activityNavigationTarget } from "./activity-navigation.js";

const review = {
  root: { id: "review-1" },
  updates: [{ event: { id: "update-1" } }],
  comments: [{ event: { id: "approval-1" } }],
  title: "docs: confirm current review delivery",
};
const task = {
  title: "Write the notes",
  repository: { coordinate: "repo-1" },
};
const project = { address: { coordinate: "project-1" } };

describe("activity navigation", () => {
  it("opens the review named by an approval card", () => {
    expect(
      activityNavigationTarget(
        {
          id: "review-comment:approval-1",
          kind: "approval",
          title: review.title,
          projectCoordinate: project.address.coordinate,
          repositoryCoordinate: "repo-1",
        },
        { tasks: [task], pullRequests: [review], projects: [project] },
      ),
    ).toEqual({ kind: "review", pullRequest: review });
  });

  it("opens a task card on that task", () => {
    expect(
      activityNavigationTarget(
        {
          id: "task:task-1",
          kind: "task",
          title: task.title,
          projectCoordinate: project.address.coordinate,
          repositoryCoordinate: "repo-1",
        },
        { tasks: [task], pullRequests: [review], projects: [project] },
      ),
    ).toEqual({ kind: "task", task });
  });
});
