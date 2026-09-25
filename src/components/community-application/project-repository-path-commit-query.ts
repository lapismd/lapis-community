import type { QueryClient } from "@tanstack/svelte-query";

import type {
  ProjectForgeCommit,
  ProjectForgeSession,
} from "../../projects/index.js";
import { readRepositoryPathCommit } from "../../projects/repository-source-reads.js";
import {
  communityProjectQueryKeys,
  type CommunityQueryScope,
} from "./project-query-keys.js";
import { PROJECT_REPOSITORY_READ_STALE_TIME_MS } from "./project-query-client.js";

export interface RepositoryPathCommitQueryInput {
  queryClient: QueryClient;
  scope: CommunityQueryScope;
  session: ProjectForgeSession | undefined;
  repository: string;
  revision: string;
  path: string;
  signal?: AbortSignal | undefined;
}

export function loadRepositoryPathCommitFromQuery(
  input: RepositoryPathCommitQueryInput,
): Promise<ProjectForgeCommit | undefined> {
  const { queryClient, scope, repository, revision, path, signal } = input;
  if (!input.session || !repository || !revision || !path) {
    return Promise.resolve(undefined);
  }
  return queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.repositoryPathCommit(scope, {
      repository,
      revision,
      path,
    }),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: () =>
      readRepositoryPathCommit(
        input.session,
        repository,
        revision,
        path,
        signal,
      ),
  });
}
