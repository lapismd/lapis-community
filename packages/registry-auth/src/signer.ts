import { verifyEvent } from "nostr-tools/pure";

import { canonicalJson } from "@lapismd/registry-protocol";
import type { JsonValue, NostrEvent } from "@lapismd/registry-protocol";

import type {
  Nip07Provider,
  Nip46RpcClient,
  Nip55Bridge,
  Nip55Connection,
  Nip55Permission,
  NostrEventTemplate,
  RegistryPrivateSigner,
  RegistrySigner,
} from "./types.js";

function assertSignedTemplate(
  template: NostrEventTemplate,
  event: NostrEvent,
  expectedPubkey: string,
): NostrEvent {
  if (
    event.pubkey !== expectedPubkey ||
    event.kind !== template.kind ||
    event.created_at !== template.created_at ||
    event.content !== template.content ||
    canonicalJson(event.tags as unknown as JsonValue) !==
      canonicalJson(template.tags as unknown as JsonValue) ||
    !verifyEvent(event)
  ) {
    throw new Error(
      "Signer returned an event that does not match the requested template",
    );
  }
  return event;
}

export class Nip07RegistrySigner implements RegistrySigner {
  readonly #provider: Nip07Provider;

  constructor(provider?: Nip07Provider) {
    const discovered = provider ?? globalThis.window?.nostr;
    if (discovered === undefined) {
      throw new Error("No NIP-07 window.nostr provider is available");
    }
    this.#provider = discovered;
  }

  async getPublicKey(): Promise<string> {
    return await this.#provider.getPublicKey();
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const expectedPubkey = await this.getPublicKey();
    return assertSignedTemplate(
      template,
      await this.#provider.signEvent(template),
      expectedPubkey,
    );
  }

  async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    if (this.#provider.nip44 === undefined) {
      throw new Error("NIP-07 signer does not support NIP-44 encryption");
    }
    return await this.#provider.nip44.encrypt(pubkey, plaintext);
  }

  async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    if (this.#provider.nip44 === undefined) {
      throw new Error("NIP-07 signer does not support NIP-44 decryption");
    }
    return await this.#provider.nip44.decrypt(pubkey, ciphertext);
  }
}

export class Nip46RegistrySigner implements RegistrySigner {
  readonly #rpc: Nip46RpcClient;

  constructor(rpc: Nip46RpcClient) {
    this.#rpc = rpc;
  }

  async getPublicKey(): Promise<string> {
    return await this.#rpc.request("get_public_key", []);
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const expectedPubkey = await this.getPublicKey();
    const result = await this.#rpc.request("sign_event", [
      JSON.stringify(template),
    ]);
    return assertSignedTemplate(
      template,
      JSON.parse(result) as NostrEvent,
      expectedPubkey,
    );
  }

  async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    return await this.#rpc.request("nip44_encrypt", [pubkey, plaintext]);
  }

  async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    return await this.#rpc.request("nip44_decrypt", [pubkey, ciphertext]);
  }

  async close(): Promise<void> {
    await this.#rpc.close?.();
  }
}

export class Nip55RegistrySigner implements RegistrySigner {
  readonly #bridge: Nip55Bridge;
  readonly #connection: Nip55Connection;
  readonly #allowedKinds: ReadonlySet<number> | undefined;
  readonly #canEncrypt: boolean;
  readonly #canDecrypt: boolean;
  #closed = false;

