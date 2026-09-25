import type { QueryClient } from "@tanstack/svelte-query";

import type {
  ProjectForgeCommitResponse,
  ProjectForgeGitHubConnection,
  ProjectForgeGitHubConnectionInput,
  ProjectForgeGitHubConnectionsResponse,
  ProjectForgeGitHubRepositoriesResponse,
  ProjectForgeRefsResponse,
  ProjectForgeSession,
} from "../../projects/index.js";
import {
  loadGitHubConnectionsFromQuery,
  loadGitHubRepositoriesFromQuery,
} from "./project-github-query.js";
import {
  communityProjectQueryKeys,
  type CommunityQueryScope,
} from "./project-query-keys.js";
import {
  loadRepositoryCommitFromQuery,
  loadRepositoryRefsFromQuery,
} from "./project-repository-read-query.js";

type ProjectRequestLoader = <T>(
  label: string,
  action: (session: ProjectForgeSession) => Promise<T>,
) => Promise<T>;

export interface ProjectApplicationQueryActions {
  loadGitHubConnections(): Promise<ProjectForgeGitHubConnectionsResponse>;
  createGitHubConnection(
    input: ProjectForgeGitHubConnectionInput,
  ): Promise<ProjectForgeGitHubConnection>;
  updateGitHubConnection(
    connectionId: string,
    input: ProjectForgeGitHubConnectionInput,
  ): Promise<ProjectForgeGitHubConnection>;
  revalidateGitHubConnection(
    connectionId: string,
  ): Promise<ProjectForgeGitHubConnection>;
  loadGitHubRepositories(
    connectionId: string,
  ): Promise<ProjectForgeGitHubRepositoriesResponse>;
  loadReviewRepositoryRefs(
    repositoryCoordinate: string,
  ): Promise<ProjectForgeRefsResponse>;
  loadRepositoryCommit(
    sha: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCommitResponse>;
}

export function createProjectApplicationQueryActions(options: {
  queryClient: () => QueryClient;
  scope: () => CommunityQueryScope;
  projectSession: () => ProjectForgeSession | undefined;
  selectedRepository: () => string | undefined;
  sourceRepository: () => string | undefined;
  request: ProjectRequestLoader;
}): ProjectApplicationQueryActions {
  const client = () => options.queryClient();
  const scope = () => options.scope();
  const invalidateGitHubConnections = () =>
    client().invalidateQueries({
      queryKey: communityProjectQueryKeys.githubConnections(scope()),
    });
  async function invalidateGitHubConnection(connectionId: string) {
    await Promise.all([
      invalidateGitHubConnections(),
      client().invalidateQueries({
        queryKey: communityProjectQueryKeys.githubRepositories(
          scope(),
          connectionId,
        ),
      }),
    ]);
  }
  function repositoryReadTarget() {
    const session = options.projectSession();
    const repository =
      options.selectedRepository() || options.sourceRepository();
    if (!session || !repository)
      throw new Error("Repository source is not ready");
    return { session, repository };
  }
  return {
    loadGitHubConnections: () =>
      loadGitHubConnectionsFromQuery({
        queryClient: client(),
        scope: scope(),
        load: () =>
          options.request("Loading GitHub connections…", (session) =>
            session.loadGitHubConnections(),
          ),
      }),
    async createGitHubConnection(input) {
      const connection = await options.request(
        "Adding GitHub App connection…",
        (session) => session.createGitHubConnection(input),
      );
      await invalidateGitHubConnections();
      return connection;
    },
    async updateGitHubConnection(connectionId, input) {
      const connection = await options.request(
        "Replacing GitHub App connection…",
        (session) => session.updateGitHubConnection(connectionId, input),
      );
      await invalidateGitHubConnection(connectionId);
      return connection;
    },
    async revalidateGitHubConnection(connectionId) {
      const connection = await options.request(
        "Revalidating GitHub App connection…",
        (session) => session.revalidateGitHubConnection(connectionId),
      );
      await invalidateGitHubConnection(connectionId);
      return connection;
    },
    loadGitHubRepositories: (connectionId) =>
      loadGitHubRepositoriesFromQuery({
        queryClient: client(),
        scope: scope(),
        connectionId,
        load: () =>
          options.request("Loading GitHub repositories…", (session) =>
            session.loadGitHubRepositories(connectionId),
          ),
      }),
    loadReviewRepositoryRefs(repository) {
      const session = options.projectSession();
      if (!session) throw new Error("Repository source is not ready");
      return loadRepositoryRefsFromQuery({
        queryClient: client(),
        scope: scope(),
        session,
        repository,
      });
    },
    loadRepositoryCommit(sha, signal) {
      const { session, repository } = repositoryReadTarget();
      return loadRepositoryCommitFromQuery({
        queryClient: client(),
        scope: scope(),
        session,
        repository,
        commitSha: sha,
        signal,
      });
    },
  };
}
