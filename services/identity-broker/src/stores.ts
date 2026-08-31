import type {
  IdentityAccount,
  IdentityAccountStore,
  IdentityFlowStore,
  OAuthAttempt,
  PendingOnboarding,
} from "./types.js";

export class MemoryIdentityFlowStore implements IdentityFlowStore {
  readonly #attempts = new Map<string, OAuthAttempt>();
  readonly #onboarding = new Map<string, PendingOnboarding>();

  async saveAttempt(attempt: OAuthAttempt): Promise<void> {
    if (this.#attempts.has(attempt.stateDigest)) {
      throw new Error("OAuth state digest already exists");
    }
    this.#attempts.set(attempt.stateDigest, structuredClone(attempt));
  }

  async consumeAttempt(stateDigest: string): Promise<OAuthAttempt | undefined> {
    const attempt = this.#attempts.get(stateDigest);
    this.#attempts.delete(stateDigest);
    return attempt === undefined ? undefined : structuredClone(attempt);
  }

  async saveOnboarding(onboarding: PendingOnboarding): Promise<void> {
    if (this.#onboarding.has(onboarding.tokenDigest)) {
      throw new Error("Onboarding token digest already exists");
    }
    this.#onboarding.set(onboarding.tokenDigest, structuredClone(onboarding));
  }

  async consumeOnboarding(
    tokenDigest: string,
  ): Promise<PendingOnboarding | undefined> {
    const onboarding = this.#onboarding.get(tokenDigest);
    this.#onboarding.delete(tokenDigest);
    return onboarding === undefined ? undefined : structuredClone(onboarding);
  }
}

export class MemoryIdentityAccountStore implements IdentityAccountStore {
  readonly #accounts = new Map<string, IdentityAccount>();
  readonly #providerMappings = new Map<string, string>();

  async findByProviderLookup(
    providerLookup: string,
  ): Promise<IdentityAccount | undefined> {
    const accountId = this.#providerMappings.get(providerLookup);
    const account =
      accountId === undefined ? undefined : this.#accounts.get(accountId);
    return account === undefined ? undefined : structuredClone(account);
  }

  async createWithProvider(
    account: IdentityAccount,
    providerLookup: string,
  ): Promise<void> {
    if (
      this.#accounts.has(account.accountId) ||
      this.#providerMappings.has(providerLookup)
    ) {
      throw new Error("Identity account or provider mapping already exists");
    }
    this.#accounts.set(account.accountId, structuredClone(account));
    this.#providerMappings.set(providerLookup, account.accountId);
  }
}
