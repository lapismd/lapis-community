import { describe, expect, it } from "vitest";

import {
  decodeProjectListCursor,
  encodeProjectListCursor,
  projectEventCursorFields,
} from "./project-list-cursor.js";

const eventId = "a".repeat(64);
const commit = "b".repeat(40);

describe("project list cursors", () => {
  it("round-trips event, commit, and row cursors", () => {
    expect(
      decodeProjectListCursor(
        encodeProjectListCursor({ kind: "event", createdAt: 123, eventId }),
      ),
    ).toEqual({ kind: "event", createdAt: 123, eventId });
    expect(
      decodeProjectListCursor(
        encodeProjectListCursor({ kind: "commit", sha: commit }),
      ),
    ).toEqual({ kind: "commit", sha: commit });
    expect(
      decodeProjectListCursor(
        encodeProjectListCursor({ kind: "row", id: "repo:activity/1" }),
      ),
    ).toEqual({ kind: "row", id: "repo:activity/1" });
  });

  it("maps event cursors to relay filter fields", () => {
    expect(
      projectEventCursorFields({ kind: "event", createdAt: 456, eventId }),
    ).toEqual({ until: 456, before_id: eventId });
    expect(projectEventCursorFields({ kind: "commit", sha: commit })).toEqual(
      {},
    );
    expect(decodeProjectListCursor("event:not-a-number:" + eventId)).toBe(
      undefined,
    );
  });
});
