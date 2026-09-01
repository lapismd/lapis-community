import { describe, expect, it } from "vitest";

import {
  DiscussionPaginationError,
  adjacentDiscussionWindow,
  centeredDiscussionWindow,
  initialDiscussionWindow,
  mergeDiscussionPosts,
  shouldCloakDiscussionPost,
  sliceBoundaryWindow,
} from "./discussion-stream.js";

describe("discussion stream windows", () => {
  it("loads the first page and centres committed timeline jumps", () => {
    expect(initialDiscussionWindow(240, 20)).toEqual({
      startIndex: 0,
      endIndex: 20,
      targetIndex: 0,
    });
    expect(centeredDiscussionWindow(240, 120, 20)).toEqual({
      startIndex: 110,
      endIndex: 130,
      targetIndex: 120,
    });
    expect(centeredDiscussionWindow(15, 14, 20)).toEqual({
      startIndex: 0,
      endIndex: 15,
      targetIndex: 14,
    });
  });

  it("requests complete adjacent windows without overlap", () => {
    expect(adjacentDiscussionWindow(240, 40, 80, "prepend", 20)).toEqual({
      startIndex: 20,
      endIndex: 40,
      targetIndex: 20,
    });
    expect(adjacentDiscussionWindow(240, 40, 80, "append", 20)).toEqual({
      startIndex: 80,
      endIndex: 100,
      targetIndex: 99,
    });
    expect(adjacentDiscussionWindow(85, 40, 80, "append", 20)).toEqual({
      startIndex: 80,
      endIndex: 85,
      targetIndex: 84,
    });
  });

  it("merges accumulated windows deterministically and removes duplicates", () => {
    const posts = mergeDiscussionPosts(
      [
        { id: "b", createdAt: 2 },
        { id: "a", createdAt: 1 },
      ],
      [
        { id: "b", createdAt: 2 },
        { id: "c", createdAt: 2 },
      ],
      (post) => post.id,
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );
    expect(posts.map((post) => post.id)).toEqual(["a", "b", "c"]);
  });

  it("slices a window across a deterministic same-second boundary", () => {
    const events = sliceBoundaryWindow({
      olderEvents: [
        { id: "01", createdAt: 1 },
        { id: "02", createdAt: 2 },
      ],
      boundaryEvents: [
        { id: "04", createdAt: 3 },
        { id: "03", createdAt: 3 },
      ],
      countBeforeBoundary: 2,
      expectedBoundaryCount: 2,
      range: { startIndex: 1, endIndex: 4, targetIndex: 2 },
      eventId: (event) => event.id,
      compare: (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    });
    expect(events.map((event) => event.id)).toEqual(["02", "03", "04"]);
  });

  it("fails closed when a relay truncates a same-second bucket", () => {
    expect(() =>
      sliceBoundaryWindow({
        olderEvents: [],
        boundaryEvents: [{ id: "01" }],
        countBeforeBoundary: 0,
        expectedBoundaryCount: 2,
        range: { startIndex: 0, endIndex: 2, targetIndex: 0 },
        eventId: (event) => event.id,
        compare: (left, right) => left.id.localeCompare(right.id),
      }),
    ).toThrow(DiscussionPaginationError);
  });

  it("cloaks only unprotected posts more than one viewport away", () => {
    expect(shouldCloakDiscussionPost({ top: -901, bottom: -1 }, 900)).toBe(
      false,
    );
    expect(shouldCloakDiscussionPost({ top: -1_801, bottom: -901 }, 900)).toBe(
      true,
    );
    expect(shouldCloakDiscussionPost({ top: 1_801, bottom: 2_200 }, 900)).toBe(
      true,
    );
    expect(
      shouldCloakDiscussionPost({ top: 1_801, bottom: 2_200 }, 900, true),
    ).toBe(false);
  });
});
