import { describe, expect, it } from "vitest";

import {
  PROJECT_ACTIVITY_FILTER_DEFAULT,
  PROJECT_ACTIVITY_FILTER_STORAGE_KEY,
  createBrowserProjectActivityFilterStore,
  filterProjectActivity,
  isProjectActivityFilterId,
  projectActivityDigest,
  projectActivityWeekItems,
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
    expect(filterProjectActivity(activity, PROJECT_ACTIVITY_FILTER_DEFAULT)).toEqual(
      activity,
    );
  });

  it("matches one relay-backed activity kind", () => {
    const activity = [item("task", 10), item("review", 11), item("commit", 12)];
    expect(filterProjectActivity(activity, "review")).toEqual([activity[1]]);
  });

  it("rejects unknown stored filter ids", () => {
    expect(isProjectActivityFilterId("all")).toBe(true);
    expect(isProjectActivityFilterId("commit")).toBe(true);
    expect(isProjectActivityFilterId("files")).toBe(false);
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

  it("persists the selected filter in local storage", () => {
    const values = new Map<string, string>();
    const store = createBrowserProjectActivityFilterStore({
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    });
    expect(store.load()).toBe(PROJECT_ACTIVITY_FILTER_DEFAULT);
    store.save("commit");
    expect(store.load()).toBe("commit");
    expect(values.get(PROJECT_ACTIVITY_FILTER_STORAGE_KEY)).toContain("commit");
  });
});
