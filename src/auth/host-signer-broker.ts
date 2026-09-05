import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";
import { generateSecretKey, verifyEvent } from "nostr-tools/pure";

import { canonicalJson } from "../protocol/index.js";
import type { JsonValue, NostrEvent } from "../protocol/index.js";

import { SecretKeyRegistrySigner } from "./signer.js";
import type { CommunitySigner, NostrEventTemplate } from "./types.js";

export type HostNostrSignerAccountKind = "local" | "nip46";

export interface HostNostrSignerAccount {
  id: string;
  label: string;
  pubkey: string;
  kind: HostNostrSignerAccountKind;
}

export interface HostNostrSignerContext {
  pluginId: string;
}

export interface HostNostrProfileCreationRequest {
  displayName?: string;
}

export interface HostNostrRemoteSignerRequest {
  bunkerUrl: string;
  label?: string;
}

export type HostNostrSignerAction =
  | "list-accounts"
  | "create-profile"
  | "connect-remote-signer"
  | "get-public-key"
  | "sign-event"
  | "nip44-encrypt"
  | "nip44-decrypt"
  | "close";

export interface HostNostrSignerPermissionRequest {
  pluginId: string;
  action: HostNostrSignerAction;
  account?: HostNostrSignerAccount;
}

export interface HostNostrSignerAccountStore {
  list(): Promise<HostNostrSignerAccount[]>;
  get(accountId: string): Promise<HostNostrSignerAccount | null>;
  put(account: HostNostrSignerAccount): Promise<void>;
}

/**
 * Host implementation backed by an OS keychain or equivalent secure store.
 * Values contain local secret keys or NIP-46 client credentials and must never
 * be placed in ordinary plugin settings, logs, or renderer-visible storage.
 */
export interface HostNostrSignerCredentialStore {
  get(accountId: string): Promise<string | null>;
  put(accountId: string, credential: string): Promise<void>;
  delete(accountId: string): Promise<void>;
}

export interface ConnectedNip46Signer extends CommunitySigner {
  close(): Promise<void>;
}

export interface HostNostrNip46Factory {
  connect(options: {
    bunkerUrl: string;
    clientSecretKey: Uint8Array;
  }): Promise<ConnectedNip46Signer>;
}

export interface HostOwnedNostrSignerBrokerOptions {
  accounts: HostNostrSignerAccountStore;
  credentials: HostNostrSignerCredentialStore;
  authorize(request: HostNostrSignerPermissionRequest): Promise<boolean>;
  nip46?: HostNostrNip46Factory;
  onRemoteAuthRequired?: (url: string) => void;
  randomId?: () => string;
}

interface LocalCredential {
  version: 1;
  kind: "local";
  secretKeyHex: string;
}

interface Nip46Credential {
  version: 1;
  kind: "nip46";
  bunkerUrl: string;
  clientSecretKeyHex: string;
}

type StoredCredential = LocalCredential | Nip46Credential;

/**
 * Implements the structural `NostrSignerBroker` contract exposed by the Lapis
 * host without importing host internals. Plugins only receive opaque account
 * records and signed results; all credential reads remain inside this class.
 */
export class HostOwnedNostrSignerBroker {
  readonly #options: HostOwnedNostrSignerBrokerOptions;
  readonly #nip46: HostNostrNip46Factory;
  readonly #remoteSessions = new Map<string, ConnectedNip46Signer>();

  constructor(options: HostOwnedNostrSignerBrokerOptions) {
    this.#options = options;
    this.#nip46 =
      options.nip46 ??
      new DefaultHostNostrNip46Factory(options.onRemoteAuthRequired);
  }

