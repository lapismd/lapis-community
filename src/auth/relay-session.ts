import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { nip19 } from "nostr-tools";
import { makeAuthEvent } from "nostr-tools/nip42";
import { getPublicKey, verifyEvent } from "nostr-tools/pure";
import { z } from "zod";

import { canonicalJson } from "../protocol/index.js";
import type { JsonValue, NostrEvent } from "../protocol/index.js";

import { Nip07RegistrySigner } from "./signer.js";
import type {
  CommunitySigner,
  Nip44Provider,
  NostrEventTemplate,
} from "./types.js";
import {
  browserCredentials,
  decodeBase64Url,
  decodePasskeyCreationOptions,
  decodePasskeyRequestOptions,
  encodeBase64Url,
  serializePasskeyCredential,
  type CommunityCredentialsContainer,
} from "./webauthn.js";

const nostrPubkeySchema = z.string().regex(/^[0-9a-f]{64}$/u);
const accountIdentitySchema = z.object({
  provider: z.string().min(1),
  login: z.string(),
  display_name: z.string(),
});
const accountSessionSchema = z.object({
  account: z.object({
    id: z.string().min(1),
    nostr_pubkey: nostrPubkeySchema,
    created_at: z.string().datetime({ offset: true }),
  }),
  auth_provider: z.string().min(1),
  expires_at: z.string().datetime({ offset: true }),
  identities: z.array(accountIdentitySchema),
  github_status: z.string().min(1),
  signer_type: z.enum(["managed", "nip46", "external"]),
  signer_status: z.enum(["active", "migration_pending", "disabled"]),
  passkey_count: z.number().int().nonnegative(),
});
const relayConfigSchema = z.object({
  providers: z.array(z.enum(["github", "google"])),
  capabilities: z.object({
    github_linking: z.boolean(),
    managed_signing: z.boolean(),
    nip44: z.boolean(),
    nip46: z.boolean(),
    nostr_login: z.boolean(),
    passkey_registration: z.boolean().optional().default(false),
    github_disconnect: z.boolean().optional().default(false),
    nip46_management: z.boolean().optional().default(false),
    custody_transfer: z.boolean().optional().default(false),
  }),
});
const challengeSchema = z.object({
  challenge: z.string().min(16),
  expires_at: z.string().datetime({ offset: true }),
});
const signedEventSchema = z.object({ event: z.custom<NostrEvent>() });
const passkeyFlowSchema = z.object({
  flow_id: z.string().min(16),
  options: z.unknown(),
});
const custodyEnvelopeSchema = z.object({
  transfer_id: z.string().min(1),
  server_public_key: z.string().min(1),
  encrypted_private_key: z.string().min(1),
  possession_challenge: z.string().min(16),
  expires_at: z.string().datetime({ offset: true }),
});
const nip46RelaysSchema = z.object({ relays: z.array(z.string().url()) });

export interface CommunityRelayAuthConfig {
  providers: readonly ("github" | "google")[];
  capabilities: {
    github_linking: boolean;
    managed_signing: boolean;
    nip44: boolean;
    nip46: boolean;
    nostr_login: boolean;
    passkey_registration?: boolean;
    github_disconnect?: boolean;
    nip46_management?: boolean;
    custody_transfer?: boolean;
  };
}

export interface CommunityAccountIdentity {
  provider: string;
  login: string;
  display_name: string;
}

export type CommunityGitHubStatus =
  | "unlinked"
  | "active"
  | "reconnect_required"
  | "disconnected"
  | "expired"
  | "revoked"
  | "insufficient_credentials"
  | (string & {});

export interface CommunityAccountSession {
  account: {
    id: string;
    nostr_pubkey: string;
    created_at: string;
  };
  auth_provider: string;
  expires_at: string;
  identities: readonly CommunityAccountIdentity[];
  github_status: CommunityGitHubStatus;
  signer_type: "managed" | "nip46" | "external";
  signer_status: "active" | "migration_pending" | "disabled";
  passkey_count: number;
}

export type RelayAuthRestoreResult =
  | {
      status: "anonymous";
      config: CommunityRelayAuthConfig;
    }
  | {
      status: "connected";
      config: CommunityRelayAuthConfig;
      session: CommunityAccountSession;
      identity: CommunitySigner;
    }
  | {
      status: "reconnect-required";
      config: CommunityRelayAuthConfig;
      session: CommunityAccountSession;
    };

export type RelayAuthConnectResult =
  | Exclude<RelayAuthRestoreResult, { status: "anonymous" }>
  | { status: "redirecting"; config: CommunityRelayAuthConfig };

