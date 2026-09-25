import type { QueryClient } from "@tanstack/svelte-query";

import type {
  ProjectForgeBlobResponse,
  ProjectForgeCommitResponse,
  ProjectForgeCommitsOptions,
  ProjectForgeCommitsResponse,
  ProjectForgePullRequestDiff,
  ProjectForgeRefsResponse,
  ProjectForgeRepositoryCapabilitiesResponse,
  ProjectForgeSession,
  ProjectForgeTreeResponse,
} from "../../projects/index.js";
import {
  communityProjectQueryKeys,
  type CommunityQueryScope,
} from "./project-query-keys.js";
import { PROJECT_REPOSITORY_READ_STALE_TIME_MS } from "./project-query-client.js";

export type ProjectRepositoryReadSession = Pick<
  ProjectForgeSession,
  | "loadCapabilities"
  | "loadRefs"
  | "loadTree"
  | "loadBlob"
  | "loadCommits"
  | "loadCommit"
>;

export interface ProjectRepositoryReadQueryContext {
  queryClient: QueryClient;
  scope: CommunityQueryScope;
}

interface ProjectRepositoryQueryInput
  extends ProjectRepositoryReadQueryContext {
  session: ProjectRepositoryReadSession;
  repository: string;
  signal?: AbortSignal | undefined;
}

export function projectRepositoryReadSession(
  session: ProjectRepositoryReadSession,
  context?: ProjectRepositoryReadQueryContext | undefined,
): ProjectRepositoryReadSession {
  if (!context) return session;
  return {
    loadCapabilities: (repository, signal) =>
      loadRepositoryCapabilitiesFromQuery({
        ...context,
        session,
        repository,
        signal,
      }),
    loadRefs: (repository, signal) =>
      loadRepositoryRefsFromQuery({ ...context, session, repository, signal }),
    loadTree: (repository, revision, path = "", signal) =>
      loadRepositoryTreeFromQuery({
        ...context,
        session,
        repository,
        revision,
        path,
        signal,
      }),
    loadBlob: (repository, revision, path, signal) =>
      loadRepositoryBlobFromQuery({
        ...context,
        session,
        repository,
        revision,
        path,
        signal,
      }),
    loadCommits: (repository, ref, signal, options) =>
      loadRepositoryCommitsFromQuery({
        ...context,
        session,
        repository,
        revision: ref,
        options,
        signal,
      }),
    loadCommit: (repository, sha, signal) =>
      loadRepositoryCommitFromQuery({
        ...context,
        session,
        repository,
        commitSha: sha,
        signal,
      }),
  };
}

export function loadRepositoryCapabilitiesFromQuery(
  input: ProjectRepositoryQueryInput,
): Promise<ProjectForgeRepositoryCapabilitiesResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryCapabilities(
      input.scope,
      input.repository,
    ),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      input.session.loadCapabilities(input.repository, input.signal),
  });
}

export function loadRepositoryRefsFromQuery(
  input: ProjectRepositoryQueryInput,
): Promise<ProjectForgeRefsResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryRefs(
      input.scope,
      input.repository,
    ),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () => input.session.loadRefs(input.repository, input.signal),
  });
}

export function loadRepositoryTreeFromQuery(
  input: ProjectRepositoryQueryInput & { revision: string; path?: string },
): Promise<ProjectForgeTreeResponse> {
  const path = input.path ?? "";
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryTree(input.scope, {
      repository: input.repository,
      revision: input.revision,
      path,
    }),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      input.session.loadTree(
        input.repository,
        input.revision,
        path,
        input.signal,
      ),
  });
}

export function loadRepositoryBlobFromQuery(
  input: ProjectRepositoryQueryInput & { revision: string; path: string },
): Promise<ProjectForgeBlobResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryBlob(input.scope, {
      repository: input.repository,
      revision: input.revision,
      path: input.path,
    }),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      input.session.loadBlob(
        input.repository,
        input.revision,
        input.path,
        input.signal,
      ),
  });
}

export function loadRepositoryCommitsFromQuery(
  input: ProjectRepositoryQueryInput & {
    revision?: string | undefined;
    options?: ProjectForgeCommitsOptions | undefined;
  },
): Promise<ProjectForgeCommitsResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryCommits(input.scope, {
      repository: input.repository,
      revision: input.revision,
      path: input.options?.path,
      limit: input.options?.limit,
      cursor: input.options?.from,
    }),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      input.session.loadCommits(
        input.repository,
        input.revision,
        input.signal,
        input.options,
      ),
  });
}

export function loadRepositoryCommitFromQuery(
  input: ProjectRepositoryQueryInput & { commitSha: string },
): Promise<ProjectForgeCommitResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryCommit(input.scope, {
      repository: input.repository,
      commitSha: input.commitSha,
    }),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      input.session.loadCommit(input.repository, input.commitSha, input.signal),
  });
}

export function loadRepositoryPullRequestDiffFromQuery(
  input: ProjectRepositoryReadQueryContext & {
    session: Pick<ProjectForgeSession, "loadPullRequestDiff">;
    repository: string;
    pullRequestId: string;
    signal?: AbortSignal | undefined;
  },
): Promise<ProjectForgePullRequestDiff> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryPullRequestDiff(input.scope, {
      repository: input.repository,
      pullRequestId: input.pullRequestId,
    }),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      input.session.loadPullRequestDiff(
        input.pullRequestId,
        input.signal ? { signal: input.signal } : {},
      ),
  });
}

export function loadRepositoryPullRequestDiffForView(input: {
  context?: ProjectRepositoryReadQueryContext | undefined;
  session: Pick<ProjectForgeSession, "loadPullRequestDiff">;
  repository: string;
  pullRequestId: string;
  signal?: AbortSignal | undefined;
}): Promise<ProjectForgePullRequestDiff> {
  if (!input.context) {
    return input.session.loadPullRequestDiff(
      input.pullRequestId,
      input.signal ? { signal: input.signal } : {},
    );
  }
  return loadRepositoryPullRequestDiffFromQuery({
    ...input.context,
    session: input.session,
    repository: input.repository,
    pullRequestId: input.pullRequestId,
    signal: input.signal,
  });
}