  async listAccounts(
    context: HostNostrSignerContext,
  ): Promise<HostNostrSignerAccount[]> {
    await this.#requirePermission(context, "list-accounts");
    return (await this.#options.accounts.list()).map((account) => ({
      ...account,
    }));
  }

  async requestProfileCreation(
    context: HostNostrSignerContext,
    request: HostNostrProfileCreationRequest,
  ): Promise<HostNostrSignerAccount> {
    await this.#requirePermission(context, "create-profile");
    const secretKey = generateSecretKey();
    const signer = new SecretKeyRegistrySigner(secretKey);
    const pubkey = await signer.getPublicKey();
    const account: HostNostrSignerAccount = {
      id: this.#createId(),
      label: normalizeLabel(request.displayName, "Nostr profile"),
      pubkey,
      kind: "local",
    };
    const credential: LocalCredential = {
      version: 1,
      kind: "local",
      secretKeyHex: encodeHex(secretKey),
    };
    await this.#persistAccount(account, credential);
    return { ...account };
  }

  async connectRemoteSigner(
    context: HostNostrSignerContext,
    request: HostNostrRemoteSignerRequest,
  ): Promise<HostNostrSignerAccount> {
    await this.#requirePermission(context, "connect-remote-signer");
    if (!request.bunkerUrl.trim()) {
      throw new TypeError("bunkerUrl is required");
    }
    const clientSecretKey = generateSecretKey();
    const signer = await this.#nip46.connect({
      bunkerUrl: request.bunkerUrl,
      clientSecretKey,
    });
    const pubkey = await signer.getPublicKey();
    assertPubkey(pubkey);
    const account: HostNostrSignerAccount = {
      id: this.#createId(),
      label: normalizeLabel(request.label, "Remote Nostr signer"),
      pubkey,
      kind: "nip46",
    };
    const credential: Nip46Credential = {
      version: 1,
      kind: "nip46",
      bunkerUrl: request.bunkerUrl,
      clientSecretKeyHex: encodeHex(clientSecretKey),
    };
    try {
      await this.#persistAccount(account, credential);
      this.#remoteSessions.set(account.id, signer);
    } catch (error) {
      await signer.close();
      throw error;
    }
    return { ...account };
  }

  async getPublicKey(
    context: HostNostrSignerContext,
    accountId: string,
  ): Promise<string> {
    const account = await this.#requireAccount(
      context,
      accountId,
      "get-public-key",
    );
    return account.pubkey;
  }

  async signEvent(
    context: HostNostrSignerContext,
    accountId: string,
    event: NostrEventTemplate,
  ): Promise<NostrEvent> {
    const account = await this.#requireAccount(
      context,
      accountId,
      "sign-event",
    );
    const signer = await this.#resolveSigner(account);
    const signed = await signer.signEvent(cloneTemplate(event));
    assertSignedEvent(account, event, signed);
    return signed;
  }

  async nip44Encrypt(
    context: HostNostrSignerContext,
    accountId: string,
    pubkey: string,
    plaintext: string,
  ): Promise<string> {
    const account = await this.#requireAccount(
      context,
      accountId,
      "nip44-encrypt",
    );
    assertPubkey(pubkey);
    const signer = await this.#resolveSigner(account);
    if (!signer.nip44)
      throw new Error("The selected signer does not support NIP-44");
    return signer.nip44.encrypt(pubkey, plaintext);
  }

  async nip44Decrypt(
    context: HostNostrSignerContext,
    accountId: string,
    pubkey: string,
    ciphertext: string,
  ): Promise<string> {
    const account = await this.#requireAccount(
      context,
      accountId,
      "nip44-decrypt",
    );
    assertPubkey(pubkey);
    const signer = await this.#resolveSigner(account);
    if (!signer.nip44)
      throw new Error("The selected signer does not support NIP-44");
    return signer.nip44.decrypt(pubkey, ciphertext);
  }

  async close(
    context: HostNostrSignerContext,
    accountId: string,
  ): Promise<void> {
    const account = await this.#requireAccount(context, accountId, "close");
    if (account.kind !== "nip46") return;
    const signer = this.#remoteSessions.get(account.id);
    this.#remoteSessions.delete(account.id);
    await signer?.close();
  }

  async #requireAccount(
    context: HostNostrSignerContext,
    accountId: string,
    action: HostNostrSignerAction,
  ): Promise<HostNostrSignerAccount> {
    const account = await this.#options.accounts.get(accountId);
    if (!account) throw new Error(`Unknown Nostr signer account: ${accountId}`);
    await this.#requirePermission(context, action, account);
    return account;
  }

  async #requirePermission(
    context: HostNostrSignerContext,
    action: HostNostrSignerAction,
    account?: HostNostrSignerAccount,
  ): Promise<void> {
    if (!context.pluginId.trim()) throw new TypeError("pluginId is required");
    const allowed = await this.#options.authorize({
      pluginId: context.pluginId,
      action,
      ...(account ? { account: { ...account } } : {}),
    });
    if (!allowed) {
      throw new Error(
        `Nostr signer permission denied for ${context.pluginId}: ${action}`,
      );
    }
  }

  async #persistAccount(
    account: HostNostrSignerAccount,
    credential: StoredCredential,
  ): Promise<void> {
    await this.#options.credentials.put(account.id, JSON.stringify(credential));
    try {
      await this.#options.accounts.put(account);
    } catch (error) {
      await this.#options.credentials.delete(account.id);
      throw error;
    }
  }

  async #resolveSigner(
    account: HostNostrSignerAccount,
  ): Promise<CommunitySigner> {
    const credential = parseCredential(
      await this.#options.credentials.get(account.id),
      account.kind,
    );
    if (credential.kind === "local") {
      return new SecretKeyRegistrySigner(
        decodeSecretKey(credential.secretKeyHex),
      );
    }
    const cached = this.#remoteSessions.get(account.id);
    if (cached) return cached;
    const signer = await this.#nip46.connect({
      bunkerUrl: credential.bunkerUrl,
      clientSecretKey: decodeSecretKey(credential.clientSecretKeyHex),
    });
    const pubkey = await signer.getPublicKey();
    if (pubkey !== account.pubkey) {
      await signer.close();
      throw new Error(
        "Remote signer public key changed for the stored account",
      );
    }
    this.#remoteSessions.set(account.id, signer);
    return signer;
  }

  #createId(): string {
    return this.#options.randomId?.() ?? crypto.randomUUID();
  }
}

