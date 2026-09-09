import { describe, expect, it, vi } from "vitest";

import type { ProjectForgeSession } from "./data-source.js";
import type { ProjectForgeTreeResponse } from "./model.js";
import { loadProjectRepositoryFileTree } from "./repository-tree.js";

function tree(
  path: string,
  entries: ProjectForgeTreeResponse["entries"],
): ProjectForgeTreeResponse {
  return { ref: "main", sha: "a".repeat(40), path, entries };
}

describe("project repository file tree", () => {
  it("loads sibling directories concurrently and flattens their files", async () => {
    let activeReads = 0;
    let maximumActiveReads = 0;
    const loadTree = vi.fn(async (_repository, _revision, path = "") => {
      if (!path)
        return tree("", [
          { name: "docs", path: "docs", type: "tree" },
          { name: "src", path: "src", type: "tree" },
          { name: "README.md", path: "README.md", type: "blob" },
        ]);
      activeReads += 1;
      maximumActiveReads = Math.max(maximumActiveReads, activeReads);
      await Promise.resolve();
      activeReads -= 1;
      return tree(path, [
        {
          name: `${path}.md`,
          path: `${path}/${path}.md`,
          type: "blob",
        },
      ]);
    });
    const session = { loadTree } as unknown as ProjectForgeSession;

    const result = await loadProjectRepositoryFileTree(
      session,
      "30617:owner:repo",
      "main",
      new AbortController().signal,
    );

    expect(maximumActiveReads).toBe(2);
    expect(result.entries.map((entry) => entry.path)).toEqual([
      "README.md",
      "docs/docs.md",
      "src/src.md",
    ]);
  });
});
