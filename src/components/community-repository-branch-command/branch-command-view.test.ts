import { describe, expect, it } from "vitest";

import { branchCommandLabel } from "./branch-command-view.js";

describe("branch command label", () => {
  const branches = [
    { name: "main", sha: "d".repeat(40) },
    { name: "community-visible", sha: "c".repeat(40) },
  ];

  it("shows the branch name when the selection is that branch tip", () => {
    expect(branchCommandLabel(branches, "c".repeat(40))).toBe("community-visible");
    expect(branchCommandLabel(branches, "main")).toBe("main");
  });

  it("keeps a commit that is not a branch tip", () => {
    expect(branchCommandLabel(branches, "e".repeat(40))).toBe("e".repeat(40));
  });

  it("prefers the default branch when several branches share a tip", () => {
    const shared = "d".repeat(40);
    expect(
      branchCommandLabel(
        [
          { name: "main", sha: shared },
          { name: "release", sha: shared },
        ],
        shared,
      ),
    ).toBe("main");
  });
});
