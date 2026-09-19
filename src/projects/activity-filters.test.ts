import { describe, expect, it } from "vitest";

import {
  PROJECT_ACTIVITY_FILTER_DEFAULT,
  PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
  PROJECT_ACTIVITY_FILTER_STORAGE_KEY,
  createBrowserProjectActivityFilterStore,
  filterProjectActivity,
  isProjectActivityFilterAll,
  isProjectActivityFilterId,
  isProjectActivityFilterSelected,
  normalizeProjectActivityFilters,
  projectActivityDigest,
  projectActivityFilterPage,
  projectActivityFilterStorageKey,
  projectActivityWeekItems,
  toggleProjectActivityFilter,
  visibleProjectActivityFilters,
} from "./activity-filters.js";
import type { ProjectForgeActivityItem } from "./model.js";

function item(
  kind: ProjectForgeActivityItem["kind"],
  createdAt: number,
  projectCoordinate = "30621:aa:notes",
): ProjectForgeActivityItem {
  return {
    id: `${kind}:${createdAt}`,
    kind,
    createdAt,
    actorPubkey: "aa",
    action: "updated",
    title: kind,
    body: "",
    projectCoordinate,
  };
}

describe("activity filters", () => {
  it("keeps every item for the all-activity default", () => {
    const activity = [item("task", 10), item("review", 11)];
    expect(
      filterProjectActivity(activity, PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT),
    ).toEqual(activity);
  });

  it("matches one or more relay-backed activity kinds", () => {
    const activity = [item("task", 10), item("review", 11), item("commit", 12)];
    expect(filterProjectActivity(activity, ["review"])).toEqual([activity[1]]);
    expect(filterProjectActivity(activity, ["task", "commit"])).toEqual([
      activity[0],
      activity[2],
    ]);
  });

  it("toggles event types while All stays exclusive", () => {
    expect(
      toggleProjectActivityFilter(PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT, "task"),
    ).toEqual(["task"]);
    expect(toggleProjectActivityFilter(["task"], "review")).toEqual([
      "task",
      "review",
    ]);
    expect(toggleProjectActivityFilter(["task", "review"], "task")).toEqual([
      "review",
    ]);
    expect(toggleProjectActivityFilter(["review"], "review")).toEqual([
      ...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
    ]);
    expect(toggleProjectActivityFilter(["task", "review"], "all")).toEqual([
      ...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
    ]);
    expect(
      isProjectActivityFilterSelected(
        PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
        PROJECT_ACTIVITY_FILTER_DEFAULT,
      ),
    ).toBe(true);
    expect(isProjectActivityFilterSelected(["task"], "task")).toBe(true);
    expect(isProjectActivityFilterSelected(["task"], "all")).toBe(false);
    expect(isProjectActivityFilterAll(["task"])).toBe(false);
    expect(
      visibleProjectActivityFilters(["commit", "task"]).map((option) => option.id),
    ).toEqual([
      "task",
      "commit",
      "all",
      "project",
      "repository",
      "assignment",
      "comment",
      "review",
      "review-update",
      "approval",
      "changes-requested",
      "review-request",
    ]);
  });

  it("rejects unknown stored filter ids", () => {
    expect(isProjectActivityFilterId("all")).toBe(true);
    expect(isProjectActivityFilterId("commit")).toBe(true);
    expect(isProjectActivityFilterId("files")).toBe(false);
    expect(normalizeProjectActivityFilters(["files", "commit", "all"])).toEqual([
      ...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
    ]);
  });

  it("summarizes this week's filtered activity", () => {
    const now = 1_700_000_000_000;
    const recent = Math.floor(now / 1_000) - 60;
    const stale = Math.floor(now / 1_000) - 700_000;
    const week = projectActivityWeekItems(
      [
        item("task", recent, "30621:aa:notes"),
        item("review", recent, "30621:aa:notes"),
        item("task", stale, "30621:bb:other"),
      ],
      now,
    );
    expect(week).toHaveLength(2);
    expect(projectActivityDigest(week, now)).toBe(
      "This week: 1 task opened, 1 review opened, and 1 active project.",
    );
  });

  it("scopes persistence to the page and shares one value across repositories", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    expect(projectActivityFilterPage({})).toBe("projects");
    expect(projectActivityFilterPage({ selectedProject: {} })).toBe("project");
    expect(
      projectActivityFilterPage({
        selectedProject: {},
        selectedRepository: {},
      }),
    ).toBe("repositories");
    const projects = createBrowserProjectActivityFilterStore({
      storage,
      page: "projects",
    });
    const project = createBrowserProjectActivityFilterStore({
      storage,
      page: "project",
    });
    const repositories = createBrowserProjectActivityFilterStore({
      storage,
      page: "repositories",
    });
    const otherRepository = createBrowserProjectActivityFilterStore({
      storage,
      page: "repositories",
    });
    expect(projects.load()).toEqual([...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT]);
    projects.save(["commit", "task"]);
    repositories.save(["review"]);
    expect(projects.load()).toEqual(["task", "commit"]);
    expect(project.load()).toEqual([...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT]);
    expect(repositories.load()).toEqual(["review"]);
    expect(otherRepository.load()).toEqual(["review"]);
    expect(values.get(projectActivityFilterStorageKey("projects"))).toContain(
      "task",
    );
    expect(
      values.get(projectActivityFilterStorageKey("repositories")),
    ).toContain("review");
    values.delete(projectActivityFilterStorageKey("projects"));
    values.set(
      PROJECT_ACTIVITY_FILTER_STORAGE_KEY,
      JSON.stringify({ version: 1, value: "comment" }),
    );
    expect(
      createBrowserProjectActivityFilterStore({ storage, page: "projects" }).load(),
    ).toEqual(["comment"]);
    expect(repositories.load()).toEqual(["review"]);
  });
});
