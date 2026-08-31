import { describe, expect, it, vi } from "vitest";

import {
  GithubOAuthAdapter,
  GoogleOAuthAdapter,
  IdentityBroker,
  MemoryIdentityAccountStore,
  MemoryIdentityFlowStore,
} from "./index.js";
import type {
  OAuthProviderAdapter,
  PrivateAuditSink,
  ThresholdGroupProfile,
} from "./index.js";

const now = 1_800_000_000;
const redirectUri = "https://registry.example.test/auth/callback";

function group(): ThresholdGroupProfile {
  return {
    groupPubkey: "1".repeat(64),
    threshold: 2,
    operators: ["one", "two", "three"].map((operatorId) => ({
      operatorId,
      endpoint: `https://${operatorId}.signer.example.test`,
      publicCommitment: `commitment-${operatorId}`,
    })),
    nip46Relays: ["wss://relay.example.test"],
  };
}

function createHarness(adapter: OAuthProviderAdapter) {
  const auditEntries: Parameters<PrivateAuditSink["record"]>[0][] = [];
  const audit: PrivateAuditSink = {
    record: async (entry) => {
      auditEntries.push(structuredClone(entry));
    },
  };
  const broker = new IdentityBroker({
    adapters: [adapter],
    flows: new MemoryIdentityFlowStore(),
    accounts: new MemoryIdentityAccountStore(),
    passkeys: {
      verifyOnboarding: async ({ challengeId }) => ({
        credentialId: `credential:${challengeId}`,
        userVerified: true,
      }),
    },
    audit,
    mappingSecret: new Uint8Array(32).fill(7),
    now: () => now,
  });
  return { broker, auditEntries };
}

async function callbackFrom(
  broker: IdentityBroker,
  provider: "github" | "google",
) {
  const beginning = await broker.beginOAuth({ provider, redirectUri });
  const authorizationUrl = new URL(beginning.authorizationUrl);
  const state = authorizationUrl.searchParams.get("state");
  if (state === null) throw new Error("missing state fixture");
  return await broker.completeOAuth({
    provider,
    state,
    code: "one-use-code",
    redirectUri,
  });
}

