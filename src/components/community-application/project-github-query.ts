import type { QueryClient } from "@tanstack/svelte-query";

import type {
  ProjectForgeGitHubConnectionsResponse,
  ProjectForgeGitHubRepositoriesResponse,
} from "../../projects/index.js";
import {
  communityProjectQueryKeys,
  type CommunityQueryScope,
} from "./project-query-keys.js";
import { PROJECT_REPOSITORY_READ_STALE_TIME_MS } from "./project-query-client.js";

export function loadGitHubConnectionsFromQuery(input: {
  queryClient: QueryClient;
  scope: CommunityQueryScope;
  load: () => Promise<ProjectForgeGitHubConnectionsResponse>;
}): Promise<ProjectForgeGitHubConnectionsResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.githubConnections(input.scope),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: input.load,
  });
}

export function loadGitHubRepositoriesFromQuery(input: {
  queryClient: QueryClient;
  scope: CommunityQueryScope;
  connectionId: string;
  load: () => Promise<ProjectForgeGitHubRepositoriesResponse>;
}): Promise<ProjectForgeGitHubRepositoriesResponse> {
  return input.queryClient.fetchQuery({
    queryKey: communityProjectQueryKeys.githubRepositories(
      input.scope,
      input.connectionId,
    ),
    staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
    queryFn: input.load,
  });
}
