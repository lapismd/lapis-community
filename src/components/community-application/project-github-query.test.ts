import { QueryClient } from "@tanstack/svelte-query";
import { describe, expect, it, vi } from "vitest";

import type { CommunityQueryScope } from "./project-query-keys.js";
import {
  loadGitHubConnectionsFromQuery,
  loadGitHubRepositoriesFromQuery,
} from "./project-github-query.js";

const scope: CommunityQueryScope = {
  communityId: "community-a",
  identityPubkey: "alice",
  relayUrls: ["wss://relay-a.example"],
};

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("project GitHub queries", () => {
  it("reuses cached GitHub connections", async () => {
    const load = vi.fn(async () => ({ connections: [] }));
    const input = { queryClient: queryClient(), scope, load };

    await loadGitHubConnectionsFromQuery(input);
    await loadGitHubConnectionsFromQuery(input);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps GitHub repository lists distinct by connection", async () => {
    const load = vi.fn(async () => ({ repositories: [] }));
    const client = queryClient();

    await loadGitHubRepositoriesFromQuery({
      queryClient: client,
      scope,
      connectionId: "connection-a",
      load,
    });
    await loadGitHubRepositoriesFromQuery({
      queryClient: client,
      scope,
      connectionId: "connection-a",
      load,
    });
    await loadGitHubRepositoriesFromQuery({
      queryClient: client,
      scope,
      connectionId: "connection-b",
      load,
    });

    expect(load).toHaveBeenCalledTimes(2);
  });
});
