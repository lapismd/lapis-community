import { describe, expect, it } from "vitest";

import {
  communityMessageDay,
  communityMessageDayLabel,
  communityMessageStartsDay,
} from "./conversation-day.js";

describe("conversation day helpers", () => {
  it("groups consecutive messages on the same day", () => {
    const messages = [
      {
        id: "1",
        authorId: "ada",
        content: "one",
        timestamp: "09:00",
        createdAt: "2026-09-02T09:00:00Z",
      },
      {
        id: "2",
        authorId: "ben",
        content: "two",
        timestamp: "10:00",
        createdAt: "2026-09-02T10:00:00Z",
      },
      {
        id: "3",
        authorId: "cy",
        content: "three",
        timestamp: "09:00",
        createdAt: "2026-09-03T09:00:00Z",
      },
    ];
    expect(communityMessageDay(messages[0]!)).toBe(
      communityMessageDay(messages[1]!),
    );
    expect(communityMessageStartsDay(messages, 0)).toBe(true);
    expect(communityMessageStartsDay(messages, 1)).toBe(false);
    expect(communityMessageStartsDay(messages, 2)).toBe(true);
  });

  it("labels today and yesterday", () => {
    const now = new Date("2026-09-03T12:00:00Z");
    expect(
      communityMessageDayLabel(
        {
          id: "1",
          authorId: "ada",
          content: "today",
          timestamp: "09:00",
          createdAt: "2026-09-03T09:00:00Z",
        },
        now,
      ),
    ).toBe("Today");
    expect(
      communityMessageDayLabel(
        {
          id: "2",
          authorId: "ada",
          content: "yesterday",
          timestamp: "09:00",
          createdAt: "2026-09-02T09:00:00Z",
        },
        now,
      ),
    ).toBe("Yesterday");
  });
});
