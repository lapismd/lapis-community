import { describe, expect, it } from "vitest";

import type { CommunityMessageModel } from "../community-workspace/model.js";
import {
  firstUnreadMessageId,
  MESSAGE_GROUPING_WINDOW_MS,
  isMessageContinuation,
} from "./grouping.js";

function message(
  id: string,
  authorId: string,
  createdAt: string,
): CommunityMessageModel {
  return { id, authorId, createdAt, content: id, timestamp: createdAt };
}

describe("isMessageContinuation", () => {
  it("groups consecutive messages by one author within ten minutes", () => {
    const messages = [
      message("first", "author", "2026-09-02T09:00:00Z"),
      message(
        "second",
        "author",
        new Date(
          Date.parse("2026-09-02T09:00:00Z") + MESSAGE_GROUPING_WINDOW_MS,
        ).toISOString(),
      ),
    ];

    expect(isMessageContinuation(messages, 0)).toBe(false);
    expect(isMessageContinuation(messages, 1)).toBe(true);
  });

  it("starts a new group after an author change or the grouping window", () => {
    const messages = [
      message("first", "author", "2026-09-02T09:00:00Z"),
      message("different", "other", "2026-09-02T09:01:00Z"),
      message("late", "other", "2026-09-02T09:12:00Z"),
    ];

    expect(isMessageContinuation(messages, 1)).toBe(false);
    expect(isMessageContinuation(messages, 2)).toBe(false);
  });

  it("keeps channel lifecycle activity as a standalone timeline item", () => {
    const messages = [
      message("first", "author", "2026-09-02T09:00:00Z"),
      {
        ...message("created", "author", "2026-09-02T09:01:00Z"),
        activity: { type: "channel-created" as const },
      },
      message("after", "author", "2026-09-02T09:02:00Z"),
    ];

    expect(isMessageContinuation(messages, 1)).toBe(false);
    expect(isMessageContinuation(messages, 2)).toBe(false);
  });

  it("starts a new group at an explicit timeline boundary", () => {
    const messages = [
      message("before", "author", "2026-09-02T23:59:00Z"),
      message("boundary", "author", "2026-09-03T00:01:00Z"),
      message("after", "author", "2026-09-03T00:02:00Z"),
    ];

    expect(isMessageContinuation(messages, 1, { startsNewGroup: true })).toBe(
      false,
    );
    expect(isMessageContinuation(messages, 2)).toBe(true);
  });

  it("finds the first rendered unread message rather than tag order", () => {
    const messages = [
      message("read", "author", "2026-09-02T09:00:00Z"),
      message("unread-first", "author", "2026-09-02T09:01:00Z"),
      message("unread-second", "author", "2026-09-02T09:02:00Z"),
    ];

    expect(
      firstUnreadMessageId(messages, [
        "unknown",
        "unread-second",
        "unread-first",
      ]),
    ).toBe("unread-first");
    expect(firstUnreadMessageId(messages, [])).toBeUndefined();
  });
});
