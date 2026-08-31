export type IdentityProvider = "github" | "google";

export interface OAuthAuthorizationRequest {
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface OAuthCallbackRequest {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

export interface OAuthProviderAdapter {
  readonly provider: IdentityProvider;
  createAuthorizationUrl(request: OAuthAuthorizationRequest): URL;
  resolveSubject(request: OAuthCallbackRequest): Promise<string>;
}

export interface OAuthAttempt {
  provider: IdentityProvider;
  stateDigest: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  expiresAt: number;
}

export interface PendingOnboarding {
  tokenDigest: string;
  provider: IdentityProvider;
  providerLookup: string;
  expiresAt: number;
}

export interface IdentityFlowStore {
  saveAttempt(attempt: OAuthAttempt): Promise<void>;
  consumeAttempt(stateDigest: string): Promise<OAuthAttempt | undefined>;
  saveOnboarding(onboarding: PendingOnboarding): Promise<void>;
  consumeOnboarding(
    tokenDigest: string,
  ): Promise<PendingOnboarding | undefined>;
}

export interface ThresholdOperatorProfile {
  operatorId: string;
  endpoint: string;
  publicCommitment: string;
}

export interface ThresholdGroupProfile {
  groupPubkey: string;
  threshold: number;
  operators: ThresholdOperatorProfile[];
  nip46Relays: string[];
}

export interface RecoveryExportReceipt {
  digest: string;
  exportedAt: string;
}

export interface IdentityAccount {
  accountId: string;
  pubkey: string;
  thresholdGroup: ThresholdGroupProfile;
  passkeyCredentialId: string;
  recoveryReceipt: RecoveryExportReceipt;
  roles: readonly ["user"];
  createdAt: string;
}

export interface IdentityAccountStore {
  findByProviderLookup(
    providerLookup: string,
  ): Promise<IdentityAccount | undefined>;
  createWithProvider(
    account: IdentityAccount,
    providerLookup: string,
  ): Promise<void>;
}

export interface PasskeyStepUpVerifier {
  verifyOnboarding(request: {
    challengeId: string;
    assertion: unknown;
  }): Promise<{ credentialId: string; userVerified: true }>;
}

export type OAuthResolution =
  | { status: "existing"; account: IdentityAccount }
  | {
      status: "onboarding-required";
      onboardingToken: string;
      provider: IdentityProvider;
    };

export interface PrivateAuditSink {
  record(entry: {
    action: string;
    outcome: "accepted" | "rejected";
    provider?: IdentityProvider;
    accountId?: string;
    occurredAt: string;
  }): Promise<void>;
}
