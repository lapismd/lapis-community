import { describe, expect, it } from "vitest";

import {
  formatCommunityFullDate,
  formatCommunityRelativeTime,
} from "./model.js";

const now = Date.UTC(2026, 8, 8, 12, 0, 0) / 1_000;

describe("community relative time", () => {
  it("uses relative labels for recent timestamps", () => {
    expect(
      formatCommunityRelativeTime(now - 30, { now, locale: "en-GB" }),
    ).toBe("just now");
    expect(
      formatCommunityRelativeTime(now - 60 * 90, {
        now,
        locale: "en-GB",
      }),
    ).toBe("1 hour ago");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 3, {
        now,
        locale: "en-GB",
      }),
    ).toBe("3 hours ago");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24 * 2, {
        now,
        locale: "en-GB",
      }),
    ).toBe("2 days ago");
  });

  it("uses the full date after the relative-time window", () => {
    const oldTimestamp = now - 60 * 60 * 24 * 7;
    expect(
      formatCommunityRelativeTime(oldTimestamp, {
        now,
        locale: "en-GB",
      }),
    ).toBe(formatCommunityFullDate(oldTimestamp, "en-GB"));
  });
});