class DefaultHostNostrNip46Factory implements HostNostrNip46Factory {
  constructor(readonly onauth?: (url: string) => void) {}

  async connect(options: {
    bunkerUrl: string;
    clientSecretKey: Uint8Array;
  }): Promise<ConnectedNip46Signer> {
    const pointer = await parseBunkerInput(options.bunkerUrl);
    if (!pointer) throw new Error("Invalid NIP-46 bunker URL or identifier");
    const signer = BunkerSigner.fromBunker(options.clientSecretKey, pointer, {
      ...(this.onauth ? { onauth: this.onauth } : {}),
    });
    await signer.connect({ name: "Lapis" });
    return {
      getPublicKey: () => signer.getPublicKey(),
      signEvent: (event) => signer.signEvent(event),
      nip44: {
        encrypt: (pubkey, plaintext) => signer.nip44Encrypt(pubkey, plaintext),
        decrypt: (pubkey, ciphertext) =>
          signer.nip44Decrypt(pubkey, ciphertext),
      },
      close: () => signer.close(),
    };
  }
}

function parseCredential(
  serialized: string | null,
  expectedKind: HostNostrSignerAccountKind,
): StoredCredential {
  if (!serialized) throw new Error("Nostr signer credential is unavailable");
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("Nostr signer credential is invalid");
  }
  if (!isRecord(value) || value.version !== 1 || value.kind !== expectedKind) {
    throw new Error("Nostr signer credential is invalid");
  }
  if (value.kind === "local" && typeof value.secretKeyHex === "string") {
    return { version: 1, kind: "local", secretKeyHex: value.secretKeyHex };
  }
  if (
    value.kind === "nip46" &&
    typeof value.bunkerUrl === "string" &&
    typeof value.clientSecretKeyHex === "string"
  ) {
    return {
      version: 1,
      kind: "nip46",
      bunkerUrl: value.bunkerUrl,
      clientSecretKeyHex: value.clientSecretKeyHex,
    };
  }
  throw new Error("Nostr signer credential is invalid");
}

const cloneTemplate = (event: NostrEventTemplate): NostrEventTemplate => ({
  kind: event.kind,
  created_at: event.created_at,
  content: event.content,
  tags: event.tags.map((tag) => [...tag]),
});

function assertSignedEvent(
  account: HostNostrSignerAccount,
  requested: NostrEventTemplate,
  signed: NostrEvent,
): void {
  if (
    signed.pubkey !== account.pubkey ||
    signed.kind !== requested.kind ||
    signed.created_at !== requested.created_at ||
    signed.content !== requested.content ||
    canonicalJson(signed.tags as unknown as JsonValue) !==
      canonicalJson(requested.tags as unknown as JsonValue) ||
    !verifyEvent(signed)
  ) {
    throw new Error("Signer returned an invalid or changed event");
  }
}

function assertPubkey(pubkey: string): void {
  if (!/^[0-9a-f]{64}$/.test(pubkey)) {
    throw new TypeError(
      "Nostr public key must be 64 lowercase hexadecimal characters",
    );
  }
}

function decodeSecretKey(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error("Nostr signer credential contains an invalid secret key");
  }
  return Uint8Array.from(value.match(/../g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

const encodeHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const normalizeLabel = (value: string | undefined, fallback: string): string =>
  value?.trim() || fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
