import { describe, expect, it, vi } from "vitest";

import type { ProjectForgeSession } from "./data-source.js";
import {
  createRepositoryCommitReader,
  loadProjectCommitActivity,
  readRepositoryCommit,
  readRepositoryPathCommit,
} from "./repository-source-reads.js";

const sha = "a".repeat(40);

describe("repository source reads", () => {
  it("loads the destination commit before source preparation and after repository changes", async () => {
    const loadCommit = vi.fn(async () => ({
      commit: { sha, subject: "checkpoint" },
    }));
    const session = { loadCommit } as unknown as ProjectForgeSession;
    let selected = "30617:owner:probe";
    let prepared = "";
    const read = createRepositoryCommitReader({
      session: () => session,
      selectedRepository: () => selected,
      sourceRepository: () => prepared,
    });
    const signal = new AbortController().signal;
    await read(sha, signal);
    expect(loadCommit).toHaveBeenLastCalledWith(selected, sha, signal);
    prepared = selected;
    selected = "30617:owner:other";
    await read(sha, signal);
    expect(loadCommit).toHaveBeenLastCalledWith(selected, sha, signal);
    selected = "";
    await read(sha, signal);
    expect(loadCommit).toHaveBeenLastCalledWith(prepared, sha, signal);
  });
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
    await expect(
      loadProjectCommitActivity(
        session,
        [
          {
            address: { coordinate: "30617:owner:notes" },
          } as never,
        ],
        [
          {
            address: {
              kind: 30621,
              owner: "owner",
              identifier: "notes",
              coordinate: "30621:owner:notes",
            },
            repositories: [{ coordinate: "30617:owner:notes" }],
          },
        ],
      ),
    ).resolves.toEqual([
      {
        projectCoordinate: "30621:owner:notes",
        repositoryCoordinate: "30617:owner:notes",
        commit: { sha, subject: "path" },
      },
    ]);
  });
});
