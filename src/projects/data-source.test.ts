import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { generateSecretKey } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { SecretKeyRegistrySigner } from "../auth/index.js";
import type { CommunityRelay } from "../nostr/index.js";
import type { NostrEvent } from "../protocol/index.js";
import { createInMemoryRelayFactory } from "../testing/index.js";
import { createNip34ProjectForgeDataSource } from "./data-source.js";

const owner = "1".repeat(64);
const repository = `30617:${owner}:notes`;

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

function authorizationEvent(value: string): NostrEvent {
  return JSON.parse(
    Buffer.from(value.slice("Nostr ".length), "base64").toString("utf8"),
  ) as NostrEvent;
}

describe("NIP-34 project forge data source", () => {
  it("closes a relay when session setup fails", async () => {
    const close = vi.fn();
    const source = createNip34ProjectForgeDataSource({
      relayFactory: {
        create: (url) =>
          ({
            url,
            authenticate: vi.fn(async () => {
              throw new Error("relay authentication failed");
            }),
            query: vi.fn(),
            publish: vi.fn(),
            subscribe: vi.fn(),
            close,
          }) as unknown as CommunityRelay,
      },
    });

    await expect(
      source.open({
        relayUrl: "wss://relay.example",
        identity: new SecretKeyRegistrySigner(generateSecretKey()),
      }),
    ).rejects.toThrow("relay authentication failed");
    expect(close).toHaveBeenCalledOnce();
  });

  it("reuses recent authenticated repository reads across sessions", async () => {
    let now = new Date("2026-09-09T12:00:00.000Z");
    const fetch = vi.fn(async () =>
      json({
        name: "README.md",
        path: "README.md",
        contents: "# Notes",
      }),
    );
    const identity = new SecretKeyRegistrySigner(generateSecretKey());
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => now,
    });

    const first = await source.open({
      relayUrl: "wss://relay.example",
      identity,
    });
    await first.loadBlob(repository, "main", "README.md");
    first.close();

    const second = await source.open({
      relayUrl: "wss://relay.example",
      identity,
    });
    await expect(
      second.loadBlob(repository, "main", "README.md"),
    ).resolves.toMatchObject({ contents: "# Notes" });
    expect(fetch).toHaveBeenCalledTimes(1);
    second.close();

    now = new Date("2026-09-09T12:00:15.001Z");
    const expired = await source.open({
      relayUrl: "wss://relay.example",
      identity,
    });
    await expired.loadBlob(repository, "main", "README.md");
    expect(fetch).toHaveBeenCalledTimes(2);
    expired.close();
  });

  it("discovers provider-neutral repository capabilities and preserves full ref paths", async () => {
    const requests: Array<{ url: string; authorization: string }> = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("Authorization") ?? "",
        });
        if (url.endsWith(`/${owner}/notes/capabilities`)) {
          return json({
            repository,
            capabilities: {
              git_authority_backend: "github",
              content_backend: "github",
              git_backend: "github",
              collaboration_backend: "relay",
              clone: {
                available: true,
                url: "https://github.com/lapismd/notes.git",
                auth: "provider",
                provider: "github",
              },
              smart_http: { read: false, write: false },
              browse: true,
              compare: true,
              ref_events: true,
              provision: false,
              import: false,
              issues: false,
              pull_requests: false,
              reviews: false,
              merge: false,
              mirror: false,
              ci: false,
              capability_limits: {
                maximum_blob_bytes: 100_000_000,
                maximum_changed_files: 300,
                maximum_tree_entries: 1_000,
                may_truncate_compare: true,
                may_truncate_tree: true,
              },
            },
          });
        }
        if (url.endsWith(`/blob/refs/heads/main/README.md`)) {
          return json({
            name: "README.md",
            path: "README.md",
            contents: "# Notes",
          });
        }
        return new Response("missing", { status: 404 });
      },
    );
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => new Date("2026-09-09T12:00:00.000Z"),
    });
    const session = await source.open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });

    await expect(session.loadCapabilities(repository)).resolves.toMatchObject({
      repository,
      capabilities: {
        content_backend: "github",
        browse: true,
        clone: { auth: "provider" },
        capability_limits: {
          maximum_changed_files: 300,
          maximum_tree_entries: 1_000,
        },
      },
    });
    await expect(
      session.loadBlob(repository, "refs/heads/main", "README.md"),
    ).resolves.toMatchObject({ contents: "# Notes" });

    expect(requests.map((request) => request.url)).toEqual([
      `https://relay.example/api/forge/repositories/${owner}/notes/capabilities`,
      `https://relay.example/api/git/${owner}/notes/blob/refs/heads/main/README.md`,
    ]);
    for (const request of requests) {
      const auth = authorizationEvent(request.authorization);
      expect(auth.tags).toContainEqual(["u", request.url]);
      expect(auth.tags).toContainEqual(["method", "GET"]);
    }
    session.close();
  });

  it("loads path-filtered commit metadata for repository file rows", async () => {
    const requests: Array<{ url: string; authorization: string }> = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("Authorization") ?? "",
        });
        return json({
          ref: "main",
          sha: "a".repeat(40),
          commits: [
            {
              sha: "b".repeat(40),
              subject: "Document the project source browser",
              author: "Noor Patel",
              commit_date: "2026-09-08T09:30:00Z",
            },
          ],
          more: false,
        });
      },
    );
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => new Date("2026-09-09T12:00:00.000Z"),
    });
    const session = await source.open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });

    await expect(
      session.loadCommits(repository, "main", undefined, {
        path: "src/app.ts",
        limit: 1,
      }),
    ).resolves.toMatchObject({
      commits: [{ subject: "Document the project source browser" }],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      `https://relay.example/api/git/${owner}/notes/commits?ref=main&path=src%2Fapp.ts&n=1`,
    );
    const auth = authorizationEvent(requests[0]!.authorization);
    expect(auth.tags).toContainEqual(["u", requests[0]!.url]);
    expect(auth.tags).toContainEqual(["method", "GET"]);
    session.close();
  });

  it("merges a pull request through a head-pinned forge operation", async () => {
    const eventId = "4".repeat(64);
    const expectedHead = "a".repeat(40);
    const requests: Array<{
      url: string;
      method: string;
      authorization: string;
      body: string;
    }> = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = {
          url: input.toString(),
          method: init?.method ?? "GET",
          authorization: new Headers(init?.headers).get("Authorization") ?? "",
          body: typeof init?.body === "string" ? init.body : "",
        };
        requests.push(request);
        if (request.url.endsWith(`/pull-requests/${eventId}/merge`)) {
          return json({
            operation_id: "fop-sample",
            state: "pending",
            command: "merge",
            repository,
          });
        }
        if (request.url.endsWith("/api/forge/operations/fop-sample")) {
          return json({
            operation_id: "fop-sample",
            state: "complete",
            command: "merge",
            repository,
            result: { state: "merged", merged_commit: "b".repeat(40) },
          });
        }
        return new Response("missing", { status: 404 });
      },
    );
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => new Date("2026-09-10T12:00:00.000Z"),
    });
    const session = await source.open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });

    await expect(
      session.mergePullRequest(eventId, expectedHead),
    ).resolves.toMatchObject({
      state: "complete",
      result: { state: "merged", merged_commit: "b".repeat(40) },
    });
    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      {
        method: "POST",
        url: `https://relay.example/api/forge/pull-requests/${eventId}/merge`,
      },
      {
        method: "GET",
        url: "https://relay.example/api/forge/operations/fop-sample",
      },
    ]);
    expect(JSON.parse(requests[0]!.body)).toEqual({
      expected_head: expectedHead,
      method: "merge",
    });
    for (const request of requests) {
      const auth = authorizationEvent(request.authorization);
      expect(auth.tags).toContainEqual(["method", request.method]);
    }
    session.close();
  });

  it("names missing OWNERS.md reviewers from a failed merge", async () => {
    const eventId = "5".repeat(64);
    const expectedHead = "a".repeat(40);
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: "path owners have not approved",
            missing_owners: ["docs/"],
          }),
          {
            status: 409,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
    });
    const session = await source.open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });

    await expect(
      session.mergePullRequest(eventId, expectedHead),
    ).rejects.toThrow(/OWNERS.md reviewers are still required: docs\//u);
    session.close();
  });

  it("discovers GitHub App connections and attaches a matching provider repository", async () => {
    const requests: Array<{
      url: string;
      method: string;
      authorization: string;
      body: string;
    }> = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? init.body : "";
        requests.push({
          url,
          method,
          authorization: new Headers(init?.headers).get("Authorization") ?? "",
          body,
        });
        if (url.endsWith("/api/forge/connections/github")) {
          return json({
            connections: [
              {
                id: "ghc-lapis",
                provider: "github",
                host: "github.com",
                installation_id: 99,
                account_id: "7",
                account_login: "lapismd",
                bridge_pubkey: "2".repeat(64),
                status: "active",
              },
            ],
          });
        }
        if (
          url.endsWith("/api/forge/connections/github/ghc-lapis/repositories")
        ) {
          return json({
            repositories: [
              {
                id: 42,
                full_name: "lapismd/notes",
                name: "notes",
                default_branch: "main",
                clone_url: "https://github.com/lapismd/notes.git",
                html_url: "https://github.com/lapismd/notes",
                private: false,
                archived: false,
                disabled: false,
                owner: { id: 7, login: "lapismd" },
              },
            ],
          });
        }
        if (
          url.endsWith(`/api/forge/repositories/${owner}/notes/integration`)
        ) {
          return json({
            capabilities: {
              git_authority_backend: "github",
              content_backend: "github",
              collaboration_backend: "relay",
            },
          });
        }
        return new Response("missing", { status: 404 });
      },
    );
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => new Date("2026-09-09T12:00:00.000Z"),
    });
    const session = await source.open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });

    await expect(session.loadGitHubConnections()).resolves.toMatchObject({
      connections: [{ id: "ghc-lapis", account_login: "lapismd" }],
    });
    await expect(
      session.loadGitHubRepositories("ghc-lapis"),
    ).resolves.toMatchObject({
      repositories: [{ id: 42, full_name: "lapismd/notes" }],
    });
    await expect(
      session.attachGitHubRepository(repository, {
        expectedAnnouncementId: "3".repeat(64),
        connectionId: "ghc-lapis",
        externalRepositoryId: "42",
      }),
    ).resolves.toMatchObject({
      capabilities: { git_authority_backend: "github" },
    });

    expect(requests.map(({ url, method }) => ({ url, method }))).toEqual([
      {
        url: "https://relay.example/api/forge/connections/github",
        method: "GET",
      },
      {
        url: "https://relay.example/api/forge/connections/github/ghc-lapis/repositories",
        method: "GET",
      },
      {
        url: `https://relay.example/api/forge/repositories/${owner}/notes/integration`,
        method: "PUT",
      },
    ]);
    expect(JSON.parse(requests[2]!.body)).toEqual({
      expected_announcement_id: "3".repeat(64),
      git_authority_backend: "github",
      content_backend: "github",
      collaboration_backend: "relay",
      connection_id: "ghc-lapis",
      external_repository_id: "42",
    });
    const auth = authorizationEvent(requests[2]!.authorization);
    expect(auth.tags).toContainEqual(["method", "PUT"]);
    expect(auth.tags).toContainEqual([
      "payload",
      bytesToHex(sha256(new TextEncoder().encode(requests[2]!.body))),
    ]);
    session.close();
  });

  it("creates, replaces, and revalidates GitHub App connections with NIP-98", async () => {
    const requests: Array<{
      url: string;
      method: string;
      authorization: string;
      body: string;
    }> = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = {
          url: input.toString(),
          method: init?.method ?? "GET",
          authorization: new Headers(init?.headers).get("Authorization") ?? "",
          body: typeof init?.body === "string" ? init.body : "",
        };
        requests.push(request);
        return json({
          id: "ghc-lapis",
          provider: "github",
          host: "github.com",
          installation_id: 99,
          account_id: "7",
          account_login: "lapismd",
          bridge_pubkey: "2".repeat(64),
          status: "active",
          updated_at: "2026-09-09T12:00:00Z",
        });
      },
    );
    const source = createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => new Date("2026-09-09T12:00:00.000Z"),
    });
    const session = await source.open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });
    const input = {
      appId: "12345",
      installationId: 99,
      credentialRef: "file:github-app.pem",
      webhookSecretRef: "file:github-webhook",
      bridgeCredentialRef: "file:github-bridge-secret",
      bridgePubkey: "2".repeat(64),
    };

    await expect(session.createGitHubConnection(input)).resolves.toMatchObject({
      id: "ghc-lapis",
      status: "active",
    });
    await expect(
      session.updateGitHubConnection("ghc-lapis", input),
    ).resolves.toMatchObject({ id: "ghc-lapis", status: "active" });
    await expect(
      session.revalidateGitHubConnection("ghc-lapis"),
    ).resolves.toMatchObject({ id: "ghc-lapis", status: "active" });

    expect(requests.map(({ url, method }) => ({ url, method }))).toEqual([
      {
        url: "https://relay.example/api/forge/connections/github",
        method: "POST",
      },
      {
        url: "https://relay.example/api/forge/connections/github/ghc-lapis",
        method: "PUT",
      },
      {
        url: "https://relay.example/api/forge/connections/github/ghc-lapis/revalidate",
        method: "POST",
      },
    ]);
    expect(JSON.parse(requests[0]!.body)).toEqual({
      app_id: "12345",
      installation_id: 99,
      credential_ref: "file:github-app.pem",
      webhook_secret_ref: "file:github-webhook",
      bridge_credential_ref: "file:github-bridge-secret",
      bridge_pubkey: "2".repeat(64),
    });
    for (const request of requests) {
      const auth = authorizationEvent(request.authorization);
      expect(auth.tags).toContainEqual(["method", request.method]);
      if (request.body) {
        expect(auth.tags).toContainEqual([
          "payload",
          bytesToHex(sha256(new TextEncoder().encode(request.body))),
        ]);
      } else {
        expect(auth.tags.some(([name]) => name === "payload")).toBe(false);
      }
    }
    session.close();
  });
});