describe("identity broker", () => {
  it("binds Google state, nonce, PKCE, issuer and audience before onboarding", async () => {
    const exchange = vi.fn(async () => ({ idToken: "ephemeral-id-token" }));
    const verify = vi.fn(async () => ({ subject: "private-google-subject" }));
    const adapter = new GoogleOAuthAdapter({
      clientId: "registry-client",
      tokens: { exchange },
      idTokens: { verify },
    });
    const { broker, auditEntries } = createHarness(adapter);
    const beginning = await broker.beginOAuth({
      provider: "google",
      redirectUri,
    });
    const authorizationUrl = new URL(beginning.authorizationUrl);
    const state = authorizationUrl.searchParams.get("state");
    const nonce = authorizationUrl.searchParams.get("nonce");

    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorizationUrl.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/u,
    );
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();

    const resolution = await broker.completeOAuth({
      provider: "google",
      state: state!,
      code: "one-use-code",
      redirectUri,
    });
    expect(resolution.status).toBe("onboarding-required");
    expect(exchange).toHaveBeenCalledWith({
      code: "one-use-code",
      codeVerifier: expect.any(String),
      redirectUri,
    });
    expect(verify).toHaveBeenCalledWith({
      idToken: "ephemeral-id-token",
      audience: "registry-client",
      nonce,
      allowedIssuers: ["https://accounts.google.com", "accounts.google.com"],
    });
    expect(JSON.stringify(auditEntries)).not.toContain(
      "private-google-subject",
    );
    expect(JSON.stringify(auditEntries)).not.toContain("ephemeral-id-token");
  });

  it("requires passkey verification, public threshold metadata, and recovery export", async () => {
    const adapter: OAuthProviderAdapter = {
      provider: "google",
      createAuthorizationUrl: ({ state }) =>
        new URL(`https://provider.example.test/auth?state=${state}`),
      resolveSubject: async () => "provider-subject",
    };
    const { broker } = createHarness(adapter);
    const resolution = await callbackFrom(broker, "google");
    if (resolution.status !== "onboarding-required") {
      throw new Error("expected onboarding fixture");
    }

    const account = await broker.completeOnboarding({
      onboardingToken: resolution.onboardingToken,
      thresholdGroup: group(),
      recoveryReceipt: {
        digest: "2".repeat(64),
        exportedAt: "2027-01-15T08:00:00.000Z",
      },
      passkeyChallengeId: "passkey-challenge",
      passkeyAssertion: { fixture: true },
    });
    expect(account).toMatchObject({
      pubkey: "1".repeat(64),
      passkeyCredentialId: "credential:passkey-challenge",
      roles: ["user"],
    });
    expect(JSON.stringify(account)).not.toMatch(
      /privateKey|nsec|secret|accessToken|idToken/u,
    );
  });

  it("rejects callback replay, redirect mismatch, and expired attempts", async () => {
    let currentTime = now;
    const adapter: OAuthProviderAdapter = {
      provider: "github",
      createAuthorizationUrl: ({ state }) =>
        new URL(`https://provider.example.test/auth?state=${state}`),
      resolveSubject: async () => "1234",
    };
    const audit: PrivateAuditSink = { record: async () => undefined };
    const broker = new IdentityBroker({
      adapters: [adapter],
      flows: new MemoryIdentityFlowStore(),
      accounts: new MemoryIdentityAccountStore(),
      passkeys: {
        verifyOnboarding: async () => ({
          credentialId: "credential",
          userVerified: true,
        }),
      },
      audit,
      mappingSecret: new Uint8Array(32).fill(8),
      now: () => currentTime,
      flowTtlSeconds: 60,
    });
    const beginning = await broker.beginOAuth({
      provider: "github",
      redirectUri,
    });
    const state = new URL(beginning.authorizationUrl).searchParams.get(
      "state",
    )!;

    await expect(
      broker.completeOAuth({
        provider: "github",
        state,
        code: "code",
        redirectUri: "https://registry.example.test/wrong",
      }),
    ).rejects.toThrow("does not match a live one-use attempt");
    await expect(
      broker.completeOAuth({
        provider: "github",
        state,
        code: "code",
        redirectUri,
      }),
    ).rejects.toThrow("does not match a live one-use attempt");

    const expiring = await broker.beginOAuth({
      provider: "github",
      redirectUri,
    });
    currentTime += 61;
    await expect(
      broker.completeOAuth({
        provider: "github",
        state: new URL(expiring.authorizationUrl).searchParams.get("state")!,
        code: "code",
        redirectUri,
      }),
    ).rejects.toThrow("does not match a live one-use attempt");
  });

  it("returns the same Nostr account for an existing opaque provider mapping", async () => {
    const adapter: OAuthProviderAdapter = {
      provider: "github",
      createAuthorizationUrl: ({ state }) =>
        new URL(`https://provider.example.test/auth?state=${state}`),
      resolveSubject: async () => "987654",
    };
    const { broker } = createHarness(adapter);
    const first = await callbackFrom(broker, "github");
    if (first.status !== "onboarding-required") {
      throw new Error("expected onboarding fixture");
    }
    const created = await broker.completeOnboarding({
      onboardingToken: first.onboardingToken,
      thresholdGroup: group(),
      recoveryReceipt: {
        digest: "3".repeat(64),
        exportedAt: "2027-01-15T08:00:00.000Z",
      },
      passkeyChallengeId: "passkey",
      passkeyAssertion: {},
    });

    const second = await callbackFrom(broker, "github");
    expect(second).toEqual({ status: "existing", account: created });
  });

  it("keeps GitHub access tokens inside the provider adapter call", async () => {
    const exchange = vi.fn(async () => ({ accessToken: "ephemeral-token" }));
    const resolve = vi.fn(async (accessToken: string) => {
      expect(accessToken).toBe("ephemeral-token");
      return { numericId: 42 };
    });
    const adapter = new GithubOAuthAdapter({
      clientId: "github-client",
      tokens: { exchange },
      users: { resolve },
    });
    const { broker, auditEntries } = createHarness(adapter);

    await callbackFrom(broker, "github");

    expect(exchange).toHaveBeenCalledWith({
      code: "one-use-code",
      codeVerifier: expect.any(String),
      redirectUri,
    });
    expect(resolve).toHaveBeenCalledOnce();
    expect(JSON.stringify(auditEntries)).not.toContain("ephemeral-token");
    expect(JSON.stringify(auditEntries)).not.toContain("42");
  });

  it("rejects private threshold fields and does not grant curator authority", async () => {
    const adapter: OAuthProviderAdapter = {
      provider: "google",
      createAuthorizationUrl: ({ state }) =>
        new URL(`https://provider.example.test/auth?state=${state}`),
      resolveSubject: async () => "provider-subject",
    };
    const { broker } = createHarness(adapter);
    const resolution = await callbackFrom(broker, "google");
    if (resolution.status !== "onboarding-required") {
      throw new Error("expected onboarding fixture");
    }
    const unsafeGroup = {
      ...group(),
      privateKey: "must-not-cross-boundary",
    } as ThresholdGroupProfile;

    await expect(
      broker.completeOnboarding({
        onboardingToken: resolution.onboardingToken,
        thresholdGroup: unsafeGroup,
        recoveryReceipt: {
          digest: "4".repeat(64),
          exportedAt: "2027-01-15T08:00:00.000Z",
        },
        passkeyChallengeId: "passkey",
        passkeyAssertion: {},
      }),
    ).rejects.toThrow("private or unsupported fields");
  });
});
