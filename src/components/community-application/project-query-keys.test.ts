import { QueryClient } from "@tanstack/svelte-query";
import { describe, expect, it } from "vitest";

import {
  communityProjectQueryKeys,
  invalidateCommunityProjectQueries,
  invalidateRepositoryQueries,
  type CommunityQueryScope,
} from "./project-query-keys.js";

const baseScope: CommunityQueryScope = {
  communityId: "community-a",
  identityPubkey: "alice",
  relayUrls: ["wss://relay-a.example"],
};

it("keeps community and identity scope in every project key", () => {
  expect(communityProjectQueryKeys.catalog(baseScope)).toEqual([
    "community",
    "community-a",
    "alice",
    "wss://relay-a.example",
    "projects",
    "catalog",
  ]);
  expect(
    communityProjectQueryKeys.catalog({ ...baseScope, identityPubkey: "bob" }),
  ).not.toEqual(communityProjectQueryKeys.catalog(baseScope));
  expect(
    communityProjectQueryKeys.catalog({
      ...baseScope,
      communityId: "community-b",
    }),
  ).not.toEqual(communityProjectQueryKeys.catalog(baseScope));
});

it("does not share cached data across community identity scopes", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(communityProjectQueryKeys.catalog(baseScope), [
    "catalog-a",
  ]);
  expect(
    queryClient.getQueryData(
      communityProjectQueryKeys.catalog({
        ...baseScope,
        identityPubkey: "bob",
      }),
    ),
  ).toBeUndefined();
});

it("separates repository reads by branch, path, commit, and pull request", () => {
  const mainTree = communityProjectQueryKeys.repositoryTree(baseScope, {
    repository: "30617:owner:repo",
    revision: "main",
  });
  const featureTree = communityProjectQueryKeys.repositoryTree(baseScope, {
    repository: "30617:owner:repo",
    revision: "feature",
  });
  expect(mainTree).not.toEqual(featureTree);
  expect(mainTree).not.toEqual(
    communityProjectQueryKeys.repositoryTree(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "src",
    }),
  );
  expect(
    communityProjectQueryKeys.repositoryCommits(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "README.md",
      limit: 1,
    }),
  ).not.toEqual(
    communityProjectQueryKeys.repositoryCommits(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "src/index.ts",
      limit: 1,
    }),
  );
  expect(
    communityProjectQueryKeys.githubRepositories(baseScope, "connection-a"),
  ).not.toEqual(
    communityProjectQueryKeys.githubRepositories(baseScope, "connection-b"),
  );
  expect(
    communityProjectQueryKeys.repositoryBlob(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "README.md",
    }),
  ).not.toEqual(
    communityProjectQueryKeys.repositoryBlob(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "src/index.ts",
    }),
  );
  expect(
    communityProjectQueryKeys.repositoryCommit(baseScope, {
      repository: "30617:owner:repo",
      commitSha: "abc",
    }),
  ).not.toEqual(
    communityProjectQueryKeys.repositoryPullRequestDiff(baseScope, {
      repository: "30617:owner:repo",
      pullRequestId: "abc",
    }),
  );
  expect(
    communityProjectQueryKeys.repositoryPathCommit(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "README.md",
    }),
  ).not.toEqual(
    communityProjectQueryKeys.repositoryPathCommit(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "src/index.ts",
    }),
  );
  expect(
    communityProjectQueryKeys.repositoryView(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "README.md",
    }),
  ).not.toEqual(
    communityProjectQueryKeys.repositoryView(baseScope, {
      repository: "30617:owner:repo",
      revision: "main",
      path: "src/index.ts",
    }),
  );
});

it("keeps cached data available when a refresh fails", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const queryKey = communityProjectQueryKeys.repositoryTree(baseScope, {
    repository: "30617:owner:repo",
    revision: "main",
  });
  queryClient.setQueryData(queryKey, { entries: ["README.md"] });
  await expect(
    queryClient.fetchQuery({
      queryKey,
      queryFn: async () => {
        throw new Error("relay offline");
      },
    }),
  ).rejects.toThrow("relay offline");
  expect(queryClient.getQueryData(queryKey)).toEqual({
    entries: ["README.md"],
  });
});

describe("query invalidation", () => {
  it("invalidates the scoped project cache after project mutations", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(communityProjectQueryKeys.catalog(baseScope), [
      "cached",
    ]);
    await invalidateCommunityProjectQueries(queryClient, baseScope);
    expect(
      queryClient.getQueryState(communityProjectQueryKeys.catalog(baseScope))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("invalidates only one repository branch of the scoped cache", async () => {
    const queryClient = new QueryClient();
    const first = communityProjectQueryKeys.repositoryTree(baseScope, {
      repository: "30617:owner:first",
      revision: "main",
    });
    const second = communityProjectQueryKeys.repositoryTree(baseScope, {
      repository: "30617:owner:second",
      revision: "main",
    });
    queryClient.setQueryData(first, "first");
    queryClient.setQueryData(second, "second");
    await invalidateRepositoryQueries(
      queryClient,
      baseScope,
      "30617:owner:first",
    );
    expect(queryClient.getQueryState(first)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(second)?.isInvalidated).toBe(false);
  });
});
