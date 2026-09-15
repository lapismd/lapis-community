import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
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
  RelayCustodyTransferHandoff,
  RelayAuthSessionExpiredError,
  RelaySessionSigner,
  decryptCustodyTransferEnvelope,
} from "./relay-session.js";
import { SecretKeyRegistrySigner } from "./signer.js";
import type { NostrEventTemplate } from "./types.js";
import { encodeBase64Url } from "./webauthn.js";

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
    passkey_registration: true,
    github_disconnect: true,
    nip46_management: true,
    custody_transfer: true,
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

  it("rejects a different key when reconnecting a GitHub-linked external account before login", async () => {
    const external = session({
      signer_type: "external",
      auth_provider: "github",
      github_status: "active",
      identities: [
        {
          provider: "github",
          login: "linked-user",
          display_name: "Linked User",
        },
      ],
    });
    const signer = new SecretKeyRegistrySigner(new Uint8Array(32).fill(32));
    const dispose = vi.spyOn(signer, "dispose");
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const path = new URL(request.toString()).pathname;
      if (path.endsWith("/config")) return json(relayConfig);
      if (path.endsWith("/session")) return json(external);
      throw new Error(`Unexpected request: ${path}`);
    });
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      connectIdentity: async () => signer,
      fetch: fetcher as typeof fetch,
    });
    await expect(client.restore()).resolves.toMatchObject({
      status: "reconnect-required",
    });
    await expect(client.connect("browser-extension")).rejects.toMatchObject({
      code: "nostr_pubkey_mismatch",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledOnce();
    expect(client.session).toEqual(external);
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

  it("consumes a sanitized provider failure from the Community return URL", async () => {
    const replacements: string[] = [];
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      currentUrl: () =>
        "https://community.example/projects?auth_error=provider_authentication_failed#/pull/42",
      replaceUrl: (value) => replacements.push(value),
      fetch: vi.fn(async () => json(relayConfig)) as typeof fetch,
    });

    await expect(client.restore()).rejects.toMatchObject({
      code: "provider_authentication_failed",
      status: 400,
    });
    expect(replacements).toEqual([
      "https://community.example/projects#/pull/42",
    ]);
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

  it("binds an external reconnect to the restored account pubkey", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const external = session({
      account: {
        id: "account-keytr",
        nostr_pubkey: pubkey,
        created_at: "2026-09-12T10:00:00Z",
      },
      auth_provider: "nostr",
      identities: [],
      signer_type: "external",
    });
    const signer = new SecretKeyRegistrySigner(secret);
    const connectIdentity = vi.fn(async () => signer);
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const path = new URL(request.toString()).pathname;
      if (path.endsWith("/config")) return json(relayConfig);
      if (path.endsWith("/session")) return json(external);
      if (path.endsWith("/nostr/challenge")) {
        return json({
          challenge: "challenge-value-at-least-sixteen",
          expires_at: "2026-09-12T10:10:00Z",
        });
      }
      if (path.endsWith("/nostr/login")) {
        return json({ account: external.account });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
      connectIdentity,
    });

    await client.getSession();
    await expect(
      client.connect("keytr", {
        keytr: { action: "login", gatewayId: "keytr.org" },
      }),
    ).resolves.toMatchObject({ status: "connected", identity: signer });
    expect(connectIdentity).toHaveBeenCalledWith(
      "keytr",
      { keytr: { action: "login", gatewayId: "keytr.org" } },
      { expectedPubkey: pubkey },
    );
  });

  it("disposes an external identity when relay login fails", async () => {
    const secret = generateSecretKey();
    const signer = new SecretKeyRegistrySigner(secret);
    const dispose = vi.spyOn(signer, "dispose");
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      connectIdentity: vi.fn(async () => signer),
      fetch: vi.fn(async (request: RequestInfo | URL) => {
        const path = new URL(request.toString()).pathname;
        if (path.endsWith("/config")) return json(relayConfig);
        if (path.endsWith("/nostr/challenge")) {
          return json({
            challenge: "challenge-value-at-least-sixteen",
            expires_at: "2026-09-12T10:10:00Z",
          });
        }
        return json({ error: "invalid_nostr_auth" }, 401);
      }) as typeof fetch,
    });

    await expect(
      client.connect("keytr", {
        keytr: { action: "login", gatewayId: "keytr.org" },
      }),
    ).rejects.toMatchObject({ code: "invalid_nostr_auth" });
    expect(dispose).toHaveBeenCalledOnce();
    await expect(signer.getPublicKey()).rejects.toThrow("no longer available");
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

  it("disconnects GitHub access without losing the linked identity", async () => {
    const active = session({
      identities: [
        ...session().identities,
        { provider: "github", login: "stevejuma", display_name: "Steve" },
      ],
      github_status: "active",
    });
    const disconnected = session({
      identities: active.identities,
      github_status: "disconnected",
    });
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const path = new URL(request.toString()).pathname;
      if (path.endsWith("/github")) return new Response(null, { status: 204 });
      if (path.endsWith("/config")) return json(relayConfig);
      if (path.endsWith("/session")) return json(disconnected);
      throw new Error(`Unexpected request: ${path}`);
    });
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
    });

    await expect(client.disconnectGitHub()).resolves.toMatchObject({
      status: "connected",
      session: {
        github_status: "disconnected",
        identities: expect.arrayContaining([
          expect.objectContaining({ provider: "github", login: "stevejuma" }),
        ]),
      },
    });
  });

  it("connects, refreshes, and disconnects an account remote signer", async () => {
    const remote = session({ signer_type: "nip46" });
    const external = session({ signer_type: "external" });
    let signerConnected = false;
    const fetcher = vi.fn(
      async (request: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(request.toString()).pathname;
        if (path.endsWith("/nip46/connect")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            bunker_url: "bunker://remote",
          });
          signerConnected = true;
          return json({ nostr_pubkey: managedPubkey, signer_type: "nip46" });
        }
        if (path.endsWith("/nip46/switch-relays")) {
          return json({ relays: ["wss://relay.example"] });
        }
        if (path.endsWith("/nip46/logout")) {
          signerConnected = false;
          return new Response(null, { status: 204 });
        }
        if (path.endsWith("/config")) return json(relayConfig);
        if (path.endsWith("/session")) {
          return json(signerConnected ? remote : external);
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
    });

    await expect(
      client.connectRemoteSigner("bunker://remote"),
    ).resolves.toMatchObject({ status: "connected", session: remote });
    await expect(client.switchRemoteSignerRelays()).resolves.toEqual([
      "wss://relay.example",
    ]);
    await expect(client.disconnectRemoteSigner()).resolves.toMatchObject({
      status: "reconnect-required",
      session: external,
    });
  });

  it("completes custody transfer with a same-key remote proof", async () => {
    const managed = session();
    const remote = session({ signer_type: "nip46" });
    const completedBodies: unknown[] = [];
    let completed = false;
    const fetcher = vi.fn(
      async (request: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(request.toString()).pathname;
        if (path.endsWith("/custody/transfer/complete")) {
          completedBodies.push(JSON.parse(String(init?.body)));
          completed = true;
          return json({
            nostr_pubkey: managedPubkey,
            signer_type: "nip46",
            managed_key_deleted: true,
          });
        }
        if (path.endsWith("/config")) return json(relayConfig);
        if (path.endsWith("/session"))
          return json(completed ? remote : managed);
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    const client = new RelayAuthClient({
      relayUrl: "https://relay.example",
      fetch: fetcher as typeof fetch,
      connectIdentity: async () => new SecretKeyRegistrySigner(managedSecret),
    });
    await client.restore();
    const handoff = RelayCustodyTransferHandoff.create(
      "2099-09-12T10:15:00Z",
      "transfer-a",
      "possession-challenge-value",
      managedSecret.slice(),
    );

    await expect(
      client.completeCustodyTransfer(handoff, "bunker://remote"),
    ).resolves.toMatchObject({ status: "connected", session: remote });
    const body = completedBodies[0] as {
      transfer_id: string;
      proof_event: { kind: number; pubkey: string; tags: string[][] };
    };
    expect(body.transfer_id).toBe("transfer-a");
    expect(body.proof_event.kind).toBe(22_242);
    expect(body.proof_event.pubkey).toBe(managedPubkey);
    expect(body.proof_event.tags).toContainEqual([
      "relay",
      "wss://relay.example",
    ]);
    expect(body.proof_event.tags).toContainEqual([
      "purpose",
      "custody-transfer",
    ]);
    expect(() => handoff.revealNsec()).toThrow(/no longer available/u);
  });

  it("decrypts the relay X25519, HKDF, and AES-GCM custody envelope", async () => {
    const account = session();
    const deviceSecret = new Uint8Array(32).fill(7);
    const serverSecret = new Uint8Array(32).fill(8);
    const serverPublic = x25519.getPublicKey(serverSecret);
    const shared = x25519.getSharedSecret(
      serverSecret,
      x25519.getPublicKey(deviceSecret),
    );
    const transferId = "transfer-crypto";
    const info = new TextEncoder().encode(
      `lapis-custody-transfer-v1\0${account.account.id}\0${transferId}\0${account.account.nostr_pubkey}`,
    );
    const keyBytes = hkdf(sha256, shared, undefined, info, 32);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      "AES-GCM",
      false,
      ["encrypt"],
    );
    const nonce = new Uint8Array(12).fill(9);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, additionalData: info },
        key,
        managedSecret,
      ),
    );
    const sealed = new Uint8Array(nonce.length + ciphertext.length);
    sealed.set(nonce);
    sealed.set(ciphertext, nonce.length);

    await expect(
      decryptCustodyTransferEnvelope(
        account,
        {
          transfer_id: transferId,
          server_public_key: encodeBase64Url(serverPublic),
          encrypted_private_key: encodeBase64Url(sealed),
          possession_challenge: "possession-challenge-value",
          expires_at: "2099-09-12T10:15:00Z",
        },
        deviceSecret,
      ),
    ).resolves.toEqual(managedSecret);
  });
});
