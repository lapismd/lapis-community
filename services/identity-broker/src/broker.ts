import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import { pkceChallenge } from "./oauth.js";
import type {
  IdentityAccount,
  IdentityAccountStore,
  IdentityFlowStore,
  IdentityProvider,
  OAuthProviderAdapter,
  OAuthResolution,
  PasskeyStepUpVerifier,
  PrivateAuditSink,
  RecoveryExportReceipt,
  ThresholdGroupProfile,
} from "./types.js";

const hex64 = /^[0-9a-f]{64}$/u;

export class IdentityBroker {
  readonly #adapters: ReadonlyMap<IdentityProvider, OAuthProviderAdapter>;
  readonly #flows: IdentityFlowStore;
  readonly #accounts: IdentityAccountStore;
  readonly #passkeys: PasskeyStepUpVerifier;
  readonly #audit: PrivateAuditSink;
  readonly #mappingSecret: Uint8Array;
  readonly #now: () => number;
  readonly #flowTtlSeconds: number;

  constructor(options: {
    adapters: readonly OAuthProviderAdapter[];
    flows: IdentityFlowStore;
    accounts: IdentityAccountStore;
    passkeys: PasskeyStepUpVerifier;
    audit: PrivateAuditSink;
    mappingSecret: Uint8Array;
    now?: () => number;
    flowTtlSeconds?: number;
  }) {
    if (options.mappingSecret.byteLength < 32) {
      throw new Error("Identity mapping secret must contain at least 32 bytes");
    }
    this.#adapters = new Map(
      options.adapters.map((adapter) => [adapter.provider, adapter]),
    );
    if (this.#adapters.size !== options.adapters.length) {
      throw new Error("OAuth providers must be configured exactly once");
    }
    this.#flows = options.flows;
    this.#accounts = options.accounts;
    this.#passkeys = options.passkeys;
    this.#audit = options.audit;
    this.#mappingSecret = new Uint8Array(options.mappingSecret);
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.#flowTtlSeconds = options.flowTtlSeconds ?? 600;
  }

  async beginOAuth(request: {
    provider: IdentityProvider;
    redirectUri: string;
  }): Promise<{ authorizationUrl: string }> {
    const adapter = this.#adapter(request.provider);
    assertHttpsRedirect(request.redirectUri);
    const state = randomToken();
    const nonce = randomToken();
    const codeVerifier = randomToken(48);
    await this.#flows.saveAttempt({
      provider: request.provider,
      stateDigest: digest(state),
      nonce,
      codeVerifier,
      redirectUri: request.redirectUri,
      expiresAt: this.#now() + this.#flowTtlSeconds,
    });
    return {
      authorizationUrl: adapter
        .createAuthorizationUrl({
          state,
          nonce,
          codeChallenge: pkceChallenge(codeVerifier),
          redirectUri: request.redirectUri,
        })
        .toString(),
    };
  }

  async completeOAuth(request: {
    provider: IdentityProvider;
    state: string;
    code: string;
    redirectUri: string;
  }): Promise<OAuthResolution> {
    const attempt = await this.#flows.consumeAttempt(digest(request.state));
    if (
      attempt === undefined ||
      attempt.provider !== request.provider ||
      attempt.redirectUri !== request.redirectUri ||
      attempt.expiresAt <= this.#now()
    ) {
      await this.#audit.record({
        action: "oauth.callback",
        outcome: "rejected",
        provider: request.provider,
        occurredAt: nowIso(this.#now()),
      });
      throw new Error("OAuth callback does not match a live one-use attempt");
    }

    let subject: string;
    try {
      subject = await this.#adapter(request.provider).resolveSubject({
        code: request.code,
        codeVerifier: attempt.codeVerifier,
        nonce: attempt.nonce,
        redirectUri: request.redirectUri,
      });
    } catch (error) {
      await this.#audit.record({
        action: "oauth.provider-verification",
        outcome: "rejected",
        provider: request.provider,
        occurredAt: nowIso(this.#now()),
      });
      throw error;
    }
    if (subject.length === 0 || subject.length > 512) {
      throw new Error("OAuth provider returned an invalid subject");
    }
    const providerLookup = this.#providerLookup(request.provider, subject);
    const account = await this.#accounts.findByProviderLookup(providerLookup);
    if (account !== undefined) {
      await this.#audit.record({
        action: "oauth.sign-in",
        outcome: "accepted",
        provider: request.provider,
        accountId: account.accountId,
        occurredAt: nowIso(this.#now()),
      });
      return { status: "existing", account };
    }

    const onboardingToken = randomToken();
    await this.#flows.saveOnboarding({
      tokenDigest: digest(onboardingToken),
      provider: request.provider,
      providerLookup,
      expiresAt: this.#now() + this.#flowTtlSeconds,
    });
    await this.#audit.record({
      action: "oauth.onboarding-required",
      outcome: "accepted",
      provider: request.provider,
      occurredAt: nowIso(this.#now()),
    });
    return {
      status: "onboarding-required",
      onboardingToken,
      provider: request.provider,
    };
  }

  async completeOnboarding(request: {
    onboardingToken: string;
    thresholdGroup: ThresholdGroupProfile;
    recoveryReceipt: RecoveryExportReceipt;
    passkeyChallengeId: string;
    passkeyAssertion: unknown;
  }): Promise<IdentityAccount> {
    const onboarding = await this.#flows.consumeOnboarding(
      digest(request.onboardingToken),
    );
    if (onboarding === undefined || onboarding.expiresAt <= this.#now()) {
      throw new Error("Onboarding token is invalid, expired, or already used");
    }
    assertPublicThresholdGroup(request.thresholdGroup);
    assertRecoveryReceipt(request.recoveryReceipt);
    const passkey = await this.#passkeys.verifyOnboarding({
      challengeId: request.passkeyChallengeId,
      assertion: request.passkeyAssertion,
    });
    if (passkey.userVerified !== true || passkey.credentialId.length === 0) {
      throw new Error("Passkey onboarding requires verified user presence");
    }

    const account: IdentityAccount = {
      accountId: randomUUID(),
      pubkey: request.thresholdGroup.groupPubkey,
      thresholdGroup: structuredClone(request.thresholdGroup),
      passkeyCredentialId: passkey.credentialId,
      recoveryReceipt: structuredClone(request.recoveryReceipt),
      roles: ["user"],
      createdAt: nowIso(this.#now()),
    };
    await this.#accounts.createWithProvider(account, onboarding.providerLookup);
    await this.#audit.record({
      action: "account.create",
      outcome: "accepted",
      provider: onboarding.provider,
      accountId: account.accountId,
      occurredAt: nowIso(this.#now()),
    });
    return account;
  }

  #adapter(provider: IdentityProvider): OAuthProviderAdapter {
    const adapter = this.#adapters.get(provider);
    if (adapter === undefined) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }
    return adapter;
  }

  #providerLookup(provider: IdentityProvider, subject: string): string {
    return createHmac("sha256", this.#mappingSecret)
      .update(`${provider}:${subject}`)
      .digest("hex");
  }
}