export type RelayAuthAccountResult = Exclude<
  RelayAuthRestoreResult,
  { status: "anonymous" }
>;

export interface RelayAuthClientOptions {
  relayUrl: string;
  fetch?: typeof globalThis.fetch;
  navigate?: (url: string) => void;
  currentUrl?: () => string;
  replaceUrl?: (url: string) => void;
  connectIdentity?: (
    methodId: string,
    credentials?: RelayAuthLoginCredentials,
    context?: RelayIdentityConnectContext,
  ) => Promise<CommunitySigner>;
  credentials?: CommunityCredentialsContainer;
}

export interface RelayAuthLoginCredentials {
  privateKey?: string;
  remoteSignerUrl?: string;
  keytr?: {
    action: "login" | "create" | "import";
    gatewayId: string;
    passkeyLabel?: string;
    privateKey?: string;
  };
}

export interface RelayIdentityConnectContext {
  expectedPubkey?: string;
}

const relayErrorMessages: Record<string, string> = {
  account_update_failed: "The relay could not update this account.",
  auth_store_unavailable: "Account services are temporarily unavailable.",
  authentication_required: "Your session has expired. Sign in again.",
  event_kind_not_allowed:
    "This Community action cannot use the managed signer.",
  event_timestamp_out_of_range:
    "Your device clock is too far from the relay clock.",
  github_credential_store_failed:
    "GitHub connected, but its credential could not be saved.",
  identity_already_linked: "That provider account is already linked elsewhere.",
  invalid_nip44_request: "The encrypted message request is invalid.",
  invalid_nostr_auth: "The Nostr signer did not approve a valid login.",
  invalid_origin: "This Community origin is not allowed by the relay.",
  nip44_operation_denied: "The signer could not complete encryption.",
  provider_authentication_failed: "The provider did not complete sign in.",
  passkey_required: "Add a passkey before moving this signing key.",
  passkey_already_registered: "This account already has a passkey.",
  passkey_registration_failed: "The passkey could not be registered.",
  passkey_store_unavailable: "Passkey services are temporarily unavailable.",
  invalid_passkey_attestation: "The relay could not verify this passkey.",
  invalid_passkey_assertion: "The relay could not verify this passkey.",
  invalid_passkey_flow: "The passkey request expired. Start again.",
  recent_authentication_required: "Sign in again before adding a passkey.",
  custody_transfer_failed: "The signing-key transfer could not be completed.",
  invalid_custody_transfer: "The signing-key transfer expired. Start again.",
  invalid_possession_proof:
    "The remote signer did not prove possession of this account key.",
  managed_custody_required:
    "This account does not have a managed key available for transfer.",
  nip46_connection_failed: "The relay could not reach the remote signer.",
  nip46_pubkey_mismatch: "The remote signer uses a different Nostr public key.",
  nip46_signer_unavailable: "The remote signer is unavailable.",
  nostr_pubkey_mismatch:
    "This signer uses a different Nostr key. Reconnect the key for this account, or sign out to use another account.",
  signer_unavailable: "Reconnect the Nostr signer for this account.",
  signing_denied: "The signer denied this Community action.",
};

export class RelayAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(
      relayErrorMessages[code] ??
        "The relay could not complete authentication.",
    );
    this.name = "RelayAuthError";
    this.code = code;
    this.status = status;
  }
}

export class RelayAuthSessionExpiredError extends RelayAuthError {
  constructor() {
    super("authentication_required", 401);
    this.name = "RelayAuthSessionExpiredError";
  }
}

interface CustodyTransferPrivateState {
  transferId: string;
  challenge: string;
  secret: Uint8Array | undefined;
}

const custodyTransferState = new WeakMap<
  RelayCustodyTransferHandoff,
  CustodyTransferPrivateState
>();

export class RelayCustodyTransferHandoff {
  readonly expiresAt: string;

  private constructor(
    expiresAt: string,
    transferId: string,
    challenge: string,
    secret: Uint8Array,
  ) {
    this.expiresAt = expiresAt;
    custodyTransferState.set(this, { transferId, challenge, secret });
  }

  static create(
    expiresAt: string,
    transferId: string,
    challenge: string,
    secret: Uint8Array,
  ): RelayCustodyTransferHandoff {
    return new RelayCustodyTransferHandoff(
      expiresAt,
      transferId,
      challenge,
      secret,
    );
  }

