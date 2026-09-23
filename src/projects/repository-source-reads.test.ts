import { describe, expect, it, vi } from "vitest";

import type { ProjectForgeSession } from "./data-source.js";
import {
  createRepositoryCommitReader,
  loadProjectCommitActivity,
  readRepositoryCommit,
  readRepositoryPathCommit,
} from "./repository-source-reads.js";
import { readRepositoryDefaultCommits } from "./repository-default-history.js";

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
      loadRefs: vi.fn(async () => ({ head: { name: "refs/heads/main", sha } })),
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

  it("preserves commit-only activity readers", async () => {
    const session = {
      loadCommits: vi.fn(async () => ({
        ref: "main",
        sha,
        commits: [{ sha, subject: "legacy" }],
        more: false,
      })),
    };
    await expect(
      loadProjectCommitActivity(
        session,
        [{ address: { coordinate: "repo" } } as never],
        [
          {
            address: { coordinate: "project" },
            repositories: [{ coordinate: "repo" }],
          } as never,
        ],
      ),
    ).resolves.toMatchObject([
      { repositoryCoordinate: "repo", commit: { sha } },
    ]);
    expect(session.loadCommits).toHaveBeenCalledWith(
      "repo",
      undefined,
      undefined,
    );
  });

  it("does not request a nonexistent HEAD from an empty repository", async () => {
    const session = {
      loadRefs: vi.fn(async () => ({ head: null, refs: [] })),
      loadCommits: vi.fn(),
    };
    await expect(
      readRepositoryDefaultCommits(session, "empty"),
    ).resolves.toEqual([]);
    expect(session.loadCommits).not.toHaveBeenCalled();
  });

  it("pins default history to an advertised commit and propagates read failures", async () => {
    const signal = new AbortController().signal;
    const session = {
      loadRefs: vi.fn(async () => ({ head: { name: "refs/heads/main", sha } })),
      loadCommits: vi.fn(async () => ({
        ref: "main",
        sha,
        commits: [{ sha, subject: "checkpoint" }],
        more: false,
      })),
    };
    await expect(
      readRepositoryDefaultCommits(session, "repo", signal),
    ).resolves.toEqual([{ sha, subject: "checkpoint" }]);
    expect(session.loadCommits).toHaveBeenCalledWith("repo", sha, signal);
    session.loadCommits.mockRejectedValueOnce(new Error("unavailable"));
    await expect(
      readRepositoryDefaultCommits(session, "repo", signal),
    ).rejects.toThrow("unavailable");
  });
});
