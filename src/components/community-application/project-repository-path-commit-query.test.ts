import { QueryClient } from "@tanstack/svelte-query";
import { describe, expect, it, vi } from "vitest";

import type { ProjectForgeSession } from "../../projects/index.js";
import { loadRepositoryPathCommitFromQuery } from "./project-repository-path-commit-query.js";
import type { CommunityQueryScope } from "./project-query-keys.js";

const scope: CommunityQueryScope = {
  communityId: "community-a",
  identityPubkey: "alice",
  relayUrls: ["wss://relay-a.example"],
};

function sessionWithCommit(subject: string): ProjectForgeSession {
  return {
    loadCommits: vi.fn(async (_repository, ref, _signal, options) => ({
      ref: ref ?? "main",
      sha: "d".repeat(40),
      more: false,
      commits: [
        {
          sha: `${options?.path ?? "root"}`.padEnd(40, "0").slice(0, 40),
          subject,
          author_name: "Noor Patel",
          author_email: "noor@example.test",
          author_date: "2026-09-08T09:30:00Z",
        },
      ],
    })),
  } as unknown as ProjectForgeSession;
}

describe("loadRepositoryPathCommitFromQuery", () => {
  it("reuses cached path commit reads for the same repository revision and path", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const session = sessionWithCommit("Update README");
    const input = {
      queryClient,
      scope,
      session,
      repository: "30617:owner:repo",
      revision: "main",
      path: "README.md",
    };

    await expect(loadRepositoryPathCommitFromQuery(input)).resolves.toMatchObject(
      { subject: "Update README" },
    );
    await expect(loadRepositoryPathCommitFromQuery(input)).resolves.toMatchObject(
      { subject: "Update README" },
    );
    expect(session.loadCommits).toHaveBeenCalledTimes(1);
  });

  it("keeps branch and path reads distinct", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const session = sessionWithCommit("Path commit");

    await loadRepositoryPathCommitFromQuery({
      queryClient,
      scope,
      session,
      repository: "30617:owner:repo",
      revision: "main",
      path: "README.md",
    });
    await loadRepositoryPathCommitFromQuery({
      queryClient,
      scope,
      session,
      repository: "30617:owner:repo",
      revision: "main",
      path: "src/index.ts",
    });
    await loadRepositoryPathCommitFromQuery({
      queryClient,
      scope,
      session,
      repository: "30617:owner:repo",
      revision: "feature",
      path: "README.md",
    });

    expect(session.loadCommits).toHaveBeenCalledTimes(3);
  });
});