  revealNsec(): string {
    const secret = custodyTransferState.get(this)?.secret;
    if (secret === undefined) {
      throw new Error("The transferred private key is no longer available");
    }
    return nip19.nsecEncode(secret);
  }

  discardPrivateKey(): void {
    const state = custodyTransferState.get(this);
    if (state?.secret !== undefined) {
      state.secret.fill(0);
      state.secret = undefined;
    }
  }
}

export function isRelayAuthSessionExpiredError(
  cause: unknown,
): cause is RelayAuthSessionExpiredError {
  return cause instanceof RelayAuthSessionExpiredError;
}

export class RelaySessionSigner implements CommunitySigner {
  readonly #client: RelayAuthClient;
  readonly #pubkey: string;
  readonly nip44: Nip44Provider;

  constructor(client: RelayAuthClient, session: CommunityAccountSession) {
    if (
      session.signer_status !== "active" ||
      (session.signer_type !== "managed" && session.signer_type !== "nip46")
    ) {
      throw new Error(
        "The relay session does not have an active signing identity",
      );
    }
    this.#client = client;
    this.#pubkey = session.account.nostr_pubkey;
    this.nip44 = {
      encrypt: async (pubkey, plaintext) =>
        await this.#client.nip44Encrypt(pubkey, plaintext),
      decrypt: async (pubkey, ciphertext) =>
        await this.#client.nip44Decrypt(pubkey, ciphertext),
    };
  }

  async getPublicKey(): Promise<string> {
    return this.#pubkey;
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    return await this.#client.signEvent(template, this.#pubkey);
  }
}

export class RelayAuthClient {
  readonly #origin: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #navigate: (url: string) => void;
  readonly #currentUrl: () => string;
  readonly #replaceUrl: (url: string) => void;
  readonly #connectIdentity?: RelayAuthClientOptions["connectIdentity"];
  readonly #credentials: CommunityCredentialsContainer | undefined;
  readonly #sessionExpiredListeners = new Set<() => void>();
  #config?: CommunityRelayAuthConfig;
  #session: CommunityAccountSession | undefined;

  constructor(options: RelayAuthClientOptions) {
    const relay = new URL(options.relayUrl);
    if (
      (relay.protocol !== "https:" && relay.protocol !== "http:") ||
      relay.username !== "" ||
      relay.password !== "" ||
      relay.search !== "" ||
      relay.hash !== ""
    ) {
      throw new Error("Relay auth URL must be an absolute HTTP origin");
    }
    this.#origin = relay.origin;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#navigate =
      options.navigate ?? ((url) => globalThis.window.location.assign(url));
    this.#currentUrl =
      options.currentUrl ?? (() => globalThis.window.location.href);
    this.#replaceUrl =
      options.replaceUrl ??
      ((url) => globalThis.window.history.replaceState(null, "", url));
    this.#connectIdentity = options.connectIdentity;
    this.#credentials = options.credentials;
  }

  get session(): CommunityAccountSession | undefined {
    return this.#session;
  }

  async getConfig(): Promise<CommunityRelayAuthConfig> {
    const payload = await this.#request("config", { method: "GET" }, false);
    const config = relayConfigSchema.parse(payload);
    this.#config = config;
    return config;
  }

  async getSession(): Promise<CommunityAccountSession> {
    const payload = await this.#request("session", { method: "GET" }, false);
    const session = accountSessionSchema.parse(payload);
    this.#session = session;
    return session;
  }

  async restore(): Promise<RelayAuthRestoreResult> {
    const config = await this.getConfig();
    const providerError = this.#consumeProviderReturnError();
    if (providerError !== undefined) {
      throw new RelayAuthError(providerError, 400);
    }
    let session: CommunityAccountSession;
    try {
      session = await this.getSession();
    } catch (cause) {
      if (cause instanceof RelayAuthError && cause.status === 401) {
        this.#session = undefined;
        return { status: "anonymous", config };
      }
      throw cause;
    }
    if (
      session.signer_status === "active" &&
      (session.signer_type === "managed" || session.signer_type === "nip46")
    ) {
      return {
        status: "connected",
        config,
        session,
        identity: new RelaySessionSigner(this, session),
      };
    }
    return { status: "reconnect-required", config, session };
  }

