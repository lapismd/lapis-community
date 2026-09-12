import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { v2 as nip44 } from "nostr-tools/nip44";

import { canonicalJson } from "../protocol/index.js";
import type { JsonValue, NostrEvent } from "../protocol/index.js";

import type {
  CommunitySigner,
  Nip07Provider,
  Nip44Provider,
  NostrEventTemplate,
  RegistrySigner,
} from "./types.js";

export class SecretKeyRegistrySigner implements CommunitySigner {
  readonly #secretKey: Uint8Array;
  readonly nip44: Nip44Provider;
  #disposed = false;

  constructor(secretKey: Uint8Array) {
    if (secretKey.byteLength !== 32) {
      throw new Error("Nostr secret key must contain exactly 32 bytes");
    }
    this.#secretKey = secretKey.slice();
    this.nip44 = {
      encrypt: async (pubkey, plaintext) => {
        this.#assertActive();
        return nip44.encrypt(
          plaintext,
          nip44.utils.getConversationKey(this.#secretKey, pubkey),
        );
      },
      decrypt: async (pubkey, ciphertext) => {
        this.#assertActive();
        return nip44.decrypt(
          ciphertext,
          nip44.utils.getConversationKey(this.#secretKey, pubkey),
        );
      },
    };
  }

  async getPublicKey(): Promise<string> {
    this.#assertActive();
    return getPublicKey(this.#secretKey);
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    this.#assertActive();
    return finalizeEvent(template, this.#secretKey);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#secretKey.fill(0);
    this.#disposed = true;
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw new Error("The local signing key is no longer available");
    }
  }
}

export class Nip07RegistrySigner implements RegistrySigner {
  readonly #provider: Nip07Provider;
  readonly nip44?: Nip44Provider;

  constructor(provider?: Nip07Provider) {
    const discovered = provider ?? globalThis.window?.nostr;
    if (discovered === undefined) {
      throw new Error("No NIP-07 window.nostr provider is available");
    }
    this.#provider = discovered;
    if (discovered.nip44 !== undefined) this.nip44 = discovered.nip44;
  }

  async getPublicKey(): Promise<string> {
    return await this.#provider.getPublicKey();
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const expectedPubkey = await this.getPublicKey();
    const event = await this.#provider.signEvent(template);
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
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}
