import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import type { CommunityAccountSession } from "./relay-session.js";
import {
  RelayAuthClient,
  RelayAuthSessionExpiredError,
  RelaySessionSigner,
} from "./relay-session.js";
import { SecretKeyRegistrySigner } from "./signer.js";
import type { NostrEventTemplate } from "./types.js";

const managedSecret = new Uint8Array(32).fill(31);
const managedPubkey = getPublicKey(managedSecret);
const relayConfig = {
  providers: ["github", "google"],
  capabilities: {
    github_linking: true,
    managed_signing: true,
    nip44: true,
    nip46: true,
    nostr_login: true,
  },
};

function session(
  overrides: Partial<CommunityAccountSession> = {},
): CommunityAccountSession {
  return {
    account: {
      id: "account-a",
      nostr_pubkey: managedPubkey,
      created_at: "2026-09-12T10:00:00Z",
    },
    auth_provider: "google",
    expires_at: "2026-09-19T10:00:00Z",
    identities: [
      { provider: "google", login: "steve@example.com", display_name: "Steve" },
    ],
    github_status: "unlinked",
    signer_type: "managed",
    signer_status: "active",
    passkey_count: 1,
    ...overrides,
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("relay auth session client", () => {
  it("restores a managed signer and validates relay-signed events", async () => {
    const template: NostrEventTemplate = {
      kind: 9,
      created_at: 1_800_000_000,
      content: "hello",
      tags: [["h", "group-a"]],
    };
    const signed = finalizeEvent(template, managedSecret);
    const fetcher = vi.fn(
      async (request: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(request.toString()).pathname;
        expect(init?.credentials).toBe("include");
        expect(init?.cache).toBe("no-store");
        if (path.endsWith("/config")) return json(relayConfig);
        if (path.endsWith("/session")) return json(session());
        if (path.endsWith("/events/sign")) return json({ event: signed });
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
    });

    const restored = await client.restore();
    expect(restored.status).toBe("connected");
    if (restored.status !== "connected") throw new Error("expected identity");
    expect(restored.session.identities[0]?.display_name).toBe("Steve");
    expect(restored.identity).toBeInstanceOf(RelaySessionSigner);
    await expect(restored.identity.signEvent(template)).resolves.toEqual(
      signed,
    );
  });

  it("rejects a relay event that changes the requested template", async () => {
    const requested = {
      kind: 1,
      created_at: 1_800_000_000,
      content: "requested",
      tags: [],
    };
    const changed = finalizeEvent(
      { ...requested, content: "changed" },
      managedSecret,
    );
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: vi.fn(async () => json({ event: changed })) as typeof fetch,
    });

    await expect(
      client.signEvent(requested, managedPubkey),
    ).rejects.toMatchObject({
      code: "invalid_signed_event",
    });
  });

  it("restores external custody as reconnect-required and treats 401 as anonymous", async () => {
    const external = session({ signer_type: "external" });
    const responses = [json(relayConfig), json(external)];
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: vi.fn(async () => responses.shift()!) as typeof fetch,
    });
    await expect(client.restore()).resolves.toMatchObject({
      status: "reconnect-required",
      session: external,
    });

    const anonymousResponses = [
      json(relayConfig),
      json({ error: "authentication_required" }, 401),
    ];
    const anonymous = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: vi.fn(async () => anonymousResponses.shift()!) as typeof fetch,
    });
    await expect(anonymous.restore()).resolves.toEqual({
      status: "anonymous",
      config: relayConfig,
    });
  });

  it("builds full return URLs for provider login and GitHub linking", async () => {
    const navigations: string[] = [];
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      currentUrl: () => "https://community.example/projects?mine=true#/pull/42",
      navigate: (value) => navigations.push(value),
      fetch: vi.fn(async () => json(relayConfig)) as typeof fetch,
    });

    await expect(client.connect("google")).resolves.toMatchObject({
      status: "redirecting",
    });
    let target = new URL(navigations[0]!);
    expect(target.pathname).toBe("/api/auth/login/google");
    expect(target.searchParams.get("return_to")).toBe(
      "https://community.example/projects?mine=true#/pull/42",
    );

    await client.connectGitHub();
    target = new URL(navigations[1]!);
    expect(target.searchParams.get("intent")).toBe("link");
  });

  it("establishes a body-bound NIP-98 session for a Nostr identity", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const external = session({
      account: {
        id: "account-external",
        nostr_pubkey: pubkey,
        created_at: "2026-09-12T10:00:00Z",
      },
      auth_provider: "nostr",
      identities: [],
      signer_type: "external",
    });
    const fetcher = vi.fn(
      async (request: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(request.toString()).pathname;
        if (path.endsWith("/nostr/challenge")) {
          return json(
            {
              challenge: "challenge-value-at-least-sixteen",
              expires_at: "2026-09-12T10:10:00Z",
            },
            201,
          );
        }
        if (path.endsWith("/nostr/login")) {
          const authorization = new Headers(init?.headers).get(
            "Authorization",
          )!;
          const event = JSON.parse(atob(authorization.slice("Nostr ".length)));
          expect(verifyEvent(event)).toBe(true);
          expect(event.pubkey).toBe(pubkey);
          expect(event.kind).toBe(27_235);
          expect(event.tags).toContainEqual([
            "u",
            "https://relay.example/api/auth/nostr/login",
          ]);
          expect(event.tags).toContainEqual(["method", "POST"]);
          expect(
            event.tags.find((tag: string[]) => tag[0] === "payload")?.[1],
          ).toMatch(/^[0-9a-f]{64}$/u);
          return json({ account: external.account });
        }
        if (path.endsWith("/session")) return json(external);
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
    });

    await expect(
      client.loginWithNostr(new SecretKeyRegistrySigner(secret)),
    ).resolves.toEqual(external);
  });

  it("exposes NIP-44 operations and reports an expired signing session", async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const path = new URL(request.toString()).pathname;
      if (path.endsWith("/nip44/encrypt"))
        return json({ ciphertext: "cipher" });
      if (path.endsWith("/nip44/decrypt")) return json({ plaintext: "plain" });
      return json({ error: "authentication_required" }, 401);
    });
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
    });
    const expired = vi.fn();
    client.onSessionExpired(expired);
    await expect(client.nip44Encrypt(managedPubkey, "plain")).resolves.toBe(
      "cipher",
    );
    await expect(client.nip44Decrypt(managedPubkey, "cipher")).resolves.toBe(
      "plain",
    );
    await expect(
      client.signEvent(
        { kind: 1, created_at: 1, content: "", tags: [] },
        managedPubkey,
      ),
    ).rejects.toBeInstanceOf(RelayAuthSessionExpiredError);
    expect(expired).toHaveBeenCalledOnce();
  });
});
