import { describe, expect, it } from "vitest";

import { projectForgeBranchRefs } from "./model.js";
import { workspaceBranchForCommit } from "./workspace-branch.js";

const main = { name: "refs/heads/main", sha: "a".repeat(40) };
const sync = {
  name: "refs/heads/jj-sync/scope/replica",
  sha: "b".repeat(40),
};
const visible = { name: "refs/heads/community-visible", sha: "c".repeat(40) };

describe("workspaceBranchForCommit", () => {
  it("returns a dest-Git workspace bookmark that is not the merge target", () => {
    const branches = projectForgeBranchRefs({
      head: main,
      refs: [main, sync, visible],
    });
    expect(workspaceBranchForCommit(visible.sha, branches, "main")).toBe(
      "community-visible",
    );
    expect(
      workspaceBranchForCommit(visible.sha, branches, "community-visible"),
    ).toBeUndefined();
    expect(workspaceBranchForCommit(sync.sha, branches)).toBeUndefined();
  });
});
