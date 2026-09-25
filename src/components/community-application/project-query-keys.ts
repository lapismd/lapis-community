import type { QueryClient, QueryKey } from "@tanstack/svelte-query";

export interface CommunityQueryScope {
  communityId: string;
  identityPubkey: string;
  relayUrls: readonly string[];
}

export interface RepositoryQueryTarget {
  repository: string;
  revision?: string | undefined;
  path?: string | undefined;
  surface?: string | undefined;
  commitSha?: string | undefined;
  pullRequestId?: string | undefined;
  limit?: number | undefined;
}

export function communityQueryRelayUrls(
  ...urls: Array<string | undefined>
): readonly string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))].sort();
}

export function communityQueryScopeStorageKey(
  scope: CommunityQueryScope,
): string {
  return JSON.stringify([
    scope.communityId,
    scope.identityPubkey,
    scope.relayUrls,
  ]);
}

const root = (scope: CommunityQueryScope) =>
  [
    "community",
    scope.communityId,
    scope.identityPubkey,
    ...scope.relayUrls,
  ] as const;

const projectsRoot = (scope: CommunityQueryScope) =>
  [...root(scope), "projects"] as const;

export const communityProjectQueryKeys = {
  root,
  projects: projectsRoot,
  catalog: (scope: CommunityQueryScope) =>
    [...projectsRoot(scope), "catalog"] as const,
  homeForChannel: (scope: CommunityQueryScope, channelId: string) =>
    [...projectsRoot(scope), "home-channel", channelId] as const,
  repository: (scope: CommunityQueryScope, repository: string) =>
    [...projectsRoot(scope), "repository", repository] as const,
  repositoryCapabilities: (scope: CommunityQueryScope, repository: string) =>
    [
      ...communityProjectQueryKeys.repository(scope, repository),
      "capabilities",
    ] as const,
  repositoryRefs: (scope: CommunityQueryScope, repository: string) =>
    [
      ...communityProjectQueryKeys.repository(scope, repository),
      "refs",
    ] as const,
  repositoryTree: (
    scope: CommunityQueryScope,
    target: Pick<RepositoryQueryTarget, "repository" | "revision" | "path">,
  ) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "tree",
      target.revision ?? "default",
      target.path ?? "root",
    ] as const,
  repositoryBlob: (
    scope: CommunityQueryScope,
    target: Required<
      Pick<RepositoryQueryTarget, "repository" | "revision" | "path">
    >,
  ) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "blob",
      target.revision,
      target.path,
    ] as const,
  repositoryCommits: (
    scope: CommunityQueryScope,
    target: Pick<
      RepositoryQueryTarget,
      "repository" | "revision" | "path" | "limit"
    >,
  ) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "commits",
      target.revision ?? "default",
      target.path ?? "all",
      target.limit ?? "all",
    ] as const,
  repositoryCommit: (
    scope: CommunityQueryScope,
    target: Required<Pick<RepositoryQueryTarget, "repository" | "commitSha">>,
  ) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "commit",
      target.commitSha,
    ] as const,
  repositoryPathCommit: (
    scope: CommunityQueryScope,
    target: Required<
      Pick<RepositoryQueryTarget, "repository" | "revision" | "path">
    >,
  ) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "path-commit",
      target.revision,
      target.path,
    ] as const,
  repositoryPullRequestDiff: (
    scope: CommunityQueryScope,
    target: Required<
      Pick<RepositoryQueryTarget, "repository" | "pullRequestId">
    >,
  ) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "pull-request-diff",
      target.pullRequestId,
    ] as const,
  repositoryView: (scope: CommunityQueryScope, target: RepositoryQueryTarget) =>
    [
      ...communityProjectQueryKeys.repository(scope, target.repository),
      "view",
      target.surface ?? "default",
      target.revision ?? "default",
      target.path ?? "root",
      target.commitSha ?? "none",
      target.pullRequestId ?? "none",
    ] as const,
  githubConnections: (scope: CommunityQueryScope) =>
    [...projectsRoot(scope), "github", "connections"] as const,
  githubRepositories: (scope: CommunityQueryScope, connectionId: string) =>
    [...projectsRoot(scope), "github", "repositories", connectionId] as const,
  channelCanvas: (scope: CommunityQueryScope, roomId: string) =>
    [...root(scope), "channel-canvas", roomId] as const,
};

export function invalidateCommunityProjectQueries(
  queryClient: QueryClient,
  scope?: CommunityQueryScope,
): Promise<unknown> {
  const queryKey: QueryKey = scope
    ? communityProjectQueryKeys.projects(scope)
    : ["community"];
  return queryClient.invalidateQueries({ queryKey });
}

export function invalidateRepositoryQueries(
  queryClient: QueryClient,
  scope: CommunityQueryScope,
  repository: string,
): Promise<unknown> {
  return queryClient.invalidateQueries({
    queryKey: communityProjectQueryKeys.repository(scope, repository),
  });
}
