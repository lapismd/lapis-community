import { QueryClient } from "@tanstack/svelte-query";
import { describe, expect, it, vi } from "vitest";

import type {
  ProjectForgeGitHubConnection,
  ProjectForgeGitHubConnectionInput,
  ProjectForgeSession,
} from "../../projects/index.js";
import { createProjectApplicationQueryActions } from "./project-application-query-actions.js";
import type { CommunityQueryScope } from "./project-query-keys.js";

const scope: CommunityQueryScope = {
  communityId: "community-a",
  identityPubkey: "alice",
  relayUrls: ["wss://relay-a.example"],
};

const githubInput: ProjectForgeGitHubConnectionInput = {
  appId: "1",
  installationId: 2,
  credentialRef: "github/private-key",
  webhookSecretRef: "github/webhook",
  bridgeCredentialRef: "github/bridge",
  bridgePubkey: "bridge-pubkey",
};

const githubConnection: ProjectForgeGitHubConnection = {
  id: "connection-a",
  provider: "github",
  host: "github.com",
  installation_id: 2,
  account_id: "10",
  account_login: "lapismd",
  bridge_pubkey: "bridge-pubkey",
  status: "active",
};

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createSession(): ProjectForgeSession {
  return {
    loadRefs: vi.fn(async () => ({
      head: { name: "refs/heads/main", sha: "a".repeat(40) },
      refs: [],
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
    loadGitHubConnections: vi.fn(async () => ({
      connections: [githubConnection],
    })),
    loadGitHubRepositories: vi.fn(async () => ({
      repositories: [],
    })),
    createGitHubConnection: vi.fn(async () => githubConnection),
    updateGitHubConnection: vi.fn(async () => githubConnection),
    revalidateGitHubConnection: vi.fn(async () => githubConnection),
  } as unknown as ProjectForgeSession;
}

function queryActions(session: ProjectForgeSession, client = queryClient()) {
  return createProjectApplicationQueryActions({
    queryClient: () => client,
    scope: () => scope,
    projectSession: () => session,
    selectedRepository: () => "30617:owner:selected",
    sourceRepository: () => "30617:owner:source",
    request: (_label, action) => action(session),
  });
}

describe("project application query actions", () => {
  it("reuses cached review refs for the same repository", async () => {
    const session = createSession();
    const actions = queryActions(session);

    await actions.loadReviewRepositoryRefs("30617:owner:repo");
    await actions.loadReviewRepositoryRefs("30617:owner:repo");

    expect(session.loadRefs).toHaveBeenCalledTimes(1);
  });

  it("invalidates GitHub connection and repository reads after updates", async () => {
    const session = createSession();
    const actions = queryActions(session);

    await actions.loadGitHubConnections();
    await actions.loadGitHubRepositories(githubConnection.id);
    await actions.updateGitHubConnection(githubConnection.id, githubInput);
    await actions.loadGitHubConnections();
    await actions.loadGitHubRepositories(githubConnection.id);

    expect(session.loadGitHubConnections).toHaveBeenCalledTimes(2);
    expect(session.loadGitHubRepositories).toHaveBeenCalledTimes(2);
  });
});
