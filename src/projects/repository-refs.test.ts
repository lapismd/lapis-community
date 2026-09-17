import { describe, expect, it, vi } from "vitest";

import { projectForgeBranchRefs } from "./model.js";
import {
  loadProjectForgeRefs,
  mergeProjectForgeRefPages,
  nextProjectForgeBranchRefsPath,
  partitionProjectForgeBranchRefs,
  projectForgeBranchKind,
  projectForgeBranchRefsPath,
  projectForgeDefaultBranchName,
} from "./repository-refs.js";

const main = { name: "refs/heads/main", sha: "a".repeat(40) };
const sync = {
  name: "refs/heads/jj-sync/scope/replica",
  sha: "b".repeat(40),
};
const visible = { name: "refs/heads/community-visible", sha: "c".repeat(40) };

describe("project forge repository refs", () => {
  it("keeps nested sync heads in the picker list", () => {
    const branches = projectForgeBranchRefs({
      head: main,
      refs: [main, sync, visible],
    });
    expect(branches.map((branch) => branch.name)).toEqual([
      "main",
      "jj-sync/scope/replica",
      "community-visible",
    ]);
    expect(projectForgeBranchKind("jj-sync/scope/replica")).toBe("sync");
    expect(partitionProjectForgeBranchRefs(branches)).toEqual({
      branches: [
        { name: "main", sha: main.sha },
        { name: "community-visible", sha: visible.sha },
      ],
      sync: [{ name: "jj-sync/scope/replica", sha: sync.sha }],
    });
    expect(projectForgeDefaultBranchName(branches)).toBe("main");
  });

  it("collects every refs/branches page after the HEAD-only /refs response", async () => {
    const get = vi.fn(async (suffix: string) => {
      if (suffix === "refs") return { head: main, refs: [main] };
      if (suffix === "refs/branches") {
        return {
          head: main,
          refs: [main, sync],
          more: true,
          continuation: "page-2",
        };
      }
      if (suffix === "refs/branches?continuation=page-2") {
        return { head: main, refs: [visible], more: false };
      }
      throw new Error(`unexpected suffix ${suffix}`);
    });

    const response = await loadProjectForgeRefs(get);
    expect(get.mock.calls.map(([suffix]) => suffix)).toEqual([
      "refs",
      "refs/branches",
      "refs/branches?continuation=page-2",
    ]);
    expect(
      projectForgeBranchRefs(response).map((branch) => branch.name),
    ).toEqual(["main", "jj-sync/scope/replica", "community-visible"]);
    expect(nextProjectForgeBranchRefsPath({ more: true })).toBeUndefined();
    expect(projectForgeBranchRefsPath("page-2")).toBe(
      "refs/branches?continuation=page-2",
    );
    expect(
      mergeProjectForgeRefPages({ head: main }, [{ refs: [sync] }]).refs,
    ).toEqual([sync]);
  });

  it("keeps the HEAD list when refs/branches is unavailable", async () => {
    const get = vi.fn(async (suffix: string) => {
      if (suffix === "refs") return { head: main, refs: [main] };
      throw new Error("missing branches");
    });
    const response = await loadProjectForgeRefs(get);
    expect(
      projectForgeBranchRefs(response).map((branch) => branch.name),
    ).toEqual(["main"]);
  });
});