  async connect(
    methodId: string,
    credentials?: RelayAuthLoginCredentials,
  ): Promise<RelayAuthConnectResult> {
    const config = this.#config ?? (await this.getConfig());
    if (methodId === "github" || methodId === "google") {
      if (!config.providers.includes(methodId)) {
        throw new RelayAuthError("provider_unavailable", 404);
      }
      this.#navigate(this.providerLoginUrl(methodId));
      return { status: "redirecting", config };
    }
    const expectedPubkey = this.#session?.account.nostr_pubkey;
    const identity = await this.#resolveIdentity(methodId, credentials);
    try {
      if (
        expectedPubkey !== undefined &&
        (await identity.getPublicKey()) !== expectedPubkey
      ) {
        throw new RelayAuthError("nostr_pubkey_mismatch", 400);
      }
      let session = await this.loginWithNostr(identity);
      if (methodId === "remote-signer" && credentials?.remoteSignerUrl) {
        await this.#request("nip46/connect", {
          method: "POST",
          body: JSON.stringify({ bunker_url: credentials.remoteSignerUrl }),
        });
        session = await this.getSession();
        identity.dispose?.();
        return {
          status: "connected",
          config,
          session,
          identity: new RelaySessionSigner(this, session),
        };
      }
      return { status: "connected", config, session, identity };
    } catch (cause) {
      identity.dispose?.();
      throw cause;
    }
  }

  providerLoginUrl(
    provider: "github" | "google",
    options: { intent?: "login" | "link"; returnTo?: string } = {},
  ): string {
    const endpoint = new URL(`/api/auth/login/${provider}`, this.#origin);
    endpoint.searchParams.set("intent", options.intent ?? "login");
    endpoint.searchParams.set(
      "return_to",
      options.returnTo ?? this.#currentUrl(),
    );
    return endpoint.toString();
  }

  async connectGitHub(): Promise<void> {
    const config = this.#config ?? (await this.getConfig());
    if (!config.providers.includes("github")) {
      throw new RelayAuthError("provider_unavailable", 404);
    }
    this.#navigate(this.providerLoginUrl("github", { intent: "link" }));
  }

  async registerPasskey(): Promise<RelayAuthAccountResult> {
    const credentials = this.#credentials ?? browserCredentials();
    const begin = passkeyFlowSchema.parse(
      await this.#request("passkeys/register/begin", { method: "POST" }),
    );
    const credential = await credentials.create(
      decodePasskeyCreationOptions(begin.options),
    );
    await this.#request(
      `passkeys/register/finish?flow_id=${encodeURIComponent(begin.flow_id)}`,
      {
        method: "POST",
        body: JSON.stringify(serializePasskeyCredential(credential)),
      },
    );
    return await this.#restoreAccount();
  }

  async disconnectGitHub(): Promise<RelayAuthAccountResult> {
    await this.#request("github", { method: "DELETE" });
    return await this.#restoreAccount();
  }

  async connectRemoteSigner(
    bunkerUrl: string,
  ): Promise<RelayAuthAccountResult> {
    await this.#request("nip46/connect", {
      method: "POST",
      body: JSON.stringify({ bunker_url: bunkerUrl }),
    });
    return await this.#restoreAccount();
  }

  async switchRemoteSignerRelays(): Promise<readonly string[]> {
    const payload = nip46RelaysSchema.parse(
      await this.#request("nip46/switch-relays", { method: "POST" }),
    );
    return payload.relays;
  }

  async disconnectRemoteSigner(): Promise<RelayAuthAccountResult> {
    await this.#request("nip46/logout", { method: "POST" });
    return await this.#restoreAccount();
  }

  async beginCustodyTransfer(): Promise<RelayCustodyTransferHandoff> {
    const session = this.#session ?? (await this.getSession());
    const credentials = this.#credentials ?? browserCredentials();
    const deviceSecret = x25519.utils.randomSecretKey();
    try {
      const devicePublicKey = x25519.getPublicKey(deviceSecret);
      const begin = passkeyFlowSchema.parse(
        await this.#request("custody/transfer/begin", {
          method: "POST",
          body: JSON.stringify({
            device_public_key: encodeBase64Url(devicePublicKey),
          }),
        }),
      );
      const credential = await credentials.get(
        decodePasskeyRequestOptions(begin.options),
      );
      const envelope = custodyEnvelopeSchema.parse(
        await this.#request(
          `custody/transfer/authorize?flow_id=${encodeURIComponent(begin.flow_id)}`,
          {
            method: "POST",
            body: JSON.stringify(serializePasskeyCredential(credential)),
          },
        ),
      );
      const secret = await decryptCustodyTransferEnvelope(
        session,
        envelope,
        deviceSecret,
      );
      return RelayCustodyTransferHandoff.create(
        envelope.expires_at,
        envelope.transfer_id,
        envelope.possession_challenge,
        secret,
      );
    } finally {
      deviceSecret.fill(0);
    }
  }

  async completeCustodyTransfer(
    handoff: RelayCustodyTransferHandoff,
    bunkerUrl: string,
  ): Promise<RelayAuthAccountResult> {
    const state = custodyTransferState.get(handoff);
    const expectedPubkey = this.#session?.account.nostr_pubkey;
    if (state === undefined || expectedPubkey === undefined) {
      throw new RelayAuthError("invalid_custody_transfer", 400);
    }
    if (new Date(handoff.expiresAt).getTime() <= Date.now()) {
      throw new RelayAuthError("invalid_custody_transfer", 400);
    }
    const signer = await this.#resolveIdentity("remote-signer", {
      remoteSignerUrl: bunkerUrl,
    });
    if ((await signer.getPublicKey()) !== expectedPubkey) {
      throw new RelayAuthError("nip46_pubkey_mismatch", 409);
    }
    const template = makeAuthEvent(this.#relayURL(), state.challenge);
    template.tags.push(["purpose", "custody-transfer"]);
    const proofEvent = await signer.signEvent(template);
    if (proofEvent.pubkey !== expectedPubkey || !verifyEvent(proofEvent)) {
      throw new RelayAuthError("invalid_possession_proof", 401);
    }
    await this.#request("custody/transfer/complete", {
      method: "POST",
      body: JSON.stringify({
        transfer_id: state.transferId,
        proof_event: proofEvent,
        bunker_url: bunkerUrl,
      }),
    });
    handoff.discardPrivateKey();
    custodyTransferState.delete(handoff);
    return await this.#restoreAccount();
  }

  async loginWithNostr(
    identity: CommunitySigner,
  ): Promise<CommunityAccountSession> {
    const pubkey = nostrPubkeySchema.parse(await identity.getPublicKey());
    const challengePayload = challengeSchema.parse(
      await this.#request("nostr/challenge", {
        method: "POST",
        body: JSON.stringify({ pubkey }),
      }),
    );
    const body = JSON.stringify({ challenge: challengePayload.challenge });
    const payloadHash = await sha256Hex(body);
    const loginUrl = new URL("/api/auth/nostr/login", this.#origin).toString();
    const event = await identity.signEvent({
      kind: 27_235,
      created_at: Math.floor(Date.now() / 1_000),
      content: "",
      tags: [
        ["u", loginUrl],
        ["method", "POST"],
        ["payload", payloadHash],
      ],
    });
    if (event.pubkey !== pubkey || !verifyEvent(event)) {
      throw new RelayAuthError("invalid_nostr_auth", 401);
    }
    await this.#request("nostr/login", {
      method: "POST",
      headers: {
        Authorization: `Nostr ${encodeBase64(JSON.stringify(event))}`,
      },
      body,
    });
    const session = await this.getSession();
    if (session.account.nostr_pubkey !== pubkey) {
      this.#session = undefined;
      throw new RelayAuthError("invalid_nostr_auth", 401);
    }
    return session;
  }

  async signEvent(
    template: NostrEventTemplate,
    expectedPubkey?: string,
  ): Promise<NostrEvent> {
    const payload = signedEventSchema.parse(
      await this.#request("events/sign", {
        method: "POST",
        body: JSON.stringify({ event: template }),
      }),
    );
    const pubkey = expectedPubkey ?? this.#session?.account.nostr_pubkey;
    if (
      pubkey === undefined ||
      payload.event.pubkey !== pubkey ||
      payload.event.kind !== template.kind ||
      payload.event.created_at !== template.created_at ||
      payload.event.content !== template.content ||
      canonicalJson(payload.event.tags as unknown as JsonValue) !==
        canonicalJson(template.tags as unknown as JsonValue) ||
      !verifyEvent(payload.event)
    ) {
      throw new RelayAuthError("invalid_signed_event", 502);
    }
    return payload.event;
  }

  async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    nostrPubkeySchema.parse(pubkey);
    const payload = z.object({ ciphertext: z.string() }).parse(
      await this.#request("nip44/encrypt", {
        method: "POST",
        body: JSON.stringify({ pubkey, plaintext }),
      }),
    );
    return payload.ciphertext;
  }

  async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    nostrPubkeySchema.parse(pubkey);
    const payload = z.object({ plaintext: z.string() }).parse(
      await this.#request("nip44/decrypt", {
        method: "POST",
        body: JSON.stringify({ pubkey, ciphertext }),
      }),
    );
    return payload.plaintext;
  }

  async signOut(): Promise<void> {
    await this.#request("logout", { method: "POST" });
    this.#session = undefined;
  }

  async #restoreAccount(): Promise<RelayAuthAccountResult> {
    const restored = await this.restore();
    if (restored.status === "anonymous") {
      throw new RelayAuthSessionExpiredError();
    }
    return restored;
  }

  #relayURL(): string {
    const relay = new URL(this.#origin);
    relay.protocol = relay.protocol === "https:" ? "wss:" : "ws:";
    return relay.toString().replace(/\/$/u, "");
  }

  onSessionExpired(listener: () => void): () => void {
    this.#sessionExpiredListeners.add(listener);
    return () => this.#sessionExpiredListeners.delete(listener);
  }

  async #resolveIdentity(
    methodId: string,
    credentials?: RelayAuthLoginCredentials,
  ): Promise<CommunitySigner> {
    if (this.#connectIdentity !== undefined) {
      const expectedPubkey = this.#session?.account.nostr_pubkey;
      return await this.#connectIdentity(
        methodId,
        credentials,
        expectedPubkey === undefined ? {} : { expectedPubkey },
      );
    }
    if (methodId === "browser-extension") return new Nip07RegistrySigner();
    throw new Error("This Nostr login method is not configured");
  }

  #consumeProviderReturnError(): string | undefined {
    try {
      const current = new URL(this.#currentUrl());
      const error = current.searchParams.get("auth_error");
      if (error === null) return undefined;
      current.searchParams.delete("auth_error");
      this.#replaceUrl(current.toString());
      return /^[a-z0-9_]{1,64}$/u.test(error)
        ? error
        : "provider_authentication_failed";
    } catch {
      return undefined;
    }
  }

  async #request(
    path: string,
    init: RequestInit,
    notifyUnauthorized = true,
  ): Promise<unknown> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await this.#fetch(
      new URL(`/api/auth/${path}`, this.#origin),
      {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const code = await readSafeErrorCode(response);
      if (response.status === 401 && code === "authentication_required") {
        this.#session = undefined;
        if (notifyUnauthorized) {
          for (const listener of this.#sessionExpiredListeners) listener();
        }
        throw new RelayAuthSessionExpiredError();
      }
      throw new RelayAuthError(code, response.status);
    }
    if (response.status === 204) return undefined;
    try {
      return await response.json();
    } catch {
      throw new RelayAuthError("invalid_relay_response", 502);
    }
  }
}

