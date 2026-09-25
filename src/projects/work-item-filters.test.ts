import { describe, expect, it } from "vitest";

import {
  pagedBuzzWorkItemFilters,
  WORK_ITEM_LIMIT,
} from "./work-item-filters.js";

const repository = "30617:owner:repo";
const eventId = "c".repeat(64);

describe("paged work item filters", () => {
  it("bounds relay filters and applies the exclusive event cursor", () => {
    const filters = pagedBuzzWorkItemFilters(repository, {
      limit: 25,
      cursor: { kind: "event", createdAt: 1234, eventId },
    });
    expect(filters.length).toBeGreaterThan(0);
    expect(
      filters.every(
        (filter) => filter.limit !== undefined && filter.limit <= 25,
      ),
    ).toBe(true);
    expect(filters.every((filter) => filter.until === 1234)).toBe(true);
    expect(
      filters.every(
        (filter) => (filter as Record<string, unknown>).before_id === eventId,
      ),
    ).toBe(true);
  });

  it("caps requested pages at the existing work item limit", () => {
    expect(
      pagedBuzzWorkItemFilters(repository, {
        limit: WORK_ITEM_LIMIT + 1,
      }).every(
        (filter) =>
          filter.limit !== undefined && filter.limit <= WORK_ITEM_LIMIT,
      ),
    ).toBe(true);
  });
});