function assertHttpsRedirect(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error(
      "OAuth redirect URI must be an HTTPS URL without credentials",
    );
  }
}

function assertPublicThresholdGroup(group: ThresholdGroupProfile): void {
  const allowedGroupKeys = new Set([
    "groupPubkey",
    "threshold",
    "operators",
    "nip46Relays",
  ]);
  if (Object.keys(group).some((key) => !allowedGroupKeys.has(key))) {
    throw new Error("Threshold group contains private or unsupported fields");
  }
  if (!hex64.test(group.groupPubkey)) {
    throw new Error("Threshold group public key must be 32-byte lowercase hex");
  }
  if (
    !Number.isInteger(group.threshold) ||
    group.threshold < 2 ||
    group.threshold > group.operators.length
  ) {
    throw new Error("Threshold group must require at least two operators");
  }
  const operatorIds = new Set<string>();
  for (const operator of group.operators) {
    const keys = Object.keys(operator);
    if (
      keys.some(
        (key) => !["operatorId", "endpoint", "publicCommitment"].includes(key),
      )
    ) {
      throw new Error(
        "Threshold operator contains private or unsupported fields",
      );
    }
    if (
      operator.operatorId.length === 0 ||
      operator.publicCommitment.length === 0 ||
      operatorIds.has(operator.operatorId)
    ) {
      throw new Error("Threshold operators require unique public identities");
    }
    const endpoint = new URL(operator.endpoint);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash
    ) {
      throw new Error(
        "Threshold operator endpoints must use HTTPS without credentials",
      );
    }
    operatorIds.add(operator.operatorId);
  }
  if (group.operators.length < 3) {
    throw new Error("Threshold onboarding requires at least three operators");
  }
  for (const relay of group.nip46Relays) {
    const relayUrl = new URL(relay);
    if (
      relayUrl.protocol !== "wss:" ||
      relayUrl.username ||
      relayUrl.password ||
      relayUrl.hash
    ) {
      throw new Error(
        "NIP-46 relay endpoints must use WSS without credentials",
      );
    }
  }
}

function assertRecoveryReceipt(receipt: RecoveryExportReceipt): void {
  if (
    !hex64.test(receipt.digest) ||
    !Number.isFinite(Date.parse(receipt.exportedAt))
  ) {
    throw new Error("A valid recovery export receipt is required");
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function nowIso(now: number): string {
  return new Date(now * 1_000).toISOString();
}
