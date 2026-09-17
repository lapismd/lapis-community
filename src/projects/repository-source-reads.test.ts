import { describe, expect, it, vi } from "vitest";

import type { ProjectForgeSession } from "./data-source.js";
import {
  readRepositoryCommit,
  readRepositoryPathCommit,
} from "./repository-source-reads.js";

const sha = "a".repeat(40);

describe("repository source reads", () => {
  it("loads one path commit and a selected sha", async () => {
    const session = {
      loadCommits: vi.fn(async () => ({
        ref: "main",
        sha,
        commits: [{ sha, subject: "path" }],
        more: false,
      })),
      loadCommit: vi.fn(async () => ({
        commit: { sha, subject: "detail" },
        stats: [{ path: "README.md", additions: 1, deletions: 0 }],
      })),
    } as unknown as ProjectForgeSession;
    await expect(
      readRepositoryPathCommit(session, "repo", "main", "README.md"),
    ).resolves.toMatchObject({ sha });
    await expect(
      readRepositoryCommit(session, "repo", sha),
    ).resolves.toMatchObject({
      commit: { subject: "detail" },
    });
    await expect(
      readRepositoryPathCommit(undefined, "repo", "main", "x"),
    ).resolves.toBeUndefined();
    await expect(readRepositoryCommit(session, undefined, sha)).rejects.toThrow(
      "Repository source is not ready",
    );
  });
});
