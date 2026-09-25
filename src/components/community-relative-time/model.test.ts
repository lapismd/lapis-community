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
      formatCommunityRelativeTime(now - 60 * 90, { now, locale: "en-GB" }),
    ).toBe("1 hour ago");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 3, { now, locale: "en-GB" }),
    ).toBe("3 hours ago");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24 * 2, {
        now,
        locale: "en-GB",
      }),
    ).toBe("2 days ago");
  });

  it("uses time-ago labels for weeks, months, and years by default", () => {
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24, {
        now,
        locale: "en-GB",
      }),
    ).toBe("yesterday");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24 * 8, {
        now,
        locale: "en-GB",
      }),
    ).toBe("last week");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24 * 21, {
        now,
        locale: "en-GB",
      }),
    ).toBe("3 weeks ago");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24 * 30 * 9, {
        now,
        locale: "en-GB",
      }),
    ).toBe("9 months ago");
    expect(
      formatCommunityRelativeTime(now - 60 * 60 * 24 * 365 * 2, {
        now,
        locale: "en-GB",
      }),
    ).toBe("2 years ago");
  });

  it("clamps future clock skew to just now", () => {
    expect(
      formatCommunityRelativeTime(now + 60 * 60 * 24 * 2, {
        now,
        locale: "en-GB",
      }),
    ).toBe("just now");
  });

  it("supports an explicit absolute-date cutoff", () => {
    const old = now - 60 * 60 * 24 * 7;
    const label = formatCommunityRelativeTime(old, {
      now,
      locale: "en-GB",
      absoluteAfterDays: 7,
    });
    const full = formatCommunityFullDate(old, "en-GB");
    expect(full.startsWith(`${label},`)).toBe(true);
  });
});
