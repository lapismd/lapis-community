import { QueryClient } from "@tanstack/svelte-query";
import { describe, expect, it, vi } from "vitest";

import type { ProjectForgeSession } from "../../projects/index.js";
import type { CommunityQueryScope } from "./project-query-keys.js";
import {
  loadRepositoryPullRequestDiffFromQuery,
  projectRepositoryReadSession,
} from "./project-repository-read-query.js";

const scope: CommunityQueryScope = {
  communityId: "community-a",
  identityPubkey: "alice",
  relayUrls: ["wss://relay-a.example"],
};

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function repositorySession(): ProjectForgeSession {
  return {
    loadCapabilities: vi.fn(async (repository) => ({
      repository,
      capabilities: { browsing: true },
    })),
    loadRefs: vi.fn(async () => ({
      head: { name: "refs/heads/main", sha: "a".repeat(40) },
      refs: [],
    })),
    loadTree: vi.fn(async (_repository, revision, path = "") => ({
      ref: revision,
      sha: "b".repeat(40),
      path,
      entries: [],
    })),
    loadBlob: vi.fn(async (_repository, _revision, path) => ({
      path,
      contents: "hello",
      binary: false,
      too_large: false,
    })),
    loadCommits: vi.fn(async (_repository, ref, _signal, options) => ({
      ref: ref ?? "main",
      sha: "c".repeat(40),
      more: false,
      commits: [
        {
          sha: `${options?.path ?? "root"}`.padEnd(40, "0").slice(0, 40),
          subject: "Commit",
          author_name: "Noor Patel",
          author_email: "noor@example.test",
          author_date: "2026-09-08T09:30:00Z",
        },
      ],
    })),
    loadCommit: vi.fn(async (_repository, sha) => ({
      commit: {
        sha,
        subject: "Selected commit",
        author_name: "Noor Patel",
        author_email: "noor@example.test",
        author_date: "2026-09-08T09:30:00Z",
      },
      stats: [],
      files: [],
    })),
    loadPullRequestDiff: vi.fn(async (eventId) => ({
      pullRequestId: eventId,
      files: [],
    })),
  } as unknown as ProjectForgeSession;
}

describe("projectRepositoryReadSession", () => {
  it("reuses cached repository refs, tree, commit list and commit details", async () => {
    const session = repositorySession();
    const reads = projectRepositoryReadSession(session, {
      queryClient: queryClient(),
      scope,
    });

    await reads.loadRefs("30617:owner:repo");
    await reads.loadRefs("30617:owner:repo");
    await reads.loadTree("30617:owner:repo", "main", "src");
    await reads.loadTree("30617:owner:repo", "main", "src");
    await reads.loadCommits("30617:owner:repo", "main", undefined, {
      path: "README.md",
      limit: 1,
    });
    await reads.loadCommits("30617:owner:repo", "main", undefined, {
      path: "README.md",
      limit: 1,
    });
    await reads.loadCommit("30617:owner:repo", "d".repeat(40));
    await reads.loadCommit("30617:owner:repo", "d".repeat(40));

    expect(session.loadRefs).toHaveBeenCalledTimes(1);
    expect(session.loadTree).toHaveBeenCalledTimes(1);
    expect(session.loadCommits).toHaveBeenCalledTimes(1);
    expect(session.loadCommit).toHaveBeenCalledTimes(1);
  });

  it("keeps branch and path reads distinct", async () => {
    const session = repositorySession();
    const reads = projectRepositoryReadSession(session, {
      queryClient: queryClient(),
      scope,
    });

    await reads.loadTree("30617:owner:repo", "main", "src");
    await reads.loadTree("30617:owner:repo", "feature", "src");
    await reads.loadTree("30617:owner:repo", "main", "docs");
    await reads.loadCommits("30617:owner:repo", "main", undefined, {
      path: "README.md",
      limit: 1,
    });
    await reads.loadCommits("30617:owner:repo", "main", undefined, {
      path: "src/index.ts",
      limit: 1,
    });

    expect(session.loadTree).toHaveBeenCalledTimes(3);
    expect(session.loadCommits).toHaveBeenCalledTimes(2);
  });

  it("reuses cached pull request diffs by repository and pull request", async () => {
    const session = repositorySession();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const input = {
      queryClient,
      scope,
      session,
      repository: "30617:owner:repo",
      pullRequestId: "e".repeat(64),
    };

    await loadRepositoryPullRequestDiffFromQuery(input);
    await loadRepositoryPullRequestDiffFromQuery(input);
    await loadRepositoryPullRequestDiffFromQuery({
      ...input,
      repository: "30617:owner:other",
    });

    expect(session.loadPullRequestDiff).toHaveBeenCalledTimes(2);
  });
});