  private constructor(
    bridge: Nip55Bridge,
    connection: Nip55Connection,
    permissions: readonly Nip55Permission[],
  ) {
    if (!/^[0-9a-f]{64}$/u.test(connection.pubkey)) {
      throw new Error("NIP-55 signer returned an invalid public key");
    }
    if (connection.packageName.trim().length === 0) {
      throw new Error("NIP-55 signer returned an invalid package name");
    }
    this.#bridge = bridge;
    this.#connection = connection;
    const kinds = permissions
      .map((permission) =>
        permission.type === "sign_event" ? permission.kind : undefined,
      )
      .filter((kind): kind is number => kind !== undefined);
    this.#allowedKinds = kinds.length === 0 ? undefined : new Set(kinds);
    this.#canEncrypt = permissions.some(
      (permission) => permission.type === "nip44_encrypt",
    );
    this.#canDecrypt = permissions.some(
      (permission) => permission.type === "nip44_decrypt",
    );
  }

  static async connect(
    bridge: Nip55Bridge,
    permissions: readonly Nip55Permission[],
  ): Promise<Nip55RegistrySigner> {
    const connection = await bridge.connect(permissions);
    return new Nip55RegistrySigner(bridge, connection, permissions);
  }

  async getPublicKey(): Promise<string> {
    this.#assertOpen();
    return this.#connection.pubkey;
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    this.#assertOpen();
    if (
      this.#allowedKinds !== undefined &&
      !this.#allowedKinds.has(template.kind)
    ) {
      throw new Error(`NIP-55 session did not request kind ${template.kind}`);
    }
    const event = await this.#bridge.signEvent({
      packageName: this.#connection.packageName,
      pubkey: this.#connection.pubkey,
      template,
    });
    this.#assertOpen();
    return assertSignedTemplate(template, event, this.#connection.pubkey);
  }

  async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    this.#assertOpen();
    if (!this.#canEncrypt || this.#bridge.nip44Encrypt === undefined) {
      throw new Error("NIP-55 session does not permit NIP-44 encryption");
    }
    return await this.#bridge.nip44Encrypt({
      packageName: this.#connection.packageName,
      pubkey: this.#connection.pubkey,
      recipientPubkey: pubkey,
      plaintext,
    });
  }

  async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    this.#assertOpen();
    if (!this.#canDecrypt || this.#bridge.nip44Decrypt === undefined) {
      throw new Error("NIP-55 session does not permit NIP-44 decryption");
    }
    return await this.#bridge.nip44Decrypt({
      packageName: this.#connection.packageName,
      pubkey: this.#connection.pubkey,
      senderPubkey: pubkey,
      ciphertext,
    });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#bridge.disconnect?.(this.#connection);
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("NIP-55 signer session is disconnected");
    }
  }
}

export class RegistrySignerSession implements RegistryPrivateSigner {
  readonly #signer: RegistrySigner;
  readonly #expiresAt: number;
  readonly #now: () => number;
  #generation = 0;
  #closed = false;

  constructor(
    signer: RegistrySigner,
    options: { expiresAt: number; now?: () => number },
  ) {
    this.#signer = signer;
    this.#expiresAt = options.expiresAt;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  }

  async getPublicKey(): Promise<string> {
    const generation = this.#assertActive();
    const pubkey = await this.#signer.getPublicKey();
    this.#assertCurrent(generation);
    return pubkey;
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const generation = this.#assertActive();
    const event = await this.#signer.signEvent(template);
    this.#assertCurrent(generation);
    return event;
  }

  async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    const generation = this.#assertActive();
    const privateSigner = this.#privateSigner();
    const ciphertext = await privateSigner.nip44Encrypt(pubkey, plaintext);
    this.#assertCurrent(generation);
    return ciphertext;
  }

  async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    const generation = this.#assertActive();
    const privateSigner = this.#privateSigner();
    const plaintext = await privateSigner.nip44Decrypt(pubkey, ciphertext);
    this.#assertCurrent(generation);
    return plaintext;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#generation += 1;
    await this.#signer.close?.();
  }

  #assertActive(): number {
    if (this.#closed) {
      throw new Error("Registry signer session is closed");
    }
    if (this.#now() >= this.#expiresAt) {
      throw new Error("Registry signer session has expired");
    }
    return this.#generation;
  }

  #assertCurrent(generation: number): void {
    if (
      this.#closed ||
      generation !== this.#generation ||
      this.#now() >= this.#expiresAt
    ) {
      throw new Error("Registry signer request became stale");
    }
  }

  #privateSigner(): RegistryPrivateSigner {
    if (
      !("nip44Encrypt" in this.#signer) ||
      !("nip44Decrypt" in this.#signer)
    ) {
      throw new Error("Registry signer does not support NIP-44");
    }
    return this.#signer as RegistryPrivateSigner;
  }
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}