export async function decryptCustodyTransferEnvelope(
  session: CommunityAccountSession,
  envelope: z.infer<typeof custodyEnvelopeSchema>,
  deviceSecret: Uint8Array,
): Promise<Uint8Array> {
  const serverPublicKey = decodeBase64Url(envelope.server_public_key);
  const sealed = decodeBase64Url(envelope.encrypted_private_key);
  if (serverPublicKey.length !== 32 || sealed.length < 12 + 16) {
    throw new RelayAuthError("custody_transfer_failed", 502);
  }
  const shared = x25519.getSharedSecret(deviceSecret, serverPublicKey);
  const info = new TextEncoder().encode(
    `lapis-custody-transfer-v1\0${session.account.id}\0${envelope.transfer_id}\0${session.account.nostr_pubkey}`,
  );
  const keyBytes = hkdf(sha256, shared, undefined, info, 32);
  try {
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      keyBytes,
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const plaintext = new Uint8Array(
      await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: sealed.subarray(0, 12), additionalData: info },
        key,
        sealed.subarray(12),
      ),
    );
    if (
      plaintext.length !== 32 ||
      getPublicKey(plaintext) !== session.account.nostr_pubkey
    ) {
      plaintext.fill(0);
      throw new RelayAuthError("nip46_pubkey_mismatch", 409);
    }
    return plaintext;
  } catch (cause) {
    if (cause instanceof RelayAuthError) throw cause;
    throw new RelayAuthError("custody_transfer_failed", 502);
  } finally {
    shared.fill(0);
    keyBytes.fill(0);
  }
}

async function readSafeErrorCode(response: Response): Promise<string> {
  try {
    const payload = z
      .object({ error: z.string() })
      .safeParse(await response.json());
    if (payload.success && /^[a-z0-9_]{1,64}$/u.test(payload.data.error)) {
      return payload.data.error;
    }
  } catch {
    // The relay body is intentionally not included in the surfaced error.
  }
  return response.status === 401
    ? "authentication_required"
    : "relay_auth_failed";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}
