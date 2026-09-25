import { describe, expect, it } from "vitest";

import { estimateCommunityProjectRow } from "./virtual-project-row-estimates.js";

describe("estimateCommunityProjectRow", () => {
  it("returns compact defaults for unknown and short rows", () => {
    expect(estimateCommunityProjectRow(undefined)).toBe(64);
    expect(
      estimateCommunityProjectRow({ kind: "commit", text: "Fix docs" }),
    ).toBe(54);
    expect(estimateCommunityProjectRow({ kind: "task", text: "Ship it" })).toBe(
      58,
    );
  });

  it("accounts for long copy, markdown bodies, and supplements", () => {
    const longText = "A".repeat(240);
    expect(
      estimateCommunityProjectRow({ kind: "activity", text: longText }),
    ).toBeGreaterThan(136);
    expect(
      estimateCommunityProjectRow({
        kind: "activity",
        text: "Review update",
        hasBody: true,
        hasSupplement: true,
      }),
    ).toBe(264);
  });

  it("adds selected-row space for repository details without exceeding the cap", () => {
    expect(
      estimateCommunityProjectRow({
        kind: "repository-log",
        text: "Selected commit",
        selected: true,
      }),
    ).toBe(220);
    expect(
      estimateCommunityProjectRow({
        kind: "repository-log",
        text: "A".repeat(2_000),
        selected: true,
        hasBody: true,
        hasSupplement: true,
      }),
    ).toBe(420);
  });
});
