import { describe, expect, it } from "vitest";

import {
  abbreviateGitCommit,
  pullRequestBranchLabel,
  pullRequestSourceLabel,
  pullRequestTargetLabel,
} from "./pull-request-branch-label.js";

const commit = "ab".repeat(20);

describe("pullRequestBranchLabel", () => {
  it("uses a dest-Git bookmark and selected target when both tags exist", () => {
    expect(
      pullRequestBranchLabel({
        branchName: "feature/files",
        targetBranch: "main",
        currentCommit: commit,
      }),
    ).toBe("feature/files → main");
  });

  it("shows the abbreviated commit instead of unknown when branch-name is missing", () => {
    expect(abbreviateGitCommit(commit)).toBe("abababa");
    expect(pullRequestSourceLabel({ currentCommit: commit })).toBe("abababa");
    expect(
      pullRequestBranchLabel({
        targetBranch: "trunk",
        currentCommit: commit,
      }),
    ).toBe("abababa → trunk");
  });

  it("falls back to default when target-branch is missing", () => {
    expect(pullRequestTargetLabel({})).toBe("default");
    expect(pullRequestBranchLabel({ currentCommit: commit })).toBe(
      "abababa → default",
    );
  });
});
